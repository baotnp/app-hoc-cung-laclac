import { vi, t } from '@/i18n/vi'
import {
  getChild,
  getExercise,
  getItemsByKeys,
  getWeeklyGoal,
  listExercises,
} from '@/data/repos'
import type { Exercise } from '@/data/types'
import { weekStartAt } from '@/lib/time'
import { Card, Muted, Row, Shell } from './Shell'
import { useAsync } from './useAsync'
import { AUDIO_ROLE_LABEL } from './labels'
import { checkItem, readinessLevel, requiredRolesFor, type ItemReadiness } from './readiness'
import type { NavProps } from './nav'

export interface SessionReadyScreenProps extends NavProps {
  onHandToChild: () => void
}

interface ExerciseReadiness {
  exercise: Exercise
  checks: ItemReadiness[]
  /** Mục vào được buổi (gồm cả mục ba mẹ đọc trực tiếp). */
  readyCount: number
  /** Mục vào được buổi nhưng còn vai chưa thu — ba mẹ sẽ đọc trực tiếp. */
  liveCount: number
  minItems: number
  enough: boolean
}

interface ReadyData {
  hasGoal: boolean
  exercises: ExerciseReadiness[]
}

const STEPS = [vi.ready.step1, vi.ready.step2, vi.ready.step3, vi.ready.step4]

/** S04 — kiểm nội dung trước khi đưa iPad cho bé. */
export function SessionReadyScreen({ onHandToChild, onBack, onNavigate }: SessionReadyScreenProps) {
  const state = useAsync<ReadyData>(async () => {
    const child = await getChild()
    if (!child) return { hasGoal: false, exercises: [] }
    const goal = await getWeeklyGoal(child.id, weekStartAt(Date.now(), child.timezone))
    // Chưa chọn mục tiêu tuần: dùng các bài giai đoạn 1 đang bật, đúng như `startSession`
    // của `sessionService`. Ba mẹ vẫn chơi được ngay, S18 chỉ để thu hẹp lại.
    const ids =
      goal && goal.exerciseIds.length > 0
        ? goal.exerciseIds
        : (await listExercises({ phase: 1, activeOnly: true })).map((e) => e.id)
    if (ids.length === 0) return { hasGoal: false, exercises: [] }

    const exercises: ExerciseReadiness[] = []
    for (const id of ids) {
      const exercise = await getExercise(id)
      if (!exercise) continue
      const items = await getItemsByKeys(exercise.config.itemPool.keys)
      const required = requiredRolesFor(exercise)
      const checks = items
        .filter((item) => !item.archived)
        .map((item) => checkItem(item, required))
      const readyCount = checks.filter((c) => c.ready).length
      const liveCount = checks.filter((c) => readinessLevel(c) === 'live').length
      const minItems = exercise.config.itemPool.minItems
      exercises.push({
        exercise,
        checks,
        readyCount,
        liveCount,
        minItems,
        enough: readyCount >= minItems,
      })
    }
    return { hasGoal: Boolean(goal && goal.exerciseIds.length > 0), exercises }
  }, [])

  const data = state.value
  // Đủ một bài là bắt đầu được; buổi học chỉ dùng các bài đã đủ nội dung
  // (`filterPlayable` trong sessionService), bài còn thiếu được bỏ qua.
  const canStart = data !== undefined && data.exercises.some((e) => e.enough)

  return (
    <Shell title={vi.ready.title} onBack={onBack}>
      <Card title={vi.ready.steps}>
        {/* Chuỗi trong vi.ready.step* đã có số thứ tự nên dùng danh sách không đánh số. */}
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </Card>

      {state.loading ? <Muted>{vi.parent.loading}</Muted> : null}
      {state.error ? <Muted>{vi.parent.readError}</Muted> : null}

      {data && !data.hasGoal && !state.loading ? (
        <Card title={vi.ready.todayExercises}>
          <p>{vi.ready.noGoal}</p>
          <button type="button" onClick={() => onNavigate?.('goals')}>
            {vi.ready.openGoals}
          </button>
        </Card>
      ) : null}

      {data?.exercises.map((ex) => (
        <Card key={ex.exercise.id} title={ex.exercise.title}>
          <p>{t(vi.ready.itemsReady, { n: ex.readyCount })}</p>
          {ex.enough ? (
            <p className="muted">{vi.ready.allReady}</p>
          ) : (
            <p style={{ color: 'var(--p-warn)' }}>
              {t(vi.ready.notEnoughItems, { n: ex.minItems })}
            </p>
          )}

          {/* Mức giữa: chơi được ngay, app hiện câu để ba mẹ đọc trực tiếp. */}
          {ex.liveCount > 0 ? (
            <>
              <h3>{t(vi.ready.liveVoiceCount, { n: ex.liveCount })}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                {ex.checks
                  .filter((c) => readinessLevel(c) === 'live')
                  .flatMap((c) =>
                    c.liveAudio.map((role) => ({
                      key: `${c.item.id}-live-${role}`,
                      text: t(vi.ready.liveVoiceItem, {
                        what: AUDIO_ROLE_LABEL[role],
                        label: c.item.label,
                      }),
                    })),
                  )
                  .map((line) => (
                    <li key={line.key}>{line.text}</li>
                  ))}
              </ul>
              <p className="muted">{vi.ready.liveVoiceHint}</p>
            </>
          ) : null}

          {/* Mức chặn: thiếu ảnh, hoặc vai không có cả bản thu lẫn câu chữ. */}
          {ex.checks.some((c) => !c.ready) ? (
            <>
              <h3>{vi.ready.missing}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                {ex.checks
                  .filter((c) => !c.ready)
                  .flatMap((c) => {
                    const lines: { key: string; text: string }[] = []
                    if (c.missingImage) {
                      lines.push({
                        key: `${c.item.id}-image`,
                        text: t(vi.ready.missingItem, {
                          what: vi.content.image,
                          label: c.item.label,
                        }),
                      })
                    }
                    for (const role of c.missingAudio) {
                      lines.push({
                        key: `${c.item.id}-${role}`,
                        text: t(vi.ready.missingItem, {
                          what: AUDIO_ROLE_LABEL[role],
                          label: c.item.label,
                        }),
                      })
                    }
                    return lines
                  })
                  .map((line) => (
                    <li key={line.key}>{line.text}</li>
                  ))}
              </ul>
              <button type="button" onClick={() => onNavigate?.('content')}>
                {vi.ready.openContent}
              </button>
            </>
          ) : null}
        </Card>
      ))}

      <Row>
        <button type="button" className="primary" disabled={!canStart} onClick={onHandToChild}>
          {vi.ready.handToChild}
        </button>
      </Row>
    </Shell>
  )
}
