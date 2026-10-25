// Repo tầng dữ liệu — xem docs/06-data-model.md.
// Quy tắc bất biến: không có đường nào xóa phần thưởng (FarmState.items, Milestone, totalStars)
// ngoài wipeAllData() dùng cho nút "Xóa toàn bộ" của ba mẹ và chế độ thay thế khi nhập sao lưu.

import Dexie from 'dexie'
import { ulid } from 'ulid'
import { db } from '@/data/db'
import { DEFAULT_CHILD_SETTINGS } from '@/data/types'
import type {
  AudioRole,
  BaseRecord,
  Child,
  ChildSettings,
  EpochMs,
  Exercise,
  FarmItem,
  FarmState,
  GeneralizationCheck,
  Item,
  ItemCategory,
  LocalDate,
  MediaAsset,
  Milestone,
  PracticeGoal,
  Session,
  Trial,
  WeekStart,
  WeeklyGoal,
} from '@/data/types'
import { withBase } from '@/lib/ids'
import { randomSeed } from '@/lib/random'
import { DEFAULT_TIMEZONE, weekStartOf } from '@/lib/time'

// ------------------------------------------------------------- tiện ích

/** Gộp patch vào bản ghi và đặt lại updatedAt (06 §1). */
function merge<T extends BaseRecord>(rec: T, patch: Partial<T>, now: EpochMs = Date.now()): T {
  return { ...rec, ...patch, id: rec.id, createdAt: rec.createdAt, updatedAt: now }
}

function newestFirst<T extends { startedAt: EpochMs }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.startedAt - a.startedAt)
}

// ---------------------------------------------------------------- Child

export async function getChild(): Promise<Child | undefined> {
  return db.children.toCollection().first()
}

export async function createChild(input: {
  displayName: string
  birthMonth: string
  timezone?: string
}): Promise<Child> {
  const child = withBase<Omit<Child, keyof BaseRecord>>({
    displayName: input.displayName,
    birthMonth: input.birthMonth,
    timezone: input.timezone ?? DEFAULT_TIMEZONE,
    settings: { ...DEFAULT_CHILD_SETTINGS, rewardKeys: [...DEFAULT_CHILD_SETTINGS.rewardKeys] },
    consents: {},
  })
  await db.children.put(child)
  return child
}

/**
 * Khóa có giá trị `undefined` bị XÓA hẳn khỏi settings — ba mẹ chọn "Theo cấu hình của bài"
 * ở S19 thì engine quay về giá trị trong ExerciseConfig (06 §1 ưu tiên cấu hình).
 */
export async function updateChildSettings(patch: Partial<ChildSettings>): Promise<Child> {
  const child = await getChild()
  if (!child) throw new Error('Chưa có hồ sơ bé')
  const settings = { ...child.settings, ...patch } as ChildSettings & Record<string, unknown>
  for (const key of Object.keys(patch)) {
    if (settings[key] === undefined) delete settings[key]
  }
  const next = merge(child, { settings })
  await db.children.put(next)
  return next
}

// ----------------------------------------------------------------- Item

export async function listItems(opts?: {
  category?: ItemCategory
  includeArchived?: boolean
}): Promise<Item[]> {
  const rows = await db.items.toArray()
  return rows
    .filter((it) => (opts?.includeArchived ? true : !it.archived))
    .filter((it) => (opts?.category ? it.category === opts.category : true))
    .sort((a, b) => a.key.localeCompare(b.key))
}

/** Trả theo đúng thứ tự `keys`; bỏ qua khóa chưa có mục. */
export async function getItemsByKeys(keys: string[]): Promise<Item[]> {
  if (keys.length === 0) return []
  const rows = await db.items.where('key').anyOf(keys).toArray()
  const byKey = new Map(rows.map((it) => [it.key, it]))
  return keys.map((k) => byKey.get(k)).filter((it): it is Item => it !== undefined)
}

export async function getItem(id: string): Promise<Item | undefined> {
  return db.items.get(id)
}

export async function upsertItem(
  input: Partial<Item> & { key: string; label: string; category: ItemCategory },
): Promise<Item> {
  const now = Date.now()
  const existing =
    (input.id ? await db.items.get(input.id) : undefined) ??
    (await db.items.where('key').equals(input.key).first())
  if (existing) {
    // Ba mẹ sửa nhãn hoặc câu → đánh dấu để gói khởi đầu không làm mới chữ mục này nữa.
    const editsText =
      (input.label !== undefined && input.label !== existing.label) ||
      input.transcripts !== undefined
    const next = merge(existing, input, now)
    if (editsText) next.textsEditedAt = now
    await db.items.put(next)
    return next
  }
  const created = withBase<Omit<Item, keyof BaseRecord>>(
    {
      key: input.key,
      scope: input.scope ?? 'family',
      category: input.category,
      label: input.label,
      imageMediaId: input.imageMediaId,
      audio: input.audio ?? {},
      transcripts: input.transcripts,
      model3dMediaId: input.model3dMediaId,
      archived: input.archived ?? false,
    },
    now,
    input.id,
  )
  await db.items.put(created)
  return created
}

