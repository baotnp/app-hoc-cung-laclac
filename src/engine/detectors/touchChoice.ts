// Detector chạm chọn hình (03 §3, 06 §2.5). Không đụng DOM: màn lượt đẩy mẫu con trỏ vào đây.
//
// Luật: nhận tại `acceptOn` (mặc định `pointerup`) khi `pointerdown` và `pointerup` cùng một hình
// và quãng dịch chuyển < `maxMovePx`. Ngón thứ hai và chạm trong `ignoreFirstMs` đầu vẫn được
// báo lên (để ghi `touches[]`) nhưng `counted=false`, nên không bao giờ tính là lựa chọn đầu.
// Giao diện tự nới vùng chạm `hitSlopPx` khi tìm hình dưới ngón tay.

import type {
  DetectedResponse,
  DetectorContext,
  PointerSample,
  PointerSink,
  ResponseDetector,
  TouchPayload,
  TouchResponseConfig,
  UncountedReason,
} from './types'
import { DEFAULT_TOUCH_RESPONSE } from './types'

interface TrackedPointer {
  downTMs: number
  x0: number
  y0: number
  targetId: string | null
  maxMove: number
  ignored: boolean
  extra: boolean
  emitted: boolean
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Đọc `ExerciseConfig.response` (đã có mặc định ở Zod, nhưng detector vẫn tự phòng hờ). */
export function parseTouchResponseConfig(config: unknown): TouchResponseConfig {
  const c = (typeof config === 'object' && config !== null ? config : {}) as Record<string, unknown>
  const acceptOn = c['acceptOn'] === 'pointerdown' ? 'pointerdown' : DEFAULT_TOUCH_RESPONSE.acceptOn
  return {
    acceptOn,
    maxMovePx: num(c['maxMovePx'], DEFAULT_TOUCH_RESPONSE.maxMovePx),
    ignoreFirstMs: num(c['ignoreFirstMs'], DEFAULT_TOUCH_RESPONSE.ignoreFirstMs),
    hitSlopPx: num(c['hitSlopPx'], DEFAULT_TOUCH_RESPONSE.hitSlopPx),
  }
}

export class TouchChoiceDetector implements ResponseDetector, PointerSink {
  readonly kind = 'touch_choice' as const

  private config: TouchResponseConfig = { ...DEFAULT_TOUCH_RESPONSE }
  private readonly listeners = new Set<(r: DetectedResponse) => void>()
  private readonly pointers = new Map<number, TrackedPointer>()
  private primaryId: number | null = null
  private running = false
  private signal: AbortSignal | null = null
  private readonly onAbort = () => this.stop()

  async start(ctx: DetectorContext): Promise<void> {
    this.config = parseTouchResponseConfig(ctx.config)
    this.pointers.clear()
    this.primaryId = null
    this.running = true
    this.signal = ctx.signal
    if (ctx.signal.aborted) {
      this.stop()
      return
    }
    ctx.signal.addEventListener('abort', this.onAbort, { once: true })
  }

  stop(): void {
    this.running = false
    this.pointers.clear()
    this.primaryId = null
    this.signal?.removeEventListener('abort', this.onAbort)
    this.signal = null
  }

  subscribe(cb: (r: DetectedResponse) => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  pointerDown(sample: PointerSample): void {
    if (!this.running || this.pointers.has(sample.pointerId)) return
    const extra = this.primaryId !== null
    const tracked: TrackedPointer = {
      downTMs: sample.tMs,
      x0: sample.x,
      y0: sample.y,
      targetId: sample.targetId,
      maxMove: 0,
      ignored: sample.tMs < this.config.ignoreFirstMs,
      extra,
      emitted: false,
    }
    this.pointers.set(sample.pointerId, tracked)
    if (!extra) this.primaryId = sample.pointerId

    if (this.config.acceptOn === 'pointerdown') {
      tracked.emitted = true
      this.emit(sample, this.reasonFor(tracked, 0, sample.targetId))
    }
  }

  pointerMove(sample: PointerSample): void {
    const tracked = this.pointers.get(sample.pointerId)
    if (!this.running || !tracked) return
    const moved = Math.hypot(sample.x - tracked.x0, sample.y - tracked.y0)
    tracked.maxMove = Math.max(tracked.maxMove, moved)
  }

  pointerUp(sample: PointerSample): void {
    const tracked = this.pointers.get(sample.pointerId)
    this.release(sample.pointerId)
    if (!this.running || !tracked || tracked.emitted) return
    const moved = Math.max(
      tracked.maxMove,
      Math.hypot(sample.x - tracked.x0, sample.y - tracked.y0),
    )
    this.emit(sample, this.reasonFor(tracked, moved, sample.targetId))
  }

  pointerCancel(sample: Pick<PointerSample, 'pointerId' | 'tMs'>): void {
    this.release(sample.pointerId)
  }

  private release(pointerId: number): void {
    this.pointers.delete(pointerId)
    if (this.primaryId === pointerId) this.primaryId = null
  }

  private reasonFor(
    tracked: TrackedPointer,
    moved: number,
    upTargetId: string | null,
  ): UncountedReason | undefined {
    if (tracked.extra) return 'second_pointer'
    if (tracked.ignored) return 'ignore_first_ms'
    if (moved >= this.config.maxMovePx) return 'moved_too_far'
    if (upTargetId === null || upTargetId !== tracked.targetId) return 'off_target'
    return undefined
  }

  private emit(sample: PointerSample, reason: UncountedReason | undefined): void {
    const payload: TouchPayload = {
      x: sample.x,
      y: sample.y,
      counted: reason === undefined,
      ...(reason ? { reason } : {}),
    }
    const response: DetectedResponse = {
      kind: this.kind,
      tMs: sample.tMs,
      ...(sample.targetId !== null ? { targetId: sample.targetId } : {}),
      payload,
    }
    for (const cb of [...this.listeners]) cb(response)
  }
}

export function createTouchChoiceDetector(): ResponseDetector {
  return new TouchChoiceDetector()
}
