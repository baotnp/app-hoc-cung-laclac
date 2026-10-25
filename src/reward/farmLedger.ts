/**
 * Sổ nông trại — **chỉ thêm** (01 §5.3, GĐ-22). Không có đường nào sinh thao tác xóa
 * hay giảm phần thưởng. Hàm thuần: trả danh sách mục cần thêm, người gọi ghi vào Dexie.
 */
import { createRng } from '@/lib/random'
import { weekStartAt } from '@/lib/time'
import type { EpochMs, FarmItem, ULID, WeekStart } from '@/data/types'

/** Loại mục thưởng hằng ngày (hoa/cây/sinh vật nhỏ). */
export const DAILY_KINDS = ['flower', 'tree', 'critter'] as const
/** Số biến thể tài nguyên mỗi loại (P2 dùng để chọn mô hình). */
export const VARIANTS_PER_KIND = 6

export interface GeneralizedItem {
  itemId: ULID
  /** khóa tài nguyên, ví dụ 'animal.dog'; mặc định dùng `itemId` */
  itemKey?: string
}

export interface FarmLedgerContext {
  now: EpochMs
  weekStart: WeekStart
  /** Ngày của bé vừa hoàn thành trong buổi này (01 §5.2). */
  dayCompleted: boolean
  /** Toàn bộ mục đang có trong `FarmState.items`. */
  existing: FarmItem[]
  /** Các mục đã "đạt ngoài đời" tới thời điểm này. */
  generalizedItems?: GeneralizedItem[]
  sessionId?: ULID
  /** Hạt giống để chọn loại/biến thể, tái lập được. */
  seed?: number
}

export type PlannedFarmItem = Omit<FarmItem, 'id'>

function weekOf(at: EpochMs): WeekStart {
  return weekStartAt(at)
}

/**
 * Mục cần thêm khi một ngày hoàn thành:
 * - 1 mục `daily`;
 * - 1 mục `weekly` nếu tuần này chưa có (tuần bỏ lỡ vẫn được cấp ở lần xong ngày kế tiếp,
 *   tối đa 1 mục/ngày);
 * - mục `animal` **chỉ khi** mục tương ứng đã đạt ngoài đời và chưa có trong nông trại.
 */
export function planFarmAdditions(ctx: FarmLedgerContext): PlannedFarmItem[] {
  const out: PlannedFarmItem[] = []
  const generalized = ctx.generalizedItems ?? []

  // Con vật: không phụ thuộc "ngày xong", nhưng bắt buộc đã đạt ngoài đời và chưa có.
  const haveAnimal = new Set(
    ctx.existing.filter(i => i.kind === 'animal' && i.itemId).map(i => i.itemId as ULID),
  )
  for (const g of generalized) {
    if (haveAnimal.has(g.itemId)) continue
    haveAnimal.add(g.itemId)
    out.push({
      kind: 'animal',
      itemId: g.itemId,
      variant: g.itemKey ?? g.itemId,
      addedAt: ctx.now,
      reason: 'generalized',
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
    })
  }

  if (!ctx.dayCompleted) return out

  const rng = createRng(ctx.seed ?? ctx.now)
  const kind = rng.pick(DAILY_KINDS)
  out.push({
    kind,
    variant: `${kind}.${rng.int(VARIANTS_PER_KIND) + 1}`,
    addedAt: ctx.now,
    reason: 'daily',
    ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
  })

  const hasWeekly = ctx.existing.some(i => i.reason === 'weekly' && weekOf(i.addedAt) === ctx.weekStart)
  if (!hasWeekly) {
    out.push({
      kind: 'weekly_unlock',
      variant: `weekly.${rng.int(VARIANTS_PER_KIND) + 1}`,
      addedAt: ctx.now,
      reason: 'weekly',
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
    })
  }

  return out
}

/** Tuần này đã được cấp "điều mới của tuần" chưa (dùng cho cột mốc `weekly_unlock`). */
export function hasWeeklyUnlock(items: FarmItem[], weekStart: WeekStart): boolean {
  return items.some(i => i.reason === 'weekly' && weekOf(i.addedAt) === weekStart)
}
