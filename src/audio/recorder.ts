/**
 * Thu giọng ba mẹ bằng `MediaRecorder` (05 §1, §6 mục 7–8; 04 §4).
 *
 * - Dò định dạng theo thứ tự `audio/mp4` → `audio/webm;codecs=opus` (Safari iOS
 *   chỉ hỗ trợ mp4; Chrome/Firefox hỗ trợ webm/opus).
 * - Giới hạn 5 giây mỗi clip (01 §4 F-03).
 * - Tính `gain` chuẩn hóa đỉnh về −3 dBFS để lưu vào `MediaAsset.gain`.
 * - `analyseAudioBlob` dùng chung cho cả file ba mẹ nhập từ ngoài.
 *
 * Giọng ba mẹ **luôn thu thật**, không tổng hợp (04 §4).
 */

import { PEAK_TARGET_VOICE_DBFS, normalisationGain, peakOfBuffer, peakOfSamples } from './normalize'
import { createAudioContext, getAudioContextCtor } from './unlock'

/** Giới hạn cứng: 5 giây. */
export const MAX_RECORDING_MS = 5000

/** Thứ tự dò định dạng ghi âm (05 §6 mục 7). */
export const RECORDING_MIME_CANDIDATES: readonly string[] = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
]

export type RecorderErrorCode = 'denied' | 'unsupported' | 'no_recording'

export class RecorderError extends Error {
  readonly code: RecorderErrorCode

  constructor(code: RecorderErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
    // Giữ `name` chuẩn DOM cho trường hợp bị từ chối quyền micro.
    this.name = code === 'denied' ? 'NotAllowedError' : 'RecorderError'
  }
}

export interface AudioAnalysis {
  durationMs: number
  /** Gain chuẩn hóa đỉnh về −3 dBFS. */
  gain: number
  mime: string
}

export interface RecordingResult {
  blob: Blob
  mime: string
  durationMs: number
  gain: number
}

export interface StartRecordingOptions {
  /** Rút ngắn thời lượng tối đa (không bao giờ vượt `MAX_RECORDING_MS`). */
  maxMs?: number
  /** Mức âm hiện tại 0..1 để vẽ thanh sóng (gọi ~20 lần/giây). */
  onLevel?: (level01: number) => void
  /** Thời gian đã thu, ms. */
  onTick?: (elapsedMs: number) => void
  /** Gọi khi tự động dừng vì chạm giới hạn thời gian. */
  onAutoStop?: () => void
}

export interface RecordingHandle {
  readonly mime: string
  readonly maxMs: number
  readonly startedAt: number
}

interface ActiveRecording extends RecordingHandle {
  recorder: MediaRecorder
  stream: MediaStream
  chunks: Blob[]
  stopped: Promise<void>
  timer: ReturnType<typeof setTimeout> | undefined
  meterTimer: ReturnType<typeof setInterval> | undefined
  meterCtx: AudioContext | undefined
  cancelled: boolean
}

let active: ActiveRecording | null = null

// ------------------------------------------------------------------ hỗ trợ

interface WindowWithRecorder {
  MediaRecorder?: typeof MediaRecorder
}

function getRecorderCtor(): typeof MediaRecorder | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as WindowWithRecorder).MediaRecorder
}

/**
 * Chọn định dạng đầu tiên được hỗ trợ.
 * Tách riêng (nhận hàm kiểm tra) để test được không cần trình duyệt thật.
 */
export function pickRecordingMime(
  isSupported: (mime: string) => boolean,
  candidates: readonly string[] = RECORDING_MIME_CANDIDATES,
): string | undefined {
  for (const mime of candidates) {
    try {
      if (isSupported(mime)) return mime
    } catch {
      // isTypeSupported ném với chuỗi lạ: thử định dạng kế tiếp.
    }
  }
  return undefined
}

/** Thiết bị này thu âm được hay không. */
export function canRecord(): boolean {
  if (typeof navigator === 'undefined') return false
  const Ctor = getRecorderCtor()
  if (!Ctor) return false
  const media = navigator.mediaDevices
  return typeof media?.getUserMedia === 'function'
}

