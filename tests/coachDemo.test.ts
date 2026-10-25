import { describe, expect, it } from 'vitest'
import {
  COACH_PARENT_STRIP_PX,
  coachDemoGame,
  coachDemoParamsSchema,
  coachDemoRect,
  readCoachDemoParams,
} from '@/engine/games/coachDemo'
import type { PlannedTrialInput, Viewport } from '@/engine/games/types'

const viewport: Viewport = { w: 1194, h: 834, dpr: 2, orientation: 'landscape' }

/** Bài 10 (SOC-01) — chuyền bóng, docs/10 §4. */
const ball = {
  activity: 'ball',
  mascotCue: 'clap',
  parentSteps: [
    { label: '"1 2 3 - Đẩy"', detail: 'Ngồi đối diện bé, làm mẫu đẩy bóng qua lại.' },
    { label: '"Lạc ơi, đẩy bóng qua cho ba mẹ"', detail: 'Dang tay ra hiệu đã sẵn sàng nhận bóng.' },
    { label: 'Để bé chủ động đẩy bóng', detail: 'Lặp lại đến khi bé tự đẩy bóng qua lại.' },
  ],
}

/** Bài 16 (GRO-01) — chui đường hầm, có đếm giờ bước. */
const tunnel = {
  activity: 'tunnel',
  mascotCue: 'crawl',
  parentSteps: [
    { label: '"Mẹ bò nè, trẻ nhìn nha"', detail: 'Bò chậm bằng 2 khuỷu tay và 2 đầu gối.' },
    { label: '"Trẻ bò nè!"', detail: 'Tập bò ngoài đường hầm trước, rồi hướng dẫn bò qua.' },
    { label: '"Hay quá! Hoan hô trẻ"', detail: 'Đứng ở điểm đến cổ vũ, bé tự bò qua.' },
  ],
  showStepTimerMs: 5000,
}

/** Bài 3 (IMI-03) — vẫy tay chào, chỉ 2 bước. */
const wave = {
  activity: 'hand',
  mascotCue: 'wave',
  parentSteps: [
    { label: '"Con bắt chước ba mẹ vẫy tay chào nhé!"', detail: 'Giơ 1 tay, xòe bàn tay rồi vẫy.' },
    { label: 'Để bé chủ động vẫy tay', detail: 'Đúng tình huống: khi gặp người hoặc ra khỏi nhà.' },
  ],
}

describe('coachDemoParamsSchema', () => {
  it('nhận cấu hình của các bài khác nhau', () => {
    for (const shape of [ball, tunnel, wave]) {
      const parsed = coachDemoGame.parseParams(shape)
      expect(parsed.ok).toBe(true)
    }
    expect(coachDemoParamsSchema.parse(tunnel).showStepTimerMs).toBe(5000)
    expect(coachDemoParamsSchema.parse(ball).showStepTimerMs).toBeUndefined()
  })

  it('từ chối parentSteps rỗng, 1 bước, hoặc quá 4 bước', () => {
    const empty = coachDemoGame.parseParams({ ...ball, parentSteps: [] })
    expect(empty.ok).toBe(false)

    const one = coachDemoGame.parseParams({ ...ball, parentSteps: [ball.parentSteps[0]] })
    expect(one.ok).toBe(false)

    const five = coachDemoGame.parseParams({
      ...ball,
      parentSteps: [...ball.parentSteps, ...ball.parentSteps].slice(0, 5),
    })
    expect(five.ok).toBe(false)
    if (!five.ok) expect(five.errors.join(' ')).toContain('parentSteps')
  })

  it('từ chối động tác linh vật lạ và khóa thừa', () => {
    expect(coachDemoGame.parseParams({ ...ball, mascotCue: 'dance' }).ok).toBe(false)
    expect(coachDemoGame.parseParams({ ...ball, choices: 1 }).ok).toBe(false)
  })
})

