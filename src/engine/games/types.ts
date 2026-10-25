// `GameModule`: phần riêng theo `Exercise.type` (05 §3). Thêm bài mới = thêm tệp JSON;
// thêm **loại** bài mới = thêm một GameModule rồi `registerGame`, engine không đổi.

import type { DetectorKind, DisplayedChoice, ExerciseType, Trial } from '@/data/types'

export type Viewport = Trial['viewport']

/** Hình dạng `PlannedTrial` của scheduler (05 §8.2) mà engine cần để dựng khung nhìn. */
export interface PlannedTrialInput {
  trialIndex: number
  exerciseId: string
  targetItemId: string
  distractorItemIds: string[]
  targetSlot: 0 | 1
  isNewItem: boolean
  waitBeforeCueMs: number
}

export interface ItemRef {
  itemId: string
  itemKey: string
}

export interface BuildDisplayedInput<P> {
  planned: PlannedTrialInput
  /** Phải chứa mục đích và các mục gây nhiễu của `planned`. */
  items: ItemRef[]
  params: P
  viewport: Viewport
}

export type ParamsResult<P> = { ok: true; value: P } | { ok: false; errors: string[] }

export interface GameModule<P = unknown> {
  readonly type: ExerciseType
  /** Detector dùng khi JSON bài không ghi `response.detector` khác. */
  readonly defaultDetector: DetectorKind
  /** Số hình/ô hiển thị cùng lúc. */
  readonly choices: number
  parseParams(params: unknown): ParamsResult<P>
  buildDisplayed(input: BuildDisplayedInput<P>): DisplayedChoice[]
}
