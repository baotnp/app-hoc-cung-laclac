// Dexie schema — xem docs/06-data-model.md §3.
// Mỗi thay đổi chỉ mục/bảng phải tăng version(n); KHÔNG bao giờ sửa version đã phát hành.

import Dexie, { type Table } from 'dexie'
import type {
  AppMeta,
  Child,
  Exercise,
  FarmState,
  GeneralizationCheck,
  Item,
  MediaAsset,
  Milestone,
  PracticeGoal,
  Session,
  Trial,
  VocalClip,
  WeeklyGoal,
} from '@/data/types'

/** Phiên bản schema Dexie hiện tại (ghi vào manifest sao lưu, 06 §6). */
export const DB_SCHEMA_VERSION = 1

/** Phiên bản app ghi vào Session.appVersion và manifest sao lưu. */
export const APP_VERSION = '0.1.0'

export class LacDB extends Dexie {
  children!: Table<Child, string>
  items!: Table<Item, string>
  exercises!: Table<Exercise, string>
  media!: Table<MediaAsset, string>
  weeklyGoals!: Table<WeeklyGoal, string>
  sessions!: Table<Session, string>
  trials!: Table<Trial, string>
  generalizationChecks!: Table<GeneralizationCheck, string>
  farmState!: Table<FarmState, string>
  practiceGoals!: Table<PracticeGoal, string>
  milestones!: Table<Milestone, string>
  vocalClips!: Table<VocalClip, string>
  appMeta!: Table<AppMeta, string>

  constructor() {
    super('laclac')
    this.version(1).stores({
      children: 'id',
      items: 'id, &key, category, scope, archived',
      exercises: 'id, code, type, phase',
      media: 'id, kind, source',
      weeklyGoals: 'id, [childId+weekStart]',
      sessions: 'id, [childId+date], [childId+weekStart], status, startedAt',
      trials:
        'id, sessionId, [childId+weekStart], [childId+exerciseId+startedAt], [childId+targetItemId+startedAt], date',
      generalizationChecks: 'id, [childId+itemId], [childId+date], level',
      farmState: 'id, &childId',
      practiceGoals: 'id, &childId',
      milestones: 'id, [childId+kind], [childId+earnedAt], itemId',
      vocalClips: 'id, trialId, childId',
      appMeta: 'key',
    })
  }
}

export const db = new LacDB()

/** Tên các bảng dùng cho sao lưu (06 §6) — thứ tự ổn định để manifest tái lập được. */
export const TABLE_NAMES = [
  'children',
  'items',
  'exercises',
  'media',
  'weeklyGoals',
  'sessions',
  'trials',
  'generalizationChecks',
  'farmState',
  'practiceGoals',
  'milestones',
  'vocalClips',
  'appMeta',
] as const

export type TableName = (typeof TABLE_NAMES)[number]
