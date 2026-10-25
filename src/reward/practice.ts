/**
 * Ngày luyện của ba mẹ (GĐ-21, 06 Q5, 01 §5.2). Hàm thuần.
 * Tuần chưa đủ ngày **không** sinh dấu hiệu nào — chỉ đếm những ngày đã luyện.
 */
import type { GeneralizationCheck, LocalDate, PracticeGoal, Session } from '@/data/types'

export const DEFAULT_PRACTICE_GOAL = { daysPerWeek: 5, minMinutesPerDay: 5 } as const

export type PracticeGoalInput = Pick<PracticeGoal, 'daysPerWeek' | 'minMinutesPerDay'>

export type SessionForPractice = Pick<Session, 'dailyGoalMet'> & Partial<Pick<Session, 'durationMs'>>

export interface PracticeDay {
  date: LocalDate
  practiced: boolean
}

export interface WeekSummary {
  days: number
  target: number
  met: boolean
  practicedDates: LocalDate[]
}

/**
 * Ba đường: ngày của bé xong, **hoặc** tổng thời gian các buổi trong ngày ≥ `minMinutesPerDay`,
 * **hoặc** có xác nhận cầu nối bậc ≥ 2 trong ngày (bậc 1 là trên iPad nên không tính).
 */
export function isPracticeDay(
  sessionsOfDay: SessionForPractice[],
  checksOfDay: Pick<GeneralizationCheck, 'level'>[],
  goal: PracticeGoalInput = DEFAULT_PRACTICE_GOAL,
): boolean {
  if (sessionsOfDay.some(s => s.dailyGoalMet)) return true
  const totalMs = sessionsOfDay.reduce((sum, s) => sum + (s.durationMs ?? 0), 0)
  if (totalMs >= goal.minMinutesPerDay * 60_000) return true
  return checksOfDay.some(c => c.level >= 2)
}

/** Tuần đạt khi số ngày luyện ≥ `daysPerWeek`. */
export function weekSummary(days: PracticeDay[], goal: PracticeGoalInput = DEFAULT_PRACTICE_GOAL): WeekSummary {
  const practicedDates = days.filter(d => d.practiced).map(d => d.date)
  return {
    days: practicedDates.length,
    target: goal.daysPerWeek,
    met: practicedDates.length >= goal.daysPerWeek,
    practicedDates,
  }
}
