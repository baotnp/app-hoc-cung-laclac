import { beforeEach, describe, expect, it } from 'vitest'
import {
  boardsInWeek,
  itemStatuses,
  practiceDaysOfWeek,
  promptSlopeForItem,
  promptTrend,
  sideBias,
  weeklyIndependentRate,
} from '@/data/queries'
import {
  addGeneralizationCheck,
  addTrial,
  createChild,
  createSession,
  upsertItem,
  wipeAllData,
} from '@/data/repos'
import { db } from '@/data/db'
import type {
  BaseRecord,
  Child,
  Exercise,
  Item,
  PromptLevel,
  Round,
  Session,
  Trial,
} from '@/data/types'
import { withBase } from '@/lib/ids'
import { addDays, daysOfWeek, weekStartOf } from '@/lib/time'

const EXERCISE_ID = 'ex.cog01.choose_pet_animal'
const WEEK = weekStartOf('2026-10-21')
const DAYS = daysOfWeek(WEEK)
const MON = DAYS[0] as string
const TUE = DAYS[1] as string
const WED = DAYS[2] as string
const THU = DAYS[3] as string
const FRI = DAYS[4] as string

function at(date: string, offsetMs = 0): number {
  return Date.parse(`${date}T08:00:00.000Z`) + offsetMs
}

const exercise: Exercise = withBase<Omit<Exercise, keyof BaseRecord>>(
  {
    code: 'COG-01',
    type: 'choose_from_two',
    title: 'Chọn 1 trong 2 hình con vật nuôi',
    phase: 1,
    active: true,
    configVersion: 1,
    config: {
      itemPool: {
        category: 'pet_animal',
        keys: ['animal.dog', 'animal.cat', 'animal.cow', 'animal.chicken'],
        minItems: 2,
      },
      requiredAudio: ['instruction', 'praise', 'bridge'],
      response: { detector: 'touch_choice' },
      timing: { waitBeforeCueMs: 5000, afterCueTimeoutMs: 15000, cue: { kind: 'raise_correct' } },
      scheduling: {
        trialsPerRound: 5,
        newItemRatio: 0.3,
        knownMinTrials: 3,
        firstTrialKnownItem: true,
      },
      mastery: {
        metric: 'independent_correct_rate',
        threshold: 0.8,
        lastSessions: 5,
        minTrials: 6,
      },
      reward: { perTrial: ['mascot_nod'], onRoundComplete: 'party_standard' },
      bridge: {
        target: 'newest_or_ready_item',
        levels: { '2': { guide: 'a' }, '3': { guide: 'b' }, '4': { guide: 'c' } },
      },
      sensory: { noWrongSound: true, noText: true },
    },
  },
  at(MON),
  EXERCISE_ID,
)

let child: Child
const items = new Map<string, Item>()

interface TrialOpts {
  date: string
  sessionId: string
  itemKey: string
  slot?: 0 | 1
  independentCorrect?: boolean
  promptLevel?: PromptLevel
  valid?: boolean
  exerciseId?: string
  index?: number
}

async function makeTrial(o: TrialOpts): Promise<Trial> {
  const item = items.get(o.itemKey)
  if (!item) throw new Error(`thiếu mục ${o.itemKey}`)
  const slot = o.slot ?? 0
  const correct = o.independentCorrect ?? true
  const promptLevel = o.promptLevel ?? (correct ? 'independent' : 'gesture')
  const startedAt = at(o.date, (o.index ?? 0) * 60_000)
  return addTrial({
    childId: child.id,
    sessionId: o.sessionId,
    roundIndex: 0,
    trialIndex: o.index ?? 0,
    date: o.date,
    weekStart: weekStartOf(o.date),
    exerciseId: o.exerciseId ?? EXERCISE_ID,
    exerciseCode: 'COG-01',
    configVersion: 1,
    targetItemId: item.id,
    targetItemKey: item.key,
    isNewItem: false,
    displayed: [],
    targetSlot: slot,
    detectorKind: 'touch_choice',
    startedAt,
    instructionStartMs: 0,
    instructionEndMs: 1000,
    firstChoice: { itemId: item.id, slot, tMs: 2000, latencyMs: 1000 },
    correctFirstTry: correct,
    parked: false,
    completedAtMs: 2000,
    completedLatencyMs: 1000,
    promptLevel,
    promptLevelAuto: promptLevel,
    promptLevelSource: 'auto',
    touches: [],
    valid: o.valid ?? true,
    viewport: { w: 1180, h: 820, dpr: 2, orientation: 'landscape' },
    schedulerId: 'simple@1',
  })
}

