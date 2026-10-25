import type {
  AudioRole,
  BaseRecord,
  Child,
  Exercise,
  FarmItem,
  GeneralizationCheck,
  Item,
  Milestone,
  Round,
  Session,
  SessionConfigSnapshot,
  Trial,
} from '@/data/types'
import * as repos from '@/data/repos'
import { localDate, weekStartAt, weekStartOf } from '@/lib/time'
import { createRng, randomSeed } from '@/lib/random'
import { planRound as simplePlanRound, pickExerciseForRound } from '@/scheduler/simpleScheduler'
import { simpleItemScheduler } from '@/scheduler'
import type { PlannedTrial } from '@/scheduler'
import { detectorRegistry, getGame } from '@/engine'
import { itemStatusFrom } from '@/scheduler/mastery'
import { isDayComplete, isPracticeDay, planFarmAdditions, planMilestones } from '@/reward'

export const APP_VERSION = '0.1.0'

export interface RoundPlan {
  exercise: Exercise
  items: Map<string, Item>
  trials: PlannedTrial[]
}

export interface MissingContent {
  itemKey: string
  label: string
  /**
   * Thiếu hẳn: không có ảnh, hoặc vai âm không có cả bản thu lẫn câu chữ.
   * Còn phần tử nào ở đây thì mục chưa vào được buổi học.
   */
  missing: ('image' | AudioRole)[]
  /**
   * Chưa thu: vai âm đã có câu chữ nhưng chưa có bản thu. Mục vẫn chơi được —
   * app hiện câu trên lớp của ba mẹ để ba mẹ đọc trực tiếp (giọng vẫn là giọng thật).
   */
  liveVoice: AudioRole[]
}

/** Vai âm mặc định khi bài không khai báo `requiredAudio`. */
export const DEFAULT_REQUIRED_AUDIO: AudioRole[] = ['instruction', 'praise']

/** Vai này đã có bản thu giọng ba mẹ chưa. */
export function hasRecordedClip(item: Item, role: AudioRole): boolean {
  return (item.audio[role]?.length ?? 0) > 0
}

/** Câu chữ để ba mẹ đọc trực tiếp cho vai này (bỏ qua ô trống), nếu có. */
export function spokenLineFor(item: Item, role: AudioRole): string | undefined {
  const line = item.transcripts?.[role]?.find((text) => text.trim().length > 0)
  return line?.trim()
}

/**
 * Câu ba mẹ đọc cho vai này, xét cả bài đang chơi.
 *
 * Thứ tự ưu tiên:
 * 1. Ba mẹ đã tự sửa câu của mục → dùng câu của ba mẹ.
 * 2. Câu của cô cho **chính bài này** (`config.spoken`), `{label}` thay bằng tên mục.
 *    Cần bước này vì một mục nằm trong nhiều bài: con bò vừa là "Chỉ vào con bò"
 *    (chọn hình) vừa là "Con gì đây?" (gọi tên) vừa là "ú òa" (trốn tìm).
 * 3. Câu kèm sẵn của mục.
 */
export function resolveSpokenLine(
  exercise: Exercise,
  item: Item,
  role: AudioRole,
): string | undefined {
  const own = spokenLineFor(item, role)
  if (item.textsEditedAt !== undefined && own) return own

  const template = exercise.config.spoken?.[role]
  if (template) return template.replaceAll('{label}', item.label).trim()

  return own
}

/** Cách một vai được truyền tới bé: bản thu sẵn, ba mẹ đọc trực tiếp, hay chưa có gì. */
export type AudioDelivery = 'recorded' | 'live' | 'none'

export function audioDelivery(item: Item, role: AudioRole, exercise?: Exercise): AudioDelivery {
  if (hasRecordedClip(item, role)) return 'recorded'
  const line = exercise ? resolveSpokenLine(exercise, item, role) : spokenLineFor(item, role)
  return line !== undefined ? 'live' : 'none'
}

/**
 * Mục đủ điều kiện vào buổi: có ảnh và, với mỗi vai bài yêu cầu, có bản thu HOẶC câu chữ
 * để ba mẹ đọc trực tiếp (docs/06 §2.3). Trả về cả hai mức để màn ba mẹ phân biệt được
 * "còn thiếu" (chặn) với "ba mẹ đọc trực tiếp" (chơi được).
 */
