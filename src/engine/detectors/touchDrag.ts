// Detector kéo–thả thẻ vào ô (bài 6 FIN-03, docs/10 §4). Không đụng DOM: màn lượt đo vị trí
// các ô bằng `getBoundingClientRect` rồi đẩy vào `setSlots`, và đẩy mẫu con trỏ như `touch_choice`.
//
// Luật "học không lỗi" (docs/03 §3): thả ra ngoài mọi ô KHÔNG phải là sai — chỉ trả về một
// kết quả không tính (`counted: false`) để thẻ tự trượt về chỗ cũ, không âm báo, không màu đỏ.
// Lượt chỉ coi là xong khi thẻ cuối điền nốt ô trống cuối cùng; lúc đó mới phát kết quả
// `counted: true` để máy trạng thái vào bước thưởng.
//
// Vì sao thẻ đã đặt thì khoá lại: bé 21 tháng kéo lại thẻ đã vào ô sẽ phá vỡ hàng vừa xếp,
// và cô dạy "xếp vào" một chiều — không có bước lấy ra.

import type {
  DetectedResponse,
  DetectorContext,
  PointerSample,
  PointerSink,
  ResponseDetector,
  TouchPayload,
  UncountedReason,
} from './types'

export interface DragRect {
  x: number
  y: number
  w: number
  h: number
}

/** Một ô đích của hàng ngang; `index` là thứ tự ô từ trái sang phải. */
export interface DragSlot {
  index: number
  rect: DragRect
}

export interface TouchDragConfig {
  /** Nới vùng nhận quanh ô đích; thả trong phạm vi này vẫn hút vào ô. */
  snapPx: number
  /** Giữ thẻ lâu hơn ngần này thì coi như bé đang nghịch, không tính là đặt thẻ. */
  maxDurationMs: number
}

export const DEFAULT_TOUCH_DRAG: TouchDragConfig = {
  snapPx: 72,
  maxDurationMs: 10_000,
}

/**
 * Kết quả một lần thả, để màn lượt biết nên kêu "ting" hay cho thẻ trượt về chỗ cũ.
 * Không giá trị nào mang nghĩa "sai".
 */
export type DragOutcome =
  | 'placed' // vào ô, hàng chưa đủ
  | 'row_complete' // vào ô cuối, hàng đã đủ → xong lượt
  | 'off_slot' // thả ngoài mọi ô trống → thẻ về chỗ cũ
  | 'too_long' // giữ quá lâu → không tính, thẻ về chỗ cũ
  | 'ignored' // ngón thứ hai, hoặc thẻ đã nằm trong ô

export interface TouchDragPayload extends TouchPayload {
  outcome: DragOutcome
  /** Thẻ bé vừa kéo; `null` khi ngón đặt xuống ngoài mọi thẻ. */
  cardId: string | null
  /** Ô vừa nhận thẻ (chỉ có khi `placed`/`row_complete`). */
  slotIndex?: number
  placedCount: number
  slotCount: number
  durationMs: number
}

export interface TouchDragOptions {
  slots?: DragSlot[]
  /**
   * `targetId` gắn vào kết quả khi hàng xếp đủ. Màn lượt truyền `setup.targetItemId` để máy
   * trạng thái nhận ra lượt đã đúng (máy chỉ thưởng khi `itemId === targetItemId`).
   */
  completionTargetId?: string
  /** Giá trị nền khi `ExerciseConfig.response` không ghi (bài 6 để snapPx trong `params`). */
  config?: Partial<TouchDragConfig>
}

interface TrackedDrag {
  downTMs: number
  x0: number
  y0: number
  cardId: string | null
  extra: boolean
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Đọc cấu hình kéo–thả; `fallback` là giá trị từ `params` của bài (xem `TouchDragOptions.config`). */
export function parseTouchDragConfig(
  config: unknown,
  fallback: Partial<TouchDragConfig> = {},
): TouchDragConfig {
  const c = (typeof config === 'object' && config !== null ? config : {}) as Record<string, unknown>
  const base: TouchDragConfig = {
    snapPx: num(fallback.snapPx, DEFAULT_TOUCH_DRAG.snapPx),
    maxDurationMs: num(fallback.maxDurationMs, DEFAULT_TOUCH_DRAG.maxDurationMs),
  }
  return {
    snapPx: num(c['snapPx'], base.snapPx),
    maxDurationMs: num(c['maxDurationMs'], base.maxDurationMs),
  }
}

/** Điểm thả nằm trong ô đã nới `snapPx` chưa, và cách tâm ô bao xa (để chọn ô gần nhất). */
function distanceToSlot(slot: DragSlot, x: number, y: number, snapPx: number): number | null {
  const { rect } = slot
  const inside =
    x >= rect.x - snapPx &&
    x <= rect.x + rect.w + snapPx &&
    y >= rect.y - snapPx &&
    y <= rect.y + rect.h + snapPx
  if (!inside) return null
  return Math.hypot(x - (rect.x + rect.w / 2), y - (rect.y + rect.h / 2))
}

export class TouchDragDetector implements ResponseDetector, PointerSink {
  readonly kind = 'touch_drag' as const

  private config: TouchDragConfig = { ...DEFAULT_TOUCH_DRAG }
  private readonly listeners = new Set<(r: DetectedResponse) => void>()
  private readonly pointers = new Map<number, TrackedDrag>()
  /** `itemId` của thẻ → thứ tự ô đã nhận nó. */
  private readonly placed = new Map<string, number>()
  private slots: DragSlot[] = []
  private completionTargetId: string | null = null
  private fallbackConfig: Partial<TouchDragConfig> = {}
  private primaryId: number | null = null
  private running = false
  private signal: AbortSignal | null = null
  private readonly onAbort = () => this.stop()

