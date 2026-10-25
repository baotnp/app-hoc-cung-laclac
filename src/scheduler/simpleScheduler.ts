/**
 * `simple@1` — luật xếp lượt của MVP (06 §4.3, bước 0..8).
 * Hàm thuần: không gọi Dexie, mọi dữ liệu truyền vào. Mọi hằng số đến từ JSON bài.
 */
import { createRng, type Rng } from '@/lib/random'
import type { ItemScheduler, ItemStats, PlanInput, PlannedTrial } from './ItemScheduler'

export const SCHEDULER_ID = 'simple@1'
export const SCHEDULER_VERSION = 1

/** Mã lỗi khi `pool` không đủ mục để dựng vòng (S04 báo ba mẹ thiếu gì). */
export const NOT_ENOUGH_ITEMS = 'NOT_ENOUGH_ITEMS'

export class NotEnoughItemsError extends Error {
  readonly code = NOT_ENOUGH_ITEMS
  constructor(
    readonly exerciseId: string,
    readonly have: number,
    readonly need: number,
  ) {
    super(NOT_ENOUGH_ITEMS)
    this.name = NOT_ENOUGH_ITEMS
  }
}

/** Dữ liệu vào của `planRound` ở MVP: `PlanInput` + hai giá trị lấy thẳng từ JSON bài. */
export interface SimplePlanInput extends PlanInput {
  /** `itemPool.minItems` của bài (mặc định 2 cho `choose_from_two`). */
  minItems?: number
  /** `timing.waitBeforeCueMs` hiệu lực của buổi. */
  waitBeforeCueMs?: number
  /** Số ô trò hiển thị cùng lúc (`GameModule.choices`); mặc định 2. */
  choices?: number
}

export const DEFAULT_MIN_ITEMS = 2
export const DEFAULT_WAIT_BEFORE_CUE_MS = 5000
const MAX_SHUFFLE_TRIES = 50

interface TargetPick {
  itemId: string
  isNewItem: boolean
}

/** Bước 0: chọn bài cho vòng — xoay vòng theo bài lâu nhất chưa chạy trong tuần. */
export function pickExerciseForRound(
  goal: { exerciseIds: string[] },
  history: { exerciseId: string; at: number }[],
  roundIndex: number,
): string {
  const ids = goal.exerciseIds
  if (ids.length === 0) throw new Error('pickExerciseForRound: WeeklyGoal không có bài nào')
  const first = ids[0] as string
  if (ids.length === 1) return first

  // Các bài đã dùng ở những vòng trước của buổi này (các mục mới nhất trong `history`).
  const recent = [...history].sort((a, b) => b.at - a.at)
  const usedThisSession = new Set(recent.slice(0, Math.max(0, roundIndex)).map(h => h.exerciseId))

  let candidates = ids.filter(id => !usedThisSession.has(id))
  if (candidates.length === 0) candidates = [...ids]

  const lastAt = new Map<string, number>()
  for (const h of history) {
    const prev = lastAt.get(h.exerciseId)
    if (prev === undefined || h.at > prev) lastAt.set(h.exerciseId, h.at)
  }

  let best = candidates[0] as string
  let bestAt = lastAt.get(best)
  for (const id of candidates.slice(1)) {
    const at = lastAt.get(id)
    if (bestAt === undefined) break // chưa chạy tuần này: ưu tiên cao nhất, giữ thứ tự danh sách
    if (at === undefined || at < bestAt) {
      best = id
      bestAt = at
    }
  }
  return best
}

function sortFresh(a: ItemStats, b: ItemStats): number {
  if (a.trials !== b.trials) return a.trials - b.trials
  const al = a.lastSeenAt ?? -1
  const bl = b.lastSeenAt ?? -1
  if (al !== bl) return al - bl
  return a.itemId.localeCompare(b.itemId)
}

function sortKnown(a: ItemStats, b: ItemStats): number {
  const al = a.lastSeenAt ?? -1
  const bl = b.lastSeenAt ?? -1
  if (al !== bl) return al - bl
  if (a.trials !== b.trials) return a.trials - b.trials
  return a.itemId.localeCompare(b.itemId)
}

