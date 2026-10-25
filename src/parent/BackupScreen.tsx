import { useEffect, useRef, useState } from 'react'
import { vi, t } from '@/i18n/vi'
import { backupFileName, exportBackup, importBackup, previewBackup } from '@/data/backup'
import type { BackupPreviewOk } from '@/data/backup'
import { getMeta, setMeta } from '@/data/repos'
import { HoldButton } from '@/ui'
import { formatDateVi, localDate } from '@/lib/time'
import { Card, Field, Muted, Row, Shell } from './Shell'
import { useAsync } from './useAsync'
import type { NavProps } from './nav'

const ZIP_MIME = 'application/zip'

/** S20 — xuất và nhập file sao lưu (.zip), không mã hóa ở MVP. */
export function BackupScreen({ onBack }: NavProps) {
  const lastBackup = useAsync<number | undefined>(() => getMeta<number>('lastBackupAt'), [])

  const [includeMedia, setIncludeMedia] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<BackupPreviewOk | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  function setUrl(url: string | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = url
    setDownloadUrl(url)
  }

  async function runExport() {
    setBusy(true)
    setMessage(vi.backup.exporting)
    setUrl(null)
    try {
      const blob = await exportBackup({ includeMedia })
      const name = backupFileName()
      setDownloadName(name)
      const shareFile = new File([blob], name, { type: ZIP_MIME })
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean
        share?: (data: { files: File[]; title?: string }) => Promise<void>
      }
      let shared = false
      if (nav.share && nav.canShare?.({ files: [shareFile] })) {
        try {
          await nav.share({ files: [shareFile], title: name })
          shared = true
        } catch {
          shared = false
        }
      }
      if (!shared) setUrl(URL.createObjectURL(blob))
      await setMeta('lastBackupAt', Date.now())
      lastBackup.reload()
      setMessage(vi.backup.exported)
    } catch {
      setMessage(vi.parent.readError)
    } finally {
      setBusy(false)
    }
  }

  async function pick(f: File | null) {
    setPreview(null)
    setFile(f)
    if (!f) return
    setBusy(true)
    setMessage(vi.backup.reading)
    try {
      const result = await previewBackup(f)
      if (result.ok) {
        setPreview(result)
        setMessage(null)
      } else {
        setMessage(result.code === 'too_new' ? vi.backup.tooNew : vi.backup.invalid)
      }
    } catch {
      setMessage(vi.backup.invalid)
    } finally {
      setBusy(false)
    }
  }

  async function runImport(mode: 'merge' | 'replace') {
    if (!file) return
    setBusy(true)
    setMessage(vi.backup.importing)
    try {
      const result = await importBackup(file, mode)
      setMessage(
        result.ok
          ? vi.backup.done
          : result.code === 'too_new'
            ? vi.backup.tooNew
            : vi.backup.invalid,
      )
    } catch {
      setMessage(vi.backup.invalid)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title={vi.backup.title} onBack={onBack}>
      <Card title={vi.backup.export}>
        <p className="muted">
          {t(vi.backup.lastBackup, {
            when:
              lastBackup.value === undefined
                ? vi.backup.never
                : formatDateVi(localDate(lastBackup.value)),
          })}
        </p>
        <label style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={includeMedia}
            onChange={(e) => setIncludeMedia(e.target.checked)}
          />
          <span>{vi.backup.includeMedia}</span>
        </label>
        <Row>
          <button type="button" className="primary" disabled={busy} onClick={() => void runExport()}>
            {vi.backup.export}
          </button>
          {downloadUrl ? (
            <a href={downloadUrl} download={downloadName}>
              {vi.backup.download}
            </a>
          ) : null}
        </Row>
        <p className="muted">{vi.backup.storageHint}</p>
      </Card>

      <Card title={vi.backup.import}>
        <Field label={vi.backup.pickFile}>
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => void pick(e.target.files?.[0] ?? null)}
          />
        </Field>
        {preview ? (
          <>
            <p>
              {t(vi.backup.preview, {
                tables: preview.tables,
                records: preview.records,
                media: preview.media,
                when: formatDateVi(localDate(preview.createdAt)),
              })}
            </p>
            <Row>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => void runImport('merge')}
              >
                {vi.backup.importMerge}
              </button>
              <HoldButton
                className="parent-danger"
                holdMs={1500}
                showRingAfterMs={300}
                onComplete={() => void runImport('replace')}
              >
                {vi.backup.importReplace}
              </HoldButton>
            </Row>
          </>
        ) : null}
      </Card>

      {lastBackup.error ? <Muted>{vi.parent.readError}</Muted> : null}
      {message ? <p aria-live="polite">{message}</p> : null}
    </Shell>
  )
}
