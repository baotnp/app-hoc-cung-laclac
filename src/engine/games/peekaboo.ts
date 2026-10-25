// Loại bài `peekaboo` (bài 1 của cô — IMI-01 "Bắt chước chơi ú òa").
// Trên iPad chỉ có MỘT tấm khăn phủ MỘT thẻ hình: bé chạm khăn, khăn trượt lên, lộ hình.
// Module này chỉ dựng bố cục + kiểm params; hiệu ứng khăn do `PeekabooScreen` lo.

import { z } from 'zod'
import type { DisplayedChoice } from '@/data/types'
import { formatIssues } from '../schema'
import type { BuildDisplayedInput, GameModule, ParamsResult, Viewport } from './types'

/** Lề quanh thẻ hình duy nhất — đủ rộng để khăn trượt lên mà không chạm mép. */
const MARGIN_RATIO = 0.06

// Thông điệp lỗi khi nạp tệp bài tập: dành cho ba mẹ/nhật ký, không phải chữ trên
// màn hình nên không nằm trong vi.ts (giống các thông điệp zod ở schema.ts).
const ERR = {
  cover: 'Phải là "cloth" (khăn) hoặc "hands" (bàn tay)',
  revealMsMin: 'Thời gian mở khăn tối thiểu 300 ms',
  revealMsMax: 'Thời gian mở khăn tối đa 900 ms',
  revealMsType: 'Thời gian mở khăn phải là số mili giây',
  repeatInvite: 'Phải là true/false: có phủ khăn lại mời bé chơi tiếp hay không',
}

/** Tham số bài ú òa (xem docs/10 §Bài 1). */
export const peekabooParamsSchema = z.strictObject({
  // Cô dạy hai cách che: hai bàn tay hoặc phủ khăn; trên iPad vẽ khác nhau.
  cover: z.enum(['cloth', 'hands'], { error: ERR.cover }),
  // Mở quá nhanh thì bé không kịp nhìn, quá chậm thì mất tính bất ngờ.
  revealMs: z
    .number({ error: ERR.revealMsType })
    .min(300, { error: ERR.revealMsMin })
    .max(900, { error: ERR.revealMsMax }),
  repeatInvite: z.boolean({ error: ERR.repeatInvite }),
})

export type PeekabooParams = z.infer<typeof peekabooParamsSchema>

/** Giá trị an toàn khi tệp bài thiếu params — màn của bé không bao giờ được vỡ giữa buổi học. */
const PEEKABOO_FALLBACK: PeekabooParams = { cover: 'cloth', revealMs: 450, repeatInvite: true }

/** Đọc params đã kiểm từ `setup.gameData` cho màn của bé. */
export function readPeekabooParams(
  gameData: Record<string, unknown> | undefined,
): PeekabooParams {
  const parsed = peekabooParamsSchema.safeParse(gameData?.params)
  return parsed.success ? parsed.data : PEEKABOO_FALLBACK
}

/** Vùng giữa màn hình dành cho thẻ hình bị khăn phủ (chiếm gần hết khung nhìn). */
export function peekabooRect(viewport: Viewport): { x: number; y: number; w: number; h: number } {
  const margin = Math.floor(Math.min(viewport.w, viewport.h) * MARGIN_RATIO)
  return {
    x: margin,
    y: margin,
    w: Math.max(0, viewport.w - 2 * margin),
    h: Math.max(0, viewport.h - 2 * margin),
  }
}

export const peekabooGame: GameModule<PeekabooParams> = {
  type: 'peekaboo',
  defaultDetector: 'touch_choice',
  choices: 1,

  parseParams(params: unknown): ParamsResult<PeekabooParams> {
    const parsed = peekabooParamsSchema.safeParse(params)
    if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) }
    return { ok: true, value: parsed.data }
  },

  buildDisplayed(input: BuildDisplayedInput<PeekabooParams>): DisplayedChoice[] {
    const { planned, items, viewport } = input
    const target = items.find((i) => i.itemId === planned.targetItemId)
    if (!target) throw new Error('Thiếu mục đích cho lượt ú òa')

    // Chỉ một ô: không có lựa chọn nào để bé chọn sai, `slot` luôn là 0.
    return [
      {
        itemId: target.itemId,
        itemKey: target.itemKey,
        slot: 0,
        rect: peekabooRect(viewport),
      },
    ]
  },
}
