import { useEffect, useState } from 'react'
import { vi, t } from '@/i18n/vi'
import type { Exercise } from '@/data/types'
import {
  getChild,
  getPracticeGoal,
  getWeeklyGoal,
  listExercises,
  setPracticeGoal,
  setWeeklyGoal,
} from '@/data/repos'
import { addDays, weekStartAt } from '@/lib/time'
import { Card, Field, Muted, Row, Shell } from './Shell'
import { useAsync } from './useAsync'
import type { NavProps } from './nav'

const MIN_EXERCISES = 2
const MAX_EXERCISES = 3

interface GoalsData {
  childId: string
  weekStart: string
  exercises: Exercise[]
  selected: string[]
  previousWeek: string[]
  daysPerWeek: number
  minMinutesPerDay: number
}

/** S18 — chọn 2–3 bài cho tuần và đặt mục tiêu luyện tập. */
export function GoalsScreen({ onBack }: NavProps) {
  const state = useAsync<GoalsData | null>(async () => {
    const child = await getChild()
    if (!child) return null
    const weekStart = weekStartAt(Date.now(), child.timezone)
    const [exercises, goal, lastGoal, practice] = await Promise.all([
      listExercises({ phase: 1, activeOnly: true }),
      getWeeklyGoal(child.id, weekStart),
      getWeeklyGoal(child.id, addDays(weekStart, -7)),
      getPracticeGoal(child.id),
    ])
    const previousWeek = lastGoal?.exerciseIds ?? []
    return {
      childId: child.id,
      weekStart,
      exercises,
      selected: goal?.exerciseIds ?? previousWeek,
      previousWeek,
      daysPerWeek: practice.daysPerWeek,
      minMinutesPerDay: practice.minMinutesPerDay,
    }
  }, [])

  const data = state.value ?? null
  const [selected, setSelected] = useState<string[]>([])
  const [days, setDays] = useState(5)
  const [minutes, setMinutes] = useState(5)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setSelected(data.selected)
    setDays(data.daysPerWeek)
    setMinutes(data.minMinutesPerDay)
  }, [data])

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= MAX_EXERCISES
          ? cur
          : [...cur, id],
    )
  }

  const valid = selected.length >= MIN_EXERCISES && selected.length <= MAX_EXERCISES

  async function save() {
    if (!data || !valid) return
    try {
      await setWeeklyGoal(data.childId, data.weekStart, selected, 'parent')
      await setPracticeGoal(data.childId, {
        daysPerWeek: days,
        minMinutesPerDay: minutes,
      })
      setMessage(vi.goals.saved)
      state.reload()
    } catch {
      setMessage(vi.parent.readError)
    }
  }

  return (
    <Shell title={vi.goals.title} onBack={onBack}>
      {state.loading ? <Muted>{vi.parent.loading}</Muted> : null}
      {state.error || (!state.loading && data === null) ? (
        <Muted>{vi.parent.readError}</Muted>
      ) : null}

      {data ? (
        <>
          <Card title={vi.goals.exercises}>
            <p className="muted">{t(vi.goals.selected, { n: selected.length })}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {data.exercises.map((ex) => (
                <li key={ex.id} style={{ marginBottom: 'var(--space-1)' }}>
                  <label style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(ex.id)}
                      onChange={() => toggle(ex.id)}
                    />
                    <span>
                      {ex.title}
                      {data.previousWeek.includes(ex.id) ? (
                        <span className="muted"> · {vi.goals.keepLastWeek}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {!valid ? <p style={{ color: 'var(--p-warn)' }}>{vi.goals.pickTwoOrThree}</p> : null}
          </Card>

          <Card title={vi.goals.title}>
            <Field label={vi.goals.daysPerWeek}>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={vi.goals.minMinutes}>
              <input
                type="number"
                min={1}
                max={60}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
            <p className="muted">{vi.goals.note}</p>
          </Card>

          <Row>
            <button type="button" className="primary" disabled={!valid} onClick={() => void save()}>
              {vi.parent.save}
            </button>
          </Row>
        </>
      ) : null}

      {message ? <p aria-live="polite">{message}</p> : null}
    </Shell>
  )
}