export async function setItemArchived(id: string, archived: boolean): Promise<void> {
  const item = await db.items.get(id)
  if (!item) return
  await db.items.put(merge(item, { archived }))
}

// ---------------------------------------------------------------- Media

export async function putMedia(input: {
  kind: MediaAsset['kind']
  blob: Blob
  mime: string
  source: MediaAsset['source']
  width?: number
  height?: number
  hasAlpha?: boolean
  durationMs?: number
  gain?: number
  assetRef?: string
}): Promise<MediaAsset> {
  const media = withBase<Omit<MediaAsset, keyof BaseRecord>>({
    kind: input.kind,
    mime: input.mime,
    bytes: input.blob.size,
    blob: input.blob,
    width: input.width,
    height: input.height,
    hasAlpha: input.hasAlpha,
    durationMs: input.durationMs,
    gain: input.gain,
    source: input.source,
    assetRef: input.assetRef,
  })
  await db.media.put(media)
  return media
}

export async function getMedia(id: string): Promise<MediaAsset | undefined> {
  return db.media.get(id)
}

const objectUrlCache = new Map<string, string>()

/** URL blob có cache theo mediaId; nhớ gọi revokeMediaObjectUrls() khi thoát màn lớn. */
export async function getMediaObjectUrl(id: string): Promise<string | undefined> {
  const cached = objectUrlCache.get(id)
  if (cached) return cached
  const media = await db.media.get(id)
  if (!media) return undefined
  if (typeof URL.createObjectURL !== 'function') return undefined
  const url = URL.createObjectURL(media.blob)
  objectUrlCache.set(id, url)
  return url
}

export function revokeMediaObjectUrls(): void {
  if (typeof URL.revokeObjectURL === 'function') {
    for (const url of objectUrlCache.values()) URL.revokeObjectURL(url)
  }
  objectUrlCache.clear()
}

// ------------------------------------------------------- Item ↔ Media

async function requireItem(itemId: string): Promise<Item> {
  const item = await db.items.get(itemId)
  if (!item) throw new Error(`Không tìm thấy mục ${itemId}`)
  return item
}

export async function attachItemAudio(
  itemId: string,
  role: AudioRole,
  mediaId: string,
  transcript?: string,
): Promise<Item> {
  const item = await requireItem(itemId)
  const ids = [...(item.audio[role] ?? [])]
  const at = ids.indexOf(mediaId)
  const index = at >= 0 ? at : ids.push(mediaId) - 1
  const audio = { ...item.audio, [role]: ids }

  let transcripts = item.transcripts
  if (transcript !== undefined) {
    const list = [...(transcripts?.[role] ?? [])]
    while (list.length < index) list.push('')
    list[index] = transcript
    transcripts = { ...transcripts, [role]: list }
  }

  const next = merge(item, { audio, transcripts })
  await db.items.put(next)
  return next
}

export async function removeItemAudio(
  itemId: string,
  role: AudioRole,
  mediaId: string,
): Promise<Item> {
  const item = await requireItem(itemId)
  const ids = [...(item.audio[role] ?? [])]
  const index = ids.indexOf(mediaId)
  if (index < 0) return item
  ids.splice(index, 1)
  const audio = { ...item.audio, [role]: ids }

  let transcripts = item.transcripts
  const list = transcripts?.[role]
  if (list && index < list.length) {
    const nextList = [...list]
    nextList.splice(index, 1)
    transcripts = { ...transcripts, [role]: nextList }
  }

  const next = merge(item, { audio, transcripts })
  await db.items.put(next)
  return next
}

export async function setItemImage(itemId: string, mediaId: string): Promise<Item> {
  const item = await requireItem(itemId)
  const next = merge(item, { imageMediaId: mediaId })
  await db.items.put(next)
  return next
}

// ------------------------------------------------------------- Exercise

export async function listExercises(opts?: {
  phase?: 1 | 2 | 3
  activeOnly?: boolean
}): Promise<Exercise[]> {
  const rows = await db.exercises.toArray()
  return rows
    .filter((ex) => (opts?.phase ? ex.phase === opts.phase : true))
    .filter((ex) => (opts?.activeOnly ? ex.active : true))
    .sort((a, b) => a.code.localeCompare(b.code))
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  return db.exercises.get(id)
}

