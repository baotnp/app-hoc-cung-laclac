import { describe, expect, it } from 'vitest'
import type { Trial } from '@/data/types'
import type { BuildDisplayedInput, ItemRef } from '@/engine/games/types'
import type { SequenceCardsParams } from '@/engine/games/sequenceCards'
import {
  readSequenceCardsParams,
  sequenceCardsGame,
  sequenceCardsLayout,
} from '@/engine/games/sequenceCards'

const ITEMS: ItemRef[] = [
  { itemId: 'item-dog', itemKey: 'animal.dog' },
  { itemId: 'item-cat', itemKey: 'animal.cat' },
  { itemId: 'item-cow', itemKey: 'animal.cow' },
]

const VIEWPORTS: Trial['viewport'][] = [
  { w: 1024, h: 768, dpr: 2, orientation: 'landscape' },
  { w: 768, h: 1024, dpr: 2, orientation: 'portrait' },
  { w: 390, h: 844, dpr: 3, orientation: 'portrait' },
]

function params(overrides: Partial<SequenceCardsParams> = {}): SequenceCardsParams {
  return { cardCount: 2, slots: 'row', snapPx: 72, startLayout: 'scattered', ...overrides }
}

function input(
  p: SequenceCardsParams,
  viewport: Trial['viewport'],
  targetSlot: 0 | 1 = 0,
): BuildDisplayedInput<SequenceCardsParams> {
  return {
    planned: {
      trialIndex: 0,
      exerciseId: 'ex.fin03.sequence_cards',
      targetItemId: 'item-dog',
      distractorItemIds: ['item-cat', 'item-cow'],
      targetSlot,
      isNewItem: false,
      waitBeforeCueMs: 5000,
    },
    items: ITEMS,
    params: p,
    viewport,
  }
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function inside(r: Rect, viewport: Trial['viewport']): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= viewport.w && r.y + r.h <= viewport.h
}

describe('sequenceCardsParamsSchema', () => {
  it('nhận 2 hoặc 3 thẻ, snapPx trong 40..120', () => {
    expect(sequenceCardsGame.parseParams(params()).ok).toBe(true)
    expect(sequenceCardsGame.parseParams(params({ cardCount: 3 })).ok).toBe(true)
    expect(sequenceCardsGame.parseParams(params({ snapPx: 20 })).ok).toBe(false)
    expect(sequenceCardsGame.parseParams(params({ snapPx: 200 })).ok).toBe(false)
    expect(sequenceCardsGame.parseParams({ ...params(), cardCount: 4 }).ok).toBe(false)
    // strictObject: trường lạ bị chặn để JSON bài không âm thầm sai tên.
    expect(sequenceCardsGame.parseParams({ ...params(), extra: 1 }).ok).toBe(false)
  })

  it('readSequenceCardsParams trả mặc định an toàn khi gameData thiếu', () => {
    expect(readSequenceCardsParams(undefined)).toEqual(params())
    expect(readSequenceCardsParams({ params: { cardCount: 99 } })).toEqual(params())
    expect(readSequenceCardsParams({ params: params({ cardCount: 3 }) }).cardCount).toBe(3)
  })
})

describe('sequenceCardsLayout', () => {
  it('ô đích thành hàng ngang đều nhau ở nửa trên, thẻ xuất phát ở nửa dưới', () => {
    for (const viewport of VIEWPORTS) {
      for (const cardCount of [2, 3] as const) {
        const layout = sequenceCardsLayout(viewport, params({ cardCount }))
        expect(layout.slots).toHaveLength(cardCount)
        expect(layout.starts).toHaveLength(cardCount)

        // Cùng một hàng: cùng y, cùng kích thước, trái → phải.
        const first = layout.slots[0]!
        for (const slot of layout.slots) {
          expect(slot.y).toBe(first.y)
          expect(slot.w).toBe(first.w)
          expect(slot.h).toBe(first.h)
          expect(inside(slot, viewport)).toBe(true)
        }
        for (let i = 1; i < layout.slots.length; i++) {
          expect(layout.slots[i]!.x).toBeGreaterThan(layout.slots[i - 1]!.x)
        }

        // Thẻ xuất phát nằm dưới hàng ô đích và không đè lên nó.
        for (const start of layout.starts) {
          expect(inside(start, viewport)).toBe(true)
          expect(start.y).toBeGreaterThan(first.y + first.h)
        }
      }
    }
  })

  it('không ô/thẻ nào chồng nhau, kể cả khi xếp thành cọc', () => {
    for (const viewport of VIEWPORTS) {
      for (const startLayout of ['scattered', 'stack'] as const) {
        const layout = sequenceCardsLayout(viewport, params({ cardCount: 3, startLayout }))
        const all = [...layout.slots, ...layout.starts]
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            expect(overlaps(all[i]!, all[j]!)).toBe(false)
          }
        }
      }
    }
  })
})

