/**
 * AudioManager — phát âm bằng Web Audio API trực tiếp (05 §1, §3; 04 §4).
 *
 * Trách nhiệm: mở khóa trên iOS, giải mã Blob từ IndexedDB thành AudioBuffer,
 * phát (có fade, gain theo clip), ducking khi giọng ba mẹ đang nói, hàng chờ,
 * và phục hồi sau gián đoạn.
 *
 * **Không có API nào phát âm báo sai** (04 §4, 01 §5.4): module này chỉ phát
 * clip do ba mẹ thu, tiếng kêu con vật, "ting" của sao và nhạc tiệc.
 */

import type { AudioRole } from '@/data/types'
import {
  DUCK_DB,
  MIN_RAMP_GAIN,
  clampVolume,
  dbToGain,
} from './normalize'
import { ToneGenerator, type StarToneIndex } from './tones'
import { playCheer, type CheerLevel } from './cheer'
import {
  createAudioContext,
  isAudioSupported,
  isContextRunning,
  observeContextInterruptions,
  unlockContext,
  type AudioInterruptionReason,
} from './unlock'

/** Fade vào 20 ms, ra 50 ms (04 §4 — chống tiếng "tách"). */
export const FADE_IN_S = 0.02
export const FADE_OUT_S = 0.05
/** Phát đồng thời ≤ 3 âm (04 §4). */
export const MAX_CONCURRENT = 3
/** Khoảng cách tối thiểu giữa hai sự kiện âm trong một chuỗi (04 §4). */
export const MIN_GAP_MS = 300

const DUCK_GAIN = dbToGain(DUCK_DB)

export interface PreloadEntry {
  /** Khóa cache, thường là `MediaAsset.id`. */
  id: string
  blob: Blob
  /** Gain chuẩn hóa đã lưu theo clip (`MediaAsset.gain`). */
  gain?: number
}

export interface PlayOptions {
  /** Ghi đè gain của clip (0..1). */
  gain?: number
  /** Clip này có hạ âm lượng các âm khác không (mặc định theo `role`). */
  duck?: boolean
  /** Vai của clip; `instruction`/`praise` tự động ducking. */
  role?: AudioRole
}

export interface PlaySeqOptions extends PlayOptions {
  /** Khoảng nghỉ giữa các clip (mặc định 300 ms). */
  gapMs?: number
}

export type InterruptionListener = (reason: AudioInterruptionReason) => void
export type ReadyListener = (ready: boolean) => void

interface CachedBuffer {
  buffer: AudioBuffer
  gain: number
}

interface ActiveSound {
  source: AudioBufferSourceNode
  gain: GainNode
  ducks: boolean
  startedAt: number
  stop: () => void
}

/** Vai nào được coi là "giọng ba mẹ" và làm các âm khác hạ 8 dB. */
export function isVoiceRole(role: AudioRole | undefined): boolean {
  return role === 'instruction' || role === 'praise'
}

export class AudioManager {
  #ctx: AudioContext | null = null
  #master: GainNode | null = null
  /** Giọng ba mẹ: không bị ducking. */
  #voiceBus: GainNode | null = null
  /** Mọi âm khác: đi qua nút ducking. */
  #sfxBus: GainNode | null = null
  /** Nhạc tiệc: có âm lượng riêng, cũng bị ducking khi có giọng ba mẹ. */
  #partyBus: GainNode | null = null
  #duckBus: GainNode | null = null
  #tones: ToneGenerator | null = null
  #stopWatching: (() => void) | null = null

  #masterVolume = 0.6
  #partyVolume = 0.6
  #unlocked = false
  #ready = false
  #manualDuck = false

  readonly #buffers = new Map<string, CachedBuffer>()
  readonly #active = new Set<ActiveSound>()
  readonly #decoding = new Map<string, Promise<void>>()
  readonly #interruptListeners = new Set<InterruptionListener>()
  readonly #readyListeners = new Set<ReadyListener>()

  // ----------------------------------------------------------- vòng đời

  /** Trình duyệt có Web Audio hay không. */
  isSupported(): boolean {
    return isAudioSupported()
  }

  /**
   * Mở khóa âm thanh. **Phải gọi trong handler chạm** (màn S01
   * "chạm để bắt đầu" / "chạm để tiếp tục").
   */
  async unlock(): Promise<void> {
    const ctx = this.#ensureContext()
    if (!ctx) return
    await unlockContext(ctx)
    this.#unlocked = isContextRunning(ctx)
    this.#setReady(isContextRunning(ctx), null)
  }

