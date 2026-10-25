import { describe, expect, it } from 'vitest'
import { weekStartAt } from '@/lib/time'
import type { FarmItem, Milestone, Round } from '@/data/types'
import {
  isDayComplete,
  isPracticeDay,
  planFarmAdditions,
  planMilestones,
  starsForRound,
  weekSummary,
  type FarmLedgerContext,
  type MilestoneContext,
} from '@/reward'

const NOW = Date.UTC(2026, 9, 21, 3, 0, 0) // thứ Tư
const WEEK = weekStartAt(NOW)

function round(over: Partial<Round> = {}): Round {
  return { index: 0, exerciseId: 'ex.cog01', startedAt: NOW, starsLit: 5, partyShown: true, trialIds: [], ...over }
}

function farmCtx(over: Partial<FarmLedgerContext> = {}): FarmLedgerContext {
  return { now: NOW, weekStart: WEEK, dayCompleted: true, existing: [], seed: 7, ...over }
}

describe('dailyGoal', () => {
  it('ngày xong khi vòng 1 đủ sao và tiệc đã chạy', () => {
    expect(isDayComplete({ rounds: [round()] })).toBe(true)
    expect(isDayComplete({ rounds: [round({ partyShown: false })] })).toBe(false)
    expect(isDayComplete({ rounds: [round({ starsLit: 4 })] })).toBe(false)
    expect(isDayComplete({ rounds: [] })).toBe(false)
  })

  it('chỉ vòng 1 quyết định; vòng 2 là phần thêm', () => {
    const rounds = [round({ starsLit: 2, partyShown: false }), round({ index: 1 })]
    expect(isDayComplete({ rounds })).toBe(false)
  })

  it('sao chỉ tăng và không vượt số ô của bảng', () => {
    expect(starsForRound(0)).toBe(0)
    expect(starsForRound(3)).toBe(3)
    expect(starsForRound(9)).toBe(5)
    expect(starsForRound(-4)).toBe(0)
  })
})

describe('isPracticeDay', () => {
  const goal = { daysPerWeek: 5, minMinutesPerDay: 5 }

  it('đường 1: ngày của bé xong', () => {
    expect(isPracticeDay([{ dailyGoalMet: true, durationMs: 1000 }], [], goal)).toBe(true)
  })

  it('đường 2: tổng thời gian các buổi trong ngày đủ phút', () => {
    const sessions = [
      { dailyGoalMet: false, durationMs: 2 * 60_000 },
      { dailyGoalMet: false, durationMs: 3 * 60_000 },
    ]
    expect(isPracticeDay(sessions, [], goal)).toBe(true)
    expect(isPracticeDay([{ dailyGoalMet: false, durationMs: 4 * 60_000 }], [], goal)).toBe(false)
  })

  it('đường 3: xác nhận cầu nối bậc ≥ 2 (bậc 1 không tính)', () => {
    expect(isPracticeDay([], [{ level: 2 }], goal)).toBe(true)
    expect(isPracticeDay([], [{ level: 1 }], goal)).toBe(false)
  })

  it('không có gì thì không phải ngày luyện', () => {
    expect(isPracticeDay([], [], goal)).toBe(false)
  })
})

describe('weekSummary', () => {
  it('đếm ngày luyện và so với mục tiêu', () => {
    const days = [
      { date: '2026-10-19', practiced: true },
      { date: '2026-10-20', practiced: true },
      { date: '2026-10-21', practiced: false },
    ]
    const s = weekSummary(days, { daysPerWeek: 5, minMinutesPerDay: 5 })
    expect(s.days).toBe(2)
    expect(s.met).toBe(false)
    expect(s.practicedDates).toEqual(['2026-10-19', '2026-10-20'])
  })
})