/** Đang có bản thu chạy hay không. */
export function isRecording(): boolean {
  return active !== null && !active.cancelled
}

// ------------------------------------------------------------------- thu âm

export async function startRecording(opts: StartRecordingOptions = {}): Promise<RecordingHandle> {
  if (active) cancelRecording()
  if (!canRecord()) throw new RecorderError('unsupported', 'Thiết bị không thu âm được.')

  const Ctor = getRecorderCtor()
  if (!Ctor) throw new RecorderError('unsupported', 'Thiết bị không thu âm được.')

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch (err) {
    throw toRecorderError(err)
  }

  const mime = pickRecordingMime((m) => Ctor.isTypeSupported(m))
  let recorder: MediaRecorder
  try {
    recorder = mime
      ? new Ctor(stream, { mimeType: mime, audioBitsPerSecond: 96_000 })
      : new Ctor(stream)
  } catch {
    stopStream(stream)
    throw new RecorderError('unsupported', 'Trình duyệt không hỗ trợ định dạng ghi âm nào.')
  }

  const chunks: Blob[] = []
  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => resolve()
  })

  const maxMs = Math.min(MAX_RECORDING_MS, Math.max(500, opts.maxMs ?? MAX_RECORDING_MS))
  const startedAt = Date.now()
  const rec: ActiveRecording = {
    mime: mime ?? recorder.mimeType ?? '',
    maxMs,
    startedAt,
    recorder,
    stream,
    chunks,
    stopped,
    timer: undefined,
    meterTimer: undefined,
    meterCtx: undefined,
    cancelled: false,
  }
  active = rec

  recorder.start()

  rec.timer = setTimeout(() => {
    if (active !== rec || rec.cancelled) return
    if (rec.recorder.state !== 'inactive') rec.recorder.stop()
    // Dừng đồng hồ/đo mức, nhưng GIỮ `active` để `stopRecording()` vẫn trả clip.
    stopMeter(rec)
    opts.onTick?.(rec.maxMs)
    opts.onAutoStop?.()
  }, maxMs)

  if (opts.onLevel || opts.onTick) startMeter(rec, opts)

  return { mime: rec.mime, maxMs: rec.maxMs, startedAt: rec.startedAt }
}

/** Dừng thu và trả clip đã phân tích. `handle` là tùy chọn. */
export async function stopRecording(handle?: RecordingHandle): Promise<RecordingResult> {
  const rec = active
  if (!rec || (handle && handle.startedAt !== rec.startedAt)) {
    throw new RecorderError('no_recording', 'Không có bản thu nào đang chạy.')
  }
  active = null
  clearTimeout(rec.timer)
  stopMeter(rec)

  if (rec.recorder.state !== 'inactive') {
    try {
      rec.recorder.stop()
    } catch {
      // recorder đã dừng
    }
  }
  await rec.stopped
  stopStream(rec.stream)

  const elapsedMs = Math.min(Date.now() - rec.startedAt, rec.maxMs)
  const type = rec.mime || rec.chunks[0]?.type || 'audio/mp4'
  const blob = new Blob(rec.chunks, { type })
  if (blob.size === 0) {
    throw new RecorderError('unsupported', 'Bản thu rỗng.')
  }

  let durationMs = elapsedMs
  let gain = 1
  try {
    const analysis = await analyseAudioBlob(blob)
    durationMs = Math.min(analysis.durationMs || elapsedMs, MAX_RECORDING_MS)
    gain = analysis.gain
  } catch {
    // Không giải mã được ngay sau khi thu (hiếm): giữ thời lượng theo đồng hồ.
  }

  return { blob, mime: type, durationMs, gain }
}

/** Hủy bản thu đang chạy, không trả kết quả. */
export function cancelRecording(handle?: RecordingHandle): void {
  const rec = active
  if (!rec) return
  if (handle && handle.startedAt !== rec.startedAt) return
  active = null
  rec.cancelled = true
  clearTimeout(rec.timer)
  stopMeter(rec)
  try {
    if (rec.recorder.state !== 'inactive') rec.recorder.stop()
  } catch {
    // recorder đã dừng
  }
  stopStream(rec.stream)
}

