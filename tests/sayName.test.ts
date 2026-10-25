import { describe, expect, it } from 'vitest'
import type { Trial } from '@/data/types'
import { readSayNameParams, sayNameGame } from '@/engine/games/sayName'
import type { PlannedTrialInput } from '@/engine/games/types'

const viewport: Trial['viewport'] = { w: 1194, h: 834, dpr: 2, orientation: 'landscape' }

const planned: PlannedTrialInput = {
  trialIndex: 0,
  exerciseId: 'ex.lan01.say_name',
  targetItemId: 'item-cat',
  distractorItemIds: [],
  targetSlot: 0,
  isNewItem: true,
  waitBeforeCueMs: 4000,
}

const items = [{ itemId: 'item-cat', itemKey: 'animal.cat' }]

const validParams = {
  modelRepeats: 3,
  promptStyle: 'what_is_this' as const,
  imageAreaRatio: 0.5,
}

describe('sayNameGame', () => {
  it('ba mẹ là người chấm nên detector mặc định là parent_confirm', () => {
    expect(sayNameGame.defaultDetector).toBe('parent_confirm')
    expect(sayNameGame.choices).toBe(1)
  })

  it('nhận params hợp lệ', () => {
    expect(sayNameGame.parseParams(validParams)).toEqual({ ok: true, value: validParams })
  })

  it('từ chối params sai với thông điệp tiếng Việt', () => {
    const small = sayNameGame.parseParams({ ...validParams, imageAreaRatio: 0.2 })
    expect(small.ok).toBe(false)
    if (!small.ok) expect(small.errors.join(' ')).toContain('40%')

    const repeats = sayNameGame.parseParams({ ...validParams, modelRepeats: 0 })
    expect(repeats.ok).toBe(false)
    if (!repeats.ok) expect(repeats.errors.join(' ')).toContain('ít nhất 1 lần')

    expect(sayNameGame.parseParams({ ...validParams, modelRepeats: 2.5 }).ok).toBe(false)
    expect(sayNameGame.parseParams({ ...validParams, promptStyle: 'ask' }).ok).toBe(false)
    expect(sayNameGame.parseParams({ ...validParams, extra: true }).ok).toBe(false)
  })

  it('dựng đúng một ô tranh giữa màn, đủ tỷ lệ diện tích', () => {
    const displayed = sayNameGame.buildDisplayed({ planned, items, params: validParams, viewport })
    expect(displayed).toHaveLength(1)
    expect(displayed[0]!.itemId).toBe('item-cat')
    expect(displayed[0]!.itemKey).toBe('animal.cat')
    expect(displayed[0]!.slot).toBe(0)

    const rect = displayed[0]!.rect
    const ratio = (rect.w * rect.h) / (viewport.w * viewport.h)
    expect(ratio).toBeGreaterThanOrEqual(0.49)
    expect(ratio).toBeLessThan(0.52)
    // Căn giữa: lề trái bằng lề phải (sai số 1 px do làm tròn).
    expect(Math.abs(viewport.w - rect.w - 2 * rect.x)).toBeLessThanOrEqual(1)
  })

  it('báo lỗi khi thiếu mục đích', () => {
    expect(() =>
      sayNameGame.buildDisplayed({ planned, items: [], params: validParams, viewport }),
    ).toThrow()
  })

  it('đọc params từ gameData, thiếu thì dùng mặc định an toàn', () => {
    expect(readSayNameParams({ params: { ...validParams, modelRepeats: 2 } }).modelRepeats).toBe(2)
    expect(readSayNameParams(undefined).imageAreaRatio).toBe(0.5)
    expect(readSayNameParams({ params: null }).promptStyle).toBe('what_is_this')
  })
})
