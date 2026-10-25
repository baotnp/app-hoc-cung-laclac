/**
 * Huy hiệu cột mốc của ba mẹ (01 §5.3, 06 §2.6). Chỉ sinh cột mốc tích cực:
 * **không có huy hiệu âm**, không đánh dấu tuần chưa đủ ngày, không bao giờ xóa cột mốc đã có.
 */
import type {
  BaseRecord,
  EpochMs,
  LocalDate,
  Milestone,
  MilestoneKind,
  ULID,
  WeekStart,
} from '@/data/types'

export type PlannedMilestone = Omit<Milestone, keyof BaseRecord>

export interface MilestoneItem {
  itemId: ULID
  label: string
  exerciseId?: string
  sourceCheckId?: ULID
  /** bậc cao nhất đã xác nhận ngoài đời (3 hoặc 4) */
  level?: number
}

export interface MilestoneContext {
  childId: ULID
  now: EpochMs
  date: LocalDate
  weekStart: WeekStart
  /** Cột mốc đã có trong Dexie (để không sinh trùng). */
  existing: Pick<Milestone, 'kind' | 'itemId' | 'params'>[]
  /** Buổi vừa đóng là buổi đầu tiên của bé. */
  firstSession?: boolean
  /** Mục vừa đạt trên iPad. */
  masteredIpad?: MilestoneItem[]
  /** Mục vừa đạt ngoài đời. */
  generalized?: MilestoneItem[]
  /** Tuần này đã đủ số ngày luyện; `days` để đưa vào câu chúc mừng. */
  weeklyPracticeMet?: { days: number }
  /** Tuần này đã cấp "điều mới của tuần". */
  weeklyUnlock?: boolean
}

function keyOf(kind: MilestoneKind, itemId: ULID | undefined, weekStart: unknown): string {
  return `${kind}|${itemId ?? ''}|${typeof weekStart === 'string' ? weekStart : ''}`
}

/** Sinh các cột mốc mới (chưa có trong `existing`). Không bao giờ sinh cột mốc tiêu cực. */
export function planMilestones(ctx: MilestoneContext): PlannedMilestone[] {
  const seen = new Set(ctx.existing.map(m => keyOf(m.kind, m.itemId, m.params?.['weekStart'])))
  const out: PlannedMilestone[] = []

  const add = (m: PlannedMilestone): void => {
    const key = keyOf(m.kind, m.itemId, m.params['weekStart'])
    if (seen.has(key)) return
    seen.add(key)
    out.push(m)
  }

  if (ctx.firstSession) {
    add({
      childId: ctx.childId,
      kind: 'first_session',
      badgeKey: 'first_session',
      params: {},
      earnedAt: ctx.now,
      date: ctx.date,
    })
  }

  for (const item of ctx.masteredIpad ?? []) {
    add({
      childId: ctx.childId,
      kind: 'item_mastered_ipad',
      itemId: item.itemId,
      ...(item.exerciseId ? { exerciseId: item.exerciseId } : {}),
      badgeKey: 'item_mastered_ipad',
      params: { label: item.label },
      earnedAt: ctx.now,
      date: ctx.date,
    })
  }

  for (const item of ctx.generalized ?? []) {
    add({
      childId: ctx.childId,
      kind: 'item_generalized',
      itemId: item.itemId,
      ...(item.exerciseId ? { exerciseId: item.exerciseId } : {}),
      badgeKey: 'item_generalized',
      params: { label: item.label, ...(item.level ? { level: item.level } : {}) },
      earnedAt: ctx.now,
      date: ctx.date,
      ...(item.sourceCheckId ? { sourceCheckId: item.sourceCheckId } : {}),
    })
  }

  if (ctx.weeklyPracticeMet) {
    add({
      childId: ctx.childId,
      kind: 'weekly_practice_met',
      badgeKey: 'weekly_practice_met',
      params: { weekStart: ctx.weekStart, days: ctx.weeklyPracticeMet.days },
      earnedAt: ctx.now,
      date: ctx.date,
    })
  }

  if (ctx.weeklyUnlock) {
    add({
      childId: ctx.childId,
      kind: 'weekly_unlock',
      badgeKey: 'weekly_unlock',
      params: { weekStart: ctx.weekStart },
      earnedAt: ctx.now,
      date: ctx.date,
    })
  }

  return out
}