  /** Âm thanh đã mở khóa và context đang chạy. */
  isReady(): boolean {
    return this.#ready && this.#unlocked && isContextRunning(this.#ctx)
  }

  /** Đăng ký nhận báo khi âm thanh bị ngắt (UI hiện lại màn "chạm để tiếp tục"). */
  onInterrupted(cb: InterruptionListener): () => void {
    this.#interruptListeners.add(cb)
    return () => {
      this.#interruptListeners.delete(cb)
    }
  }

  /** Đăng ký nhận báo mỗi khi trạng thái sẵn sàng đổi. */
  onReadyChange(cb: ReadyListener): () => void {
    this.#readyListeners.add(cb)
    return () => {
      this.#readyListeners.delete(cb)
    }
  }

  // ------------------------------------------------------------ âm lượng

  /** Âm lượng tổng (0..1), mặc định 0,6 (GĐ-09). */
  setMasterVolume(v: number): void {
    this.#masterVolume = clampVolume(v)
    this.#rampGain(this.#master, this.#masterVolume)
  }

  getMasterVolume(): number {
    return this.#masterVolume
  }

  /** Âm lượng riêng của màn tiệc (0..1). */
  setPartyVolume(v: number): void {
    this.#partyVolume = clampVolume(v)
    this.#rampGain(this.#partyBus, this.#partyVolume)
  }

  getPartyVolume(): number {
    return this.#partyVolume
  }

  /** Bật/tắt ducking thủ công (dùng khi ba mẹ nói trực tiếp với bé). */
  duck(on: boolean): void {
    this.#manualDuck = on
    this.#applyDuck()
  }

  // ------------------------------------------------------------- nạp clip