// ---------------------------------------------------------------- phân tích

/**
 * Giải mã clip để lấy thời lượng và gain chuẩn hóa (−3 dBFS).
 * Dùng cho cả bản thu trong app lẫn file ba mẹ nhập từ ngoài.
 */
export async function analyseAudioBlob(blob: Blob): Promise<AudioAnalysis> {
  const data = await blob.arrayBuffer()
  const ctx = createDecodeContext()
  if (!ctx) throw new RecorderError('unsupported', 'Trình duyệt không giải mã được âm thanh.')
  let buffer: AudioBuffer
  try {
    buffer = await decodeAudioData(ctx, data)
  } catch {
    throw new RecorderError('unsupported', 'Không đọc được file âm thanh này.')
  } finally {
    closeContext(ctx)
  }
  const peak = peakOfBuffer(buffer)
  return {
    durationMs: Math.round(buffer.duration * 1000),
    gain: normalisationGain(peak, { targetDbfs: PEAK_TARGET_VOICE_DBFS }),
    mime: blob.type || 'audio/mp4',
  }
}

// ------------------------------------------------------------------ nội bộ

/** Đo mức âm từ luồng micro; trả hàm đọc đỉnh 0..1 (không có thì trả undefined). */
function createLevelMeter(stream: MediaStream): { ctx: AudioContext; read: () => number } | undefined {
  let ctx: AudioContext
  try {
    ctx = createAudioContext()
  } catch {
    return undefined
  }
  try {
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    void ctx.resume().catch(() => undefined)
    return {
      ctx,
      read: () => {
        analyser.getFloatTimeDomainData(samples)
        return Math.min(1, peakOfSamples(samples))
      },
    }
  } catch {
    closeContext(ctx)
    return undefined
  }
}

function startMeter(rec: ActiveRecording, opts: StartRecordingOptions): void {
  const onLevel = opts.onLevel
  const meter = onLevel ? createLevelMeter(rec.stream) : undefined
  rec.meterCtx = meter?.ctx
  rec.meterTimer = setInterval(() => {
    opts.onTick?.(Math.min(Date.now() - rec.startedAt, rec.maxMs))
    if (meter && onLevel) onLevel(meter.read())
  }, 50)
}

function stopMeter(rec: ActiveRecording): void {
  clearInterval(rec.meterTimer)
  rec.meterTimer = undefined
  const ctx = rec.meterCtx
  rec.meterCtx = undefined
  if (ctx) closeContext(ctx)
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // track đã dừng
    }
  }
}

type DecodeContext = AudioContext | OfflineAudioContext

function createDecodeContext(): DecodeContext | null {
  if (typeof OfflineAudioContext === 'function') {
    try {
      return new OfflineAudioContext(1, 1, 48_000)
    } catch {
      // Safari cũ: rơi xuống AudioContext thường.
    }
  }
  if (!getAudioContextCtor()) return null
  try {
    return createAudioContext()
  } catch {
    return null
  }
}

function closeContext(ctx: DecodeContext): void {
  const closable = ctx as { close?: () => Promise<void>; state?: string }
  if (typeof closable.close !== 'function' || closable.state === 'closed') return
  void closable.close().catch(() => undefined)
}

function decodeAudioData(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((resolve, reject) => {
    const maybe: Promise<AudioBuffer> | undefined = ctx.decodeAudioData(
      data,
      (buffer) => resolve(buffer),
      (err) => reject(err instanceof Error ? err : new Error('decode-failed')),
    )
    void maybe?.catch(() => undefined)
  })
}

function toRecorderError(err: unknown): RecorderError {
  const name = err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return new RecorderError('denied', 'Chưa có quyền dùng micro.')
  }
  return new RecorderError('unsupported', 'Không mở được micro trên thiết bị này.')
}