async function makeSession(o: {
  date: string
  dailyGoalMet?: boolean
  durationMs?: number
  rounds?: Round[]
}): Promise<Session> {
  return createSession({
    childId: child.id,
    date: o.date,
    weekStart: weekStartOf(o.date),
    startedAt: at(o.date),
    endedAt: at(o.date, o.durationMs ?? 0),
    status: 'completed',
    phase: 'done',
    rewardOptions: [],
    rounds: o.rounds ?? [],
    dailyGoalMet: o.dailyGoalMet ?? false,
    ipadActiveMs: o.durationMs ?? 0,
    durationMs: o.durationMs ?? 0,
    schedulerId: 'simple@1',
    randomSeed: 1,
    configSnapshot: {
      waitBeforeCueMs: 5000,
      afterCueTimeoutMs: 15000,
      trialsPerRound: 5,
      quality: 'high',
      reduceMotion: false,
      silentParty: false,
      masterVolume: 0.6,
    },
    appVersion: '0.1.0',
    observations: [],
  })
}

function round(index: number, partyShown: boolean): Round {
  return {
    index,
    exerciseId: EXERCISE_ID,
    startedAt: at(MON, index * 1000),
    starsLit: partyShown ? 5 : 2,
    partyShown,
    trialIds: [],
  }
}

beforeEach(async () => {
  await wipeAllData()
  items.clear()
  child = await createChild({ displayName: 'Lạc', birthMonth: '2024-01' })
  await db.exercises.put(exercise)
  for (const [key, label] of [
    ['animal.dog', 'con chó'],
    ['animal.cat', 'con mèo'],
    ['animal.cow', 'con bò'],
    ['animal.chicken', 'con gà'],
  ] as const) {
    items.set(key, await upsertItem({ key, label, category: 'pet_animal', scope: 'bundled' }))
  }
})

describe('Q1 — tỷ lệ tự làm theo tuần', () => {
  it('tính đúng tỷ lệ và loại lượt valid=false', async () => {
    const s1 = await makeSession({ date: MON })
    await makeTrial({ date: MON, sessionId: s1.id, itemKey: 'animal.dog', index: 0 })
    await makeTrial({ date: MON, sessionId: s1.id, itemKey: 'animal.cat', index: 1 })
    await makeTrial({
      date: TUE,
      sessionId: s1.id,
      itemKey: 'animal.cow',
      independentCorrect: false,
      index: 2,
    })
    await makeTrial({
      date: TUE,
      sessionId: s1.id,
      itemKey: 'animal.cow',
      independentCorrect: false,
      index: 3,
    })
    // Lượt bị ba mẹ đánh dấu không hợp lệ: không được tính vào mẫu số.
    await makeTrial({ date: TUE, sessionId: s1.id, itemKey: 'animal.dog', valid: false, index: 4 })

    const nextWeek = addDays(WEEK, 7)
    const s2 = await makeSession({ date: nextWeek })
    await makeTrial({ date: nextWeek, sessionId: s2.id, itemKey: 'animal.dog', index: 0 })
    await makeTrial({ date: nextWeek, sessionId: s2.id, itemKey: 'animal.dog', index: 1 })

    const rows = await weeklyIndependentRate(child.id, WEEK, nextWeek)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ weekStart: WEEK, n: 4, independentCorrect: 2, rate: 0.5 })
    expect(rows[1]).toMatchObject({ weekStart: nextWeek, n: 2, independentCorrect: 2, rate: 1 })
  })

  it('lọc theo bài tập', async () => {
    const s = await makeSession({ date: MON })
    await makeTrial({ date: MON, sessionId: s.id, itemKey: 'animal.dog', index: 0 })
    await makeTrial({
      date: MON,
      sessionId: s.id,
      itemKey: 'animal.cat',
      exerciseId: 'ex.cog03.choose_personal_object',
      index: 1,
    })
    const rows = await weeklyIndependentRate(child.id, WEEK, WEEK, EXERCISE_ID)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.n).toBe(1)
  })
})

