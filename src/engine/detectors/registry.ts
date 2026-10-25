// `DetectorRegistry` (05 §8.1). Engine chỉ biết registry này; P3 thêm detector camera/micro
// bằng `register('hand_pose', …)` mà không sửa engine.

import type { DetectorKind } from '@/data/types'
import type { DetectorRegistry, ResponseDetector } from './types'
import { createTouchChoiceDetector } from './touchChoice'
import { createParentConfirmDetector } from './parentConfirm'
import { createTouchDragDetector } from './touchDrag'

class MapDetectorRegistry implements DetectorRegistry {
  private readonly factories = new Map<DetectorKind, () => ResponseDetector>()

  register(kind: DetectorKind, factory: () => ResponseDetector): void {
    this.factories.set(kind, factory)
  }

  has(kind: DetectorKind): boolean {
    return this.factories.has(kind)
  }

  create(kind: DetectorKind): ResponseDetector {
    const factory = this.factories.get(kind)
    if (!factory) throw new Error(`Chưa đăng ký detector: ${kind}`)
    return factory()
  }
}

export function createDetectorRegistry(): DetectorRegistry {
  return new MapDetectorRegistry()
}

/** Registry mặc định của MVP: chạm chọn hình, kéo thả, và ba mẹ xác nhận. */
export const detectorRegistry: DetectorRegistry = createDetectorRegistry()
detectorRegistry.register('touch_choice', createTouchChoiceDetector)
detectorRegistry.register('parent_confirm', createParentConfirmDetector)
detectorRegistry.register('touch_drag', createTouchDragDetector)