// ----------------------------------------------------------- WeeklyGoal

export async function getWeeklyGoal(
  childId: string,
  weekStart: WeekStart,
): Promise<WeeklyGoal | undefined> {
  return db.weeklyGoals.where('[childId+weekStart]').equals([childId, weekStart]).first()
}

export async function setWeeklyGoal(
  childId: string,
  weekStart: WeekStart,
  exerciseIds: string[],
  source: WeeklyGoal['source'] = 'parent',
): Promise<WeeklyGoal> {
  const existing = await getWeeklyGoal(childId, weekStart)
  if (existing) {
    const next = merge(existing, { exerciseIds: [...exerciseIds], source })
    await db.weeklyGoals.put(next)
    return next
  }
  const created = withBase<Omit<WeeklyGoal, keyof BaseRecord>>({
    childId,
    weekStart,
    exerciseIds: [...exerciseIds],
    source,
  })
  await db.weeklyGoals.put(created)
  return created
}

// -------------------------------------------------------------- Session

export async function createSession(s: Omit<Session, keyof BaseRecord>): Promise<Session> {
  const session = withBase(s)
  await db.sessions.put(session)
  return session
}

export async function updateSession(id: string, patch: Partial<Session>): Promise<Session> {
  const session = await db.sessions.get(id)
  if (!session) throw new Error(`Không tìm thấy buổi ${id}`)
  const next = merge(session, patch)
  await db.sessions.put(next)
  return next
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id)
}

/** Mới nhất trước. */
export async function listSessions(
  childId: string,
  opts?: { limit?: number; weekStart?: WeekStart; date?: LocalDate },
): Promise<Session[]> {
  let rows: Session[]
  if (opts?.date) {
    rows = await db.sessions.where('[childId+date]').equals([childId, opts.date]).toArray()
  } else if (opts?.weekStart) {
    rows = await db.sessions
      .where('[childId+weekStart]')
      .equals([childId, opts.weekStart])
      .toArray()
  } else {
    rows = await db.sessions
      .where('[childId+weekStart]')
      .between([childId, Dexie.minKey], [childId, Dexie.maxKey], true, true)
      .toArray()
  }
  const sorted = newestFirst(rows)
  return opts?.limit !== undefined ? sorted.slice(0, opts.limit) : sorted
}

export async function getUnfinishedSession(childId: string): Promise<Session | undefined> {
  const rows = await db.sessions.where('status').equals('active').toArray()
  return newestFirst(rows.filter((s) => s.childId === childId))[0]
}

// ---------------------------------------------------------------- Trial

export async function addTrial(trial: Omit<Trial, keyof BaseRecord>): Promise<Trial> {
  const row = withBase(trial)
  await db.trials.put(row)
  return row
}

export async function updateTrial(id: string, patch: Partial<Trial>): Promise<Trial> {
  const trial = await db.trials.get(id)
  if (!trial) throw new Error(`Không tìm thấy lượt ${id}`)
  const next = merge(trial, patch)
  await db.trials.put(next)
  return next
}

export async function listTrialsBySession(sessionId: string): Promise<Trial[]> {
  const rows = await db.trials.where('sessionId').equals(sessionId).toArray()
  return rows.sort(
    (a, b) => a.roundIndex - b.roundIndex || a.trialIndex - b.trialIndex || a.startedAt - b.startedAt,
  )
}

export async function listTrialsByWeek(childId: string, weekStart: WeekStart): Promise<Trial[]> {
  const rows = await db.trials.where('[childId+weekStart]').equals([childId, weekStart]).toArray()
  return rows.sort((a, b) => a.startedAt - b.startedAt)
}

/** Mới nhất trước. */
export async function listTrialsByItem(
  childId: string,
  itemId: string,
  limit?: number,
): Promise<Trial[]> {
  const rows = await db.trials
    .where('[childId+targetItemId+startedAt]')
    .between([childId, itemId, Dexie.minKey], [childId, itemId, Dexie.maxKey], true, true)
    .reverse()
    .toArray()
  return limit !== undefined ? rows.slice(0, limit) : rows
}

// --------------------------------------------------- Cầu nối, cột mốc

export async function addGeneralizationCheck(
  c: Omit<GeneralizationCheck, keyof BaseRecord>,
): Promise<GeneralizationCheck> {
  const row = withBase(c)
  await db.generalizationChecks.put(row)
  return row
}

