import { useEffect, useRef, useState } from 'react'
import { vi, t } from '@/i18n/vi'
import type { AudioRole, Item, ItemCategory } from '@/data/types'
import {
  attachItemAudio,
  getItem,
  getMediaObjectUrl,
  listExercises,
  putMedia,
  removeItemAudio,
  setItemArchived,
  setItemImage,
  upsertItem,
} from '@/data/repos'
import { analyseAudioBlob, canRecord, startRecording, stopRecording } from '@/audio/recorder'
import type { RecordingHandle } from '@/audio/recorder'
import { Card, Field, Muted, Row, Shell } from './Shell'
import { AUDIO_ROLE_LABEL, CATEGORY_LABEL, CATEGORY_ORDER, EDITABLE_AUDIO_ROLES } from './labels'
import { requiredRolesByItemKey } from './readiness'
import { processImageFile } from './image'
import { useAsync } from './useAsync'

export const MAX_RECORD_MS = 5000

export interface ItemEditorProps {
  /** `null` = tạo mục mới. */
  itemId: string | null
  onBack: () => void
  onChanged?: () => void
}

interface EditorData {
  item: Item | null
  requiredAudio: AudioRole[]
  imageUrl: string | undefined
}

/** S16/S17/S17b — sửa một mục: ảnh và các bản thu theo vai. */
export function ItemEditor({ itemId, onBack, onChanged }: ItemEditorProps) {
  const [createdId, setCreatedId] = useState<string | null>(null)
  const id = itemId ?? createdId

  const state = useAsync<EditorData>(async () => {
    const item = id ? ((await getItem(id)) ?? null) : null
    const exercises = await listExercises({ phase: 1, activeOnly: true })
    const required = item ? (requiredRolesByItemKey(exercises).get(item.key) ?? []) : []
    const imageUrl = item?.imageMediaId ? await getMediaObjectUrl(item.imageMediaId) : undefined
    return { item, requiredAudio: required, imageUrl }
  }, [id])

  const item = state.value?.item ?? null

  function changed() {
    state.reload()
    onChanged?.()
  }

  return (
    <Shell title={item ? item.label : vi.content.newItem} onBack={onBack}>
      {state.loading ? <Muted>{vi.parent.loading}</Muted> : null}
      {state.error ? <Muted>{vi.parent.readError}</Muted> : null}

      <ItemFields item={item} onCreated={(newId) => setCreatedId(newId)} onChanged={changed} />

      {item ? (
        <>
          <ImageSection item={item} imageUrl={state.value?.imageUrl} onChanged={changed} />
          <Card title={vi.content.audio}>
            <p className="muted">{vi.content.requiredHint}</p>
            <p className="muted">{vi.content.liveVoiceHint}</p>
            {EDITABLE_AUDIO_ROLES.map((role) => (
              <AudioRoleEditor
                key={role}
                item={item}
                role={role}
                required={(state.value?.requiredAudio ?? []).includes(role)}
                onChanged={changed}
              />
            ))}
          </Card>
          <Row>
            <button
              type="button"
              onClick={() => {
                void setItemArchived(item.id, !item.archived).then(changed)
              }}
            >
              {item.archived ? vi.content.unarchive : vi.content.archive}
            </button>
          </Row>
        </>
      ) : null}
    </Shell>
  )
}

function ItemFields({
  item,
  onCreated,
  onChanged,
}: {
  item: Item | null
  onCreated: (id: string) => void
  onChanged: () => void
}) {
  const [key, setKey] = useState(item?.key ?? '')
  const [label, setLabel] = useState(item?.label ?? '')
  const [category, setCategory] = useState<ItemCategory>(item?.category ?? 'pet_animal')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (item) {
      setKey(item.key)
      setLabel(item.label)
      setCategory(item.category)
    }
  }, [item])

  async function save() {
    if (key.trim().length === 0 || label.trim().length === 0) {
      setMessage(vi.content.keyRequired)
      return
    }
    setBusy(true)
    try {
      const saved = await upsertItem({
        ...(item ? { id: item.id } : {}),
        key: key.trim(),
        scope: 'family',
        category,
        label: label.trim(),
        archived: item?.archived ?? false,
      })
      setMessage(vi.review.saved)
      if (!item) onCreated(saved.id)
      else onChanged()
    } catch {
      setMessage(vi.parent.readError)
    } finally {
      setBusy(false)
    }
  }


  return (
    <Card title={vi.content.items}>
      <Field label={vi.content.itemKey}>
        <input type="text" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} />
      </Field>
      <Field label={vi.content.label}>
        <input
          type="text"
          value={label}
          autoComplete="off"
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <Field label={vi.content.category}>
        <select value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)}>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <Row>
        <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
          {vi.content.saveItem}
        </button>
      </Row>
      {item?.archived ? <p className="muted">{vi.content.archived}</p> : null}
      {message ? <p aria-live="polite">{message}</p> : null}
    </Card>
  )
}