describe('planFarmAdditions', () => {
  it('ngày xong: thêm 1 mục daily và 1 mục weekly khi tuần chưa có', () => {
    const out = planFarmAdditions(farmCtx())
    expect(out.filter(i => i.reason === 'daily')).toHaveLength(1)
    expect(out.filter(i => i.reason === 'weekly')).toHaveLength(1)
  })

  it('một ngày tối đa 1 mục weekly', () => {
    const weekly: FarmItem = {
      id: 'f1',
      kind: 'weekly_unlock',
      variant: 'weekly.1',
      addedAt: NOW - 86_400_000,
      reason: 'weekly',
    }
    const out = planFarmAdditions(farmCtx({ existing: [weekly] }))
    expect(out.filter(i => i.reason === 'weekly')).toHaveLength(0)
    expect(out.filter(i => i.reason === 'daily')).toHaveLength(1)
  })

  it('tuần bỏ lỡ vẫn được cấp ở lần xong ngày kế tiếp', () => {
    const oldWeekly: FarmItem = {
      id: 'f1',
      kind: 'weekly_unlock',
      variant: 'weekly.1',
      addedAt: NOW - 21 * 86_400_000,
      reason: 'weekly',
    }
    const out = planFarmAdditions(farmCtx({ existing: [oldWeekly] }))
    expect(out.filter(i => i.reason === 'weekly')).toHaveLength(1)
  })

  it('không bao giờ có mục animal khi chưa đạt ngoài đời', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const out = planFarmAdditions(farmCtx({ seed }))
      expect(out.some(i => i.kind === 'animal')).toBe(false)
    }
  })

  it('thêm animal khi đã đạt ngoài đời và chưa có trong nông trại', () => {
    const out = planFarmAdditions(farmCtx({ generalizedItems: [{ itemId: 'i1', itemKey: 'animal.dog' }] }))
    const animals = out.filter(i => i.kind === 'animal')
    expect(animals).toHaveLength(1)
    expect(animals[0]?.itemId).toBe('i1')
    expect(animals[0]?.variant).toBe('animal.dog')
  })

  it('không thêm animal trùng mục đã có', () => {
    const existing: FarmItem[] = [
      { id: 'f1', kind: 'animal', itemId: 'i1', variant: 'animal.dog', addedAt: NOW, reason: 'generalized' },
    ]
    const out = planFarmAdditions(farmCtx({ existing, generalizedItems: [{ itemId: 'i1' }] }))
    expect(out.some(i => i.kind === 'animal')).toBe(false)
  })

  it('ngày chưa xong: không có mục daily hay weekly', () => {
    const out = planFarmAdditions(farmCtx({ dayCompleted: false }))
    expect(out).toHaveLength(0)
  })
})

describe('planMilestones', () => {
  function ctx(over: Partial<MilestoneContext> = {}): MilestoneContext {
    return { childId: 'c1', now: NOW, date: '2026-10-21', weekStart: WEEK, existing: [], ...over }
  }

  it('sinh đủ các loại cột mốc tích cực', () => {
    const out = planMilestones(
      ctx({
        firstSession: true,
        masteredIpad: [{ itemId: 'i1', label: 'con chó' }],
        generalized: [{ itemId: 'i2', label: 'con mèo', level: 3 }],
        weeklyPracticeMet: { days: 5 },
        weeklyUnlock: true,
      }),
    )
    expect(out.map(m => m.kind)).toEqual([
      'first_session',
      'item_mastered_ipad',
      'item_generalized',
      'weekly_practice_met',
      'weekly_unlock',
    ])
    expect(out.every(m => m.badgeKey === m.kind)).toBe(true)
  })

  it('không sinh trùng với cột mốc đã có', () => {
    const existing: Pick<Milestone, 'kind' | 'itemId' | 'params'>[] = [
      { kind: 'first_session', params: {} },
      { kind: 'item_mastered_ipad', itemId: 'i1', params: { label: 'con chó' } },
      { kind: 'weekly_practice_met', params: { weekStart: WEEK, days: 5 } },
    ]
    const out = planMilestones(
      ctx({
        existing,
        firstSession: true,
        masteredIpad: [{ itemId: 'i1', label: 'con chó' }],
        weeklyPracticeMet: { days: 5 },
      }),
    )
    expect(out).toHaveLength(0)
  })

  it('tuần chưa đủ ngày không sinh cột mốc nào', () => {
    expect(planMilestones(ctx())).toHaveLength(0)
  })

  it('cột mốc tuần của tuần khác vẫn được sinh', () => {
    const existing: Pick<Milestone, 'kind' | 'itemId' | 'params'>[] = [
      { kind: 'weekly_practice_met', params: { weekStart: '2026-10-12', days: 5 } },
    ]
    const out = planMilestones(ctx({ existing, weeklyPracticeMet: { days: 6 } }))
    expect(out).toHaveLength(1)
    expect(out[0]?.params['weekStart']).toBe(WEEK)
  })
})
