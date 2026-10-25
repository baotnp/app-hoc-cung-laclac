import { beforeEach, describe, expect, it } from 'vitest'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { db } from '@/data/db'
import {
  backupFileName,
  exportBackup,
  getDeviceId,
  importBackup,
  previewBackup,
} from '@/data/backup'
import * as repos from '@/data/repos'
import { ensureStarterPack } from '@/data/starter'
import type { Child, MediaAsset } from '@/data/types'
import { weekStartOf } from '@/lib/time'

const DATE = '2026-10-21'
const WEEK = weekStartOf(DATE)

let child: Child
let image: MediaAsset
let audio: MediaAsset

async function seed(): Promise<void> {
  child = await repos.createChild({ displayName: 'Lạc', birthMonth: '2024-01' })
  await ensureStarterPack()

  image = await repos.putMedia({
    kind: 'image',
    blob: new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' }),
    mime: 'image/jpeg',
    source: 'family',
    width: 1200,
    height: 900,
  })
  audio = await repos.putMedia({
    kind: 'audio',
    blob: new Blob([new Uint8Array([9, 8, 7])], { type: 'audio/mp4' }),
    mime: 'audio/mp4',
    source: 'family',
    durationMs: 800,
  })

  const [dog] = await repos.getItemsByKeys(['animal.dog'])
  if (!dog) throw new Error('thiếu mục khởi đầu')
  await repos.setItemImage(dog.id, image.id)
  await repos.attachItemAudio(dog.id, 'instruction', audio.id, 'Con chó đâu?')

  await repos.setWeeklyGoal(child.id, WEEK, ['ex.cog01.choose_pet_animal'])
  const session = await repos.createSession({
    childId: child.id,
    date: DATE,
    weekStart: WEEK,
    startedAt: Date.parse(`${DATE}T08:00:00Z`),
    endedAt: Date.parse(`${DATE}T08:06:00Z`),
    status: 'completed',
    phase: 'done',
    rewardOptions: [],
    rounds: [
      {
        index: 0,
        exerciseId: 'ex.cog01.choose_pet_animal',
        startedAt: Date.parse(`${DATE}T08:00:30Z`),
        starsLit: 5,
        partyShown: true,
        trialIds: [],
      },
    ],
    dailyGoalMet: true,
    ipadActiveMs: 360_000,
    durationMs: 360_000,
    schedulerId: 'simple@1',
    randomSeed: 42,
    configSnapshot: {
      waitBeforeCueMs: 5000,
      afterCueTimeoutMs: 15000,
      trialsPerRound: 5,
      quality: 'high',
      reduceMotion: false,
      silentParty: false,
      masterVolume: 0.6,
    },
    appVersion: '0.1.0',
    observations: ['engaged'],
  })
  await repos.addTrial({
    childId: child.id,
    sessionId: session.id,
    roundIndex: 0,
    trialIndex: 0,
    date: DATE,
    weekStart: WEEK,
    exerciseId: 'ex.cog01.choose_pet_animal',
    exerciseCode: 'COG-01',
    configVersion: 1,
    targetItemId: dog.id,
    targetItemKey: dog.key,
    isNewItem: true,
    displayed: [
      { itemId: dog.id, itemKey: dog.key, slot: 0, rect: { x: 0, y: 0, w: 400, h: 400 } },
    ],
    targetSlot: 0,
    detectorKind: 'touch_choice',
    startedAt: Date.parse(`${DATE}T08:01:00Z`),
    instructionStartMs: 0,
    instructionEndMs: 1200,
    firstChoice: { itemId: dog.id, slot: 0, tMs: 2400, latencyMs: 1200 },
    correctFirstTry: true,
    parked: false,
    completedAtMs: 2400,
    completedLatencyMs: 1200,
    promptLevel: 'independent',
    promptLevelAuto: 'independent',
    promptLevelSource: 'auto',
    touches: [],
    valid: true,
    viewport: { w: 1180, h: 820, dpr: 2, orientation: 'landscape' },
    schedulerId: 'simple@1',
  })
  await repos.addGeneralizationCheck({
    childId: child.id,
    itemId: dog.id,
    exerciseId: 'ex.cog01.choose_pet_animal',
    level: 3,
    result: 'did_it',
    confirmedBy: 'parent',
    date: DATE,
  })
  await repos.addMilestone({
    childId: child.id,
    kind: 'first_session',
    badgeKey: 'first_session',
    params: {},
    earnedAt: Date.now(),
    date: DATE,
  })
  await repos.appendFarmItems(child.id, [
    { kind: 'flower', variant: 'hoa-1', addedAt: Date.now(), reason: 'daily' },
  ])
  await repos.addStars(child.id, 5)
}