describe('sequenceCardsGame.buildDisplayed', () => {
  it('trả đủ số thẻ, mỗi thẻ một chỗ xuất phát riêng trong khung nhìn', () => {
    for (const viewport of VIEWPORTS) {
      for (const cardCount of [2, 3] as const) {
        const p = params({ cardCount })
        const displayed = sequenceCardsGame.buildDisplayed(input(p, viewport))
        expect(displayed).toHaveLength(cardCount)
        expect(new Set(displayed.map((d) => d.itemId)).size).toBe(cardCount)
        expect(new Set(displayed.map((d) => d.slot)).size).toBe(cardCount)
        for (const choice of displayed) {
          expect(inside(choice.rect, viewport)).toBe(true)
        }
        for (let i = 0; i < displayed.length; i++) {
          for (let j = i + 1; j < displayed.length; j++) {
            expect(overlaps(displayed[i]!.rect, displayed[j]!.rect)).toBe(false)
          }
        }
      }
    }
  })

  it('targetSlot đổi chỗ xuất phát của thẻ mục đích', () => {
    const p = params()
    const viewport = VIEWPORTS[0]!
    const a = sequenceCardsGame.buildDisplayed(input(p, viewport, 0))
    const b = sequenceCardsGame.buildDisplayed(input(p, viewport, 1))
    expect(a.find((d) => d.itemId === 'item-dog')?.slot).toBe(0)
    expect(b.find((d) => d.itemId === 'item-dog')?.slot).toBe(1)
  })

  it('kho thiếu thẻ thì xếp ít thẻ hơn, không làm vỡ buổi học', () => {
    // Đã xảy ra trên máy thật: bộ lập lịch cấp 2 mục cho bài khai 3 thẻ,
    // `buildDisplayed` ném lỗi và cả app trắng xóa giữa buổi học của bé.
    const p = params({ cardCount: 3 })
    const viewport = VIEWPORTS[0]!
    const thin = input(p, viewport)
    thin.planned.distractorItemIds = ['item-cat']

    const out = sequenceCardsGame.buildDisplayed(thin)
    expect(out).toHaveLength(2)
    expect(out.map((c) => c.itemId)).toContain(thin.planned.targetItemId)
    expect(new Set(out.map((c) => c.slot)).size).toBe(2)
    for (const c of out) {
      expect(c.rect.w).toBeGreaterThan(0)
      expect(c.rect.x).toBeGreaterThanOrEqual(0)
      expect(c.rect.x + c.rect.w).toBeLessThanOrEqual(viewport.w)
    }
  })

  it('chỉ còn mỗi mục đích thì vẫn ném lỗi — không có gì để xếp', () => {
    const thin = input(params({ cardCount: 3 }), VIEWPORTS[0]!)
    thin.planned.distractorItemIds = []
    thin.items = thin.items.filter((i) => i.itemId !== thin.planned.targetItemId)
    expect(() => sequenceCardsGame.buildDisplayed(thin)).toThrow()
  })

  it('khai báo đúng loại và detector mặc định', () => {
    expect(sequenceCardsGame.type).toBe('sequence_cards')
    expect(sequenceCardsGame.defaultDetector).toBe('touch_drag')
  })
})
