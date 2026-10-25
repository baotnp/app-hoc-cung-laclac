import type { EpochMs, LocalDate, WeekStart } from '@/data/types'

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

/** 'YYYY-MM-DD' theo múi giờ của bé (06 §1). */
export function localDate(at: EpochMs = Date.now(), timeZone = DEFAULT_TIMEZONE): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at))
  return parts
}

/** Thứ trong tuần theo múi giờ của bé: 1 = Thứ Hai … 7 = Chủ nhật. */
export function isoWeekday(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = CN
  return day === 0 ? 7 : day
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000
  const dt = new Date(t)
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${mm}-${dd}`
}

/** Thứ Hai của tuần chứa `date` (GĐ-12). */
export function weekStartOf(date: LocalDate): WeekStart {
  return addDays(date, -(isoWeekday(date) - 1))
}

export function weekStartAt(at: EpochMs = Date.now(), timeZone = DEFAULT_TIMEZONE): WeekStart {
  return weekStartOf(localDate(at, timeZone))
}

export function daysOfWeek(weekStart: WeekStart): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function minutes(ms: number): number {
  return ms / 60_000
}

export function formatDateVi(date: LocalDate): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

export function formatClockVi(at: EpochMs, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at))
}