/** Lấy `count` mục theo thứ tự ưu tiên, xoay vòng khi thiếu mục. */
function takeRoundRobin(sorted: ItemStats[], count: number): string[] {
  const out: string[] = []
  if (sorted.length === 0) return out
  for (let i = 0; i < count; i++) out.push((sorted[i % sorted.length] as ItemStats).itemId)
  return out
}

/** Không để cùng một mục làm đích ở hai lượt liền (bước 4). */
function hasAdjacentRepeat(picks: TargetPick[]): boolean {
  for (let i = 1; i < picks.length; i++) {
    if ((picks[i] as TargetPick).itemId === (picks[i - 1] as TargetPick).itemId) return true
  }
  return false
}

/** Sắp xếp lại để tránh hai lượt liền cùng mục (dự phòng khi xáo trộn không ra). */
function spread(picks: TargetPick[]): TargetPick[] {
  const byItem = new Map<string, TargetPick[]>()
  for (const p of picks) {
    const list = byItem.get(p.itemId)
    if (list) list.push(p)
    else byItem.set(p.itemId, [p])
  }
  const groups = [...byItem.values()].sort((a, b) => b.length - a.length)
  const out: TargetPick[] = []
  let moved = true
  while (out.length < picks.length && moved) {
    moved = false
    for (const g of groups) {
      const next = g[0]
      if (!next) continue
      const last = out[out.length - 1]
      if (last && last.itemId === next.itemId) continue
      out.push(g.shift() as TargetPick)
      moved = true
    }
  }
  for (const g of groups) out.push(...g) // phần còn lại (pool quá nhỏ): chấp nhận lặp
  return out
}

function maxRunOk(slots: (0 | 1)[], maxRun: number, prevSide: 0 | 1 | null, prevRun: number): boolean {
  let run = 0
  let side: 0 | 1 | null = prevSide
  if (prevSide !== null) run = prevRun
  for (const s of slots) {
    if (s === side) run++
    else {
      side = s
      run = 1
    }
    if (run > maxRun) return false
  }
  return true
}

/** Bước 6: vị trí đích cân bằng, chuỗi cùng bên ≤ maxSameSideRun. */
function planSlots(
  n: number,
  maxSameSideRun: number,
  history: { lastSideRun: number; leftShare: number },
  rng: Rng,
): (0 | 1)[] {
  const majority: 0 | 1 = rng.int(2) === 0 ? 0 : 1
  const other: 0 | 1 = majority === 0 ? 1 : 0
  const majorityCount = Math.ceil(n / 2)
  const base: (0 | 1)[] = []
  for (let i = 0; i < majorityCount; i++) base.push(majority)
  for (let i = majorityCount; i < n; i++) base.push(other)

  // Chuỗi cuối của vòng trước: biết độ dài, bên suy ra từ `leftShare`.
  const prevRun = Math.max(0, Math.floor(history.lastSideRun))
  const prevSide: 0 | 1 | null = prevRun > 0 ? (history.leftShare >= 0.5 ? 0 : 1) : null

  for (let i = 0; i < MAX_SHUFFLE_TRIES; i++) {
    const candidate = rng.shuffle(base)
    if (maxRunOk(candidate, maxSameSideRun, prevSide, prevRun)) return candidate
  }
  // Dự phòng: xen kẽ, bắt đầu bằng bên nhiều hơn (và khác bên của chuỗi trước nếu đang dài).
  const startWithMajority = !(prevSide === majority && prevRun >= maxSameSideRun)
  const out: (0 | 1)[] = []
  let left = majorityCount
  let right = n - majorityCount
  let useMajority = startWithMajority
  while (out.length < n) {
    if (useMajority && left > 0) {
      out.push(majority)
      left--
    } else if (!useMajority && right > 0) {
      out.push(other)
      right--
    } else if (left > 0) {
      out.push(majority)
      left--
    } else {
      out.push(other)
      right--
    }
    useMajority = !useMajority
  }
  return out
}

