// Chế độ "ba mẹ đọc trực tiếp": mục chỉ có ảnh + câu chữ vẫn vào được buổi học,
// app không phát gì mà hiện câu trên lớp của ba mẹ (docs/04 §4 — giọng luôn là giọng thật).
import { describe, expect, it } from 'vitest'
import type { BaseRecord, Exercise, Item } from '@/data/types'
import { withBase } from '@/lib/ids'
import {
  SPOKEN_LINE_BASE_MS,
  SPOKEN_LINE_MAX_MS,
  SPOKEN_LINE_MIN_MS,
  SPOKEN_LINE_PER_CHAR_MS,
  audioDelivery,
  canRun,
  contentGaps,
  eligibleItems,
  estimateSpokenMs,
  resolveSpokenLine,
} from '@/session/sessionService'
import { checkItem, readinessLevel } from '@/parent/readiness'

const NOW = Date.parse('2026-10-25T08:00:00.000Z')

const exercise: Exercise = withBase<Omit<Exercise, keyof BaseRecord>>(
  {
    code: 'COG-01',
    type: 'choose_from_two',
    title: 'Chọn 1 trong 2 hình con vật nuôi',
    phase: 1,
    active: true,
    configVersion: 1,
    config: {
      itemPool: { category: 'pet_animal', keys: ['animal.dog', 'animal.cat'], minItems: 2 },
      requiredAudio: ['instruction', 'praise'],
      response: { detector: 'touch_choice' },
      timing: { waitBeforeCueMs: 5000, afterCueTimeoutMs: 15000, cue: { kind: 'raise_correct' } },
      scheduling: {
        trialsPerRound: 5,
        newItemRatio: 0.3,
        knownMinTrials: 3,
        firstTrialKnownItem: true,
      },
      mastery: {
        metric: 'independent_correct_rate',
        threshold: 0.8,
        lastSessions: 5,
        minTrials: 6,
      },
      reward: { perTrial: ['mascot_nod'], onRoundComplete: 'party_standard' },
      bridge: {
        target: 'newest_or_ready_item',
        levels: { '2': { guide: 'a' }, '3': { guide: 'b' }, '4': { guide: 'c' } },
      },
      sensory: { noWrongSound: true, noText: true },
    },
  },
  NOW,
  'ex.cog01.choose_pet_animal',
)

function makeItem(key: string, patch: Partial<Omit<Item, keyof BaseRecord>>): Item {
  return withBase<Omit<Item, keyof BaseRecord>>(
    {
      key,
      scope: 'family',
      category: 'pet_animal',
      label: key,
      audio: {},
      archived: false,
      ...patch,
    },
    NOW,
    `item.${key}`,
  )
}

/** Có ảnh và đủ bản thu — mức "Đủ dùng". */
const recorded = makeItem('animal.dog', {
  imageMediaId: 'media.dog.image',
  audio: { instruction: ['media.dog.instruction'], praise: ['media.dog.praise'] },
})

/** Có ảnh và câu chữ, chưa thu — ba mẹ đọc trực tiếp. */
const live = makeItem('animal.cat', {
  imageMediaId: 'media.cat.image',
  transcripts: { instruction: ['Con mèo đâu?'], praise: ['Giỏi quá!'] },
})

/** Thiếu ảnh — bị chặn dù có cả bản thu lẫn câu chữ. */
const noImage = makeItem('animal.cow', {
  audio: { instruction: ['media.cow.instruction'], praise: ['media.cow.praise'] },
  transcripts: { instruction: ['Con bò đâu?'], praise: ['Giỏi quá!'] },
})

/** Có ảnh nhưng vai "praise" không có cả bản thu lẫn câu chữ — bị chặn. */
const roleMissing = makeItem('animal.chicken', {
  imageMediaId: 'media.chicken.image',
  transcripts: { instruction: ['Con gà đâu?'], praise: ['   '] },
})

function gapFor(key: string) {
  return contentGaps(exercise, [recorded, live, noImage, roleMissing]).find((g) => g.itemKey === key)
}

describe('điều kiện vào buổi học', () => {
  it('mục có ảnh + câu chữ nhưng chưa thu vẫn vào được buổi, xếp vào nhóm "chưa thu"', () => {
    const gap = gapFor('animal.cat')
    expect(gap?.missing).toEqual([])
    expect(gap?.liveVoice).toEqual(['instruction', 'praise'])
    expect(eligibleItems(exercise, [live]).map((i) => i.key)).toEqual(['animal.cat'])
    expect(audioDelivery(live, 'instruction')).toBe('live')
  })

  it('mục đã thu đủ thì không có khoảng trống nào', () => {
    expect(gapFor('animal.dog')).toBeUndefined()
    expect(audioDelivery(recorded, 'praise')).toBe('recorded')
  })

  it('mục thiếu ảnh bị chặn', () => {
    expect(gapFor('animal.cow')?.missing).toEqual(['image'])
    expect(eligibleItems(exercise, [noImage])).toEqual([])
  })

  it('vai vừa không bản thu vừa không câu chữ thì bị chặn', () => {
    const gap = gapFor('animal.chicken')
    expect(gap?.missing).toEqual(['praise'])
    expect(gap?.liveVoice).toEqual(['instruction'])
    expect(eligibleItems(exercise, [roleMissing])).toEqual([])
    expect(audioDelivery(roleMissing, 'praise')).toBe('none')
  })

  it('màn ba mẹ phân biệt đủ ba mức', () => {
    const roles = exercise.config.requiredAudio ?? []
    expect(readinessLevel(checkItem(recorded, roles))).toBe('recorded')
    expect(readinessLevel(checkItem(live, roles))).toBe('live')
    expect(readinessLevel(checkItem(roleMissing, roles))).toBe('missing')
  })
})