export function contentGaps(exercise: Exercise, items: Item[]): MissingContent[] {
  const roles = exercise.config.requiredAudio ?? DEFAULT_REQUIRED_AUDIO
  const gaps: MissingContent[] = []
  for (const item of items) {
    const missing: MissingContent['missing'] = []
    const liveVoice: AudioRole[] = []
    if (!item.imageMediaId) missing.push('image')
    for (const role of roles) {
      const delivery = audioDelivery(item, role, exercise)
      if (delivery === 'live') liveVoice.push(role)
      else if (delivery === 'none') missing.push(role)
    }
    if (missing.length > 0 || liveVoice.length > 0) {
      gaps.push({ itemKey: item.key, label: item.label, missing, liveVoice })
    }
  }
  return gaps
}

export function eligibleItems(exercise: Exercise, items: Item[]): Item[] {
  const blocked = new Set(
    contentGaps(exercise, items)
      .filter((gap) => gap.missing.length > 0)
      .map((gap) => gap.itemKey),
  )
  return items.filter((i) => !i.archived && !blocked.has(i.key))
}

/**
 * Ước lượng thời gian ba mẹ đọc xong một câu.
 *
 * Khi vai chưa có bản thu, app không phát gì mà hiện câu cho ba mẹ đọc trực tiếp, nên
 * không có sự kiện "phát xong" để máy trạng thái bắt đầu đếm `waitBeforeCueMs`. Các hằng số
 * dưới đây là ƯỚC LƯỢNG ban đầu, CẦN HIỆU CHỈNH sau buổi thử đầu tiên với ba mẹ thật.
 */
export const SPOKEN_LINE_BASE_MS = 1200
export const SPOKEN_LINE_PER_CHAR_MS = 60
export const SPOKEN_LINE_MIN_MS = 1500
export const SPOKEN_LINE_MAX_MS = 4000

export function estimateSpokenMs(text: string): number {
  const chars = text.trim().length
  const raw = SPOKEN_LINE_BASE_MS + chars * SPOKEN_LINE_PER_CHAR_MS
  return Math.min(SPOKEN_LINE_MAX_MS, Math.max(SPOKEN_LINE_MIN_MS, raw))
}

/**
 * Bài chạy được: app có trò và có cách nhận trả lời cho nó, **và** đủ mục dùng được
 * (ảnh + câu lệnh đã thu hoặc câu chữ để ba mẹ đọc).
 *
 * Kiểm trò/detector là bắt buộc: thiếu chúng thì `useTrial` không dựng được bộ nhận
 * chạm, màn hiện ra nhưng bé chạm mãi không ăn — tệ hơn nhiều so với bỏ qua bài.
 */
export function canRun(exercise: Exercise): boolean {
  if (!getGame(exercise.type)) return false
  const kind = exercise.config.response.detector
  return detectorRegistry.has(kind)
}

async function isPlayable(exercise: Exercise): Promise<boolean> {
  if (!canRun(exercise)) return false
  const pool = await repos.getItemsByKeys(exercise.config.itemPool.keys)
  return eligibleItems(exercise, pool).length >= exercise.config.itemPool.minItems
}

/** Lọc danh sách bài của tuần, chỉ giữ bài đã đủ nội dung. */
export async function filterPlayable(exerciseIds: string[]): Promise<string[]> {
  const out: string[] = []
  for (const id of exerciseIds) {
    const exercise = await repos.getExercise(id)
    if (exercise && (await isPlayable(exercise))) out.push(id)
  }
  return out
}

/**
 * Đã có bài nào chơi được chưa. Dùng cho màn chờ của bé: khi chưa có,
 * app hiện lối vào trang ba mẹ thấy được (lúc đó chắc chắn bé chưa dùng app).
 */
export async function hasPlayableExercise(): Promise<boolean> {
  const exercises = await repos.listExercises({ phase: 1, activeOnly: true })
  for (const exercise of exercises) if (await isPlayable(exercise)) return true
  return false
}