async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const table of db.tables) out[table.name] = await table.count()
  return out
}

beforeEach(async () => {
  await repos.wipeAllData()
  await seed()
})

describe('xuất sao lưu', () => {
  it('tạo zip có manifest, tables và media', async () => {
    const blob = await exportBackup()
    expect(blob.type).toBe('application/zip')
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(entries)).toContain('manifest.json')
    expect(Object.keys(entries)).toContain('tables/children.json')
    expect(Object.keys(entries)).toContain('tables/trials.json')
    expect(Object.keys(entries)).toContain(`media/${image.id}.jpg`)
    expect(Object.keys(entries)).toContain(`media/${audio.id}.m4a`)

    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']))
    expect(manifest.format).toBe('laclac-backup')
    expect(manifest.formatVersion).toBe(1)
    expect(manifest.dbSchemaVersion).toBe(1)
    expect(manifest.includes.media).toBe(true)
    expect(manifest.includes.vocalClips).toBe(false)
    expect(manifest.tables.children.count).toBe(1)
    expect(manifest.media).toHaveLength(2)

    // media.json giữ metadata, không kèm blob.
    const mediaRows = JSON.parse(new TextDecoder().decode(entries['tables/media.json']))
    expect(mediaRows).toHaveLength(2)
    expect(mediaRows[0].blob).toBeUndefined()
    expect(mediaRows[0].bytes).toBeGreaterThan(0)
  })

  it('ghi lastBackupAt và đặt tên file đúng mẫu', async () => {
    await exportBackup({ includeMedia: false })
    expect(await repos.getMeta<number>('lastBackupAt')).toBeTypeOf('number')
    expect(backupFileName(Date.parse('2026-11-20T11:30:00Z'))).toMatch(
      /^laclac-backup-\d{8}-\d{4}\.zip$/,
    )
  })
})

describe('xem trước', () => {
  it('trả số bản ghi, số media và ngày tạo', async () => {
    const blob = await exportBackup()
    const preview = await previewBackup(blob)
    if (!preview.ok) throw new Error(`xem trước thất bại: ${preview.code}`)
    expect(preview.media).toBe(2)
    expect(preview.records).toBeGreaterThan(10)
    expect(preview.tables).toBeGreaterThan(3)
    expect(preview.tableCounts['children']).toBe(1)
    expect(preview.tableCounts['trials']).toBe(1)
    expect(preview.createdAt).toBeLessThanOrEqual(Date.now())
    expect(preview.dbSchemaVersion).toBe(1)
  })
})

