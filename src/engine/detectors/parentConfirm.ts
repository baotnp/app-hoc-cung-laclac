// Detector "ba mẹ xác nhận" (05 §8.1). Dùng cho các bài ngoài màn hình và cho P2/P3 khi
// detector ML chỉ đề xuất: ba mẹ vẫn là người xác nhận. Không có khái niệm "sai", chỉ có xác nhận.

import type { DetectedResponse, DetectorContext, ResponseDetector } from './types'

export interface ParentConfirmInput {
  /** Tính từ đầu lượt (ms). */
  tMs: number
  /** `Item.id` ba mẹ xác nhận bé đã chọn/làm được. */
  targetId?: string
  payload?: Record<string, unknown>
}

export class ParentConfirmDetector implements ResponseDetector {
  readonly kind = 'parent_confirm' as const

  private readonly listeners = new Set<(r: DetectedResponse) => void>()
  private running = false
  private signal: AbortSignal | null = null
  private readonly onAbort = () => this.stop()

  async start(ctx: DetectorContext): Promise<void> {
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
    this.signal?.removeEventListener('abort', this.onAbort)
    this.signal = null
  }

  subscribe(cb: (r: DetectedResponse) => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  /** Giao diện gọi khi ba mẹ bấm "Bé làm được". */
  confirm(input: ParentConfirmInput): void {
    if (!this.running) return
    const response: DetectedResponse = {
      kind: this.kind,
      tMs: input.tMs,
      confidence: 1,
      ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
      payload: { counted: true, source: 'parent', ...(input.payload ?? {}) },
    }
    for (const cb of [...this.listeners]) cb(response)
  }
}

export function createParentConfirmDetector(): ResponseDetector {
  return new ParentConfirmDetector()
}