/** Bước 1..8: dựng kế hoạch cho một vòng. Hàm thuần, tái lập theo `seed`. */
export function planRound(input: SimplePlanInput): PlannedTrial[] {
  const n = input.scheduling.trialsPerRound
  const minItems = input.minItems ?? DEFAULT_MIN_ITEMS
  if (input.pool.length < minItems) {
    throw new NotEnoughItemsError(input.exerciseId, input.pool.length, minItems)
  }
  if (n <= 0) return []

  const rng = createRng(input.seed ?? 1)

  // Bước 2: phân loại.
  const known = input.pool.filter(i => i.trials >= input.scheduling.knownMinTrials).sort(sortKnown)
  const fresh = input.pool.filter(i => i.trials < input.scheduling.knownMinTrials).sort(sortFresh)

  // Bước 3: số lượt mới.
  let newCount = fresh.length === 0 ? 0 : Math.max(1, Math.floor(input.scheduling.newItemRatio * n))
  if (known.length === 0) newCount = n
  newCount = Math.min(newCount, n)
  const knownCount = n - newCount

  // Bước 4: chọn mục.
  const picks: TargetPick[] = [
    ...takeRoundRobin(fresh, newCount).map(itemId => ({ itemId, isNewItem: true })),
    ...takeRoundRobin(known, knownCount).map(itemId => ({ itemId, isNewItem: false })),
  ]

  // Bước 5: thứ tự.
  const wantKnownFirst = input.scheduling.firstTrialKnownItem && knownCount > 0
  let ordered = picks
  let ok = false
  for (let i = 0; i < MAX_SHUFFLE_TRIES; i++) {
    const candidate = rng.shuffle(picks)
    const firstOk = !wantKnownFirst || (candidate[0] as TargetPick).isNewItem === false
    if (firstOk && !hasAdjacentRepeat(candidate)) {
      ordered = candidate
      ok = true
      break
    }
  }
  if (!ok) {
    ordered = spread(rng.shuffle(picks))
    if (wantKnownFirst) {
      const idx = ordered.findIndex(p => !p.isNewItem)
      if (idx > 0) {
        const head = ordered[idx] as TargetPick
        ordered = [head, ...ordered.slice(0, idx), ...ordered.slice(idx + 1)]
      }
    }
  }

  // Bước 6: vị trí đích.
  const slots = planSlots(n, Math.max(1, input.positions.maxSameSideRun), input.history, rng)

  // Bước 7: hình gây nhiễu.
  const avoid = Math.max(0, input.distractor.avoidRepeatLast)
  const recentDistractors: string[] = []
  const waitBeforeCueMs = input.waitBeforeCueMs ?? DEFAULT_WAIT_BEFORE_CUE_MS

  // Số ô trò cần: `choose_from_two` cần 2 (1 đích + 1 nhiễu), `sequence_cards` cần 3.
  // Kho nhỏ hơn thì dùng hết kho — buổi học của bé không được vỡ vì thiếu một thẻ.
  const wanted = Math.max(2, input.choices ?? 2)
  const perTrial = Math.min(wanted, input.pool.length)

  return ordered.map((pick, trialIndex) => {
    const others = input.pool.filter(i => i.itemId !== pick.itemId).map(i => i.itemId)
    let candidates = others
    if (input.pool.length > 2 && avoid > 0) {
      const banned = new Set(recentDistractors.slice(-avoid))
      const filtered = others.filter(id => !banned.has(id))
      if (filtered.length > 0) candidates = filtered
    }
    const need = perTrial - 1
    const distractors: string[] = []
    const bag = rng.shuffle(candidates.length >= need ? candidates : others)
    for (const id of bag) {
      if (distractors.length >= need) break
      distractors.push(id)
    }
    if (distractors.length > 0) recentDistractors.push(distractors[0] as string)
    return {
      trialIndex,
      exerciseId: input.exerciseId,
      targetItemId: pick.itemId,
      distractorItemIds: distractors,
      targetSlot: slots[trialIndex] as 0 | 1,
      isNewItem: pick.isNewItem,
      waitBeforeCueMs,
    }
  })
}

/** Bản cài đặt `ItemScheduler` dùng ở MVP. */
export const simpleItemScheduler: ItemScheduler = {
  id: SCHEDULER_ID,
  version: SCHEDULER_VERSION,
  async planRound(input: PlanInput): Promise<PlannedTrial[]> {
    return planRound(input)
  },
  waitBeforeCueMs(_itemId: string, defaults: { waitBeforeCueMs: number }): number {
    return defaults.waitBeforeCueMs
  },
}
