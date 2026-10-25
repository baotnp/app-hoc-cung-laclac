export type {
  ConfirmSink,
  DetectedResponse,
  DetectorContext,
  DetectorRegistry,
  PointerSample,
  PointerSink,
  ResponseDetector,
  TouchPayload,
  TouchResponseConfig,
  UncountedReason,
} from './types'
export { DEFAULT_TOUCH_RESPONSE, isConfirmSink, isPointerSink } from './types'
export { TouchChoiceDetector, createTouchChoiceDetector, parseTouchResponseConfig } from './touchChoice'
export { ParentConfirmDetector, createParentConfirmDetector } from './parentConfirm'
export type { ParentConfirmInput } from './parentConfirm'
export { createDetectorRegistry, detectorRegistry } from './registry'
