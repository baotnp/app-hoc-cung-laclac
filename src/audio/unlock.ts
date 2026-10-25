/**
 * Mở khóa âm thanh trên iOS Safari (05 §6, mục 1 và 2).
 *
 * Safari chỉ cho AudioContext chạy sau một cử chỉ của người dùng, và tự đưa
 * context về trạng thái 'interrupted'/'suspended' khi khóa màn hình, có cuộc
 * gọi, hoặc khi app chuyển sang nền. Module này gói các thao tác đó lại để
 * AudioManager chỉ phải theo dõi một cờ "đang chạy hay không".
 */

/** Lý do âm thanh ngừng sẵn sàng. */
export type AudioInterruptionReason = 'suspended' | 'hidden' | 'closed'

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext

interface WindowWithWebkitAudio {
  AudioContext?: AudioContextCtor
  webkitAudioContext?: AudioContextCtor
}

interface AudioSessionLike {
  type: string
}

interface NavigatorWithAudioSession {
  audioSession?: AudioSessionLike
}

/** Trình dựng AudioContext của trình duyệt (có fallback `webkitAudioContext`). */
export function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as WindowWithWebkitAudio
  return w.AudioContext ?? w.webkitAudioContext
}

/** Trình duyệt có Web Audio hay không. */
export function isAudioSupported(): boolean {
  return getAudioContextCtor() !== undefined
}

/**
 * Tạo AudioContext. Tạo được trước cử chỉ chạm (context sẽ ở trạng thái
 * 'suspended' cho tới khi `unlockContext` được gọi trong handler chạm).
 */
export function createAudioContext(): AudioContext {
  const Ctor = getAudioContextCtor()
  if (!Ctor) throw new Error('web-audio-unsupported')
  // latencyHint 'interactive': phản hồi nhanh cho "ting" và giọng ba mẹ.
  return new Ctor({ latencyHint: 'interactive' })
}

/**
 * Xin phát qua "playback" để công tắc im lặng của iPad không tắt tiếng app
 * (05 §6 mục 2). API chỉ có trên Safari mới; không có thì bỏ qua.
 */
export function configureAudioSession(): void {
  if (typeof navigator === 'undefined') return
  const nav = navigator as unknown as NavigatorWithAudioSession
  const session = nav.audioSession
  if (!session) return
  try {
    session.type = 'playback'
  } catch {
    // Trình duyệt không cho đặt: bỏ qua, hướng dẫn ba mẹ trong cài đặt.
  }
}

/** Context đang phát được hay không. */
export function isContextRunning(ctx: AudioContext | null): boolean {
  // Safari còn có trạng thái ngoài chuẩn 'interrupted' -> mọi thứ khác
  // 'running' đều coi là chưa sẵn sàng.
  return ctx !== null && ctx.state === 'running'
}

/**
 * `resume()` + phát một buffer câm. Phải gọi **trong** handler chạm
 * (pointerup/click) thì iOS mới mở khóa.
 */
export async function unlockContext(ctx: AudioContext): Promise<void> {
  configureAudioSession()
  // Buffer câm 1 frame: iOS coi đây là "đã phát trong cử chỉ người dùng".
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    source.stop(ctx.currentTime + 0.001)
  } catch {
    // Một vài bản Safari ném khi context đang 'interrupted'; resume ở dưới.
  }
  try {
    await ctx.resume()
  } catch {
    // Chưa mở được: UI giữ màn "chạm để bắt đầu".
  }
}

export interface InterruptionWatchOptions {
  /** Gọi khi trạng thái sẵn sàng thay đổi. */
  onChange: (running: boolean, reason: AudioInterruptionReason | null) => void
  /** Thử resume im lặng khi app quay lại (không phải lúc nào Safari cũng cho). */
  resumeOnVisible?: boolean
}

/**
 * Theo dõi `statechange` của context và `visibilitychange` của trang.
 * Trả về hàm hủy theo dõi.
 */
export function observeContextInterruptions(
  ctx: AudioContext,
  opts: InterruptionWatchOptions,
): () => void {
  const emit = (reason: AudioInterruptionReason | null): void => {
    opts.onChange(isContextRunning(ctx), reason)
  }

  const onStateChange = (): void => {
    if (isContextRunning(ctx)) {
      emit(null)
      return
    }
    emit(ctx.state === 'closed' ? 'closed' : 'suspended')
  }

  const onVisibility = (): void => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'hidden') {
      emit('hidden')
      return
    }
    if (opts.resumeOnVisible !== false && !isContextRunning(ctx)) {
      void ctx
        .resume()
        .then(() => emit(isContextRunning(ctx) ? null : 'suspended'))
        .catch(() => emit('suspended'))
      return
    }
    emit(isContextRunning(ctx) ? null : 'suspended')
  }

  ctx.addEventListener('statechange', onStateChange)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }

  return () => {
    ctx.removeEventListener('statechange', onStateChange)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }
}