describe('Q2 — xu hướng mức gợi ý', () => {
  it('phân bố và meanRank theo tuần', async () => {
    const s = await makeSession({ date: MON })
    await makeTrial({ date: MON, sessionId: s.id, itemKey: 'animal.dog', index: 0 })
    await makeTrial({
      date: MON,
      sessionId: s.id,
      itemKey: 'animal.dog',
      promptLevel: 'model',
      independentCorrect: false,
      index: 1,
    })
    const rows = await promptTrend(child.id, WEEK, WEEK)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.n).toBe(2)
    expect(rows[0]?.distribution.independent).toBe(0.5)
    expect(rows[0]?.distribution.model).toBe(0.5)
    expect(rows[0]?.meanRank).toBe(1) // (0 + 2) / 2
  })

  it('hồi quy 5 buổi gần nhất cho ra xu hướng giảm dần', async () => {
    const levels: PromptLevel[] = [
      'full_physical',
      'partial_physical',
      'model',
      'gesture',
      'independent',
    ]
    for (let i = 0; i < levels.length; i++) {
      const date = addDays(MON, i)
      const s = await makeSession({ date })
      await makeTrial({
        date,
        sessionId: s.id,
        itemKey: 'animal.dog',
        promptLevel: levels[i] as PromptLevel,
        independentCorrect: i === levels.length - 1,
        index: 0,
      })
    }
    const dog = items.get('animal.dog')
    const trend = await promptSlopeForItem(child.id, dog?.id ?? '')
    expect(trend.n).toBe(5)
    expect(trend.slope).toBeCloseTo(-1, 6)
    expect(trend.direction).toBe('down')
    expect(trend.points.map((p) => p.meanRank)).toEqual([4, 3, 2, 1, 0])
  })
})

describe('Q3 — thiên vị vị trí', () => {
  function picks(slots: (0 | 1)[]): Trial[] {
    return slots.map(
      (slot, i) =>
        ({
          valid: true,
          firstChoice: { itemId: 'x', slot, tMs: i, latencyMs: i },
        }) as unknown as Trial,
    )
  }

  it('bật cờ khi 5/5 lượt cùng một bên', () => {
    const bias = sideBias(picks([0, 0, 0, 0, 0]))
    expect(bias.n).toBe(5)
    expect(bias.shareSlot0).toBe(1)
    expect(bias.biasedSlot).toBe(0)
    expect(bias.flagged).toBe(true)
  })

  it('tắt cờ khi 3/5 lượt cùng một bên', () => {
    const bias = sideBias(picks([0, 0, 0, 1, 1]))
    expect(bias.n).toBe(5)
    expect(bias.shareSlot0).toBeCloseTo(0.6, 6)
    expect(bias.biasedSlot).toBeNull()
    expect(bias.flagged).toBe(false)
  })

  it('nhận ra thiên vị bên phải', () => {
    const bias = sideBias(picks([1, 1, 1, 1, 1]))
    expect(bias.biasedSlot).toBe(1)
    expect(bias.flagged).toBe(true)
  })
})

