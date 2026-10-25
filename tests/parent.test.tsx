import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { vi as strings } from '@/i18n/vi'
import type { PromptLevel, Trial } from '@/data/types'
import { DayDots } from '@/parent/Shell'
import { promptLevelPatch, trialResultKey, validityPatch } from '@/parent/reviewPatch'

/**
 * Từ cấm theo docs/09 §6. Bỏ "nặng/nhẹ" khỏi danh sách tự động vì chỉ bị cấm
 * khi nói về tự kỷ; "Nhẹ" là một mức chất lượng hiển thị hợp lệ (04 §7).
 */
const FORBIDDEN = [
  'chữa',
  'chữa khỏi',
  'điều trị',
  'giảm triệu chứng',
  'cải thiện tự kỷ',
  'chẩn đoán',
  'tiên lượng',
  'mức độ tự kỷ',
  'bình thường',
  'bất thường',
  'chậm phát triển',
  'kém',
  'điểm yếu',
  'thất bại',
  'bỏ lỡ',
  'đứt chuỗi',
  'chuỗi ngày',
  'phạt',
  'mất sao',
  'sai',
  'chắc chắn sẽ',
  'đảm bảo tiến bộ',
]

const LETTER = '[\\p{L}\\p{M}]'

function collectStrings(value: unknown, path: string): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }]
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      collectStrings(v, path ? `${path}.${k}` : k),
    )
  }
  return []
}

function makeTrial(overrides: Partial<Trial> = {}): Trial {
  return {
    id: 'trial-1',
    schemaVersion: 1,
    createdAt: 0,
    updatedAt: 0,
    childId: 'child-1',
    sessionId: 'session-1',
    roundIndex: 0,
    trialIndex: 0,
    date: '2026-10-19',
    weekStart: '2026-10-19',
    exerciseId: 'COG-01',
    exerciseCode: 'COG-01',
    configVersion: 1,
    targetItemId: 'item-1',
    targetItemKey: 'dog',
    isNewItem: false,
    displayed: [],
    targetSlot: 0,
    detectorKind: 'touch_choice',
    startedAt: 0,
    instructionStartMs: 0,
    instructionEndMs: 900,
    firstChoice: null,
    correctFirstTry: false,
    parked: false,
    completedAtMs: 4000,
    completedLatencyMs: 3100,
    promptLevel: 'gesture',
    promptLevelAuto: 'gesture',
    promptLevelSource: 'auto',
    touches: [],
    valid: true,
    viewport: { w: 1194, h: 834, dpr: 2, orientation: 'landscape' },
    schedulerId: 'simple@1',
    ...overrides,
  }
}

describe('ngôn ngữ trong i18n/vi', () => {
  const entries = collectStrings(strings, '')

  it('có đủ chuỗi để duyệt', () => {
    expect(entries.length).toBeGreaterThan(100)
  })

  for (const word of FORBIDDEN) {
    it(`không dùng từ "${word}"`, () => {
      const re = new RegExp(`(?<!${LETTER})${word}(?!${LETTER})`, 'iu')
      const hits = entries.filter((e) => re.test(e.text))
      expect(hits.map((h) => `${h.path}: ${h.text}`)).toEqual([])
    })
  }

  it('cảnh báo thiên vị vị trí kèm số lượt và nhắc hỏi cô giáo', () => {
    expect(strings.progress.sideBias).toContain('{picked}')
    expect(strings.progress.sideBias).toContain('{total}')
    expect(strings.common.askTeacher).toContain('cô giáo')
  })

  it('kết quả của bé dùng chữ trung tính, không đúng/sai', () => {
    expect(strings.review.resultIndependent).toBe(strings.promptLevel.independent)
    expect(strings.review.resultPrompted).toBe('Có gợi ý')
  })
})

describe('sửa mức gợi ý của ba mẹ', () => {
  it('giữ nguyên promptLevelAuto và đặt nguồn parent_edit', () => {
    const trial = makeTrial({ promptLevel: 'gesture', promptLevelAuto: 'gesture' })
    const patch = promptLevelPatch(trial, 'independent')
    expect(patch).toEqual({
      promptLevel: 'independent',
      promptLevelAuto: 'gesture',
      promptLevelSource: 'parent_edit',
    })
  })

  it('sửa nhiều lần vẫn giữ giá trị app ghi ban đầu', () => {
    const trial = makeTrial({ promptLevelAuto: 'model' })
    const once = promptLevelPatch(trial, 'independent')
    const twice = promptLevelPatch({ ...trial, ...once }, 'partial_physical')
    const expectedAuto: PromptLevel = 'model'
    expect(twice.promptLevelAuto).toBe(expectedAuto)
    expect(twice.promptLevel).toBe('partial_physical')
  })

  it('đánh dấu lượt không hợp lệ kèm lý do, bỏ dấu thì xóa lý do', () => {
    expect(validityPatch(false, 'accidental')).toEqual({
      valid: false,
      invalidReason: 'accidental',
    })
    expect(validityPatch(true)).toEqual({ valid: true, invalidReason: undefined })
  })

  it('kết quả một lượt chỉ có hai nhãn trung tính', () => {
    expect(trialResultKey(makeTrial({ promptLevel: 'independent', correctFirstTry: true }))).toBe(
      'independent',
    )
    expect(trialResultKey(makeTrial({ promptLevel: 'gesture', correctFirstTry: true }))).toBe(
      'prompted',
    )
  })
})

describe('lịch tuần của ba mẹ', () => {
  it('ngày chưa luyện là vòng rỗng, không có dấu X', () => {
    const { container } = render(
      <DayDots
        days={[
          { date: '2026-10-19', practiced: true },
          { date: '2026-10-20', practiced: false },
        ]}
      />,
    )
    expect(container.textContent).toBe('')
    expect(screen.getByLabelText('2026-10-20')).toBeDefined()
  })
})