/** Giá trị hiệu lực = ghi đè của ba mẹ, nếu không thì cấu hình bài (GĐ-29). */
export function effectiveTiming(
  child: Child,
  exercise: Exercise,
): { waitBeforeCueMs: number; afterCueTimeoutMs: number } {
  const s = child.settings
  return {
    waitBeforeCueMs: s.waitBeforeCueMsOverride ?? exercise.config.timing.waitBeforeCueMs,
    afterCueTimeoutMs: s.afterCueTimeoutMsOverride ?? exercise.config.timing.afterCueTimeoutMs,
  }
}

function snapshot(child: Child, exercise: Exercise): SessionConfigSnapshot {
  const timing = effectiveTiming(child, exercise)
  return {
    waitBeforeCueMs: timing.waitBeforeCueMs,
    afterCueTimeoutMs: timing.afterCueTimeoutMs,
    trialsPerRound: exercise.config.scheduling.trialsPerRound,
    quality: child.settings.quality,
    reduceMotion: child.settings.reduceMotion,
    silentParty: child.settings.silentParty,
    masterVolume: child.settings.masterVolume,
  }
}

/** Chọn 2 phần thưởng thật để bé chọn ở S05 (F-09, GĐ-16). */
export async function pickRewardOptions(child: Child, seed: number): Promise<[string, string] | []> {
  const keys = child.settings.rewardKeys
  if (keys.length < 2) return []
  const items = (await repos.getItemsByKeys(keys)).filter((i) => !i.archived && i.imageMediaId)
  if (items.length < 2) return []
  const rng = createRng(seed)
  const picked = rng.shuffle(items).slice(0, 2)
  return [picked[0]!.id, picked[1]!.id]
}

export interface StartSessionResult {
  session: Session
  plan: RoundPlan
}

export async function startSession(child: Child): Promise<StartSessionResult> {
  const now = Date.now()
  const date = localDate(now, child.timezone)
  const weekStart = weekStartOf(date)
  const goal = await repos.getWeeklyGoal(child.id, weekStart)

  let exerciseIds = goal?.exerciseIds ?? []
  if (exerciseIds.length === 0) {
    // Chưa có mục tiêu tuần: dùng các bài giai đoạn 1 đang bật (UI chọn bài ở S18).
    const actives = await repos.listExercises({ phase: 1, activeOnly: true })
    exerciseIds = actives.map((e) => e.id)
  }
  // Bỏ bài chưa đủ nội dung: một bài thiếu ảnh không nên chặn cả buổi học.
  exerciseIds = await filterPlayable(exerciseIds)
  if (exerciseIds.length === 0) throw new Error('NO_EXERCISE')

  const seed = randomSeed()
  const history = await recentExerciseHistory(child.id, weekStart)
  const exerciseId = pickExerciseForRound({ exerciseIds }, history, 0)
  const plan = await planRound(child, exerciseId, 0, seed)

  const session = await repos.createSession({
    childId: child.id,
    date,
    weekStart,
    startedAt: now,
    status: 'active',
    phase: 'reward_choice',
    weeklyGoalId: goal?.id,
    rewardOptions: (await pickRewardOptions(child, seed)) as Session['rewardOptions'],
    rounds: [
      {
        index: 0,
        exerciseId: plan.exercise.id,
        startedAt: now,
        starsLit: 0,
        partyShown: false,
        trialIds: [],
      },
    ],
    dailyGoalMet: false,
    ipadActiveMs: 0,
    schedulerId: simpleItemScheduler.id,
    randomSeed: seed,
    configSnapshot: snapshot(child, plan.exercise),
    appVersion: APP_VERSION,
    observations: [],
  })
  return { session, plan }
}

async function recentExerciseHistory(
  childId: string,
  weekStart: string,
): Promise<{ exerciseId: string; at: number }[]> {
  const sessions = await repos.listSessions(childId, { weekStart })
  const out: { exerciseId: string; at: number }[] = []
  for (const s of sessions) {
    for (const r of s.rounds) out.push({ exerciseId: r.exerciseId, at: r.startedAt })
  }
  return out.sort((a, b) => b.at - a.at)
}