  /** Giải mã và cache AudioBuffer theo id. Clip đã có trong cache thì bỏ qua. */
  async preloadBlobs(entries: PreloadEntry[]): Promise<void> {
    const ctx = this.#ensureContext()
    if (!ctx) return
    const jobs: Promise<void>[] = []
    for (const entry of entries) {
      if (this.#buffers.has(entry.id)) continue
      const pending = this.#decoding.get(entry.id)
      if (pending) {
        jobs.push(pending)
        continue
      }
      const job = this.#decodeEntry(ctx, entry).finally(() => {
        this.#decoding.delete(entry.id)
      })
      this.#decoding.set(entry.id, job)
      jobs.push(job)
    }
    await Promise.all(jobs)
  }

  /** Clip đã sẵn trong cache chưa (dùng để biết preload có thành công không). */
  hasBuffer(id: string): boolean {
    return this.#buffers.has(id)
  }

  /** Thời lượng clip đã nạp (ms), chưa nạp thì trả 0. */
  durationMs(id: string): number {
    const cached = this.#buffers.get(id)
    return cached ? Math.round(cached.buffer.duration * 1000) : 0
  }

  /** Bỏ cache (không truyền id = bỏ hết) để nhường bộ nhớ. */
  release(ids?: string[]): void {
    if (!ids) {
      this.#buffers.clear()
      return
    }
    for (const id of ids) this.#buffers.delete(id)
  }

  // ----------------------------------------------------------------- phát

  /** Phát một clip đã preload; resolve khi phát xong (hoặc khi bị dừng). */
  async play(id: string, opts: PlayOptions = {}): Promise<void> {
    const cached = this.#buffers.get(id)
    if (!cached) return
    const ctx = await this.#runningContext()
    if (!ctx) return
    const ducks = opts.duck ?? isVoiceRole(opts.role)
    const bus = ducks ? this.#voiceBus : this.#sfxBus
    if (!bus) return
    const level = clampVolume(opts.gain ?? cached.gain)
    await this.#startBuffer(ctx, cached.buffer, bus, level, ducks)
  }

  /** Phát lần lượt nhiều clip, cách nhau ≥ 300 ms (04 §4). */
  async playSeq(ids: string[], opts: PlaySeqOptions = {}): Promise<void> {
    const gap = Math.max(0, opts.gapMs ?? MIN_GAP_MS)
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]
      if (id === undefined) continue
      await this.play(id, opts)
      if (i < ids.length - 1 && gap > 0) await delay(gap)
    }
  }

  /** Nốt "ting" thứ `index` của bảng sao (0..4). */
  async playStarTone(index: StarToneIndex): Promise<void> {
    const ctx = await this.#runningContext()
    if (!ctx || !this.#tones) return
    await this.#tones.playStarTone(index)
  }

  /**
   * Tiếng hoan hô khi bé làm đúng (yêu cầu của ba mẹ 25/10). Tổng hợp tại chỗ,
   * **không phải giọng người** — giọng chỉ đến từ bản thu của ba mẹ. Đi qua `#sfxBus`
   * nên vẫn tự hạ xuống khi giọng ba mẹ đang phát.
   */
  async playCheer(level: CheerLevel, opts: { volume?: number } = {}): Promise<void> {
    const ctx = await this.#runningContext()
    if (!ctx || !this.#sfxBus) return
    await playCheer(ctx, this.#sfxBus, { level, volume: opts.volume })
  }

  /**
   * Nhạc màn tiệc (5–8 giây, không lặp). Tôn trọng `partyVolume`;
   * `silent` = cờ "tiệc yên lặng" do người gọi truyền vào (04 §4).
   */
  async playPartyMusic(opts: { silent?: boolean } = {}): Promise<void> {
    if (opts.silent) return
    const ctx = await this.#runningContext()
    if (!ctx || !this.#tones) return
    await this.#tones.playPartyMusic(opts)
  }

  /** Dừng mọi âm đang phát (fade ra 50 ms). */
  stopAll(): void {
    for (const sound of [...this.#active]) sound.stop()
    this.#tones?.stopAll()
  }

  /** Đóng context (dùng khi gỡ app/test). */
  async dispose(): Promise<void> {
    this.stopAll()
    this.#stopWatching?.()
    this.#stopWatching = null
    this.#buffers.clear()
    const ctx = this.#ctx
    this.#ctx = null
    this.#tones = null
    this.#master = null
    this.#voiceBus = null
    this.#sfxBus = null
    this.#partyBus = null
    this.#duckBus = null
    this.#unlocked = false
    this.#setReady(false, 'closed')
    if (ctx) {
      try {
        await ctx.close()
      } catch {
        // context đã đóng
      }
    }
  }

  // ------------------------------------------------------------- nội bộ

  #ensureContext(): AudioContext | null {
    if (this.#ctx) return this.#ctx
    if (!isAudioSupported()) return null
    let ctx: AudioContext
    try {
      ctx = createAudioContext()
    } catch {
      return null
    }
    const master = ctx.createGain()
    master.gain.value = this.#masterVolume
    master.connect(ctx.destination)

    const duck = ctx.createGain()
    duck.gain.value = 1
    duck.connect(master)

    const voice = ctx.createGain()
    voice.gain.value = 1
    voice.connect(master)

    const sfx = ctx.createGain()
    sfx.gain.value = 1
    sfx.connect(duck)

    const party = ctx.createGain()
    party.gain.value = this.#partyVolume
    party.connect(duck)

    this.#ctx = ctx
    this.#master = master
    this.#duckBus = duck
    this.#voiceBus = voice
    this.#sfxBus = sfx
    this.#partyBus = party
    this.#tones = new ToneGenerator(ctx, sfx, party)
    this.#ready = isContextRunning(ctx)

    this.#stopWatching = observeContextInterruptions(ctx, {
      onChange: (running, reason) => {
        if (!running) this.stopAll()
        this.#setReady(running, reason)
      },
    })
    return ctx
  }

  /** Context đang chạy; thử resume im lặng một lần nếu đang bị ngắt. */
  async #runningContext(): Promise<AudioContext | null> {
    const ctx = this.#ensureContext()
    if (!ctx) return null
    if (!this.#unlocked) return null
    if (isContextRunning(ctx)) return ctx
    try {
      await ctx.resume()
    } catch {
      // Safari cần cử chỉ mới: UI sẽ hiện lại màn "chạm để tiếp tục".
    }
    if (isContextRunning(ctx)) {
      this.#setReady(true, null)
      return ctx
    }
    this.#setReady(false, 'suspended')
    return null
  }

  async #decodeEntry(ctx: AudioContext, entry: PreloadEntry): Promise<void> {
    try {
      const data = await entry.blob.arrayBuffer()
      const buffer = await decodeAudioData(ctx, data)
      this.#buffers.set(entry.id, { buffer, gain: clampVolume(entry.gain ?? 1) })
    } catch {
      // Clip hỏng: bỏ qua, `hasBuffer(id)` trả false để UI của ba mẹ biết.
    }
  }

  #startBuffer(
    ctx: AudioContext,
    buffer: AudioBuffer,
    bus: GainNode,
    level: number,
    ducks: boolean,
  ): Promise<void> {
    this.#enforceConcurrency()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    source.connect(gain)
    gain.connect(bus)

    const now = ctx.currentTime
    const duration = buffer.duration
    const peak = Math.max(level, MIN_RAMP_GAIN)
    const fadeIn = Math.min(FADE_IN_S, duration / 2)
    const fadeOutStart = Math.max(now + fadeIn, now + duration - FADE_OUT_S)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(peak, now + fadeIn)
    gain.gain.setValueAtTime(peak, fadeOutStart)
    gain.gain.linearRampToValueAtTime(0, now + duration)

    return new Promise<void>((resolve) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined

      const cleanup = (): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.#active.delete(entry)
        if (ducks) this.#applyDuck()
        try {
          source.disconnect()
          gain.disconnect()
        } catch {
          // đã ngắt kết nối
        }
        resolve()
      }

      const stop = (): void => {
        if (settled) return
        const t = ctx.currentTime
        try {
          gain.gain.cancelScheduledValues(t)
          gain.gain.setValueAtTime(gain.gain.value, t)
          gain.gain.linearRampToValueAtTime(0, t + FADE_OUT_S)
          source.stop(t + FADE_OUT_S + 0.01)
        } catch {
          cleanup()
        }
      }

      const entry: ActiveSound = { source, gain, ducks, startedAt: now, stop }
      this.#active.add(entry)
      if (ducks) this.#applyDuck()

      source.onended = cleanup
      // Lưới an toàn: vài bản Safari không bắn `ended` khi app vào nền.
      timer = setTimeout(cleanup, Math.ceil(duration * 1000) + 400)
      source.start(now)
    })
  }

  /** Giữ tối đa 3 âm cùng lúc: dừng âm cũ nhất (ưu tiên âm không phải giọng). */
  #enforceConcurrency(): void {
    while (this.#active.size >= MAX_CONCURRENT) {
      const sounds = [...this.#active].sort((a, b) => a.startedAt - b.startedAt)
      const victim = sounds.find((s) => !s.ducks) ?? sounds[0]
      if (!victim) return
      this.#active.delete(victim)
      victim.stop()
    }
  }

  /** Giọng ba mẹ đang phát -> các âm khác hạ 8 dB (fade vào 20 ms, ra 50 ms). */
  #applyDuck(): void {
    const ctx = this.#ctx
    const duck = this.#duckBus
    if (!ctx || !duck) return
    let voiceActive = this.#manualDuck
    if (!voiceActive) {
      for (const sound of this.#active) {
        if (sound.ducks) {
          voiceActive = true
          break
        }
      }
    }
    const target = voiceActive ? DUCK_GAIN : 1
    const now = ctx.currentTime
    const ramp = voiceActive ? FADE_IN_S : FADE_OUT_S
    try {
      duck.gain.cancelScheduledValues(now)
      duck.gain.setValueAtTime(duck.gain.value, now)
      duck.gain.linearRampToValueAtTime(target, now + ramp)
    } catch {
      duck.gain.value = target
    }
  }

  #rampGain(node: GainNode | null, value: number): void {
    const ctx = this.#ctx
    if (!node || !ctx) return
    const now = ctx.currentTime
    try {
      node.gain.cancelScheduledValues(now)
      node.gain.setValueAtTime(node.gain.value, now)
      node.gain.linearRampToValueAtTime(value, now + FADE_OUT_S)
    } catch {
      node.gain.value = value
    }
  }

  #setReady(ready: boolean, reason: AudioInterruptionReason | null): void {
    const changed = this.#ready !== ready
    this.#ready = ready
    if (!ready && reason) {
      for (const cb of this.#interruptListeners) cb(reason)
    }
    if (changed) {
      for (const cb of this.#readyListeners) cb(ready && this.#unlocked)
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * `decodeAudioData` dạng callback: Safari cũ chỉ hỗ trợ dạng này, bản mới trả
 * thêm Promise (được bắt để không sinh unhandled rejection).
 */
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
