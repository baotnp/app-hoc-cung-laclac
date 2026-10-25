// Truy vấn báo cáo Q1–Q6 — xem docs/06-data-model.md §5.
// Dữ liệu valid=false luôn bị loại. Mọi truy vấn nhận childId.

import Dexie from 'dexie'
import { db } from '@/data/db'
import { PROMPT_LEVELS, PROMPT_RANK } from '@/data/types'
import type {
  Exercise,
  GeneralizationCheck,
  ItemStatus,
  LocalDate,
  PromptLevel,
  Trial,
  WeekStart,
} from '@/data/types'
import { getItemsByKeys, getPracticeGoal } from '@/data/repos'
import { daysOfWeek } from '@/lib/time'

// ------------------------------------- Q1 — Tỷ lệ tự làm theo tuần

export interface WeeklyRate {
  weekStart: WeekStart
  exerciseId: string
  n: number
  independentCorrect: number
  rate: number
}

/** Tự làm đúng = correctFirstTry && promptLevel === 'independent' (06 §2.5). */
function isIndependentCorrect(t: Trial): boolean {
  return t.correctFirstTry && t.promptLevel === 'independent'
}

export async function weeklyIndependentRate(
  childId: string,
  fromWeek: WeekStart,
  toWeek: WeekStart,
  exerciseId?: string,
): Promise<WeeklyRate[]> {
  const rows = await db.trials
    .where('[childId+weekStart]')
    .between([childId, fromWeek], [childId, toWeek], true, true)
    .filter((t) => t.valid && (!exerciseId || t.exerciseId === exerciseId))
    .toArray()
  const acc = new Map<string, WeeklyRate>()
  for (const t of rows) {
    const k = `${t.weekStart}|${t.exerciseId}`
    const r = acc.get(k) ?? {
      weekStart: t.weekStart,
      exerciseId: t.exerciseId,
      n: 0,
      independentCorrect: 0,
      rate: 0,
    }
    r.n++
    if (isIndependentCorrect(t)) r.independentCorrect++
    acc.set(k, r)
  }
  return [...acc.values()]
    .map((r) => ({ ...r, rate: r.independentCorrect / r.n }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

// --------------------------------------- Q2 — Xu hướng mức gợi ý

export interface PromptTrend {
  weekStart: WeekStart
  n: number
  /** Tỷ lệ 0..1 theo từng mức. */
  distribution: Record<PromptLevel, number>
  /** 0..4, thấp hơn = ít gợi ý. */
  meanRank: number
}

function emptyCounts(): Record<PromptLevel, number> {
  return {
    independent: 0,
    gesture: 0,
    model: 0,
    partial_physical: 0,
    full_physical: 0,
  }
}

/** meanRank của một tập lượt: trung bình PROMPT_RANK[promptLevel]. */
function meanRankOf(trials: Trial[]): number {
  if (trials.length === 0) return 0
  let sum = 0
  for (const t of trials) sum += PROMPT_RANK[t.promptLevel]
  return sum / trials.length
}

export async function promptTrend(
  childId: string,
  fromWeek: WeekStart,
  toWeek: WeekStart,
  exerciseId?: string,
  targetItemKey?: string,
): Promise<PromptTrend[]> {
  const rows = await db.trials
    .where('[childId+weekStart]')
    .between([childId, fromWeek], [childId, toWeek], true, true)
    .filter(
      (t) =>
        t.valid &&
        (!exerciseId || t.exerciseId === exerciseId) &&
        (!targetItemKey || t.targetItemKey === targetItemKey),
    )
    .toArray()

  const byWeek = new Map<WeekStart, Trial[]>()
  for (const t of rows) {
    const list = byWeek.get(t.weekStart)
    if (list) list.push(t)
    else byWeek.set(t.weekStart, [t])
  }

  return [...byWeek.entries()]
    .map(([weekStart, trials]) => {
      const counts = emptyCounts()
      for (const t of trials) counts[t.promptLevel]++
      const distribution = emptyCounts()
      for (const level of PROMPT_LEVELS) distribution[level] = counts[level] / trials.length
      return { weekStart, n: trials.length, distribution, meanRank: meanRankOf(trials) }
    })
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

/** ↘ ít gợi ý dần / → đi ngang / ↗ nhiều gợi ý hơn. Mũi tên trung tính, không "tốt/xấu". */
export type TrendDirection = 'down' | 'flat' | 'up'

export interface PromptSlope {
  /** Số buổi dùng để hồi quy. */
  n: number
  slope: number
  direction: TrendDirection
  points: { sessionId: string; meanRank: number }[]
}

/**
 * Xu hướng cho 1 mục (06 §5 Q2): hồi quy tuyến tính meanRank theo thứ tự buổi
 * trên `lastSessions` buổi gần nhất. slope < 0 → ít gợi ý dần; |slope| < 0.1 → đi ngang.
 */
export async function promptSlopeForItem(
  childId: string,
  itemId: string,
  lastSessions = 5,
  exerciseId?: string,
): Promise<PromptSlope> {
  const rows = await db.trials
    .where('[childId+targetItemId+startedAt]')
    .between([childId, itemId, Dexie.minKey], [childId, itemId, Dexie.maxKey], true, true)
    .filter((t) => t.valid && (!exerciseId || t.exerciseId === exerciseId))
    .toArray()

  const sessions = groupBySession(rows)
  const recent = sessions.slice(-lastSessions)
  const points = recent.map((s) => ({ sessionId: s.sessionId, meanRank: meanRankOf(s.trials) }))
  return { n: points.length, ...linearTrend(points.map((p) => p.meanRank)), points }
}

interface SessionGroup {
  sessionId: string
  at: number
  trials: Trial[]
}

/** Gom lượt theo buổi, cũ → mới (mốc buổi = lượt sớm nhất của buổi). */
function groupBySession(trials: Trial[]): SessionGroup[] {
  const byId = new Map<string, SessionGroup>()
  for (const t of trials) {
    const g = byId.get(t.sessionId)
    if (g) {
      g.trials.push(t)
      if (t.startedAt < g.at) g.at = t.startedAt
    } else {
      byId.set(t.sessionId, { sessionId: t.sessionId, at: t.startedAt, trials: [t] })
    }
  }
  return [...byId.values()].sort((a, b) => a.at - b.at)
}

/** Hồi quy tuyến tính y theo x = 0..n-1. */
function linearTrend(ys: number[]): { slope: number; direction: TrendDirection } {
  const n = ys.length
  if (n < 2) return { slope: 0, direction: 'flat' }
  const meanX = (n - 1) / 2
  let meanY = 0
  for (const y of ys) meanY += y
  meanY /= n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = i - meanX
    num += dx * ((ys[i] as number) - meanY)
    den += dx * dx
  }
  const slope = den === 0 ? 0 : num / den
  const direction: TrendDirection = Math.abs(slope) < 0.1 ? 'flat' : slope < 0 ? 'down' : 'up'
  return { slope, direction }
}

// ---------------------------------- Q3 — Thiên vị vị trí (GĐ-24)

export interface SideBias {
  /** Số lượt có firstChoice. */
  n: number
  /** Tỷ lệ chọn slot 0. */
  shareSlot0: number
  biasedSlot: 0 | 1 | null
  flagged: boolean
}

export function sideBias(trials: Trial[], minTrials = 5): SideBias {
  const picks = trials.filter((t) => t.valid && t.firstChoice?.slot != null)
  const n = picks.length
  const s0 = picks.filter((t) => t.firstChoice?.slot === 0).length
  const share0 = n ? s0 / n : 0
  const maxShare = Math.max(share0, 1 - share0)
  return {
    n,
    shareSlot0: share0,
    biasedSlot: maxShare > 0.8 ? (share0 > 0.5 ? 0 : 1) : null,
    flagged: n >= minTrials && maxShare > 0.8,
  }
}

/**
 * Cửa sổ nhiều buổi (06 §5 Q3): lấy `sessions` buổi gần nhất qua index startedAt,
 * gom trials theo sessionId rồi gọi sideBias với ngưỡng 5 lượt/buổi.
 */
export async function sideBiasForRecentSessions(
  childId: string,
  sessions = 3,
  exerciseId?: string,
): Promise<SideBias> {
  const recent = await db.sessions
    .where('[childId+weekStart]')
    .between([childId, Dexie.minKey], [childId, Dexie.maxKey], true, true)
    .toArray()
  const ids = recent
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, sessions)
    .map((s) => s.id)
  if (ids.length === 0) return sideBias([], sessions * 5)
  const trials = await db.trials.where('sessionId').anyOf(ids).toArray()
  const scoped = exerciseId ? trials.filter((t) => t.exerciseId === exerciseId) : trials
  return sideBias(scoped, sessions * 5)
}

// ----------------------------- Q4 — Trạng thái mục (GĐ-04, GĐ-05)

/** `generalized` ưu tiên hơn `mastered_ipad`. */
function isGeneralized(checks: GeneralizationCheck[]): boolean {
  const dates = new Set<LocalDate>()
  for (const c of checks) {
    if (c.result === 'did_it' && c.level >= 3) dates.add(c.date)
  }
  return dates.size >= 2
}

export async function itemStatuses(
  childId: string,
  exercise: Exercise,
): Promise<Map<string, ItemStatus>> {
  const { threshold, lastSessions, minTrials } = exercise.config.mastery
  const items = await getItemsByKeys(exercise.config.itemPool.keys)

  const trials = await db.trials
    .where('[childId+exerciseId+startedAt]')
    .between([childId, exercise.id, Dexie.minKey], [childId, exercise.id, Dexie.maxKey], true, true)
    .filter((t) => t.valid)
    .toArray()

  const byItem = new Map<string, Trial[]>()
  for (const t of trials) {
    const list = byItem.get(t.targetItemId)
    if (list) list.push(t)
    else byItem.set(t.targetItemId, [t])
  }

  const checks = await db.generalizationChecks
    .where('[childId+date]')
    .between([childId, Dexie.minKey], [childId, Dexie.maxKey], true, true)
    .toArray()
  const checksByItem = new Map<string, GeneralizationCheck[]>()
  for (const c of checks) {
    const list = checksByItem.get(c.itemId)
    if (list) list.push(c)
    else checksByItem.set(c.itemId, [c])
  }

  const out = new Map<string, ItemStatus>()
  for (const item of items) {
    if (isGeneralized(checksByItem.get(item.id) ?? [])) {
      out.set(item.id, 'generalized')
      continue
    }
    const itemTrials = byItem.get(item.id) ?? []
    if (itemTrials.length === 0) {
      out.set(item.id, 'new')
      continue
    }
    // `lastSessions` buổi gần nhất CÓ MỤC NÀY.
    const recent = groupBySession(itemTrials).slice(-lastSessions)
    let n = 0
    let independentCorrect = 0
    for (const g of recent) {
      for (const t of g.trials) {
        n++
        if (isIndependentCorrect(t)) independentCorrect++
      }
    }
    const mastered = n >= minTrials && independentCorrect / n >= threshold
    out.set(item.id, mastered ? 'mastered_ipad' : 'learning')
  }
  return out
}

// ------------------------- Q5 — Ngày luyện trong tuần (GĐ-21)

export async function practiceDaysOfWeek(
  childId: string,
  weekStart: WeekStart,
): Promise<{ date: LocalDate; practiced: boolean }[]> {
  const goal = await getPracticeGoal(childId)
  const minMs = goal.minMinutesPerDay * 60_000

  const sessions = await db.sessions
    .where('[childId+weekStart]')
    .equals([childId, weekStart])
    .toArray()
  const checks = await db.generalizationChecks
    .where('[childId+date]')
    .between([childId, weekStart], [childId, daysOfWeek(weekStart)[6] as LocalDate], true, true)
    .toArray()

  return daysOfWeek(weekStart).map((date) => {
    const ofDay = sessions.filter((s) => s.date === date)
    const goalMet = ofDay.some((s) => s.dailyGoalMet)
    const totalMs = ofDay.reduce((sum, s) => sum + (s.durationMs ?? 0), 0)
    // Bậc 1 là trên iPad nên không tính; bậc ≥2 tính với mọi kết quả.
    const offIpadCheck = checks.some((c) => c.date === date && c.level >= 2)
    return { date, practiced: goalMet || totalMs >= minMs || offIpadCheck }
  })
}

/** Tuần đạt khi số ngày luyện ≥ PracticeGoal.daysPerWeek. */
export async function weeklyPracticeMet(childId: string, weekStart: WeekStart): Promise<boolean> {
  const goal = await getPracticeGoal(childId)
  const days = await practiceDaysOfWeek(childId, weekStart)
  return days.filter((d) => d.practiced).length >= goal.daysPerWeek
}

// ------------------- Q6 — Số bảng sao hoàn thành trong tuần (F-14)

export async function boardsInWeek(childId: string, weekStart: WeekStart): Promise<number> {
  const sessions = await db.sessions
    .where('[childId+weekStart]')
    .equals([childId, weekStart])
    .toArray()
  let boards = 0
  for (const s of sessions) {
    for (const r of s.rounds) {
      if (r.partyShown) boards++
    }
  }
  return boards
}
