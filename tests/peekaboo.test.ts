import { describe, expect, it } from 'vitest'
import type { Trial } from '@/data/types'
import { peekabooGame, readPeekabooParams } from '@/engine/games/peekaboo'
import type { PlannedTrialInput } from '@/engine/games/types'

const viewport: Trial['viewport'] = { w: 1194, h: 834, dpr: 2, orientation: 'landscape' }

const planned: PlannedTrialInput = {
  trialIndex: 0,
  exerciseId: 'ex.imi01.peekaboo',
  targetItemId: 'item-dog',
  distractorItemIds: [],
  targetSlot: 0,
  isNewItem: false,
  waitBeforeCueMs: 5000,
}

const items = [{ itemId: 'item-dog', itemKey: 'animal.dog' }]

const validParams = { cover: 'cloth' as const, revealMs: 450, repeatInvite: true }

describe('peekabooGame', () => {
  it('nhận params hợp lệ', () => {
    const result = peekabooGame.parseParams(validParams)
    expect(result).toEqual({ ok: true, value: validParams })
  })

  it('từ chối params sai với thông điệp tiếng Việt', () => {
    const tooFast = peekabooGame.parseParams({ ...validParams, revealMs: 100 })
    expect(tooFast.ok).toBe(false)
    if (!tooFast.ok) expect(tooFast.errors.join(' ')).toContain('300 ms')

    const badCover = peekabooGame.parseParams({ ...validParams, cover: 'blanket' })
    expect(badCover.ok).toBe(false)

    // strictObject: khóa lạ cũng bị chặn để tệp bài không trôi lặng lẽ.
    expect(peekabooGame.parseParams({ ...validParams, extra: 1 }).ok).toBe(false)
    expect(peekabooGame.parseParams(undefined).ok).toBe(false)
  })

  it('dựng đúng một ô cho mục đích, nằm giữa màn', () => {
    const displayed = peekabooGame.buildDisplayed({ planned, items, params: validParams, viewport })
    expect(displayed).toHaveLength(1)
    expect(peekabooGame.choices).toBe(1)
    expect(displayed[0]!.itemId).toBe('item-dog')
    expect(displayed[0]!.slot).toBe(0)

    const rect = displayed[0]!.rect
    // Ô chiếm gần hết khung nhìn và lề hai bên bằng nhau.
    expect(rect.w * rect.h).toBeGreaterThan(viewport.w * viewport.h * 0.7)
    expect(rect.x + rect.w).toBe(viewport.w - rect.x)
    expect(rect.y + rect.h).toBe(viewport.h - rect.y)
  })

  it('báo lỗi khi thiếu mục đích', () => {
    expect(() =>
      peekabooGame.buildDisplayed({ planned, items: [], params: validParams, viewport }),
    ).toThrow()
  })

  it('đọc params từ gameData, thiếu thì dùng mặc định an toàn', () => {
    expect(readPeekabooParams({ params: { ...validParams, cover: 'hands' } }).cover).toBe('hands')
    expect(readPeekabooParams(undefined).revealMs).toBe(450)
    expect(readPeekabooParams({ params: { revealMs: 'x' } }).cover).toBe('cloth')
  })
})