describe('Q4 — trạng thái mục', () => {
  it('mastered_ipad chỉ khi đủ số lượt và ngưỡng 80%', async () => {
    // con chó: 6 lượt tự làm đúng trên 3 buổi -> đạt trên iPad.
    for (let s = 0; s < 3; s++) {
      const date = addDays(MON, s)
      const session = await makeSession({ date })
      for (let k = 0; k < 2; k++) {
        await makeTrial({
          date,
          sessionId: session.id,
          itemKey: 'animal.dog',
          index: k,
        })
      }
      // con mèo: 6 lượt nhưng chỉ 4 lượt tự làm đúng -> 0,67 < 0,8.
      for (let k = 0; k < 2; k++) {
        await makeTrial({
          date,
          sessionId: session.id,
          itemKey: 'animal.cat',
          independentCorrect: !(s === 0 && k === 0) && !(s === 1 && k === 1),
          index: 2 + k,
        })
      }
      // con bò: 5 lượt tự làm đúng -> chưa đủ minTrials = 6.
      if (s < 2) {
        await makeTrial({ date, sessionId: session.id, itemKey: 'animal.cow', index: 4 })
        await makeTrial({ date, sessionId: session.id, itemKey: 'animal.cow', index: 5 })
      } else {
        await makeTrial({ date, sessionId: session.id, itemKey: 'animal.cow', index: 4 })
      }
    }

    const statuses = await itemStatuses(child.id, exercise)
    expect(statuses.get(items.get('animal.dog')?.id ?? '')).toBe('mastered_ipad')
    expect(statuses.get(items.get('animal.cat')?.id ?? '')).toBe('learning')
    expect(statuses.get(items.get('animal.cow')?.id ?? '')).toBe('learning')
    expect(statuses.get(items.get('animal.chicken')?.id ?? '')).toBe('new')
  })

  it('generalized khi có 2 check bậc ≥3 did_it vào 2 ngày khác nhau', async () => {
    const chicken = items.get('animal.chicken')
    if (!chicken) throw new Error('thiếu mục')
    for (const date of [MON, TUE]) {
      await addGeneralizationCheck({
        childId: child.id,
        itemId: chicken.id,
        exerciseId: EXERCISE_ID,
        level: 3,
        result: 'did_it',
        confirmedBy: 'parent',
        date,
      })
    }
    const statuses = await itemStatuses(child.id, exercise)
    expect(statuses.get(chicken.id)).toBe('generalized')
  })

  it('không generalized khi 2 check cùng một ngày, hoặc bậc 2, hoặc chưa làm được', async () => {
    const cat = items.get('animal.cat')
    const cow = items.get('animal.cow')
    const dog = items.get('animal.dog')
    if (!cat || !cow || !dog) throw new Error('thiếu mục')
    for (let i = 0; i < 2; i++) {
      await addGeneralizationCheck({
        childId: child.id,
        itemId: cat.id,
        exerciseId: EXERCISE_ID,
        level: 4,
        result: 'did_it',
        confirmedBy: 'parent',
        date: MON,
      })
    }
    for (const date of [MON, TUE]) {
      await addGeneralizationCheck({
        childId: child.id,
        itemId: cow.id,
        exerciseId: EXERCISE_ID,
        level: 2,
        result: 'did_it',
        confirmedBy: 'parent',
        date,
      })
      await addGeneralizationCheck({
        childId: child.id,
        itemId: dog.id,
        exerciseId: EXERCISE_ID,
        level: 3,
        result: 'with_help',
        confirmedBy: 'parent',
        date,
      })
    }
    const statuses = await itemStatuses(child.id, exercise)
    expect(statuses.get(cat.id)).toBe('new')
    expect(statuses.get(cow.id)).toBe('new')
    expect(statuses.get(dog.id)).toBe('new')
  })
})

describe('Q5 — ngày luyện trong tuần', () => {
  it('tính đủ 3 đường và bỏ qua check bậc 1', async () => {
    // Thứ Hai: bảng sao xong (dailyGoalMet), thời gian ngắn.
    await makeSession({ date: MON, dailyGoalMet: true, durationMs: 60_000 })
    // Thứ Ba: không xong bảng nhưng tổng thời gian ≥ 5 phút.
    await makeSession({ date: TUE, durationMs: 200_000 })
    await makeSession({ date: TUE, durationMs: 160_000 })
    // Thứ Tư: chỉ có check ngoài iPad bậc 2.
    const dog = items.get('animal.dog')
    if (!dog) throw new Error('thiếu mục')
    await addGeneralizationCheck({
      childId: child.id,
      itemId: dog.id,
      exerciseId: EXERCISE_ID,
      level: 2,
      result: 'not_yet',
      confirmedBy: 'parent',
      date: WED,
    })
    // Thứ Năm: chỉ có check bậc 1 (trên iPad) -> không tính.
    await addGeneralizationCheck({
      childId: child.id,
      itemId: dog.id,
      exerciseId: EXERCISE_ID,
      level: 1,
      result: 'did_it',
      confirmedBy: 'parent',
      date: THU,
    })
    // Thứ Sáu: buổi ngắn, chưa xong bảng.
    await makeSession({ date: FRI, durationMs: 60_000 })

    const days = await practiceDaysOfWeek(child.id, WEEK)
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.date)).toEqual(DAYS)
    expect(days.map((d) => d.practiced)).toEqual([true, true, true, false, false, false, false])
  })
})

describe('Q6 — số bảng sao trong tuần', () => {
  it('đếm vòng có tiệc', async () => {
    await makeSession({ date: MON, rounds: [round(0, true), round(1, false)] })
    await makeSession({ date: TUE, rounds: [round(0, true)] })
    await makeSession({ date: addDays(WEEK, 7), rounds: [round(0, true)] })
    expect(await boardsInWeek(child.id, WEEK)).toBe(2)
  })
})
