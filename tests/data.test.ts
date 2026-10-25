import { beforeEach, describe, expect, it } from 'vitest'
// Nguồn repos.ts được nạp dạng văn bản để rà các API xóa phần thưởng (06 §1).
import REPOS_SOURCE from '@/data/repos.ts?raw'
import { db } from '@/data/db'
import * as repos from '@/data/repos'
import { exportBackup, importBackup } from '@/data/backup'
import { DEFAULT_CHILD, ensureStarterPack } from '@/data/starter'
import type { Child, FarmItem } from '@/data/types'

let child: Child

beforeEach(async () => {
  await repos.wipeAllData()
  child = await repos.createChild({ displayName: 'Lạc', birthMonth: '2024-01' })
})

function farmItem(reason: FarmItem['reason'], variant: string): Omit<FarmItem, 'id'> {
  return { kind: 'flower', variant, addedAt: Date.now(), reason }
}

describe('bất biến phần thưởng', () => {
  it('appendFarmItems chỉ thêm, addStars chỉ tăng', async () => {
    const start = await repos.getFarmState(child.id)
    expect(start.items).toHaveLength(0)
    expect(start.totalStars).toBe(0)

    await repos.appendFarmItems(child.id, [farmItem('daily', 'hoa-1')])
    await repos.addStars(child.id, 5)
    await repos.appendFarmItems(child.id, [farmItem('daily', 'hoa-2'), farmItem('weekly', 'cay-1')])
    await repos.addStars(child.id, 5)

    const mid = await repos.getFarmState(child.id)
    expect(mid.items).toHaveLength(3)
    expect(mid.totalStars).toBe(10)

    // Không có cách nào giảm: số âm bị bỏ qua, danh sách rỗng không xóa gì.
    await repos.addStars(child.id, -100)
    await repos.appendFarmItems(child.id, [])
    const after = await repos.getFarmState(child.id)
    expect(after.items.length).toBeGreaterThanOrEqual(mid.items.length)
    expect(after.totalStars).toBeGreaterThanOrEqual(mid.totalStars)
    expect(after.totalStars).toBe(10)
  })

  it('nhập sao lưu dạng gộp không làm giảm items hay totalStars', async () => {
    // Sao lưu ở trạng thái "ít" hơn.
    await repos.appendFarmItems(child.id, [farmItem('daily', 'hoa-1')])
    await repos.addStars(child.id, 3)
    await repos.addMilestone({
      childId: child.id,
      kind: 'first_session',
      badgeKey: 'first_session',
      params: {},
      earnedAt: Date.now(),
      date: '2026-10-21',
    })
    const backup = await exportBackup({ includeMedia: false })
    const before = await repos.getFarmState(child.id)
    const milestonesBefore = (await repos.listMilestones(child.id)).length

    // Rồi bé học thêm: nông trại và sao tăng lên.
    await repos.appendFarmItems(child.id, [farmItem('daily', 'hoa-2'), farmItem('weekly', 'cay-1')])
    await repos.addStars(child.id, 7)
    await repos.addMilestone({
      childId: child.id,
      kind: 'weekly_practice_met',
      badgeKey: 'weekly_practice_met',
      params: { days: 5 },
      earnedAt: Date.now(),
      date: '2026-10-25',
    })
    const grown = await repos.getFarmState(child.id)
    expect(grown.items).toHaveLength(3)
    expect(grown.totalStars).toBe(10)

    const result = await importBackup(backup, 'merge')
    expect(result.ok).toBe(true)

    const after = await repos.getFarmState(child.id)
    expect(after.items.length).toBeGreaterThanOrEqual(grown.items.length)
    expect(after.totalStars).toBeGreaterThanOrEqual(grown.totalStars)
    expect(after.items.length).toBeGreaterThanOrEqual(before.items.length)
    expect((await repos.listMilestones(child.id)).length).toBeGreaterThanOrEqual(milestonesBefore)
    expect(await repos.listMilestones(child.id)).toHaveLength(2)
  })

  it('repos không export hàm xóa/đặt lại cho bảng thưởng', () => {
    const banned = /delete|remove|reset|clear|revoke|subtract|decrement/i
    const rewardWords = /farm|star|milestone|reward/i
    const offenders = Object.keys(repos).filter(
      (name) => banned.test(name) && rewardWords.test(name),
    )
    expect(offenders).toEqual([])

    // Và không có khai báo export nào trong mã nguồn nhắm tới bảng thưởng để xóa.
    const exported = [...REPOS_SOURCE.matchAll(/export (?:async )?function (\w+)/g)].map(
      (m) => m[1] as string,
    )
    expect(exported.filter((n) => banned.test(n) && rewardWords.test(n))).toEqual([])
    expect(REPOS_SOURCE).not.toMatch(/db\.farmState\.(delete|clear|bulkDelete)/)
    expect(REPOS_SOURCE).not.toMatch(/db\.milestones\.(delete|clear|bulkDelete)/)
  })

  it('wipeAllData là đường xóa duy nhất', async () => {
    await repos.appendFarmItems(child.id, [farmItem('daily', 'hoa-1')])
    await repos.addStars(child.id, 4)
    await repos.wipeAllData()
    expect(await db.farmState.count()).toBe(0)
    expect(await db.milestones.count()).toBe(0)
    expect(await repos.getChild()).toBeUndefined()
  })
})

