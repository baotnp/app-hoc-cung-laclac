import { useEffect, useState } from 'react'
import { vi, t } from '@/i18n/vi'
import type {
  Exercise,
  GeneralizationCheck,
  Item,
  ItemStatus,
  Milestone,
  PromptLevel,
} from '@/data/types'
import { PROMPT_LEVELS } from '@/data/types'
import {
  getChild,
  getItemsByKeys,
  getMeta,
  getWeeklyGoal,
  listExercises,
  listGeneralizationChecks,
  listMilestones,
  setMeta,
} from '@/data/repos'
import type { PromptTrend, SideBias, WeeklyRate } from '@/data/queries'
import {
  boardsInWeek,
  itemStatuses,
  practiceDaysOfWeek,
  promptTrend,
  sideBiasForRecentSessions,
  weeklyIndependentRate,
} from '@/data/queries'
import { addDays, daysOfWeek, formatDateVi, weekStartAt } from '@/lib/time'
import { Card, DayDots, Field, Muted, Row, Shell } from './Shell'
import { useAsync } from './useAsync'
import { CHECK_RESULT_LABEL, ITEM_STATUS_LABEL } from './labels'
import type { NavProps } from './nav'

const TEACHER_NOTE_KEY = 'teacherNote'
const MILESTONE_LIMIT = 50

interface ExerciseProgress {
  exercise: Exercise
  rate: WeeklyRate | undefined
  statuses: { item: Item; status: ItemStatus }[]
}

interface ProgressData {
  childId: string
  days: { date: string; practiced: boolean }[]
  boards: number
  exercises: ExerciseProgress[]
  trendThis: PromptTrend | undefined
  trendPrev: PromptTrend | undefined
  sideBias: SideBias
  checks: GeneralizationCheck[]
  milestones: Milestone[]
  itemLabels: Map<string, string>
  teacherNote: string
}

function trendLabel(current: PromptTrend | undefined, previous: PromptTrend | undefined): string {
  if (!current || !previous) return vi.progress.trendSame
  const delta = current.meanRank - previous.meanRank
  if (delta < -0.1) return vi.progress.trendLess
  if (delta > 0.1) return vi.progress.trendMore
  return vi.progress.trendSame
}

