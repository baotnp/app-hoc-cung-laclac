import { vi, t } from '@/i18n/vi'
import {
  getChild,
  getMeta,
  getPracticeGoal,
  getUnfinishedSession,
  setMeta,
} from '@/data/repos'
import { practiceDaysOfWeek } from '@/data/queries'
import { formatDateVi, localDate, weekStartAt } from '@/lib/time'
import { Card, DayDots, Muted, Row, Shell } from './Shell'
import { useAsync } from './useAsync'
import type { NavProps, ParentRoute } from './nav'

const DAY_MS = 86_400_000
const DISMISS_KEY = 'backupReminderDismissedAt'

export interface ParentHomeProps extends NavProps {
  /** Người tích hợp dựng buổi học rồi chuyển sang S04. */
  onStartSession: () => void
  updateReady?: boolean
  onUpdate?: () => void
}

interface HomeData {
  childName: string
  days: { date: string; practiced: boolean }[]
  targetDays: number
  lastBackupAt: number | undefined
  backupReminderDays: number
  dismissedAt: number | undefined
  unfinishedSessionId: string | undefined
}

const SHORTCUTS: { route: ParentRoute; label: string }[] = [
  { route: 'ready', label: vi.ready.title },
  { route: 'content', label: vi.parent.content },
  { route: 'goals', label: vi.parent.goals },
  { route: 'progress', label: vi.parent.progress },
  { route: 'backup', label: vi.parent.backup },
  { route: 'settings', label: vi.parent.settings },
]

/** S03 — trang chính của chế độ ba mẹ. */
export function ParentHome({
  onStartSession,
  onBack,
  onNavigate,
  updateReady = false,
  onUpdate,
}: ParentHomeProps) {
  const state = useAsync<HomeData | null>(async () => {
    const child = await getChild()
    if (!child) return null
    const weekStart = weekStartAt(Date.now(), child.timezone)
    const [days, goal, lastBackupAt, dismissedAt, unfinished] = await Promise.all([
      practiceDaysOfWeek(child.id, weekStart),
      getPracticeGoal(child.id),
      getMeta<number>('lastBackupAt'),
      getMeta<number>(DISMISS_KEY),
      getUnfinishedSession(child.id),
    ])
    return {
      childName: child.displayName,
      days,
      targetDays: goal.daysPerWeek,
      lastBackupAt,
      backupReminderDays: child.settings.backupReminderDays,
      dismissedAt,
      unfinishedSessionId: unfinished?.id,
    }
  }, [])

  const data = state.value ?? null
  const doneDays = data ? data.days.filter((d) => d.practiced).length : 0
  const now = Date.now()
  const needsBackup =
    data !== null &&
    (data.lastBackupAt === undefined ||
      now - data.lastBackupAt > data.backupReminderDays * DAY_MS) &&
    (data.dismissedAt === undefined || now - data.dismissedAt > 7 * DAY_MS)

  async function dismissReminder() {
    await setMeta(DISMISS_KEY, Date.now())
    state.reload()
  }

  return (
    <Shell title={vi.parent.title} onBack={onBack}>
      {state.loading ? <Muted>{vi.parent.loading}</Muted> : null}
      {state.error || (!state.loading && data === null) ? (
        <Muted>{vi.parent.readError}</Muted>
      ) : null}

      {updateReady ? (
        <Card title={vi.settings.updateAvailable}>
          <button type="button" onClick={onUpdate}>
            {vi.settings.updateNow}
          </button>
        </Card>
      ) : null}

      <Card>
        <button type="button" className="primary" onClick={onStartSession}>
          {vi.parent.startSession}
        </button>
      </Card>

      {data?.unfinishedSessionId ? (
        <Card>
          <p>{vi.parent.unfinished}</p>
          <Row>
            <button type="button" onClick={onStartSession}>
              {vi.parent.continueSession}
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('review', data.unfinishedSessionId)}
            >
              {vi.parent.review}
            </button>
          </Row>
        </Card>
      ) : null}

      {data ? (
        <Card title={vi.progress.practiceDays}>
          <p>{t(vi.goals.weekProgress, { done: doneDays, target: data.targetDays })}</p>
          <DayDots days={data.days} />
          <p className="muted">{vi.goals.note}</p>
          <button type="button" onClick={() => onNavigate?.('progress')}>
            {vi.parent.progress}
          </button>
        </Card>
      ) : null}

      {needsBackup && data ? (
        <Card title={vi.parent.backup}>
          <p>{vi.backup.reminder}</p>
          <p className="muted">
            {t(vi.backup.lastBackup, {
              when:
                data.lastBackupAt === undefined
                  ? vi.backup.never
                  : formatDateVi(localDate(data.lastBackupAt)),
            })}
          </p>
          <Row>
            <button type="button" onClick={() => onNavigate?.('backup')}>
              {vi.backup.export}
            </button>
            <button type="button" onClick={() => void dismissReminder()}>
              {vi.parent.dismiss}
            </button>
          </Row>
        </Card>
      ) : null}

      <Card title={vi.parent.shortcuts}>
        <Row>
          {SHORTCUTS.map((s) => (
            <button key={s.route} type="button" onClick={() => onNavigate?.(s.route)}>
              {s.label}
            </button>
          ))}
        </Row>
      </Card>
    </Shell>
  )
}