describe('repo cơ bản', () => {
  it('gọi song song không tạo trùng PracticeGoal/FarmState (index &childId)', async () => {
    // Màn ba mẹ nạp nhiều truy vấn bằng Promise.all; trước đây hai lời gọi cùng thấy
    // "chưa có" rồi cùng ghi, làm Dexie ném ConstraintError.
    const goals = await Promise.all([
      repos.getPracticeGoal(child.id),
      repos.getPracticeGoal(child.id),
      repos.getPracticeGoal(child.id),
    ])
    expect(new Set(goals.map((g) => g.id)).size).toBe(1)
    expect(await db.practiceGoals.count()).toBe(1)

    const farms = await Promise.all([
      repos.getFarmState(child.id),
      repos.getFarmState(child.id),
      repos.getFarmState(child.id),
    ])
    expect(new Set(farms.map((f) => f.id)).size).toBe(1)
    expect(await db.farmState.count()).toBe(1)
  })

  it('createChild dùng mặc định và updateChildSettings đặt lại updatedAt', async () => {
    expect(child.settings.masterVolume).toBe(0.6)
    expect(child.settings.musicEnabled).toBe(false)
    expect(child.timezone).toBe('Asia/Ho_Chi_Minh')

    const updated = await repos.updateChildSettings({ reduceMotion: true, ipadMaxMinutes: 8 })
    expect(updated.settings.reduceMotion).toBe(true)
    expect(updated.settings.ipadMaxMinutes).toBe(8)
    expect(updated.settings.masterVolume).toBe(0.6)
    expect(updated.updatedAt).toBeGreaterThanOrEqual(child.updatedAt)
    expect(updated.createdAt).toBe(child.createdAt)
  })

  it('upsertItem theo key và gắn ảnh/âm', async () => {
    const created = await repos.upsertItem({
      key: 'animal.dog',
      label: 'con chó',
      category: 'pet_animal',
      scope: 'bundled',
    })
    const again = await repos.upsertItem({
      key: 'animal.dog',
      label: 'con cún',
      category: 'pet_animal',
    })
    expect(again.id).toBe(created.id)
    expect(again.label).toBe('con cún')
    expect(await db.items.count()).toBe(1)

    const media = await repos.putMedia({
      kind: 'audio',
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mp4' }),
      mime: 'audio/mp4',
      source: 'family',
      durationMs: 900,
    })
    const withAudio = await repos.attachItemAudio(
      created.id,
      'instruction',
      media.id,
      'Con chó đâu?',
    )
    expect(withAudio.audio.instruction).toEqual([media.id])
    expect(withAudio.transcripts?.instruction).toEqual(['Con chó đâu?'])

    const image = await repos.putMedia({
      kind: 'image',
      blob: new Blob([new Uint8Array([9])], { type: 'image/jpeg' }),
      mime: 'image/jpeg',
      source: 'family',
      width: 1200,
      height: 900,
    })
    const withImage = await repos.setItemImage(created.id, image.id)
    expect(withImage.imageMediaId).toBe(image.id)

    const removed = await repos.removeItemAudio(created.id, 'instruction', media.id)
    expect(removed.audio.instruction).toEqual([])
    expect(removed.transcripts?.instruction).toEqual([])
  })

  it('archive ẩn mục khỏi listItems mặc định', async () => {
    const item = await repos.upsertItem({
      key: 'object.hat',
      label: 'cái mũ',
      category: 'personal_object',
    })
    await repos.setItemArchived(item.id, true)
    expect(await repos.listItems()).toHaveLength(0)
    expect(await repos.listItems({ includeArchived: true })).toHaveLength(1)
  })

  it('getPracticeGoal tạo mặc định 5 ngày / 5 phút', async () => {
    const goal = await repos.getPracticeGoal(child.id)
    expect(goal.daysPerWeek).toBe(5)
    expect(goal.minMinutesPerDay).toBe(5)
    const again = await repos.getPracticeGoal(child.id)
    expect(again.id).toBe(goal.id)
    const changed = await repos.setPracticeGoal(child.id, { daysPerWeek: 3 })
    expect(changed.daysPerWeek).toBe(3)
    expect(changed.minMinutesPerDay).toBe(5)
  })

  it('setWeeklyGoal ghi đè mục tiêu cùng tuần', async () => {
    const a = await repos.setWeeklyGoal(child.id, '2026-10-19', ['ex.cog01.choose_pet_animal'])
    const b = await repos.setWeeklyGoal(child.id, '2026-10-19', [
      'ex.cog01.choose_pet_animal',
      'ex.cog03.choose_personal_object',
    ])
    expect(b.id).toBe(a.id)
    expect(b.exerciseIds).toHaveLength(2)
    expect(await db.weeklyGoals.count()).toBe(1)
  })

  it('meta đọc ghi được', async () => {
    expect(await repos.getMeta<number>('lastBackupAt')).toBeUndefined()
    await repos.setMeta('lastBackupAt', 123)
    expect(await repos.getMeta<number>('lastBackupAt')).toBe(123)
  })
})

