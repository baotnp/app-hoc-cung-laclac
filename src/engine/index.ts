// API công khai của engine (05 §3). `child/` chỉ nhập từ đây.

export {
  chooseFromTwoParamsSchema,
  exerciseFileSchema,
  exerciseFromFile,
  formatIssues,
  parseExerciseFile,
} from './schema'
export type { ChooseFromTwoParamsInput, ExerciseFile, ParseExerciseResult } from './schema'

export {
  DEFAULT_REWARD_MAX_MS,
  SHOWING_MS,
  buildTrialSetup,
  effectiveTiming,
  loadBundledExercises,
  loadExerciseFiles,
} from './loader'
export type { BuildTrialSetupInput, ExerciseFileSource, LoadExercisesResult } from './loader'

export { buildTrialRecord, createTrialState, isAudioEffect, trialReducer } from './trialMachine'
export type {
  CueKind,
  RewardPart,
  TrialAction,
  TrialEffect,
  TrialPhase,
  TrialRecord,
  TrialSetup,
  TrialState,
  TrialTimer,
  TrialTiming,
} from './trialMachine'

export { useTrial } from './useTrial'
export type {
  TrialAudioCallbacks,
  TrialPointerApi,
  UseTrialApi,
  UseTrialOptions,
} from './useTrial'

export { getGame, registerGame, registeredGameTypes, requireGame } from './registry'
export { chooseFromTwoGame, chooseFromTwoRects } from './games/chooseFromTwo'
export { peekabooGame, peekabooParamsSchema } from './games/peekaboo'
export { sayNameGame, sayNameParamsSchema } from './games/sayName'
export { sequenceCardsGame, sequenceCardsParamsSchema } from './games/sequenceCards'
export { coachDemoGame, coachDemoParamsSchema } from './games/coachDemo'
export type {
  BuildDisplayedInput,
  GameModule,
  ItemRef,
  ParamsResult,
  PlannedTrialInput,
  Viewport,
} from './games/types'

export {
  DEFAULT_TOUCH_RESPONSE,
  ParentConfirmDetector,
  TouchChoiceDetector,
  createDetectorRegistry,
  createParentConfirmDetector,
  createTouchChoiceDetector,
  detectorRegistry,
  isConfirmSink,
  isPointerSink,
  parseTouchResponseConfig,
} from './detectors'
export {
  TouchDragDetector,
  createTouchDragDetector,
  parseTouchDragConfig,
} from './detectors/touchDrag'
export type {
  ConfirmSink,
  DetectedResponse,
  DetectorContext,
  DetectorRegistry,
  ParentConfirmInput,
  PointerSample,
  PointerSink,
  ResponseDetector,
  TouchPayload,
  TouchResponseConfig,
  UncountedReason,
} from './detectors'
