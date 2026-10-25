// Loại bài `sequence_cards` — bài 6 của cô (FIN-03 "Tập xếp thẻ tranh thành hàng", docs/10 §4).
// "Thành hàng" = xếp liền nhau thành MỘT HÀNG NGANG, không phải sắp theo thứ tự nội dung
// (docs/10 §4, trả lời Q-15). Vì vậy thẻ nào vào ô nào cũng được; lượt xong khi hàng đủ thẻ.

import { z } from 'zod'
import type { DisplayedChoice } from '@/data/types'
import { formatIssues } from '../schema'
import type { DragRect } from '../detectors/touchDrag'
import type { BuildDisplayedInput, GameModule, ParamsResult, Viewport } from './types'

export const sequenceCardsParamsSchema = z.strictObject({
  /** Cô bắt đầu bằng 2 thẻ, lên 3 khi bé quen. Hơn 3 thẻ quá sức bé 21 tháng. */
  cardCount: z.union([z.literal(2), z.literal(3)]),
  slots: z.literal('row'),
  // 40 px là tối thiểu để ngón tay bé vẫn "bắt" được ô; trên 120 px thì ô nào cũng hút.
  snapPx: z.number().min(40).max(120),
  startLayout: z.enum(['scattered', 'stack']),
})

export type SequenceCardsParams = z.infer<typeof sequenceCardsParamsSchema>

const DEFAULT_PARAMS: SequenceCardsParams = {
  cardCount: 2,
  slots: 'row',
  snapPx: 72,
  startLayout: 'scattered',
}

/** Lề quanh màn và chỗ để trống phía trên cho bảng sao (tỷ lệ theo khung nhìn). */
const MARGIN_RATIO = 0.04
const GAP_RATIO = 0.03
const STARS_BAND_RATIO = 0.14
const SLOT_MAX_HEIGHT_RATIO = 0.3

export interface SequenceCardsLayout {
  /** Ô đích rỗng, trái → phải. */
  slots: DragRect[]
  /** Vị trí xuất phát của thẻ, cùng thứ tự với `DisplayedChoice.slot`. */
  starts: DragRect[]
}

/**
 * Params đã kiểm nằm ở `TrialSetup.gameData.params`. Thiếu hoặc hỏng thì trả bộ mặc định
 * (2 thẻ, rải nhẹ) để buổi học của bé không đứt giữa chừng.
 */
export function readSequenceCardsParams(
  gameData: Record<string, unknown> | undefined,
): SequenceCardsParams {
  const raw = gameData?.params ?? gameData
  const parsed = sequenceCardsParamsSchema.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_PARAMS
}

/**
 * Hàng ô đích ở nửa trên (dưới bảng sao), thẻ xuất phát ở nửa dưới — tay bé với tới được
 * và không che hàng đang xếp. Mọi kích thước tính theo khung nhìn như `chooseFromTwoRects`.
 */
export function sequenceCardsLayout(
  viewport: Viewport,
  params: SequenceCardsParams,
): SequenceCardsLayout {
  const count = params.cardCount
  const margin = Math.max(4, Math.floor(Math.min(viewport.w, viewport.h) * MARGIN_RATIO))
  const gap = Math.max(4, Math.floor(viewport.w * GAP_RATIO))
  const starsBand = Math.floor(viewport.h * STARS_BAND_RATIO)
  const rowTop = starsBand + margin

  const widthLimit = Math.floor((viewport.w - 2 * margin - (count - 1) * gap) / count)
  const heightLimit = Math.floor(viewport.h * SLOT_MAX_HEIGHT_RATIO)
  // Hai dải (ô đích + thẻ xuất phát) phải cùng nằm dưới bảng sao, nên cạnh thẻ còn bị
  // chặn bởi nửa chiều cao còn lại; nếu không, thẻ xuất phát sẽ đè lên hàng ô đích.
  const bandLimit = Math.floor((viewport.h - rowTop - margin - gap) / 2)
  const side = Math.max(1, Math.min(widthLimit, heightLimit, bandLimit))

  const rowWidth = count * side + (count - 1) * gap
  const rowLeft = Math.floor((viewport.w - rowWidth) / 2)
  const slots: DragRect[] = []
  for (let i = 0; i < count; i++) {
    slots.push({ x: rowLeft + i * (side + gap), y: rowTop, w: side, h: side })
  }

  const startTop = viewport.h - margin - side
  const starts: DragRect[] =
    params.startLayout === 'stack'
      ? stackStarts(viewport, count, side, margin)
      : scatteredStarts(count, side, gap, rowLeft, startTop, rowTop, viewport, margin)

  return { slots, starts }
}