/** Dựng kế hoạch một vòng: bài + mục + các lượt (docs/06 §4.3). */
export async function planRound(
  child: Child,
  exerciseId: string,
  roundIndex: number,
  seed: number,
  lastSideRun = 0,
): Promise<RoundPlan> {
  const exercise = await repos.getExercise(exerciseId)
  if (!exercise) throw new Error(`EXERCISE_NOT_FOUND:${exerciseId}`)
  const pool = await repos.getItemsByKeys(exercise.config.itemPool.keys)
  const usable = eligibleItems(exercise, pool)
  const statuses = await itemStatsFor(child.id, usable, exercise)

  const params = exercise.config.params as
    | { positions?: { maxSameSideRun?: number }; distractor?: { avoidRepeatLast?: number } }
    | undefined

  const trials: PlannedTrial[] = await simplePlanRound({
    childId: child.id,
    now: Date.now(),
    exerciseId: exercise.id,
    scheduling: exercise.config.scheduling,
    positions: { maxSameSideRun: params?.positions?.maxSameSideRun ?? 3 },
    distractor: { avoidRepeatLast: params?.distractor?.avoidRepeatLast ?? 1 },
    pool: statuses,
    history: { lastSideRun, leftShare: 0.5 },
    seed: seed + roundIndex * 7919,
    minItems: exercise.config.itemPool.minItems,
    waitBeforeCueMs: effectiveTiming(child, exercise).waitBeforeCueMs,
    // Mỗi trò cần số ô khác nhau; thiếu ô thì màn của bé không dựng được.
    choices: getGame(exercise.type)?.choices,
  })

  return { exercise, items: new Map(usable.map((i) => [i.id, i])), trials }
}

async function itemStatsFor(childId: string, items: Item[], exercise: Exercise) {
  return Promise.all(
    items.map(async (item) => {
      const trials = await repos.listTrialsByItem(childId, item.id, 60)
      const valid = trials.filter((t) => t.valid)
      const checks = await repos.listGeneralizationChecks(childId, { itemId: item.id })
      const bySession = new Map<string, { trials: number; independentCorrect: number }>()
      for (const t of valid) {
        const acc = bySession.get(t.sessionId) ?? { trials: 0, independentCorrect: 0 }
        acc.trials++
        if (t.correctFirstTry && t.promptLevel === 'independent') acc.independentCorrect++
        bySession.set(t.sessionId, acc)
      }
      return {
        itemId: item.id,
        trials: valid.length,
        independentCorrect: valid.filter(
          (t) => t.correctFirstTry && t.promptLevel === 'independent',
        ).length,
        lastSeenAt: valid.length > 0 ? Math.max(...valid.map((t) => t.startedAt)) : null,
        recentSessions: [...bySession.entries()].map(([sessionId, v]) => ({ sessionId, ...v })),
        status: itemStatusFrom(valid, checks, exercise.config.mastery),
      }
    }),
  )
}

export async function recordTrial(
  session: Session,
  draft: Omit<Trial, keyof BaseRecord>,
): Promise<{ session: Session; trial: Trial }> {
  const trial = await repos.addTrial(draft)
  const rounds: Round[] = session.rounds.map((r) =>
    r.index === draft.roundIndex
      ? { ...r, starsLit: r.starsLit + 1, trialIds: [...r.trialIds, trial.id] }
      : r,
  )
  const updated = await repos.updateSession(session.id, {
    rounds,
    ipadActiveMs: Date.now() - session.startedAt,
  })
  await repos.addStars(session.childId, 1)
  return { session: updated, trial }
}

export async function markPartyShown(session: Session, roundIndex: number): Promise<Session> {
  const rounds = session.rounds.map((r) =>
    r.index === roundIndex ? { ...r, partyShown: true, endedAt: Date.now() } : r,
  )
  const next = { ...session, rounds }
  return repos.updateSession(session.id, { rounds, dailyGoalMet: isDayComplete(next) })
}

export interface BridgeAnswer {
  itemId: string
  exerciseId: string
  level: 2 | 3 | 4
  result: GeneralizationCheck['result']
}

