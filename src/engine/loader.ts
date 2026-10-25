// Nạp tệp bài tập (content/exercises/*.json) và dựng dữ liệu đầu vào cho máy trạng thái.
// Không đụng cơ sở dữ liệu: nơi lưu `Exercise` là `@/data/repos`.

import type { ChildSettings, Exercise, ExerciseConfig, LocalDate, ULID, WeekStart } from '@/data/types'
import { parseExerciseFile } from './schema'
import { requireGame } from './registry'
import type { ItemRef, PlannedTrialInput, Viewport } from './games/types'
import type { TrialSetup, TrialTiming } from './trialMachine'

/** 03 §3: hai ảnh mờ dần vào 300 ms trước khi phát câu lệnh. */
export const SHOWING_MS = 300
/** 04 §2: ngưỡng yên tĩnh của `--dur-reward` khi JSON bài không ghi `rewardMaxMs`. */
export const DEFAULT_REWARD_MAX_MS = 1200

export interface ExerciseFileSource {
  /** Tên tệp/nguồn để báo lỗi cho ba mẹ. */
  source: string
  json: unknown
}

export interface LoadExercisesResult {
  exercises: Exercise[]
  failures: { source: string; errors: string[] }[]
}

export function loadExerciseFiles(
  files: ExerciseFileSource[],
  now: number = Date.now(),
): LoadExercisesResult {
  const exercises: Exercise[] = []
  const failures: { source: string; errors: string[] }[] = []
  for (const file of files) {
    const parsed = parseExerciseFile(file.json, now)
    if (parsed.ok) exercises.push(parsed.value)
    else failures.push({ source: file.source, errors: parsed.errors })
  }
  return { exercises, failures }
}

const bundledFiles = import.meta.glob('../../content/exercises/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

/** Các bài đi kèm bản cài (dữ liệu, không phải code). */
export function loadBundledExercises(now: number = Date.now()): LoadExercisesResult {
  const files = Object.entries(bundledFiles).map(([path, json]) => ({ source: path, json }))
  files.sort((a, b) => a.source.localeCompare(b.source))
  return loadExerciseFiles(files, now)
}

/**
 * Giá trị hiệu lực của một lượt (06 §1): ghi đè của ba mẹ thắng giá trị trong JSON bài.
 * `plannedWaitBeforeCueMs` là đề xuất của scheduler (P2 có thể thích ứng theo mục).
 */
export function effectiveTiming(
  config: ExerciseConfig,
  settings?: Partial<ChildSettings>,
  plannedWaitBeforeCueMs?: number,
): TrialTiming {
  return {
    showingMs: SHOWING_MS,
    waitBeforeCueMs:
      settings?.waitBeforeCueMsOverride ?? plannedWaitBeforeCueMs ?? config.timing.waitBeforeCueMs,
    afterCueTimeoutMs: settings?.afterCueTimeoutMsOverride ?? config.timing.afterCueTimeoutMs,
    rewardMaxMs: config.timing.rewardMaxMs ?? DEFAULT_REWARD_MAX_MS,
  }
}

export interface BuildTrialSetupInput {
  exercise: Exercise
  planned: PlannedTrialInput
  /** Mục đích + mục gây nhiễu (đủ `itemId`/`itemKey`). */
  items: ItemRef[]
  context: {
    childId: ULID
    sessionId: ULID
    roundIndex: number
    date: LocalDate
    weekStart: WeekStart
    schedulerId: string
    startedAt: number
  }
  viewport: Viewport
  settings?: Partial<ChildSettings>
}

/** Dựng `TrialSetup` từ bài + kế hoạch lượt của scheduler. */
export function buildTrialSetup(input: BuildTrialSetupInput): TrialSetup {
  const { exercise, planned, items, context, viewport, settings } = input
  const config = exercise.config
  const game = requireGame(exercise.type)

  const params = game.parseParams(config.params)
  if (!params.ok) {
    throw new Error(`params của ${exercise.id} không hợp lệ: ${params.errors.join('; ')}`)
  }

  const displayed = game.buildDisplayed({ planned, items, params: params.value, viewport })
  const target = items.find((i) => i.itemId === planned.targetItemId)
  if (!target) throw new Error('Thiếu mục đích cho lượt')

  return {
    childId: context.childId,
    sessionId: context.sessionId,
    roundIndex: context.roundIndex,
    trialIndex: planned.trialIndex,
    date: context.date,
    weekStart: context.weekStart,

    exerciseId: exercise.id,
    exerciseCode: exercise.code,
    configVersion: exercise.configVersion,

    targetItemId: target.itemId,
    targetItemKey: target.itemKey,
    isNewItem: planned.isNewItem,
    displayed,
    targetSlot: planned.targetSlot,

    detectorKind: config.response.detector ?? game.defaultDetector,
    detectorConfig: { ...config.response },
    startedAt: context.startedAt,

    timing: effectiveTiming(config, settings, planned.waitBeforeCueMs),
    cue: {
      kind: config.timing.cue.kind,
      repeatInstruction: config.timing.cue.repeatInstruction ?? false,
    },
    reward: {
      perTrial: [...config.reward.perTrial],
      echoWord: config.reward.echoWord ?? false,
    },

    // Params đã kiểm của loại bài: màn của bé cần chúng (ví dụ `coach_demo` cần các
    // bước cho ba mẹ). Đã parse ở trên nên màn không phải kiểm lại.
    gameData: { params: params.value },

    viewport,
    schedulerId: context.schedulerId,
  }
}
