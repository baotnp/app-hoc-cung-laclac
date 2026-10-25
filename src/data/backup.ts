// Sao lưu / khôi phục — xem docs/06-data-model.md §6.
// Không mã hóa ở MVP (GĐ-23): file chứa ảnh và giọng của bé; màn S20 hiển thị cảnh báo lưu trữ.
// Không có request mạng: toàn bộ chạy trên thiết bị.

import { unzipSync, zipSync } from 'fflate'
import { ulid } from 'ulid'
import { APP_VERSION, DB_SCHEMA_VERSION, TABLE_NAMES, db } from '@/data/db'
import type { TableName } from '@/data/db'
import { getMeta, mediaBlob, revokeMediaObjectUrls, setMeta } from '@/data/repos'
import type { EpochMs } from '@/data/types'
import { formatClockVi, localDate } from '@/lib/time'

export const BACKUP_FORMAT = 'laclac-backup'
export const BACKUP_FORMAT_VERSION = 1

export interface BackupManifest {
  format: typeof BACKUP_FORMAT
  formatVersion: typeof BACKUP_FORMAT_VERSION
  /** Phiên bản Dexie lúc xuất. */
  dbSchemaVersion: number
  appVersion: string
  createdAt: EpochMs
  deviceId: string
  includes: { media: boolean; vocalClips: boolean }
  tables: Record<string, { count: number; sha256: string }>
  media: { id: string; path: string; mime: string; bytes: number; sha256: string }[]
}

export interface BackupError {
  ok: false
  code: 'invalid' | 'too_new'
  message?: string
}

export interface BackupPreviewOk {
  ok: true
  /** Số bảng có bản ghi. */
  tables: number
  /** Tổng số bản ghi của mọi bảng. */
  records: number
  /** Số tệp ảnh/âm thanh. */
  media: number
  createdAt: EpochMs
  appVersion: string
  dbSchemaVersion: number
  deviceId: string
  includesMedia: boolean
  tableCounts: Record<string, number>
}

export type BackupPreview = BackupPreviewOk | BackupError

export interface ImportResultOk {
  ok: true
  tables: number
  records: number
  media: number
}

export type ImportResult = ImportResultOk | BackupError

export interface ExportOptions {
  includeMedia?: boolean
  includeVocalClips?: boolean
}

// ----------------------------------------------------------- tiện ích

const MEDIA_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
  'audio/ogg': 'ogg',
  'model/gltf-binary': 'glb',
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Sao chép sang ArrayBuffer thường: Uint8Array<ArrayBufferLike> không gán được cho BufferSource.
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  let out = ''
  for (const b of new Uint8Array(digest)) out += b.toString(16).padStart(2, '0')
  return out
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Mốc thiết bị dùng trong manifest; tạo một lần rồi giữ nguyên qua các lần nhập. */
export async function getDeviceId(): Promise<string> {
  const existing = await getMeta<string>('deviceId')
  if (existing) return existing
  const id = ulid()
  await setMeta('deviceId', id)
  return id
}

/** laclac-backup-YYYYMMDD-HHmm.zip (06 §6). */
export function backupFileName(at: EpochMs = Date.now()): string {
  const day = localDate(at).replaceAll('-', '')
  const clock = formatClockVi(at).replace(/\D/g, '')
  return `laclac-backup-${day}-${clock}.zip`
}

// -------------------------------------------------------------- Xuất

