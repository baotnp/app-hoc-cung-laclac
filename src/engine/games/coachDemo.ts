// Loại bài `coach_demo` — 12/18 bài của cô (2, 3, 4, 8, 10, 11, 12, 14, 15, 16, 17, 18).
// Hoạt động xảy ra ngoài đời giữa ba mẹ và bé; iPad chỉ giữ chú ý bằng một hình minh họa lớn,
// nhắc ba mẹ đúng câu/đúng bước, rồi nhận kết quả do ba mẹ chấm (docs/10 §4).

import { z } from 'zod'
import type { DisplayedChoice } from '@/data/types'
import { formatIssues } from '../schema'
import type { BuildDisplayedInput, GameModule, ParamsResult, Viewport } from './types'

/** Động tác linh vật đi kèm; `none` cho bài không có động tác đặc trưng. */
export type CoachMascotCue = 'wave' | 'clap' | 'walk' | 'crawl' | 'none'

/**
 * Bước dạy của cô: `label` là câu/điều ba mẹ làm ngay lúc này (liếc mắt là đọc được),
 * `detail` là mô tả đầy đủ hơn cho lần đầu làm.
 */
export const coachDemoStepSchema = z.strictObject({
  label: z.string().min(1),
  detail: z.string().min(1),
})

export const coachDemoParamsSchema = z.strictObject({
  /** Khóa hình minh họa, ví dụ "ball", "tunnel", "truck" (ảnh `object.<activity>`). */
  activity: z.string().min(1),
  mascotCue: z.enum(['wave', 'clap', 'walk', 'crawl', 'none']),
  // Cô luôn dạy theo 3 bước (làm mẫu → cầm tay → giảm hỗ trợ); cho phép 2–4 để gộp/tách.
  parentSteps: z.array(coachDemoStepSchema).min(2).max(4),
  /** 0 hoặc bỏ = không đếm giờ. Dùng cho các bài cô dặn "đợi 3–5 giây". */
  showStepTimerMs: z.number().int().min(0).max(60_000).optional(),
})

export type CoachDemoStep = z.infer<typeof coachDemoStepSchema>
export type CoachDemoParams = z.infer<typeof coachDemoParamsSchema>

/** Chiều cao dải của ba mẹ (px). Dùng chung giữa bố cục ô hình và màn hình. */
export const COACH_PARENT_STRIP_PX = 124

const MARGIN_RATIO = 0.04

/**
 * Params đã kiểm nằm ở `TrialSetup.gameData.params` (do `buildTrialSetup` đặt vào).
 * Thiếu hoặc hỏng thì trả bộ rỗng an toàn: màn vẫn chạy để buổi học của bé không đứt,
 * chỉ là không có thẻ nhắc bước.
 */
export function readCoachDemoParams(
  gameData: Record<string, unknown> | undefined,
): CoachDemoParams {
  const raw = gameData?.params ?? gameData
  const parsed = coachDemoParamsSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return { activity: '', mascotCue: 'none', parentSteps: [] }
}

export const coachDemoGame: GameModule<CoachDemoParams> = {
  type: 'coach_demo',
  defaultDetector: 'parent_confirm',
  choices: 1,

  parseParams(params: unknown): ParamsResult<CoachDemoParams> {
    const parsed = coachDemoParamsSchema.safeParse(params)
    if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) }
    return { ok: true, value: parsed.data }
  },

  buildDisplayed(input: BuildDisplayedInput<CoachDemoParams>): DisplayedChoice[] {
    const { planned, items, params, viewport } = input
    // Hình minh họa phải là đồ của chính hoạt động đó: bài "chui qua đường hầm" luôn
    // hiện đường hầm. Kho nhiều mục chỉ để engine xoay vòng mục đích khi chấm tiến bộ;
    // nếu lấy mục đích làm hình thì bài đường hầm có lúc hiện quả bóng (đã xảy ra).
    const shown =
      items.find((i) => i.itemKey.endsWith(`.${params.activity}`)) ??
      items.find((i) => i.itemId === planned.targetItemId)
    if (!shown) throw new Error('Thiếu mục đích cho lượt coach_demo')
    return [
      {
        itemId: shown.itemId,
        itemKey: shown.itemKey,
        slot: 0,
        rect: coachDemoRect(viewport),
      },
    ]
  },
}

/** Một ô duy nhất chiếm gần hết màn, trừ dải của ba mẹ sát mép dưới. */
export function coachDemoRect(viewport: Viewport): DisplayedChoice['rect'] {
  const margin = Math.floor(Math.min(viewport.w, viewport.h) * MARGIN_RATIO)
  const w = Math.max(1, viewport.w - 2 * margin)
  const h = Math.max(1, viewport.h - 2 * margin - COACH_PARENT_STRIP_PX)
  return { x: margin, y: margin, w, h }
}