describe('vòng tròn xuất → xóa → nhập', () => {
  it('khôi phục đủ bản ghi và media', async () => {
    const before = await counts()
    const dogBefore = (await repos.getItemsByKeys(['animal.dog']))[0]
    const farmBefore = await repos.getFarmState(child.id)
    const blob = await exportBackup()

    await repos.wipeAllData()
    expect(await db.children.count()).toBe(0)
    expect(await db.media.count()).toBe(0)

    const result = await importBackup(blob, 'replace')
    expect(result.ok).toBe(true)

    const after = await counts()
    for (const [name, n] of Object.entries(before)) {
      if (name === 'appMeta') continue // deviceId được giữ của máy hiện tại
      expect(after[name], `bảng ${name}`).toBe(n)
    }

    const restoredChild = await repos.getChild()
    expect(restoredChild?.id).toBe(child.id)
    expect(restoredChild?.displayName).toBe('Lạc')

    const dogAfter = (await repos.getItemsByKeys(['animal.dog']))[0]
    expect(dogAfter?.imageMediaId).toBe(dogBefore?.imageMediaId)
    expect(dogAfter?.audio.instruction).toEqual([audio.id])

    const restoredImage = await repos.getMedia(image.id)
    expect(restoredImage).toBeDefined()
    expect(restoredImage?.mime).toBe('image/jpeg')
    expect(restoredImage?.bytes).toBe(5)
    expect(new Uint8Array(await (restoredImage as MediaAsset).blob.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4, 5]),
    )
    const restoredAudio = await repos.getMedia(audio.id)
    expect(new Uint8Array(await (restoredAudio as MediaAsset).blob.arrayBuffer())).toEqual(
      new Uint8Array([9, 8, 7]),
    )

    const farmAfter = await repos.getFarmState(child.id)
    expect(farmAfter.items).toHaveLength(farmBefore.items.length)
    expect(farmAfter.totalStars).toBe(farmBefore.totalStars)
  })

  it('gộp giữ bản ghi có updatedAt mới hơn', async () => {
    const blob = await exportBackup({ includeMedia: false })
    const updated = await repos.updateChildSettings({ ipadMaxMinutes: 7 })
    expect(updated.settings.ipadMaxMinutes).toBe(7)

    const result = await importBackup(blob, 'merge')
    expect(result.ok).toBe(true)
    // Bản trong file cũ hơn -> giữ bản hiện tại.
    expect((await repos.getChild())?.settings.ipadMaxMinutes).toBe(7)
  })

  it('gộp thêm bản ghi mới từ file', async () => {
    const blob = await exportBackup({ includeMedia: false })
    const trialsBefore = await db.trials.count()
    await db.trials.clear()
    expect(await db.trials.count()).toBe(0)

    const result = await importBackup(blob, 'merge')
    expect(result.ok).toBe(true)
    expect(await db.trials.count()).toBe(trialsBefore)
  })

  it('thay thế giữ deviceId của máy hiện tại', async () => {
    const blob = await exportBackup({ includeMedia: false })
    const deviceId = await getDeviceId()
    await repos.wipeAllData()
    await repos.setMeta('deviceId', 'thiet-bi-moi')

    const result = await importBackup(blob, 'replace')
    expect(result.ok).toBe(true)
    expect(await repos.getMeta<string>('deviceId')).toBe('thiet-bi-moi')
    expect(await repos.getMeta<string>('deviceId')).not.toBe(deviceId)
  })
})

describe('file hỏng bị từ chối', () => {
  async function expectUnchanged(file: Blob, code: 'invalid' | 'too_new'): Promise<void> {
    const before = await counts()
    const preview = await previewBackup(file)
    expect(preview.ok).toBe(false)
    if (!preview.ok) expect(preview.code).toBe(code)

    const result = await importBackup(file, 'replace')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe(code)
    expect(await counts()).toEqual(before)
  }

  it('không phải zip', async () => {
    await expectUnchanged(new Blob([strToU8('không phải zip')]), 'invalid')
  })

  it('zip nhưng thiếu manifest', async () => {
    const zip = zipSync({ 'tables/children.json': strToU8('[]') })
    await expectUnchanged(new Blob([zip]), 'invalid')
  })

  it('manifest sai định dạng', async () => {
    const zip = zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'khac' })) })
    await expectUnchanged(new Blob([zip]), 'invalid')
  })

  it('bảng bị sửa nội dung -> sai sha256', async () => {
    const blob = await exportBackup({ includeMedia: false })
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    entries['tables/children.json'] = strToU8('[]')
    const tampered = new Blob([zipSync(entries)])

    const before = await counts()
    const result = await importBackup(tampered, 'replace')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid')
    expect(await counts()).toEqual(before)
    expect((await repos.getChild())?.displayName).toBe('Lạc')
  })

  it('media bị sửa nội dung -> sai sha256', async () => {
    const blob = await exportBackup()
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    entries[`media/${image.id}.jpg`] = new Uint8Array([0, 0, 0, 0, 0])
    const tampered = new Blob([zipSync(entries)])

    const before = await counts()
    const result = await importBackup(tampered, 'replace')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid')
    expect(await counts()).toEqual(before)
  })

  it('dbSchemaVersion cao hơn app -> too_new, dữ liệu giữ nguyên', async () => {
    const blob = await exportBackup({ includeMedia: false })
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']))
    manifest.dbSchemaVersion = 99
    entries['manifest.json'] = strToU8(JSON.stringify(manifest))
    await expectUnchanged(new Blob([zipSync(entries)]), 'too_new')
  })
})