export async function exportBackup(opts: ExportOptions = {}): Promise<Blob> {
  const includeMedia = opts.includeMedia ?? true
  const includeVocalClips = opts.includeVocalClips ?? false
  const createdAt = Date.now()
  const deviceId = await getDeviceId()

  const files: Record<string, Uint8Array> = {}
  const tables: BackupManifest['tables'] = {}
  const mediaEntries: BackupManifest['media'] = []

  for (const name of TABLE_NAMES) {
    let rows: unknown[]
    if (name === 'media') {
      const assets = includeMedia ? await db.media.toArray() : []
      rows = assets.map((a) => {
        const { blob: _blob, storedAs: _storedAs, ...meta } = a
        return meta
      })
      for (const asset of assets) {
        const bytes = new Uint8Array(await mediaBlob(asset).arrayBuffer())
        const ext = MEDIA_EXT[asset.mime] ?? 'bin'
        const path = `media/${asset.id}.${ext}`
        files[path] = bytes
        mediaEntries.push({
          id: asset.id,
          path,
          mime: asset.mime,
          bytes: bytes.length,
          sha256: await sha256Hex(bytes),
        })
      }
    } else if (name === 'vocalClips') {
      rows = includeVocalClips ? await db.vocalClips.toArray() : []
    } else {
      rows = await db.table(name).toArray()
    }

    const bytes = encoder.encode(JSON.stringify(rows))
    files[`tables/${name}.json`] = bytes
    tables[name] = { count: rows.length, sha256: await sha256Hex(bytes) }
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    dbSchemaVersion: DB_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt,
    deviceId,
    includes: { media: includeMedia, vocalClips: includeVocalClips },
    tables,
    media: mediaEntries,
  }
  files['manifest.json'] = encoder.encode(JSON.stringify(manifest, null, 2))

  const zipped = zipSync(files, { level: 6, mtime: createdAt })
  await setMeta('lastBackupAt', createdAt)
  return new Blob([zipped], { type: 'application/zip' })
}

// -------------------------------------------------------------- Nhập

interface ParsedBackup {
  manifest: BackupManifest
  tables: Map<TableName, Record<string, unknown>[]>
  media: Map<string, { mime: string; bytes: Uint8Array }>
}

function isManifest(value: unknown): value is BackupManifest {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Partial<BackupManifest>
  return (
    m.format === BACKUP_FORMAT &&
    typeof m.formatVersion === 'number' &&
    typeof m.dbSchemaVersion === 'number' &&
    typeof m.createdAt === 'number' &&
    typeof m.tables === 'object' &&
    m.tables !== null &&
    Array.isArray(m.media)
  )
}

async function readBackup(file: Blob, verifyPayload: boolean): Promise<ParsedBackup | BackupError> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    return { ok: false, code: 'invalid', message: 'Không mở được file zip' }
  }

  const manifestBytes = entries['manifest.json']
  if (!manifestBytes) return { ok: false, code: 'invalid', message: 'Thiếu manifest.json' }

  let manifest: unknown
  try {
    manifest = JSON.parse(decoder.decode(manifestBytes))
  } catch {
    return { ok: false, code: 'invalid', message: 'manifest.json hỏng' }
  }
  if (!isManifest(manifest)) return { ok: false, code: 'invalid', message: 'manifest không đúng dạng' }
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION || manifest.dbSchemaVersion > DB_SCHEMA_VERSION) {
    return { ok: false, code: 'too_new', message: 'File tạo bởi bản app mới hơn' }
  }

  const tables = new Map<TableName, Record<string, unknown>[]>()
  const media = new Map<string, { mime: string; bytes: Uint8Array }>()
  if (!verifyPayload) return { manifest, tables, media }

  for (const name of TABLE_NAMES) {
    const info = manifest.tables[name]
    if (!info) return { ok: false, code: 'invalid', message: `Thiếu bảng ${name} trong manifest` }
    const bytes = entries[`tables/${name}.json`]
    if (!bytes) return { ok: false, code: 'invalid', message: `Thiếu tables/${name}.json` }
    if ((await sha256Hex(bytes)) !== info.sha256) {
      return { ok: false, code: 'invalid', message: `Sai mã kiểm tra bảng ${name}` }
    }
    let rows: unknown
    try {
      rows = JSON.parse(decoder.decode(bytes))
    } catch {
      return { ok: false, code: 'invalid', message: `Bảng ${name} hỏng` }
    }
    if (!Array.isArray(rows) || rows.length !== info.count) {
      return { ok: false, code: 'invalid', message: `Bảng ${name} sai số bản ghi` }
    }
    tables.set(name, rows as Record<string, unknown>[])
  }

  for (const entry of manifest.media) {
    const bytes = entries[entry.path]
    if (!bytes) return { ok: false, code: 'invalid', message: `Thiếu ${entry.path}` }
    if ((await sha256Hex(bytes)) !== entry.sha256) {
      return { ok: false, code: 'invalid', message: `Sai mã kiểm tra ${entry.path}` }
    }
    media.set(entry.id, { mime: entry.mime, bytes })
  }

  return { manifest, tables, media }
}