describe('ước lượng thời gian ba mẹ đọc', () => {
  it('kẹp đúng biên dưới với câu rất ngắn', () => {
    expect(estimateSpokenMs('A')).toBe(SPOKEN_LINE_MIN_MS)
    expect(estimateSpokenMs('   ')).toBe(SPOKEN_LINE_MIN_MS)
  })

  it('kẹp đúng biên trên với câu rất dài', () => {
    expect(estimateSpokenMs('a'.repeat(200))).toBe(SPOKEN_LINE_MAX_MS)
  })

  it('giữa hai biên thì tính theo số ký tự', () => {
    const text = 'Con mèo đâu con?' // 16 ký tự
    expect(estimateSpokenMs(text)).toBe(SPOKEN_LINE_BASE_MS + text.length * SPOKEN_LINE_PER_CHAR_MS)
    expect(estimateSpokenMs(text)).toBeGreaterThan(SPOKEN_LINE_MIN_MS)
    expect(estimateSpokenMs(text)).toBeLessThan(SPOKEN_LINE_MAX_MS)
  })
})

describe('câu đọc phải khớp bài đang chơi', () => {
  // Một mục nằm trong nhiều bài. Lỗi đã gặp trên máy thật: màn "ú òa" hiện câu
  // "Chỉ vào con bò" của bài chọn hình, vì câu chỉ gắn vào mục chứ không gắn vào bài.
  const cow = makeItem('animal.cow', {
    imageMediaId: 'media.cow.image',
    transcripts: { instruction: ['Chỉ vào con bò'], praise: ['Hoan hô!'] },
  })

  const withSpoken = (spoken: Record<string, string>): Exercise => ({
    ...exercise,
    config: { ...exercise.config, spoken },
  })

  it('dùng câu của bài, chèn tên mục vào {label}', () => {
    const peekaboo = withSpoken({ instruction: 'Hôm nay mình chơi ú òa nhé!' })
    expect(resolveSpokenLine(peekaboo, cow, 'instruction')).toBe('Hôm nay mình chơi ú òa nhé!')

    const sayName = withSpoken({ praise: 'Đúng rồi, {label}!' })
    expect(resolveSpokenLine(sayName, cow, 'praise')).toBe('Đúng rồi, animal.cow!')
  })

  it('ba mẹ tự sửa câu thì giữ nguyên câu của ba mẹ', () => {
    const edited = { ...cow, textsEditedAt: NOW }
    const peekaboo = withSpoken({ instruction: 'Hôm nay mình chơi ú òa nhé!' })
    expect(resolveSpokenLine(peekaboo, edited, 'instruction')).toBe('Chỉ vào con bò')
  })

  it('bài không khai báo câu thì lùi về câu của mục', () => {
    expect(resolveSpokenLine(exercise, cow, 'instruction')).toBe('Chỉ vào con bò')
    expect(resolveSpokenLine(exercise, cow, 'bridge')).toBeUndefined()
  })
})

describe('bài app chưa chạy được thì không đưa cho bé', () => {
  // Lỗi đã gặp trên máy thật: bài "ú òa" khai detector `touch_reveal` chưa đăng ký.
  // Màn vẫn hiện ra nhưng `useTrial` không dựng được bộ nhận chạm, bé chạm mãi không ăn.
  const withResponse = (detector: string): Exercise => ({
    ...exercise,
    config: {
      ...exercise.config,
      response: { ...exercise.config.response, detector: detector as never },
    },
  })

  it('loại bài có detector chưa đăng ký', () => {
    expect(canRun(withResponse('touch_choice'))).toBe(true)
    expect(canRun(withResponse('touch_reveal'))).toBe(false)
    expect(canRun(withResponse('hand_pose'))).toBe(false)
  })

  it('loại bài có loại trò chưa cài', () => {
    expect(canRun({ ...exercise, type: 'aac_request' })).toBe(false)
  })

  it('nhận đủ năm loại trò của 18 bài cô giao', () => {
    for (const [type, detector] of [
      ['choose_from_two', 'touch_choice'],
      ['peekaboo', 'touch_choice'],
      ['say_name', 'parent_confirm'],
      ['sequence_cards', 'touch_drag'],
      ['coach_demo', 'parent_confirm'],
    ] as const) {
      expect({ type, ok: canRun({ ...withResponse(detector), type }) }).toEqual({ type, ok: true })
    }
  })
})