  constructor(options: TouchDragOptions = {}) {
    this.slots = options.slots ? [...options.slots] : []
    this.completionTargetId = options.completionTargetId ?? null
    this.fallbackConfig = options.config ?? {}
    this.config = parseTouchDragConfig({}, this.fallbackConfig)
  }

  /** Màn lượt gọi lại mỗi khi bố cục đổi (xoay máy, bàn phím…). Không xoá thẻ đã đặt. */
  setSlots(slots: DragSlot[]): void {
    this.slots = [...slots]
  }

  setCompletionTargetId(itemId: string | null): void {
    this.completionTargetId = itemId
  }

  /** Dùng khi bài để `snapPx` trong `params` thay vì trong `response`. */
  setFallbackConfig(config: Partial<TouchDragConfig>): void {
    this.fallbackConfig = config
    this.config = parseTouchDragConfig({}, config)
  }

  get placements(): ReadonlyMap<string, number> {
    return this.placed
  }

  isPlaced(cardId: string): boolean {
    return this.placed.has(cardId)
  }

  /** Lượt mới dùng lại cùng detector (màn không remount): xoá hàng đã xếp. */
  resetPlacements(): void {
    this.placed.clear()
    this.pointers.clear()
    this.primaryId = null
  }

  async start(ctx: DetectorContext): Promise<void> {
    this.config = parseTouchDragConfig(ctx.config, this.fallbackConfig)
    this.pointers.clear()
    this.placed.clear()
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
    this.pointers.set(sample.pointerId, {
      downTMs: sample.tMs,
      x0: sample.x,
      y0: sample.y,
      cardId: sample.targetId,
      extra,
    })
    if (!extra) this.primaryId = sample.pointerId
  }

  pointerMove(_sample: PointerSample): void {
    // Hiệu ứng thẻ đi theo ngón tay do màn lượt tự vẽ; detector chỉ cần điểm thả.
  }

  pointerUp(sample: PointerSample): void {
    const tracked = this.pointers.get(sample.pointerId)
    this.release(sample.pointerId)
    if (!this.running || !tracked) return

    const durationMs = sample.tMs - tracked.downTMs
    const cardId = tracked.cardId

    if (tracked.extra) {
      this.emit(sample, { cardId, outcome: 'ignored', durationMs, reason: 'second_pointer' })
      return
    }
    if (cardId === null) {
      // Đặt ngón xuống ngoài mọi thẻ: không có gì để kéo.
      this.emit(sample, { cardId, outcome: 'off_slot', durationMs, reason: 'off_target' })
      return
    }
    if (this.placed.has(cardId)) {
      this.emit(sample, { cardId, outcome: 'ignored', durationMs })
      return
    }
    if (durationMs > this.config.maxDurationMs) {
      // Không gắn `UncountedReason`: giữ lâu không phải lỗi của bé, chỉ là chưa xong.
      this.emit(sample, { cardId, outcome: 'too_long', durationMs })
      return
    }

    const slot = this.nearestFreeSlot(sample.x, sample.y)
    if (!slot) {
      this.emit(sample, { cardId, outcome: 'off_slot', durationMs, reason: 'off_target' })
      return
    }

    this.placed.set(cardId, slot.index)
    const complete = this.slots.length > 0 && this.placed.size >= this.slots.length
    this.emit(sample, {
      cardId,
      outcome: complete ? 'row_complete' : 'placed',
      durationMs,
      slotIndex: slot.index,
      // Hàng đủ thẻ = lượt đúng: gắn `targetItemId` để máy trạng thái vào bước thưởng.
      targetId: complete ? (this.completionTargetId ?? cardId) : cardId,
    })
  }

  pointerCancel(sample: Pick<PointerSample, 'pointerId' | 'tMs'>): void {
    this.release(sample.pointerId)
  }

  private release(pointerId: number): void {
    this.pointers.delete(pointerId)
    if (this.primaryId === pointerId) this.primaryId = null
  }

  private nearestFreeSlot(x: number, y: number): DragSlot | null {
    const taken = new Set(this.placed.values())
    let best: DragSlot | null = null
    let bestDistance = Infinity
    for (const slot of this.slots) {
      if (taken.has(slot.index)) continue
      const distance = distanceToSlot(slot, x, y, this.config.snapPx)
      if (distance === null || distance >= bestDistance) continue
      best = slot
      bestDistance = distance
    }
    return best
  }

  private emit(
    sample: PointerSample,
    info: {
      cardId: string | null
      outcome: DragOutcome
      durationMs: number
      reason?: UncountedReason
      slotIndex?: number
      /** Mặc định bằng `cardId`; chỉ lượt xếp đủ hàng mới đổi sang mục đích của lượt. */
      targetId?: string | null
    },
  ): void {
    const payload: TouchDragPayload = {
      x: sample.x,
      y: sample.y,
      counted: info.outcome === 'row_complete',
      outcome: info.outcome,
      cardId: info.cardId,
      placedCount: this.placed.size,
      slotCount: this.slots.length,
      durationMs: info.durationMs,
      ...(info.slotIndex !== undefined ? { slotIndex: info.slotIndex } : {}),
      ...(info.reason ? { reason: info.reason } : {}),
    }
    const targetId = info.targetId !== undefined ? info.targetId : info.cardId
    const response: DetectedResponse = {
      kind: this.kind,
      tMs: sample.tMs,
      ...(targetId !== null ? { targetId } : {}),
      payload,
    }
    for (const cb of [...this.listeners]) cb(response)
  }
}

export function createTouchDragDetector(options: TouchDragOptions = {}): ResponseDetector {
  return new TouchDragDetector(options)
}