export async function listGeneralizationChecks(
  childId: string,
  opts?: { itemId?: string; weekStart?: WeekStart },
): Promise<GeneralizationCheck[]> {
  let rows: GeneralizationCheck[]
  if (opts?.itemId) {
    rows = await db.generalizationChecks
      .where('[childId+itemId]')
      .equals([childId, opts.itemId])
      .toArray()
  } else {
    rows = await db.generalizationChecks
      .where('[childId+date]')
      .between([childId, Dexie.minKey], [childId, Dexie.maxKey], true, true)
      .toArray()
  }
  if (opts?.weekStart) {
    rows = rows.filter((c) => weekStartOf(c.date) === opts.weekStart)
  }
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export async function addMilestone(m: Omit<Milestone, keyof BaseRecord>): Promise<Milestone> {
  const row = withBase(m)
  await db.milestones.put(row)
  return row
}

/** Mới nhất trước. Không có API xóa cột mốc (06 §1). */
export async function listMilestones(childId: string, limit?: number): Promise<Milestone[]> {
  const rows = await db.milestones
    .where('[childId+earnedAt]')
    .between([childId, Dexie.minKey], [childId, Dexie.maxKey], true, true)
    .reverse()
    .toArray()
  return limit !== undefined ? rows.slice(0, limit) : rows
}

// ------------------------------------------------------------ FarmState

/**
 * Tạo sổ nông trại nếu chưa có; sổ chỉ thêm (06 §2.6).
 * Tạo trong một transaction 'rw': hai lời gọi song song (ví dụ `Promise.all` ở màn ba mẹ)
 * nếu không sẽ cùng thấy "chưa có" rồi cùng ghi, làm vỡ index duy nhất `&childId`.
 */
export async function getFarmState(childId: string): Promise<FarmState> {
  return db.transaction('rw', db.farmState, async () => {
    const existing = await db.farmState.where('childId').equals(childId).first()
    if (existing) return existing
    const created = withBase<Omit<FarmState, keyof BaseRecord>>({
      childId,
      items: [],
      totalStars: 0,
      layoutSeed: randomSeed(),
    })
    await db.farmState.put(created)
    return created
  })
}

/** CHỈ THÊM: không có đường nào bỏ bớt FarmItem. */
export async function appendFarmItems(
  childId: string,
  items: Omit<FarmItem, 'id'>[],
): Promise<FarmState> {
  const state = await getFarmState(childId)
  if (items.length === 0) return state
  const added: FarmItem[] = items.map((it) => ({ ...it, id: ulid() }))
  const next = merge(state, { items: [...state.items, ...added] })
  await db.farmState.put(next)
  return next
}

/** CHỈ TĂNG: n âm bị bỏ qua, totalStars không bao giờ giảm. */
export async function addStars(childId: string, n: number): Promise<FarmState> {
  const state = await getFarmState(childId)
  const delta = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  if (delta === 0) return state
  const next = merge(state, { totalStars: state.totalStars + delta })
  await db.farmState.put(next)
  return next
}

// --------------------------------------------------------- PracticeGoal

/** Tạo trong transaction vì lý do như `getFarmState`. */
export async function getPracticeGoal(childId: string): Promise<PracticeGoal> {
  return db.transaction('rw', db.practiceGoals, async () => {
    const existing = await db.practiceGoals.where('childId').equals(childId).first()
    if (existing) return existing
    const created = withBase<Omit<PracticeGoal, keyof BaseRecord>>({
      childId,
      daysPerWeek: 5,
      minMinutesPerDay: 5,
    })
    await db.practiceGoals.put(created)
    return created
  })
}

export async function setPracticeGoal(
  childId: string,
  patch: Partial<PracticeGoal>,
): Promise<PracticeGoal> {
  const goal = await getPracticeGoal(childId)
  const next = merge(goal, {
    ...patch,
    childId: goal.childId,
    daysPerWeek:
      patch.daysPerWeek === undefined
        ? goal.daysPerWeek
        : Math.min(7, Math.max(1, Math.round(patch.daysPerWeek))),
    minMinutesPerDay:
      patch.minMinutesPerDay === undefined
        ? goal.minMinutesPerDay
        : Math.max(1, Math.round(patch.minMinutesPerDay)),
  })
  await db.practiceGoals.put(next)
  return next
}

// -------------------------------------------------------------- AppMeta

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.appMeta.get(key)
  return row === undefined ? undefined : (row.value as T)
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.appMeta.put({ key, value })
}

// ------------------------------------------------------------ Xóa toàn bộ

/**
 * Thao tác xóa DUY NHẤT của app (06 §1): nút "Xóa toàn bộ" của ba mẹ và
 * chế độ "Thay thế" khi nhập sao lưu. Không có API xóa riêng cho phần thưởng.
 */
export async function wipeAllData(): Promise<void> {
  revokeMediaObjectUrls()
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
