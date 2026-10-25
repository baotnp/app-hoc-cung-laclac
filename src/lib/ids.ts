import { ulid } from 'ulid'
import type { BaseRecord, EpochMs } from '@/data/types'
import { SCHEMA_VERSION } from '@/data/types'

/** Gắn các trường bắt buộc của BaseRecord (06 §1) cho bản ghi mới. */
export function withBase<T extends object>(
  data: T,
  now: EpochMs = Date.now(),
  id: string = ulid(),
): T & BaseRecord {
  return { ...data, id, schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now }
}
