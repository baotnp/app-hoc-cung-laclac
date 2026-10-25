// Zod của tệp bài tập (06 §4.1). Nguồn sự thật của JSON Schema ở content/schema/exercise.schema.json.
// Chỉ kiểm dữ liệu, không chạm DOM, không chạm cơ sở dữ liệu.

import { z } from 'zod'
import type { Exercise, ExerciseConfig } from '@/data/types'
import { withBase } from '@/lib/ids'
import { peekabooParamsSchema } from './games/peekaboo'
import { sayNameParamsSchema } from './games/sayName'
import { sequenceCardsParamsSchema } from './games/sequenceCards'
import { coachDemoParamsSchema } from './games/coachDemo'

// ----------------------------------------------------------------- bảng giá trị

const itemCategory = z.enum([
  'pet_animal',
  'personal_object',
  'daily_object',
  'reward',
  'fruit',
  'vehicle',
  'other',
])

const audioRole = z.enum(['instruction', 'praise', 'sound', 'bridge', 'then'])

const exerciseType = z.enum([
  'choose_from_two',
  'peekaboo',
  'sequence_cards',
  'offline_guide',
  'coach_demo',
  'drag_to_jar',
  'turn_taking',
  'slice_fruit',
  'drive_truck',
  'say_name',
  'aac_request',
])

const detectorKind = z.enum([
  'touch_choice',
  'touch_reveal',
  'touch_drag',
  'touch_swipe',
  'touch_button',
  'parent_confirm',
  'voice_activity',
  'hand_pose',
  'body_pose',
])

// ------------------------------------------------------- params theo từng loại bài

/** 06 §4.1 $defs/chooseFromTwoParams. */
export const chooseFromTwoParamsSchema = z.strictObject({
  choices: z.literal(2),
  layout: z.object({
    // GĐ-08: mỗi hình chiếm tối thiểu 1/3 khung nhìn.
    minCardAreaRatio: z.number().min(0.333),
  }),
  positions: z.object({
    strategy: z.literal('balanced_shuffle'),
    maxSameSideRun: z.number().int().min(1).max(5),
  }),
  distractor: z.object({
    strategy: z.literal('random_other_in_pool'),
    avoidRepeatLast: z.number().int().min(0).optional(),
  }),
})

export type ChooseFromTwoParamsInput = z.infer<typeof chooseFromTwoParamsSchema>

/** Bảng tra params theo loại bài; loại không có mục ở đây thì không kiểm `params`. */
const paramsByType: Partial<Record<z.infer<typeof exerciseType>, z.ZodType>> = {
  choose_from_two: chooseFromTwoParamsSchema,
  peekaboo: peekabooParamsSchema,
  say_name: sayNameParamsSchema,
  sequence_cards: sequenceCardsParamsSchema,
  coach_demo: coachDemoParamsSchema,
}

// --------------------------------------------------------------- tệp bài tập

const baseExerciseFileSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^ex\.[a-z0-9_.]+$/, 'id phải có dạng ex.<slug>'),
  code: z
    .string()
    .regex(/^(IMI|FIN|COG|SOC|LAN|GRO)-[0-9]{2}$/, 'code phải có dạng COG-01'),
  type: exerciseType,
  title: z.string().min(1),
  group: z.string().optional(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  configVersion: z.number().int().min(1),

  itemPool: z.strictObject({
    category: itemCategory,
    keys: z
      .array(z.string())
      .min(2)
      .refine((keys) => new Set(keys).size === keys.length, 'keys không được trùng'),
    minItems: z.number().int().min(2),
  }),

  requiredAudio: z.array(audioRole).optional(),

  response: z.object({
    detector: detectorKind,
    acceptOn: z.enum(['pointerdown', 'pointerup']).default('pointerup'),
    maxMovePx: z.number().min(0).default(24),
    ignoreFirstMs: z.number().int().min(0).default(150),
    hitSlopPx: z.number().min(0).default(24),
  }),

  params: z.record(z.string(), z.unknown()).optional(),

  timing: z.object({
    waitBeforeCueMs: z.number().int().min(1000).max(30_000),
    afterCueTimeoutMs: z.number().int().min(3000).max(60_000),
    // 04 §2: ngưỡng yên tĩnh của --dur-reward.
    rewardMaxMs: z.number().int().min(300).max(1200).optional(),
    cue: z.object({
      kind: z.enum(['raise_correct', 'mascot_point', 'none']),
      repeatInstruction: z.boolean().optional(),
    }),
  }),

  scheduling: z.object({
    // GĐ-06: bảng sao cố định 5 ô ở MVP.
    trialsPerRound: z.literal(5),
    newItemRatio: z.number().min(0).max(1),
    knownMinTrials: z.number().int().min(1),
    firstTrialKnownItem: z.boolean(),
  }),

  mastery: z.object({
    metric: z.literal('independent_correct_rate'),
    threshold: z.number().min(0).max(1),
    lastSessions: z.number().int().min(1),
    minTrials: z.number().int().min(1),
  }),

  reward: z.object({
    // Enum không có âm "sai" — 01 §4, GĐ-09. Mức ăn mừng (hoan hô/sao bung) là
    // tuỳ chọn của ba mẹ ở `ChildSettings.celebrationLevel`, không đặt theo từng bài.
    perTrial: z.array(z.enum(['mascot_nod', 'praise_audio', 'star_ting'])),
    echoWord: z.boolean().optional(),
    onRoundComplete: z.literal('party_standard'),
    party: z.record(z.string(), z.unknown()).optional(),
  }),

  // Câu của cô cho chính bài này; `{label}` được thay bằng tên mục lúc chạy.
  spoken: z.partialRecord(audioRole, z.string().min(1)).optional(),

  bridge: z.object({
    target: z.literal('newest_or_ready_item'),
    promptAudioRole: z.literal('bridge').optional(),
    levels: z.strictObject({
      '2': z.object({ guide: z.string() }),
      '3': z.object({ guide: z.string() }),
      '4': z.object({ guide: z.string() }),
    }),
  }),

  sensory: z.object({
    noWrongSound: z.literal(true),
    noText: z.literal(true),
  }),

  confirm: z
    .object({
      status: z.enum(['assumed', 'confirmed']),
      by: z.string().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date phải là YYYY-MM-DD').optional(),
      fields: z.array(z.string()).optional(),
    })
    .optional(),
})

/** Kiểm tra ngoài JSON Schema (06 §4.1, đoạn cuối). */
export const exerciseFileSchema = baseExerciseFileSchema.superRefine((value, ctx) => {
  if (value.timing.afterCueTimeoutMs <= value.timing.waitBeforeCueMs) {
    ctx.addIssue({
      code: 'custom',
      path: ['timing', 'afterCueTimeoutMs'],
      message: 'afterCueTimeoutMs phải lớn hơn waitBeforeCueMs',
    })
  }

  if (value.itemPool.minItems > value.itemPool.keys.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['itemPool', 'minItems'],
      message: 'minItems không được lớn hơn số keys',
    })
  }

  if (value.requiredAudio && value.requiredAudio.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['requiredAudio'],
      message: 'requiredAudio không được rỗng',
    })
  }

  const paramsSchema = paramsByType[value.type]
  if (paramsSchema) {
    const parsed = paramsSchema.safeParse(value.params)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: ['params', ...issue.path],
          message: issue.message,
        })
      }
    }
  }
})

export type ExerciseFile = z.infer<typeof exerciseFileSchema>

export type ParseExerciseResult =
  | { ok: true; value: Exercise }
  | { ok: false; errors: string[] }

/** Chuỗi lỗi cho ba mẹ/nhật ký: `đường.dẫn: thông điệp`. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map((p) => String(p)).join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

/** Tách tệp JSON thành bản ghi `Exercise` (danh tính) + `ExerciseConfig` (nội dung). */
export function exerciseFromFile(file: ExerciseFile, now: number = Date.now()): Exercise {
  const { schemaVersion, id, code, type, title, phase, configVersion, ...config } = file
  void schemaVersion
  return withBase(
    {
      code,
      type,
      title,
      phase,
      active: true,
      configVersion,
      config: config satisfies ExerciseConfig,
    },
    now,
    id,
  )
}

/** Kiểm một tệp bài tập; không ném lỗi. */
export function parseExerciseFile(json: unknown, now: number = Date.now()): ParseExerciseResult {
  const result = exerciseFileSchema.safeParse(json)
  if (!result.success) return { ok: false, errors: formatIssues(result.error) }
  return { ok: true, value: exerciseFromFile(result.data, now) }
}