/** S13 — bảng tiến độ theo tuần (không biểu đồ ở MVP). */
export function ProgressScreen({ onBack }: NavProps) {
  const [weekStart, setWeekStart] = useState<string>(() => weekStartAt())

  const state = useAsync<ProgressData | null>(async () => {
    const child = await getChild()
    if (!child) return null
    const week = weekStart
    const prevWeek = addDays(week, -7)

    const [days, boards, rates, trends, bias, checks, milestones, goal, allExercises, note] =
      await Promise.all([
        practiceDaysOfWeek(child.id, week),
        boardsInWeek(child.id, week),
        weeklyIndependentRate(child.id, week, week),
        promptTrend(child.id, prevWeek, week),
        sideBiasForRecentSessions(child.id, 3),
        listGeneralizationChecks(child.id, { weekStart: week }),
        listMilestones(child.id, MILESTONE_LIMIT),
        getWeeklyGoal(child.id, week),
        listExercises({ phase: 1, activeOnly: true }),
        getMeta<string>(TEACHER_NOTE_KEY),
      ])

    const chosen =
      goal && goal.exerciseIds.length > 0
        ? allExercises.filter((ex) => goal.exerciseIds.includes(ex.id))
        : allExercises

    const itemLabels = new Map<string, string>()
    const exercises: ExerciseProgress[] = []
    for (const exercise of chosen) {
      const items = await getItemsByKeys(exercise.config.itemPool.keys)
      const statusMap = await itemStatuses(child.id, exercise)
      for (const item of items) itemLabels.set(item.id, item.label)
      exercises.push({
        exercise,
        rate: rates.find((r) => r.exerciseId === exercise.id),
        statuses: items.map((item) => ({ item, status: statusMap.get(item.id) ?? 'new' })),
      })
    }

    const weekDates = new Set(daysOfWeek(week))
    return {
      childId: child.id,
      days,
      boards,
      exercises,
      trendThis: trends.find((x) => x.weekStart === week),
      trendPrev: trends.find((x) => x.weekStart === prevWeek),
      sideBias: bias,
      checks,
      milestones: milestones.filter((m) => weekDates.has(m.date)),
      itemLabels,
      teacherNote: note ?? '',
    }
  }, [weekStart])

  const data = state.value ?? null
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (data) setNote(data.teacherNote)
  }, [data])

  const shownWeek = weekStart
  const doneDays = data ? data.days.filter((d) => d.practiced).length : 0
  const trendThis = data?.trendThis

  async function saveNote() {
    await setMeta(TEACHER_NOTE_KEY, note)
    setMessage(vi.progress.teacherNoteSaved)
  }

  return (
    <Shell title={vi.progress.title} onBack={onBack}>
      <Row>
        <button type="button" onClick={() => setWeekStart(addDays(shownWeek, -7))}>
          {vi.progress.prevWeek}
        </button>
        <span>{t(vi.progress.weekOf, { date: formatDateVi(shownWeek) })}</span>
        <button
          type="button"
          disabled={shownWeek >= weekStartAt()}
          onClick={() => setWeekStart(addDays(shownWeek, 7))}
        >
          {vi.progress.nextWeek}
        </button>
      </Row>

      {state.loading ? <Muted>{vi.parent.loading}</Muted> : null}
      {state.error || (!state.loading && data === null) ? (
        <Muted>{vi.parent.readError}</Muted>
      ) : null}

      {data ? (
        <>
          <Card title={vi.progress.practiceDays}>
            <p>{t(vi.goals.weekProgress, { done: doneDays, target: data.days.length })}</p>
            <DayDots days={data.days} />
          </Card>

          <Card title={vi.progress.boards}>
            <p>{t(vi.progress.boardsValue, { n: data.boards })}</p>
          </Card>

          <Card title={vi.progress.independentRate}>
            {data.exercises.length === 0 ? <p className="muted">{vi.progress.none}</p> : null}
            <table>
              <tbody>
                {data.exercises.map((ex) => (
                  <tr key={ex.exercise.id}>
                    <td>{ex.exercise.title}</td>
                    <td>
                      {ex.rate
                        ? t(vi.progress.rateValue, { percent: Math.round(ex.rate.rate * 100) })
                        : vi.common.none}
                    </td>
                    <td>{t(vi.progress.trials, { n: ex.rate?.n ?? 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title={vi.progress.promptMix}>
            {trendThis && trendThis.n > 0 ? (
              <>
                <p>{trendLabel(trendThis, data.trendPrev)}</p>
                <table>
                  <tbody>
                    {PROMPT_LEVELS.map((level: PromptLevel) => (
                      <tr key={level}>
                        <td>{vi.promptLevel[level]}</td>
                        <td>
                          {t(vi.settings.percent, {
                            n: Math.round((trendThis.distribution[level] ?? 0) * 100),
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted">{t(vi.progress.trials, { n: trendThis.n })}</p>
              </>
            ) : (
              <p className="muted">{vi.progress.none}</p>
            )}
          </Card>

          {data.sideBias.flagged && data.sideBias.biasedSlot !== null ? (
            <Card title={vi.progress.sideBiasTitle}>
              <p style={{ color: 'var(--p-warn)' }}>
                {t(vi.progress.sideBias, {
                  side:
                    data.sideBias.biasedSlot === 0 ? vi.progress.sideLeft : vi.progress.sideRight,
                  picked: Math.round(
                    (data.sideBias.biasedSlot === 0
                      ? data.sideBias.shareSlot0
                      : 1 - data.sideBias.shareSlot0) * data.sideBias.n,
                  ),
                  total: data.sideBias.n,
                })}
              </p>
              <p className="muted">{vi.common.askTeacher}</p>
            </Card>
          ) : null}

          <Card title={vi.progress.items}>
            {data.exercises.map((ex) => (
              <div key={ex.exercise.id}>
                <h3>{ex.exercise.title}</h3>
                <table>
                  <tbody>
                    {ex.statuses.map((row) => (
                      <tr key={row.item.id}>
                        <td>{row.item.label}</td>
                        <td>{ITEM_STATUS_LABEL[row.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </Card>

          <Card title={vi.progress.bridge}>
            <h3>{vi.progress.checks}</h3>
            {data.checks.length === 0 ? (
              <p className="muted">{vi.progress.none}</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                {data.checks.map((c) => (
                  <li key={c.id}>
                    {t(vi.progress.checkLine, {
                      date: formatDateVi(c.date),
                      label: data.itemLabels.get(c.itemId) ?? vi.common.none,
                      level: c.level,
                      result: CHECK_RESULT_LABEL[c.result],
                    })}
                  </li>
                ))}
              </ul>
            )}
            <h3>{vi.progress.milestones}</h3>
            {data.milestones.length === 0 ? (
              <p className="muted">{vi.progress.none}</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                {data.milestones.map((m) => (
                  <li key={m.id}>
                    {formatDateVi(m.date)} — {t(vi.milestone[m.kind], m.params)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={vi.progress.teacherNote}>
            <Field label={vi.progress.teacherNote}>
              <textarea
                rows={4}
                value={note}
                placeholder={vi.common.notePlaceholder}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <button type="button" onClick={() => void saveNote()}>
              {vi.parent.save}
            </button>
            <p className="muted">{vi.common.askTeacher}</p>
          </Card>
        </>
      ) : null}

      {message ? <p aria-live="polite">{message}</p> : null}
    </Shell>
  )
}
