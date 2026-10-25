// Loại bài `say_name` (bài 13 của cô — LAN-01 "Tập gọi tên các con vật nuôi bằng từ đơn").
// iPad chỉ là tấm tranh lớn; ba mẹ làm mẫu, hỏi "Con gì đây?", đợi 3–5 giây rồi chấm.
// Không có gì cho bé chạm nên detector mặc định là `parent_confirm`.

import { z } from 'zod'
import type { DisplayedChoice } from '@/data/types'
import { formatIssues } from '../schema'
import type { BuildDisplayedInput, GameModule, ParamsResult, Viewport } from './types'

// Thông điệp lỗi khi nạp tệp bài tập: dành cho ba mẹ/nhật ký, không phải chữ trên
// màn hình nên không nằm trong vi.ts (giống các thông điệp zod ở schema.ts).
const ERR = {
  modelRepeatsType: 'Số lần làm mẫu phải là số nguyên',
  modelRepeatsMin: 'Phải làm mẫu ít nhất 1 lần',
  modelRepeatsMax: 'Làm mẫu nhiều nhất 5 lần kẻo bé mệt',
  promptStyle: 'Phải là "what_is_this" (Con gì đây?) hoặc "name_it" (Gọi tên con vật)',
  ratioType: 'Tỷ lệ diện tích tranh phải là số',
  ratioMin: 'Tranh phải chiếm ít nhất 40% màn hình để bé nhìn rõ',
  ratioMax: 'Tỷ lệ diện tích tranh không vượt quá 1',
}

/** Tham số bài gọi tên (xem docs/10 §Bài 13). */
export const sayNameParamsSchema = z.strictObject({
  // Cô dặn gọi tên 2–3 lần bằng từ đơn trước khi hỏi.
  modelRepeats: z
    .number({ error: ERR.modelRepeatsType })
    .int({ error: ERR.modelRepeatsType })
    .min(1, { error: ERR.modelRepeatsMin })
    .max(5, { error: ERR.modelRepeatsMax }),
  promptStyle: z.enum(['what_is_this', 'name_it'], { error: ERR.promptStyle }),
  // Tranh phải "ngang tầm mắt" và thật to: tối thiểu 40% diện tích khung nhìn.
  imageAreaRatio: z
    .number({ error: ERR.ratioType })
    .min(0.4, { error: ERR.ratioMin })
    .max(1, { error: ERR.ratioMax }),
})

export type SayNameParams = z.infer<typeof sayNameParamsSchema>

/** Giá trị an toàn khi tệp bài thiếu params (xem ghi chú ở peekaboo.ts). */
const SAY_NAME_FALLBACK: SayNameParams = {
  modelRepeats: 3,
  promptStyle: 'what_is_this',
  imageAreaRatio: 0.5,
}

/** Đọc params đã kiểm từ `setup.gameData` cho màn của bé. */
export function readSayNameParams(gameData: Record<string, unknown> | undefined): SayNameParams {
  const parsed = sayNameParamsSchema.safeParse(gameData?.params)
  return parsed.success ? parsed.data : SAY_NAME_FALLBACK
}

/**
 * Ô tranh duy nhất, đặt giữa màn, giữ đúng `imageAreaRatio` diện tích khung nhìn
 * và giữ nguyên tỷ lệ khung hình của màn để tranh không bị dẹt.
 */
export function sayNameRect(
  viewport: Viewport,
  imageAreaRatio: number,
): { x: number; y: number; w: number; h: number } {
  const scale = Math.sqrt(Math.min(1, Math.max(0, imageAreaRatio)))
  const w = Math.floor(viewport.w * scale)
  const h = Math.floor(viewport.h * scale)
  return {
    x: Math.floor((viewport.w - w) / 2),
    y: Math.floor((viewport.h - h) / 2),
    w,
    h,
  }
}

export const sayNameGame: GameModule<SayNameParams> = {
  type: 'say_name',
  defaultDetector: 'parent_confirm',
  choices: 1,

  parseParams(params: unknown): ParamsResult<SayNameParams> {
    const parsed = sayNameParamsSchema.safeParse(params)
    if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) }
    return { ok: true, value: parsed.data }
  },

  buildDisplayed(input: BuildDisplayedInput<SayNameParams>): DisplayedChoice[] {
    const { planned, items, params, viewport } = input
    const target = items.find((i) => i.itemId === planned.targetItemId)
    if (!target) throw new Error('Thiếu mục đích cho lượt gọi tên')

    return [
      {
        itemId: target.itemId,
        itemKey: target.itemKey,
        slot: 0,
        rect: sayNameRect(viewport, params.imageAreaRatio),
      },
    ]
  },
}