describe('gói khởi đầu', () => {
  it('idempotent: gọi hai lần không nhân đôi bản ghi', async () => {
    await ensureStarterPack()
    const exercises = await repos.listExercises()
    const items = await repos.listItems()
    // 18 bài của cô (docs/10). Mục dùng chung giữa các bài nên không đếm được theo
    // số bài; điều phải đúng là mọi khóa trong kho của bài đều có mục thật.
    expect(exercises).toHaveLength(18)
    const keys = new Set(items.map((i) => i.key))
    for (const ex of exercises) {
      const missing = ex.config.itemPool.keys.filter((k) => !keys.has(k))
      expect({ code: ex.code, missing }).toEqual({ code: ex.code, missing: [] })
    }

    await ensureStarterPack()
    expect(await repos.listExercises()).toHaveLength(exercises.length)
    expect(await repos.listItems()).toHaveLength(items.length)
  })

  it('tự tạo hồ sơ bé khi máy trống và giữ nguyên hồ sơ đã có', async () => {
    await repos.wipeAllData() // beforeEach đã tạo sẵn một hồ sơ; test này bắt đầu từ máy trống
    expect(await repos.getChild()).toBeUndefined()

    await ensureStarterPack()
    const child = await repos.getChild()
    expect(child?.displayName).toBe(DEFAULT_CHILD.displayName)
    expect(child?.birthMonth).toBe(DEFAULT_CHILD.birthMonth)
    // Có sẵn phần thưởng thật để buổi học chạy được ngay (GĐ-16).
    expect(child?.settings.rewardKeys.length).toBeGreaterThanOrEqual(4)

    await repos.updateChildSettings({ masterVolume: 0.2 })
    await ensureStarterPack()
    const again = await repos.getChild()
    expect(again?.id).toBe(child?.id)
    expect(again?.settings.masterVolume).toBe(0.2)
  })

  it('mọi mục đều có câu cho ba mẹ đọc khi chưa thu giọng', async () => {
    await ensureStarterPack()
    const [dog] = await repos.getItemsByKeys(['animal.dog'])
    // Máy mới chưa có bản thu nào; buổi học vẫn chạy được vì ba mẹ đọc câu trên thẻ.
    expect(dog?.audio).toEqual({})
    for (const role of ['instruction', 'praise', 'bridge'] as const) {
      expect(dog?.transcripts?.[role]?.[0]).toBeTruthy()
    }

    // Câu phải là câu của cô, không phải câu app tự chế (docs/10 §3).
    expect(dog?.transcripts?.instruction?.[0]).toContain('chó')

    const rewards = await repos.listItems({ category: 'reward' })
    expect(rewards.map((r) => r.key).sort()).toEqual([
      'reward.book',
      'reward.bubbles',
      'reward.car',
      'reward.swing',
    ])
    const objects = await repos.listItems({ category: 'personal_object' })
    expect(objects).toHaveLength(6)
  })

  it('không ghi đè nhãn ba mẹ đã sửa', async () => {
    await ensureStarterPack()
    const [dog] = await repos.getItemsByKeys(['animal.dog'])
    if (!dog) throw new Error('thiếu mục')
    await repos.upsertItem({ id: dog.id, key: dog.key, label: 'con cún', category: dog.category })
    await ensureStarterPack()
    const [again] = await repos.getItemsByKeys(['animal.dog'])
    expect(again?.label).toBe('con cún')
  })

  it('bản cập nhật mang câu mới của cô về máy đã cài sẵn', async () => {
    await ensureStarterPack()
    const [dog] = await repos.getItemsByKeys(['animal.dog'])
    if (!dog) throw new Error('thiếu mục')

    // Giả lập máy cài từ bản cũ: câu do app tự chế, ba mẹ chưa đụng vào.
    await db.items.put({
      ...dog,
      transcripts: { instruction: ['Con chó đâu?'], praise: ['Giỏi quá!'] },
      textsEditedAt: undefined,
    })

    await ensureStarterPack()
    const [fresh] = await repos.getItemsByKeys(['animal.dog'])
    expect(fresh?.transcripts?.instruction?.[0]).toBe(dog.transcripts?.instruction?.[0])
    expect(fresh?.id).toBe(dog.id)
  })

  it('không làm mới chữ của mục ba mẹ đã sửa câu', async () => {
    await ensureStarterPack()
    const [dog] = await repos.getItemsByKeys(['animal.dog'])
    if (!dog) throw new Error('thiếu mục')
    await repos.upsertItem({
      id: dog.id,
      key: dog.key,
      label: dog.label,
      category: dog.category,
      transcripts: { instruction: ['Chỉ con chó cho mẹ nào'] },
    })

    await ensureStarterPack()
    const [again] = await repos.getItemsByKeys(['animal.dog'])
    expect(again?.transcripts?.instruction?.[0]).toBe('Chỉ con chó cho mẹ nào')
  })
})