function ImageSection({
  item,
  imageUrl,
  onChanged,
}: {
  item: Item
  imageUrl: string | undefined
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function pick(file: File | null) {
    if (!file) return
    setBusy(true)
    setMessage(vi.content.processingImage)
    try {
      const processed = await processImageFile(file)
      const media = await putMedia({
        kind: 'image',
        mime: processed.mime,
        blob: processed.blob,
        width: processed.width,
        height: processed.height,
        hasAlpha: processed.hasAlpha,
        source: 'family',
      })
      await setItemImage(item.id, media.id)
      setMessage(null)
      onChanged()
    } catch {
      setMessage(vi.content.imageError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={vi.content.image}>
      <p className="muted">{vi.content.imageHint}</p>
      <div
        style={{
          background: 'var(--bg, #ede9df)',
          borderRadius: 'var(--radius-chip)',
          padding: 'var(--space-2)',
          display: 'flex',
          justifyContent: 'center',
          minHeight: 160,
          alignItems: 'center',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.label}
            style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain' }}
          />
        ) : (
          <span className="muted">{vi.content.noImage}</span>
        )}
      </div>
      <Field label={vi.content.pickImage}>
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => void pick(e.target.files?.[0] ?? null)}
        />
      </Field>
      {message ? <p aria-live="polite">{message}</p> : null}
    </Card>
  )
}

interface PendingClip {
  blob: Blob
  mime: string
  durationMs: number
  gain: number
}

/**
 * Ba mức của một vai: có bản thu → "Đủ dùng"; chưa thu nhưng đã có câu chữ →
 * "Ba mẹ đọc trực tiếp"; không có gì → "Còn thiếu" (mục chưa vào được buổi học).
 */
function roleStatusLabel(clipCount: number, spokenLine: string): string {
  if (clipCount > 0) return vi.content.ready
  return spokenLine.trim().length > 0 ? vi.content.liveVoice : vi.content.notReady
}

function AudioRoleEditor({
  item,
  role,
  required,
  onChanged,
}: {
  item: Item
  role: AudioRole
  required: boolean
  onChanged: () => void
}) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'preview'>('idle')
  const [level, setLevel] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [pending, setPending] = useState<PendingClip | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const handleRef = useRef<RecordingHandle | null>(null)

  const clips = item.audio[role] ?? []
  const transcripts = item.transcripts?.[role] ?? []
  /** Câu ở vị trí đầu: app hiện câu này để ba mẹ đọc trực tiếp khi vai chưa có bản thu. */
  const spokenLine = transcripts[0] ?? ''
  const recordable = canRecord()

  const [draft, setDraft] = useState(spokenLine)
  const [savingLine, setSavingLine] = useState(false)
  useEffect(() => {
    setDraft(spokenLine)
  }, [spokenLine])

  useEffect(() => {
    return () => {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl)
    }
  }, [pendingUrl])

  const stop = async () => {
    const handle = handleRef.current
    if (!handle) return
    handleRef.current = null
    try {
      const clip = await stopRecording(handle)
      if (pendingUrl) URL.revokeObjectURL(pendingUrl)
      setPending(clip)
      setPendingUrl(URL.createObjectURL(clip.blob))
      setPhase('preview')
    } catch (err) {
      setPhase('idle')
      // Recorder đã tự dừng khi chạm trần 5 giây: không có gì để báo.
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
      if (code !== 'no_recording') setMessage(vi.content.audioError)
    }
  }

  const stopRef = useRef<() => void>(() => undefined)
  stopRef.current = () => void stop()

  // Recorder tự dừng ở trần 5 giây và báo bằng onAutoStop (audio/recorder).

  async function start() {
    setMessage(null)
    setLevel(0)
    setElapsedMs(0)
    try {
      handleRef.current = await startRecording({
        maxMs: MAX_RECORD_MS,
        onLevel: setLevel,
        onTick: setElapsedMs,
        onAutoStop: () => stopRef.current(),
      })
      setPhase('recording')
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      setMessage(name === 'NotAllowedError' ? vi.content.micDenied : vi.content.recorderUnsupported)
      setPhase('idle')
    }
  }

  function discardPending() {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl)
    setPendingUrl(null)
    setPending(null)
    setPhase('idle')
  }

  async function keepPending() {
    if (!pending) return
    try {
      const media = await putMedia({
        kind: 'audio',
        mime: pending.mime,
        blob: pending.blob,
        durationMs: pending.durationMs,
        gain: pending.gain,
        source: 'family',
      })
      await attachItemAudio(item.id, role, media.id)
      discardPending()
      onChanged()
    } catch {
      setMessage(vi.content.audioError)
    }
  }

  async function importFile(file: File | null) {
    if (!file) return
    setMessage(null)
    try {
      const info = await analyseAudioBlob(file)
      const media = await putMedia({
        kind: 'audio',
        mime: info.mime || file.type || 'audio/mp4',
        blob: file,
        durationMs: info.durationMs,
        gain: info.gain,
        source: 'family',
      })
      await attachItemAudio(item.id, role, media.id)
      onChanged()
    } catch {
      setMessage(vi.content.audioError)
    }
  }

  async function playMedia(mediaId: string) {
    const url = await getMediaObjectUrl(mediaId)
    if (!url) return
    await new Audio(url).play()
  }

  /** Lưu câu ba mẹ đọc cho vai này (cô giáo có thể đưa câu lệnh khác — GĐ-01). */
  async function saveSpokenLine() {
    const text = draft.trim()
    const list = [...transcripts]
    if (text.length === 0) {
      if (list.length === 0) return
      list.splice(0, 1)
    } else if (list.length === 0) {
      list.push(text)
    } else {
      list[0] = text
    }
    setSavingLine(true)
    const nextTranscripts: Partial<Record<AudioRole, string[]>> = {
      ...item.transcripts,
      [role]: list,
    }
    try {
      await upsertItem({
        id: item.id,
        key: item.key,
        label: item.label,
        category: item.category,
        transcripts: nextTranscripts,
      })
      setMessage(vi.review.saved)
      onChanged()
    } catch {
      setMessage(vi.parent.readError)
    } finally {
      setSavingLine(false)
    }
  }

  return (
    <section style={{ borderTop: '1px solid var(--p-border)', paddingTop: 'var(--space-2)' }}>
      <h3>
        {AUDIO_ROLE_LABEL[role]}
        {required ? ` · ${roleStatusLabel(clips.length, spokenLine)}` : ''}
      </h3>

      <Field label={vi.content.transcript}>
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </Field>
      <p className="muted">{vi.content.transcriptHint}</p>
      <Row>
        <button type="button" disabled={savingLine} onClick={() => void saveSpokenLine()}>
          {vi.content.saveTranscript}
        </button>
      </Row>

      {transcripts.length > 1 ? (
        <>
          <p className="label">{vi.content.suggested}</p>
          <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
            {transcripts.slice(1).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="muted">
        {clips.length > 0 ? t(vi.content.clipCount, { n: clips.length }) : vi.content.noClip}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {clips.map((mediaId, index) => (
          <li key={mediaId} style={{ marginBottom: 'var(--space-1)' }}>
            <Row>
              <span>{t(vi.content.clipIndex, { n: index + 1 })}</span>
              <button type="button" onClick={() => void playMedia(mediaId)}>
                {vi.content.playBack}
              </button>
              <button
                type="button"
                onClick={() => {
                  void removeItemAudio(item.id, role, mediaId).then(onChanged)
                }}
              >
                {vi.content.deleteClip}
              </button>
            </Row>
          </li>
        ))}
      </ul>

      {phase === 'idle' ? (
        <Row>
          <button type="button" disabled={!recordable} onClick={() => void start()}>
            {vi.content.record}
          </button>
        </Row>
      ) : null}

      {phase === 'recording' ? (
        <div>
          <p aria-live="polite">
            {vi.content.recording} · {t(vi.content.elapsed, { s: Math.round(elapsedMs / 100) / 10 })}
          </p>
          <div
            aria-label={vi.content.recordLevel}
            style={{
              height: 12,
              borderRadius: 6,
              background: 'var(--p-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round(Math.min(1, Math.max(0, level)) * 100)}%`,
                background: 'var(--p-accent)',
              }}
            />
          </div>
          <Row>
            <button type="button" onClick={() => void stop()}>
              {vi.content.stopRecording}
            </button>
          </Row>
        </div>
      ) : null}

      {phase === 'preview' && pendingUrl ? (
        <Row>
          <button
            type="button"
            onClick={() => {
              void new Audio(pendingUrl).play()
            }}
          >
            {vi.content.playBack}
          </button>
          <button type="button" onClick={() => void start()}>
            {vi.content.recordAgain}
          </button>
          <button type="button" className="primary" onClick={() => void keepPending()}>
            {vi.content.useThis}
          </button>
        </Row>
      ) : null}

      {!recordable ? <p className="muted">{vi.content.recorderUnsupported}</p> : null}

      <Field label={vi.content.importAudio}>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => void importFile(e.target.files?.[0] ?? null)}
        />
      </Field>

      {message ? <p aria-live="polite">{message}</p> : null}
    </section>
  )
}
