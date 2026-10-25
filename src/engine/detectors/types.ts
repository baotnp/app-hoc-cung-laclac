// Hợp đồng `ResponseDetector` (05 §8.1). Engine chỉ biết registry + chuỗi `response.detector`,
// không import detector cụ thể, để P3 thêm detector camera/micro mà không sửa engine.

import type { DetectorKind } from '@/data/types'

export interface DetectedResponse {
  kind: DetectorKind
  /** Thời điểm tính từ đầu lượt (ms). */
  tMs: number
  /** Item/ô được chọn; bỏ trống khi chạm ngoài hình. */
  targetId?: string
  /** 0..1, chỉ detector ML (P3). */
  confidence?: number
  payload?: Record<string, unknown>
}

export interface DetectorContext {
  trialId: string
  /** Phần `response.*` của `ExerciseConfig`. */
  config: unknown
  signal: AbortSignal
}

export interface ResponseDetector {
  readonly kind: DetectorKind
  start(ctx: DetectorContext): Promise<void>
  stop(): void
  subscribe(cb: (r: DetectedResponse) => void): () => void
}

export interface DetectorRegistry {
  register(kind: DetectorKind, factory: () => ResponseDetector): void
  create(kind: DetectorKind): ResponseDetector
  has(kind: DetectorKind): boolean
}

/** Cấu hình chạm lấy từ `ExerciseConfig.response` (06 §4.1). */
export interface TouchResponseConfig {
  acceptOn: 'pointerdown' | 'pointerup'
  maxMovePx: number
  ignoreFirstMs: number
  hitSlopPx: number
}

export const DEFAULT_TOUCH_RESPONSE: TouchResponseConfig = {
  acceptOn: 'pointerup',
  maxMovePx: 24,
  ignoreFirstMs: 150,
  hitSlopPx: 24,
}

/** Một mẫu con trỏ do giao diện đẩy vào detector (không đụng DOM trong engine). */
export interface PointerSample {
  pointerId: number
  /** Tính từ đầu lượt (ms). */
  tMs: number
  x: number
  y: number
  /** `Item.id` của hình dưới ngón tay; `null` khi chạm ra ngoài hình. */
  targetId: string | null
}

/** Giao diện màn lượt gọi các hàm này từ sự kiện pointer của React. */
export interface PointerSink {
  pointerDown(sample: PointerSample): void
  pointerMove(sample: PointerSample): void
  pointerUp(sample: PointerSample): void
  pointerCancel(sample: Pick<PointerSample, 'pointerId' | 'tMs'>): void
}

/** Detector nhận xác nhận từ giao diện của ba mẹ (không có khái niệm "sai"). */
export interface ConfirmSink {
  confirm(input: { tMs: number; targetId?: string; payload?: Record<string, unknown> }): void
}

/** Vì sao một chạm không được tính là lựa chọn (06 §2.5 `TrialTouch.counted`). */
export type UncountedReason = 'ignore_first_ms' | 'second_pointer' | 'moved_too_far' | 'off_target'

export interface TouchPayload extends Record<string, unknown> {
  x: number
  y: number
  counted: boolean
  reason?: UncountedReason
}

export function isPointerSink(detector: ResponseDetector): detector is ResponseDetector & PointerSink {
  const candidate = detector as Partial<PointerSink>
  return typeof candidate.pointerDown === 'function' && typeof candidate.pointerUp === 'function'
}

export function isConfirmSink(detector: ResponseDetector): detector is ResponseDetector & ConfirmSink {
  return typeof (detector as Partial<ConfirmSink>).confirm === 'function'
}
