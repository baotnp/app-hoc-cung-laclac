import { describe, expect, it } from 'vitest'
import {
  NOT_ENOUGH_ITEMS,
  pickExerciseForRound,
  planRound,
  type ItemStats,
  type SimplePlanInput,
} from '@/scheduler'

function stats(itemId: string, trials: number, lastSeenAt: number | null = null): ItemStats {
  return {
    itemId,
    trials,
    independentCorrect: 0,
    lastSeenAt,
    recentSessions: [],
    status: trials === 0 ? 'new' : 'learning',
  }
}

function input(pool: ItemStats[], over: Partial<SimplePlanInput> = {}): SimplePlanInput {
  return {
    childId: 'child1',
    now: 1_700_000_000_000,
    exerciseId: 'ex.cog01',
    scheduling: { trialsPerRound: 5, newItemRatio: 0.3, knownMinTrials: 3, firstTrialKnownItem: true },
    positions: { maxSameSideRun: 3 },
    distractor: { avoidRepeatLast: 1 },
    pool,
    history: { lastSideRun: 0, leftShare: 0.5 },
    seed: 1,
    ...over,
  }
}

const mixedPool = [
  stats('new1', 0),
  stats('new2', 0),
  stats('known1', 10, 100),
  stats('known2', 8, 200),
  stats('known3', 6, 300),
]

describe('planRound', () => {
  it('N=5 cho 1 lượt mới và 4 lượt đã biết', () => {
    const plan = planRound(input(mixedPool))
    expect(plan).toHaveLength(5)
    expect(plan.filter(p => p.isNewItem)).toHaveLength(1)
    expect(plan.filter(p => !p.isNewItem)).toHaveLength(4)
  })

  it('lượt đầu là mục đã biết khi firstTrialKnownItem', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const plan = planRound(input(mixedPool, { seed }))
      expect(plan[0]?.isNewItem).toBe(false)
    }
  })

  it('không có mục đã biết thì mọi lượt là mục mới', () => {
    const plan = planRound(input([stats('a', 0), stats('b', 1), stats('c', 0)]))
    expect(plan).toHaveLength(5)
    expect(plan.every(p => p.isNewItem)).toBe(true)
  })

  it('không có mục mới thì mọi lượt là mục đã biết', () => {
    const plan = planRound(input([stats('k1', 9, 1), stats('k2', 9, 2), stats('k3', 9, 3)]))
    expect(plan.every(p => !p.isNewItem)).toBe(true)
  })

  it('vị trí đích 2–3 mỗi bên và không quá 3 lượt liền cùng bên (200 hạt giống)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const plan = planRound(input(mixedPool, { seed }))
      const left = plan.filter(p => p.targetSlot === 0).length
      expect(left).toBeGreaterThanOrEqual(2)
      expect(left).toBeLessThanOrEqual(3)

      let run = 0
      let side: 0 | 1 | null = null
      for (const p of plan) {
        run = p.targetSlot === side ? run + 1 : 1
        side = p.targetSlot
        expect(run).toBeLessThanOrEqual(3)
      }
    }
  })

  it('tính cả chuỗi cuối của vòng trước', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const plan = planRound(
        input(mixedPool, { seed, history: { lastSideRun: 3, leftShare: 0.9 } }),
      )
      expect(plan[0]?.targetSlot).toBe(1)
    }
  })

  it('không lặp cùng một mục đích ở hai lượt liền', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const plan = planRound(input(mixedPool, { seed }))
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i]?.targetItemId).not.toBe(plan[i - 1]?.targetItemId)
      }
    }
  })

  it('hình gây nhiễu khác đích và tránh lặp hình gần nhất', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const plan = planRound(input(mixedPool, { seed }))
      let prev: string | undefined
      for (const p of plan) {
        expect(p.distractorItemIds).toHaveLength(1)
        expect(p.distractorItemIds[0]).not.toBe(p.targetItemId)
        if (prev !== undefined) expect(p.distractorItemIds[0]).not.toBe(prev)
        prev = p.distractorItemIds[0]
      }
    }
  })

  it('cùng hạt giống cho cùng kết quả', () => {
    expect(planRound(input(mixedPool, { seed: 42 }))).toEqual(planRound(input(mixedPool, { seed: 42 })))
  })

  it('ném NOT_ENOUGH_ITEMS khi pool nhỏ hơn minItems', () => {
    expect(() => planRound(input([stats('a', 0)], { minItems: 2 }))).toThrowError(NOT_ENOUGH_ITEMS)
  })

  // Mỗi trò cần số ô khác nhau. Lỗi đã gặp trên máy thật: bài xếp thẻ khai 3 thẻ nhưng
  // lịch chỉ cấp 1 hình nhiễu, màn của bé không dựng được và cả app trắng xóa.
  it('cấp đủ hình nhiễu cho số ô mà trò cần', () => {
    for (const choices of [2, 3]) {
      const plan = planRound(input(mixedPool, { choices }))
      for (const t of plan) {
        expect({ choices, n: t.distractorItemIds.length }).toEqual({ choices, n: choices - 1 })
        expect(t.distractorItemIds).not.toContain(t.targetItemId)
        expect(new Set(t.distractorItemIds).size).toBe(choices - 1)
      }
    }
  })

  it('kho nhỏ hơn số ô thì cấp hết kho, không lặp mục', () => {
    const small = [stats('a', 5, 100), stats('b', 5, 200)]
    const plan = planRound(input(small, { choices: 3, minItems: 2 }))
    for (const t of plan) {
      expect(t.distractorItemIds).toHaveLength(1)
      expect(t.distractorItemIds).not.toContain(t.targetItemId)
    }
  })

  it('mặc định vẫn là 1 hình nhiễu khi trò không khai số ô', () => {
    for (const t of planRound(input(mixedPool))) {
      expect(t.distractorItemIds).toHaveLength(1)
    }
  })
})

describe('pickExerciseForRound', () => {
  const goal = { exerciseIds: ['A', 'B', 'C'] }

  it('ưu tiên bài chưa chạy trong tuần, theo thứ tự danh sách', () => {
    expect(pickExerciseForRound(goal, [], 0)).toBe('A')
    expect(pickExerciseForRound(goal, [{ exerciseId: 'A', at: 10 }], 0)).toBe('B')
    expect(
      pickExerciseForRound(
        goal,
        [
          { exerciseId: 'A', at: 10 },
          { exerciseId: 'B', at: 20 },
        ],
        0,
      ),
    ).toBe('C')
  })

  it('xoay vòng theo bài lâu nhất chưa chạy', () => {
    const history = [
      { exerciseId: 'A', at: 30 },
      { exerciseId: 'B', at: 10 },
      { exerciseId: 'C', at: 20 },
    ]
    expect(pickExerciseForRound(goal, history, 0)).toBe('B')
  })

  it('vòng 2 không lặp bài của vòng 1 khi còn bài khác', () => {
    const history = [
      { exerciseId: 'B', at: 10 },
      { exerciseId: 'C', at: 20 },
      { exerciseId: 'A', at: 99 }, // vòng 1 của buổi hôm nay
    ]
    expect(pickExerciseForRound(goal, history, 1)).toBe('B')
  })

  it('chỉ có một bài thì vòng nào cũng là bài đó', () => {
    expect(pickExerciseForRound({ exerciseIds: ['A'] }, [{ exerciseId: 'A', at: 1 }], 1)).toBe('A')
  })
})