export async function previewBackup(file: Blob): Promise<BackupPreview> {
  const parsed = await readBackup(file, false)
  if ('ok' in parsed) return parsed
  const { manifest } = parsed
  const tableCounts: Record<string, number> = {}
  let records = 0
  let tablesWithRows = 0
  for (const [name, info] of Object.entries(manifest.tables)) {
    tableCounts[name] = info.count
    records += info.count
    if (info.count > 0) tablesWithRows++
  }
  return {
    ok: true,
    tables: tablesWithRows,
    records,
    media: manifest.media.length,
    createdAt: manifest.createdAt,
    appVersion: manifest.appVersion,
    dbSchemaVersion: manifest.dbSchemaVersion,
    deviceId: manifest.deviceId,
    includesMedia: manifest.includes.media,
    tableCounts,
  }
}

/** Bản ghi nào mới hơn thì giữ (06 §6 bước 4). */
function pickNewer(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!existing) return incoming
  const a = typeof incoming['updatedAt'] === 'number' ? (incoming['updatedAt'] as number) : 0
  const b = typeof existing['updatedAt'] === 'number' ? (existing['updatedAt'] as number) : 0
  return a > b ? incoming : null
}

export async function importBackup(file: Blob, mode: 'merge' | 'replace'): Promise<ImportResult> {
  const parsed = await readBackup(file, true)
  if ('ok' in parsed) return parsed
  const { manifest, tables, media } = parsed

  const localDeviceId = await getDeviceId()
  let records = 0
  let tablesTouched = 0

  try {
    await db.transaction('rw', db.tables, async () => {
      if (mode === 'replace') {
        await Promise.all(db.tables.map((t) => t.clear()))
      }

      for (const name of TABLE_NAMES) {
        const rows = tables.get(name) ?? []
        const prepared: Record<string, unknown>[] = []

        for (const row of rows) {
          if (name === 'media') {
            const blobData = media.get(String(row['id']))
            if (!blobData) continue // media không kèm trong file (includes.media = false)
            const mime = typeof row['mime'] === 'string' ? (row['mime'] as string) : blobData.mime
            prepared.push({
              ...row,
              mime,
              bytes: blobData.bytes.length,
              blob: new Blob([new Uint8Array(blobData.bytes)], { type: mime }),
            })
            continue
          }
          if (name === 'appMeta' && row['key'] === 'deviceId') continue // giữ mốc thiết bị hiện tại
          prepared.push(row)
        }

        if (prepared.length === 0) continue
        const table = db.table(name)
        const keyName = name === 'appMeta' ? 'key' : 'id'

        let toWrite = prepared
        if (mode === 'merge') {
          const keys = prepared.map((r) => String(r[keyName]))
          const existing = await table.bulkGet(keys)
          toWrite = prepared
            .map((row, i) => pickNewer(row, existing[i] as Record<string, unknown> | undefined))
            .filter((r): r is Record<string, unknown> => r !== null)
        }

        if (toWrite.length === 0) continue
        await table.bulkPut(toWrite)
        records += toWrite.length
        tablesTouched++
      }

      await db.appMeta.put({ key: 'deviceId', value: localDeviceId })
      await db.appMeta.put({ key: 'lastBackupAt', value: manifest.createdAt })
    })
  } catch (err) {
    // Transaction Dexie đã tự hoàn tác: dữ liệu hiện tại giữ nguyên.
    return {
      ok: false,
      code: 'invalid',
      message: err instanceof Error ? err.message : 'Không ghi được dữ liệu',
    }
  }

  revokeMediaObjectUrls()
  return { ok: true, tables: tablesTouched, records, media: media.size }
}
