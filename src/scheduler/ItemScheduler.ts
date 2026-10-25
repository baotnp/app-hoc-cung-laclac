/**
 * Hợp đồng bộ xếp lượt (05 §8.2). MVP: `simple@1`; giai đoạn 2 có thể thay bằng bản thích ứng
 * mà không sửa engine, vì `Session.schedulerId` ghi lại bản đã dùng.
 */
import type { ItemStatus } from '@/data/types'

export interface ItemStats {
  itemId: string
  /** tổng lượt hợp lệ */
  trials: number
  independentCorrect: number
  lastSeenAt: number | null
  recentSessions: { sessionId: string; trials: number; independentCorrect: number }[]
  status: ItemStatus
}

export interface PlanInput {
  childId: string
  now: number
  exerciseId: string
  /** Lấy từ ExerciseConfig sau khi áp ưu tiên cấu hình (06 §1) */
  scheduling: {
    trialsPerRound: number
    newItemRatio: number
    knownMinTrials: number
    firstTrialKnownItem: boolean
  }
  positions: { maxSameSideRun: number }
  distractor: { avoidRepeatLast: number }
  /** đã lọc theo `requiredAudio` của bài + có ảnh */
  pool: ItemStats[]
  /** thiên vị vị trí gần đây */
  history: { lastSideRun: number; leftShare: number }
  /** xáo trộn tái lập được */
  seed?: number
}

export interface PlannedTrial {
  trialIndex: number
  exerciseId: string
  targetItemId: string
  /** choose_from_two: 1 phần tử */
  distractorItemIds: string[]
  /** 0 = trái/trên */
  targetSlot: 0 | 1
  isNewItem: boolean
  waitBeforeCueMs: number
}

export interface ItemScheduler {
  /** 'simple@1' */
  readonly id: string
  readonly version: number
  planRound(input: PlanInput): Promise<PlannedTrial[]>
  /** P2: thời gian chờ thích ứng theo từng mục */
  waitBeforeCueMs(itemId: string, defaults: { waitBeforeCueMs: number }): number
}