/** Rải nhẹ: cùng khoảng cách với hàng ô đích (nên không bao giờ chồng nhau), lệch dọc xen kẽ. */
function scatteredStarts(
  count: number,
  side: number,
  gap: number,
  rowLeft: number,
  startTop: number,
  rowTop: number,
  viewport: Viewport,
  margin: number,
): DragRect[] {
  const jitter = Math.floor(Math.min(side * 0.1, (startTop - (rowTop + side + gap)) / 2))
  const starts: DragRect[] = []
  for (let i = 0; i < count; i++) {
    const offset = jitter > 0 && i % 2 === 1 ? -jitter : 0
    const y = Math.min(Math.max(startTop + offset, rowTop + side + gap), viewport.h - margin - side)
    starts.push({ x: rowLeft + i * (side + gap), y, w: side, h: side })
  }
  return starts
}

/**
 * "Cọc" thẻ: xếp sát nhau ở góc dưới bên trái nhưng **xòe nhẹ, không chồng lên nhau** —
 * bé 21 tháng chưa nhặt được thẻ bị thẻ khác che.
 */
function stackStarts(viewport: Viewport, count: number, side: number, margin: number): DragRect[] {
  const tightGap = Math.max(4, Math.floor(side * 0.08))
  const width = count * side + (count - 1) * tightGap
  const left = width + 2 * margin <= viewport.w ? margin : Math.floor((viewport.w - width) / 2)
  const y = viewport.h - margin - side
  const starts: DragRect[] = []
  for (let i = 0; i < count; i++) {
    starts.push({ x: left + i * (side + tightGap), y, w: side, h: side })
  }
  return starts
}

export const sequenceCardsGame: GameModule<SequenceCardsParams> = {
  type: 'sequence_cards',
  defaultDetector: 'touch_drag',
  // Số thẻ tối đa hiển thị cùng lúc; mỗi bài chọn 2 hay 3 qua `params.cardCount`.
  choices: 3,

  parseParams(params: unknown): ParamsResult<SequenceCardsParams> {
    const parsed = sequenceCardsParamsSchema.safeParse(params)
    if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) }
    return { ok: true, value: parsed.data }
  },

  buildDisplayed(input: BuildDisplayedInput<SequenceCardsParams>): DisplayedChoice[] {
    const { planned, items, params, viewport } = input
    const ids = [planned.targetItemId, ...planned.distractorItemIds].slice(0, params.cardCount)
    const cards = ids
      .map((id) => items.find((i) => i.itemId === id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
    if (cards.length === 0) throw new Error('Thiếu mục đích cho lượt xếp thẻ')

    // Kho nhỏ hơn `cardCount` thì xếp ít thẻ hơn thay vì ném lỗi: một bài thiếu ảnh
    // không được làm vỡ cả buổi học của bé (đã xảy ra: màn trắng giữa buổi).
    const count = cards.length
    const layout = count === params.cardCount ? params : { ...params, cardCount: count as 2 | 3 }

    // Xoay danh sách để thẻ mục đích không luôn nằm ở cùng một chỗ xuất phát
    // (hàng xếp không theo thứ tự nội dung nên xoay là đủ, không cần xáo trộn).
    const shift = planned.targetSlot % count
    const { starts } = sequenceCardsLayout(viewport, layout)

    return cards.map((card, i) => {
      const slot = (i + shift) % count
      return {
        itemId: card.itemId,
        itemKey: card.itemKey,
        slot,
        rect: starts[slot] as DisplayedChoice['rect'],
      }
    })
  },
}