describe('readCoachDemoParams', () => {
  it('đọc được params lồng trong gameData và cả dạng phẳng', () => {
    expect(readCoachDemoParams({ params: ball }).activity).toBe('ball')
    expect(readCoachDemoParams({ ...ball }).mascotCue).toBe('clap')
  })

  it('thiếu hoặc hỏng thì trả bộ rỗng an toàn, không ném lỗi', () => {
    expect(readCoachDemoParams(undefined).parentSteps).toEqual([])
    expect(readCoachDemoParams({ params: { activity: 'ball' } })).toEqual({
      activity: '',
      mascotCue: 'none',
      parentSteps: [],
    })
  })
})

describe('coachDemoGame.buildDisplayed', () => {
  const planned: PlannedTrialInput = {
    trialIndex: 0,
    exerciseId: 'ex.soc01.pass_ball',
    targetItemId: 'ITEM-BALL',
    distractorItemIds: [],
    targetSlot: 0,
    isNewItem: false,
    waitBeforeCueMs: 5000,
  }

  it('một ô duy nhất chiếm vùng giữa, chừa dải của ba mẹ', () => {
    const parsed = coachDemoGame.parseParams(ball)
    if (!parsed.ok) throw new Error(parsed.errors.join('; '))

    const displayed = coachDemoGame.buildDisplayed({
      planned,
      items: [{ itemId: 'ITEM-BALL', itemKey: 'object.ball' }],
      params: parsed.value,
      viewport,
    })

    expect(displayed).toHaveLength(1)
    expect(coachDemoGame.choices).toBe(1)
    expect(coachDemoGame.defaultDetector).toBe('parent_confirm')

    const cell = displayed[0]
    if (!cell) throw new Error('thiếu ô hiển thị')
    expect(cell.itemKey).toBe('object.ball')
    expect(cell.slot).toBe(0)
    expect(cell.rect.h).toBeLessThanOrEqual(viewport.h - COACH_PARENT_STRIP_PX)
    // Vẫn là ô lớn: hơn một nửa diện tích khung nhìn.
    expect((cell.rect.w * cell.rect.h) / (viewport.w * viewport.h)).toBeGreaterThan(0.5)
  })

  it('thiếu mục đích thì ném lỗi rõ ràng', () => {
    const parsed = coachDemoGame.parseParams(ball)
    if (!parsed.ok) throw new Error(parsed.errors.join('; '))
    expect(() =>
      coachDemoGame.buildDisplayed({
        planned,
        items: [{ itemId: 'ITEM-KHAC', itemKey: 'object.truck' }],
        params: parsed.value,
        viewport,
      }),
    ).toThrow()
  })

  it('luôn hiện đồ của chính hoạt động, không phải mục đích đang xoay vòng', () => {
    // Đã xảy ra trên máy thật: bài "chui qua đường hầm" hiện quả bóng, vì kho có 2 mục
    // và bộ lập lịch chọn quả bóng làm mục đích của lượt đó.
    const parsed = coachDemoGame.parseParams({ ...ball, activity: 'tunnel' })
    if (!parsed.ok) throw new Error(parsed.errors.join('; '))

    const displayed = coachDemoGame.buildDisplayed({
      planned, // mục đích là quả bóng
      items: [
        { itemId: 'ITEM-BALL', itemKey: 'object.ball' },
        { itemId: 'ITEM-TUNNEL', itemKey: 'object.tunnel' },
      ],
      params: parsed.value,
      viewport,
    })
    expect(displayed[0]?.itemKey).toBe('object.tunnel')
  })

  it('màn dọc vẫn cho ô dương và chừa đúng dải ba mẹ', () => {
    const portrait: Viewport = { w: 834, h: 1194, dpr: 2, orientation: 'portrait' }
    const rect = coachDemoRect(portrait)
    expect(rect.w).toBeGreaterThan(0)
    expect(rect.h).toBeGreaterThan(0)
    expect(rect.y + rect.h + COACH_PARENT_STRIP_PX).toBeLessThanOrEqual(portrait.h)
  })
})