export async function recordBridge(
  session: Session,
  answer: BridgeAnswer,
): Promise<GeneralizationCheck> {
  return repos.addGeneralizationCheck({
    childId: session.childId,
    itemId: answer.itemId,
    exerciseId: answer.exerciseId,
    level: answer.level,
    result: answer.result,
    confirmedBy: 'parent',
    date: session.date,
    sessionId: session.id,
  })
}

/** Có nên chơi thêm một bảng không (docs/03 §4): còn ≥2 phút so với mức iPad tối đa. */
export function canPlayAnotherRound(session: Session, child: Child): boolean {
  const elapsedMin = (Date.now() - session.startedAt) / 60_000
  return (
    session.rounds.length < child.settings.maxRoundsPerSession &&
    elapsedMin <= child.settings.ipadMaxMinutes - 2
  )
}

export interface SessionCloseResult {
  session: Session
  farmAdded: FarmItem[]
  milestones: Milestone[]
}

export async function closeSession(
  session: Session,
  status: Exclude<Session['status'], 'active'>,
): Promise<SessionCloseResult> {
  const endedAt = Date.now()
  const dayCompleted = isDayComplete(session)
  const closed = await repos.updateSession(session.id, {
    status,
    phase: 'done',
    endedAt,
    durationMs: endedAt - session.startedAt,
    dailyGoalMet: dayCompleted,
  })

  const farmState = await repos.getFarmState(closed.childId)
  const checks = await repos.listGeneralizationChecks(closed.childId)
  const exercise = await repos.getExercise(closed.rounds[0]?.exerciseId ?? '')
  const statuses = exercise ? await repos.listItems() : []
  const generalizedItems = exercise
    ? (await itemStatsFor(closed.childId, eligibleItems(exercise, statuses), exercise))
        .filter((s) => s.status === 'generalized')
        .map((s) => ({ itemId: s.itemId }))
    : []

  const additions = planFarmAdditions({
    now: endedAt,
    weekStart: closed.weekStart,
    dayCompleted,
    existing: farmState.items,
    generalizedItems,
    sessionId: closed.id,
    seed: closed.randomSeed,
  })
  const farm =
    additions.length > 0 ? await repos.appendFarmItems(closed.childId, additions) : farmState

  const milestones = await awardMilestones(closed, checks, {
    generalized: generalizedItems,
    weeklyUnlock: additions.some((a) => a.reason === 'weekly'),
  })
  return {
    session: closed,
    farmAdded: farm.items.slice(farm.items.length - additions.length),
    milestones,
  }
}

async function awardMilestones(
  session: Session,
  checks: GeneralizationCheck[],
  extra: { generalized: { itemId: string }[]; weeklyUnlock: boolean },
): Promise<Milestone[]> {
  const existing = await repos.listMilestones(session.childId)
  const weekSessions = await repos.listSessions(session.childId, { weekStart: session.weekStart })
  const goal = await repos.getPracticeGoal(session.childId)
  const checksByDate = new Map<string, GeneralizationCheck[]>()
  for (const c of checks) checksByDate.set(c.date, [...(checksByDate.get(c.date) ?? []), c])

  const practiceDays = [...new Set(weekSessions.map((s) => s.date))].filter((d) =>
    isPracticeDay(
      weekSessions.filter((s) => s.date === d),
      checksByDate.get(d) ?? [],
      goal,
    ),
  ).length

  const allSessions = await repos.listSessions(session.childId, { limit: 2 })
  const labels = new Map<string, string>()
  for (const item of await repos.listItems({ includeArchived: true })) {
    labels.set(item.id, item.label)
  }

  const planned = planMilestones({
    childId: session.childId,
    now: Date.now(),
    date: session.date,
    weekStart: session.weekStart,
    existing,
    firstSession: allSessions.length <= 1,
    generalized: extra.generalized.map((g) => ({
      itemId: g.itemId,
      label: labels.get(g.itemId) ?? '',
    })),
    weeklyPracticeMet: practiceDays >= goal.daysPerWeek ? { days: practiceDays } : undefined,
    weeklyUnlock: extra.weeklyUnlock,
  })

  const out: Milestone[] = []
  for (const m of planned) out.push(await repos.addMilestone(m))
  return out
}

export function currentWeekStart(child: Child): string {
  return weekStartAt(Date.now(), child.timezone)
}
