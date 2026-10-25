// Loại bài `choose_from_two` (02 COG-01/COG-03/FIN-02). Chỉ dựng bố cục + kiểm params;
// hiệu ứng và hình ảnh do màn lượt lo.

import type { ChooseFromTwoParams, DisplayedChoice } from '@/data/types'
import { chooseFromTwoParamsSchema, formatIssues } from '../schema'
import type { BuildDisplayedInput, GameModule, ParamsResult, Viewport } from './types'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const MARGIN_RATIO = 0.04
const GAP_RATIO = 0.06

/**
 * Hai thẻ cạnh nhau (ngang) hoặc trên dưới (dọc), mỗi thẻ chiếm ít nhất `minCardAreaRatio`
 * diện tích khung nhìn (GĐ-08). Lề và khoảng cách bị thu nhỏ đều cho tới khi đạt tỷ lệ.
 */
export function chooseFromTwoRects(viewport: Viewport, minCardAreaRatio: number): [Rect, Rect] {
  const horizontal = viewport.orientation === 'landscape'
  const along = horizontal ? viewport.w : viewport.h
  const across = horizontal ? viewport.h : viewport.w
  const marginBase = Math.min(viewport.w, viewport.h) * MARGIN_RATIO
  const gapBase = along * GAP_RATIO
  const area = viewport.w * viewport.h

  const ratioAt = (scale: number) => {
    const margin = marginBase * scale
    const gap = gapBase * scale
    const cardAlong = (along - 2 * margin - gap) / 2
    const cardAcross = across - 2 * margin
    return area > 0 ? (cardAlong * cardAcross) / area : 0
  }

  // ratioAt giảm đơn điệu theo scale; scale = 0 cho tỷ lệ 0,5 nên luôn tìm được nghiệm.
  let scale = 1
  if (ratioAt(1) < minCardAreaRatio) {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (ratioAt(mid) >= minCardAreaRatio) lo = mid
      else hi = mid
    }
    scale = lo
  }

  const margin = Math.floor(marginBase * scale)
  const gap = Math.floor(gapBase * scale)
  const cardAlong = Math.floor((along - 2 * margin - gap) / 2)
  const cardAcross = Math.floor(across - 2 * margin)
  const second = margin + cardAlong + gap

  if (horizontal) {
    return [
      { x: margin, y: margin, w: cardAlong, h: cardAcross },
      { x: second, y: margin, w: cardAlong, h: cardAcross },
    ]
  }
  return [
    { x: margin, y: margin, w: cardAcross, h: cardAlong },
    { x: margin, y: second, w: cardAcross, h: cardAlong },
  ]
}

export const chooseFromTwoGame: GameModule<ChooseFromTwoParams> = {
  type: 'choose_from_two',
  defaultDetector: 'touch_choice',
  choices: 2,

  parseParams(params: unknown): ParamsResult<ChooseFromTwoParams> {
    const parsed = chooseFromTwoParamsSchema.safeParse(params)
    if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) }
    return { ok: true, value: parsed.data }
  },

  buildDisplayed(input: BuildDisplayedInput<ChooseFromTwoParams>): DisplayedChoice[] {
    const { planned, items, params, viewport } = input
    const distractorId = planned.distractorItemIds[0]
    if (distractorId === undefined) {
      throw new Error('choose_from_two cần đúng 1 hình gây nhiễu')
    }
    const target = items.find((i) => i.itemId === planned.targetItemId)
    const distractor = items.find((i) => i.itemId === distractorId)
    if (!target || !distractor) {
      throw new Error('Thiếu mục cho lượt: cần cả mục đích và mục gây nhiễu')
    }

    const rects = chooseFromTwoRects(viewport, params.layout.minCardAreaRatio)
    const targetSlot = planned.targetSlot
    const distractorSlot: 0 | 1 = targetSlot === 0 ? 1 : 0

    const bySlot: DisplayedChoice[] = [
      {
        itemId: target.itemId,
        itemKey: target.itemKey,
        slot: targetSlot,
        rect: rects[targetSlot],
      },
      {
        itemId: distractor.itemId,
        itemKey: distractor.itemKey,
        slot: distractorSlot,
        rect: rects[distractorSlot],
      },
    ]
    return bySlot.sort((a, b) => a.slot - b.slot)
  },
}
