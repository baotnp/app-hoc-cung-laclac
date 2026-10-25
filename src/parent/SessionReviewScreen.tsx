import { useEffect, useState } from 'react'
import { vi, t } from '@/i18n/vi'
import { PROMPT_LEVELS } from '@/data/types'
import type { Item, ObservationTag, PromptLevel, Session, Trial } from '@/data/types'
import { getItem, getSession, listTrialsBySession, updateSession, updateTrial } from '@/data/repos'
import { formatClockVi } from '@/lib/time'
import { Card, Field, Muted, Row, Shell } from './Shell'
import { useAsync } from './useAsync'
import { promptLevelPatch, trialResultKey, validityPatch, type InvalidReason } from './reviewPatch'
import type { NavProps } from './nav'

const OBSERVATION_TAGS: ObservationTag[] = [
  'engaged',
  'wanted_more',
  'tired',
  'distracted',
  'sound_distress',
  'visual_distress',
  'motor_difficulty',
  'other',
]

const INVALID_REASONS: { value: InvalidReason; label: string }[] = [
  { value: 'accidental', label: vi.review.reasonAccidental },
  { value: 'interrupted', label: vi.review.reasonInterrupted },
  { value: 'other', label: vi.review.reasonOther },
]

export interface SessionReviewScreenProps extends NavProps {
  sessionId: string
}

interface ReviewData {
  session: Session | null
  trials: Trial[]
  itemsById: Map<string, Item>
}

/** S15 — xem lại các lượt của một buổi; ba mẹ sửa mức gợi ý và ghi chú. */
export function SessionReviewScreen({ sessionId, onBack }: SessionReviewScreenProps) {
  const state = useAsync<ReviewData>(async () => {
    const [session, trials] = await Promise.all([
      getSession(sessionId),
      listTrialsBySession(sessionId),
    ])
    const itemsById = new Map<string, Item>()
    for (const id of new Set(trials.map((tr) => tr.targetItemId))) {
      const item = await getItem(id)
      if (item) itemsById.set(id, item)
    }
    return { session: session ?? null, trials, itemsById }
  }, [sessionId])

  const session = state.value?.session ?? null
  const trials = state.value?.trials ?? []
  const [message, setMessage] = useState<string | null>(null)

  async function saveTrial(id: string, patch: Partial<Trial>) {
    await updateTrial(id, patch)
    setMessage(vi.review.saved)
    state.reload()
  }

  return (
    <Shell title={vi.review.title} onBack={onBack}>
      {state.loading ? <Muted>{vi.parent.loading}</Muted> : null}
      {state.error ? <Muted>{vi.parent.readError}</Muted> : null}

      {session ? (
        <SessionCard
          session={session}
          onSaved={() => {
            setMessage(vi.review.saved)
            state.reload()
          }}
        />
      ) : null}

      {!state.loading && trials.length === 0 ? <Muted>{vi.review.noTrials}</Muted> : null}

      {trials.map((trial, index) => (
        <TrialCard
          key={trial.id}
          trial={trial}
          index={index}
          label={state.value?.itemsById.get(trial.targetItemId)?.label ?? trial.targetItemKey}
          onSave={saveTrial}
        />
      ))}

      {message ? <p aria-live="polite">{message}</p> : null}
    </Shell>
  )
}

function SessionCard({ session, onSaved }: { session: Session; onSaved: () => void }) {
  const [tags, setTags] = useState<ObservationTag[]>(session.observations)
  const [note, setNote] = useState(session.parentNote ?? '')

  useEffect(() => {
    setTags(session.observations)
    setNote(session.parentNote ?? '')
  }, [session])

  async function toggleTag(tag: ObservationTag) {
    const next = tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag]
    setTags(next)
    await updateSession(session.id, { observations: next })
    onSaved()
  }

  async function saveNote() {
    await updateSession(session.id, { parentNote: note })
    onSaved()
  }

  return (
    <Card title={vi.review.sessionCard}>
      <p className="muted">{formatClockVi(session.startedAt)}</p>
      <p className="label">{vi.review.observations}</p>
      <Row>
        {OBSERVATION_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tags.includes(tag)}
            onClick={() => void toggleTag(tag)}
            style={
              tags.includes(tag)
                ? { borderColor: 'var(--p-accent)', color: 'var(--p-accent)' }
                : undefined
            }
          >
            {vi.observation[tag]}
          </button>
        ))}
      </Row>
      <Field label={vi.review.note}>
        <textarea
          rows={3}
          value={note}
          placeholder={vi.common.notePlaceholder}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <button type="button" onClick={() => void saveNote()}>
        {vi.parent.save}
      </button>
    </Card>
  )
}

function TrialCard({
  trial,
  index,
  label,
  onSave,
}: {
  trial: Trial
  index: number
  label: string
  onSave: (id: string, patch: Partial<Trial>) => Promise<void>
}) {
  const [note, setNote] = useState(trial.parentNote ?? '')

  useEffect(() => {
    setNote(trial.parentNote ?? '')
  }, [trial])

  const resultKey = trialResultKey(trial)

  return (
    <Card title={t(vi.review.trial, { n: index + 1 })}>
      <p>
        <span className="label">{vi.review.target}: </span>
        {label}
      </p>
      <p>
        <span className="label">{vi.review.result}: </span>
        {resultKey === 'independent' ? vi.review.resultIndependent : vi.review.resultPrompted}
      </p>

      <Field label={vi.review.promptLevel}>
        <select
          value={trial.promptLevel}
          onChange={(e) =>
            void onSave(trial.id, promptLevelPatch(trial, e.target.value as PromptLevel))
          }
        >
          {PROMPT_LEVELS.map((level) => (
            <option key={level} value={level}>
              {vi.promptLevel[level]}
            </option>
          ))}
        </select>
      </Field>
      {trial.promptLevelSource === 'parent_edit' ? (
        <p className="muted">
          {t(vi.review.autoValue, { value: vi.promptLevel[trial.promptLevelAuto] })}
        </p>
      ) : null}

      <label style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={!trial.valid}
          onChange={(e) =>
            void onSave(
              trial.id,
              validityPatch(!e.target.checked, trial.invalidReason ?? 'accidental'),
            )
          }
        />
        <span>{vi.review.markInvalid}</span>
      </label>
      {!trial.valid ? (
        <Field label={vi.review.invalidReason}>
          <select
            value={trial.invalidReason ?? 'other'}
            onChange={(e) =>
              void onSave(trial.id, validityPatch(false, e.target.value as InvalidReason))
            }
          >
            {INVALID_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label={vi.review.note}>
        <textarea
          rows={2}
          value={note}
          placeholder={vi.common.notePlaceholder}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <button type="button" onClick={() => void onSave(trial.id, { parentNote: note })}>
        {vi.parent.save}
      </button>
    </Card>
  )
}
