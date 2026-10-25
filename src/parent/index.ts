// Chế độ ba mẹ (03 §1). Mỗi màn nhận prop điều hướng; router do src/app/ đấu vào.

export { ParentHome } from './ParentHome'
export type { ParentHomeProps } from './ParentHome'
export { SessionReadyScreen } from './SessionReadyScreen'
export type { SessionReadyScreenProps } from './SessionReadyScreen'
export { ContentScreen } from './ContentScreen'
export { ItemEditor, MAX_RECORD_MS } from './ItemEditor'
export type { ItemEditorProps } from './ItemEditor'
export { GoalsScreen } from './GoalsScreen'
export { SettingsScreen } from './SettingsScreen'
export type { SettingsScreenProps } from './SettingsScreen'
export { SessionReviewScreen } from './SessionReviewScreen'
export type { SessionReviewScreenProps } from './SessionReviewScreen'
export { ProgressScreen } from './ProgressScreen'
export { BackupScreen } from './BackupScreen'

export { Shell, Card, Field, Row, DayDots, Muted } from './Shell'
export type { NavProps, ParentRoute } from './nav'
export {
  promptLevelPatch,
  validityPatch,
  trialResultKey,
} from './reviewPatch'
export type { InvalidReason, PromptLevelPatch, ValidityPatch } from './reviewPatch'
export { checkItem, requiredRolesFor, requiredRolesByItemKey } from './readiness'
export type { ItemReadiness } from './readiness'
export { processImageFile, fitSize, hasAlphaPixels, MAX_IMAGE_EDGE, JPEG_QUALITY } from './image'
export type { ProcessedImage } from './image'
export {
  AUDIO_ROLE_LABEL,
  EDITABLE_AUDIO_ROLES,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  ITEM_STATUS_LABEL,
  CHECK_RESULT_LABEL,
} from './labels'
export { useAsync } from './useAsync'
export type { AsyncResult } from './useAsync'
