import { describe, expect, it } from 'vitest'
import type { DetectedResponse } from '@/engine/detectors/types'
import type { DragSlot, TouchDragPayload } from '@/engine/detectors/touchDrag'
import { TouchDragDetector, parseTouchDragConfig } from '@/engine/detectors/touchDrag'

const CARD_A = 'item-dog'
const CARD_B = 'item-cat'
const TARGET = 'item-dog'

/** Hai ô 100×100 cạnh nhau ở nửa trên; thẻ xuất phát ở y = 600. */
const SLOTS: DragSlot[] = [
  { index: 0, rect: { x: 100, y: 100, w: 100, h: 100 } },
  { index: 1, rect: { x: 300, y: 100, w: 100, h: 100 } },
]

const CONFIG = { snapPx: 40, maxDurationMs: 2000 }

async function started(): Promise<{ d: TouchDragDetector; seen: DetectedResponse[] }> {
  const d = new TouchDragDetector({ slots: SLOTS, completionTargetId: TARGET })
  const seen: DetectedResponse[] = []
  d.subscribe((r) => seen.push(r))
  await d.start({ trialId: 't1', config: CONFIG, signal: new AbortController().signal })
  return { d, seen }
}

function payloadOf(response: DetectedResponse | undefined): TouchDragPayload {
  return (response?.payload ?? {}) as TouchDragPayload
}

/** Một lần kéo trọn vẹn của ngón đầu tiên. */
function dragCard(
  d: TouchDragDetector,
  card: string,
  to: { x: number; y: number },
  opts: { pointerId?: number; downTMs?: number; upTMs?: number } = {},
): void {
  const pointerId = opts.pointerId ?? 1
  const downTMs = opts.downTMs ?? 1000
  d.pointerDown({ pointerId, tMs: downTMs, x: 150, y: 600, targetId: card })
  d.pointerMove({ pointerId, tMs: downTMs + 100, x: to.x, y: to.y, targetId: card })
  d.pointerUp({ pointerId, tMs: opts.upTMs ?? downTMs + 200, x: to.x, y: to.y, targetId: card })
}

describe('parseTouchDragConfig', () => {
  it('lấy giá trị nền từ params khi response không ghi', () => {
    expect(parseTouchDragConfig({}, { snapPx: 56 }).snapPx).toBe(56)
    expect(parseTouchDragConfig({ snapPx: 90 }, { snapPx: 56 }).snapPx).toBe(90)
    expect(parseTouchDragConfig(null).maxDurationMs).toBeGreaterThan(0)
  })
})

describe('TouchDragDetector', () => {
  it('thả trong snapPx quanh ô trống thì thẻ vào ô', async () => {
    const { d, seen } = await started()
    // y = 235 nằm ngoài ô (100..200) nhưng trong phạm vi snapPx = 40.
    dragCard(d, CARD_A, { x: 150, y: 235 })

    expect(seen).toHaveLength(1)
    expect(payloadOf(seen[0])).toMatchObject({
      outcome: 'placed',
      cardId: CARD_A,
      slotIndex: 0,
      placedCount: 1,
      slotCount: 2,
    })
    // Hàng chưa đủ thẻ: chưa phải câu trả lời của lượt.
    expect(payloadOf(seen[0]).counted).toBe(false)
    expect(d.isPlaced(CARD_A)).toBe(true)
  })

  it('xếp đủ hàng mới báo lượt xong, kèm mục đích của lượt', async () => {
    const { d, seen } = await started()
    dragCard(d, CARD_A, { x: 150, y: 150 })
    dragCard(d, CARD_B, { x: 350, y: 150 }, { pointerId: 2, downTMs: 2000 })

    expect(payloadOf(seen[1])).toMatchObject({
      outcome: 'row_complete',
      cardId: CARD_B,
      slotIndex: 1,
      counted: true,
      placedCount: 2,
    })
    expect(seen[1]?.targetId).toBe(TARGET)
  })

  it('ô đã có thẻ thì không nhận thêm; không ô trống nào trong tầm thì thẻ về chỗ cũ', async () => {
    const { d, seen } = await started()
    dragCard(d, CARD_A, { x: 150, y: 150 })
    // Thả ngay trên ô 0 đã đầy: ô 1 cách 190 px > snapPx nên không ô nào nhận.
    dragCard(d, CARD_B, { x: 150, y: 150 }, { pointerId: 2, downTMs: 2000 })

    expect(payloadOf(seen[1]).outcome).toBe('off_slot')
    expect(d.isPlaced(CARD_B)).toBe(false)
  })

  it('thả ngoài mọi ô: không tính là sai, chỉ là chưa xong', async () => {
    const { d, seen } = await started()
    dragCard(d, CARD_A, { x: 150, y: 420 })

    expect(payloadOf(seen[0])).toMatchObject({
      outcome: 'off_slot',
      counted: false,
      reason: 'off_target',
    })
    expect(d.isPlaced(CARD_A)).toBe(false)
    // Thử lại được ngay: không có trạng thái "đã sai".
    dragCard(d, CARD_A, { x: 150, y: 150 }, { downTMs: 3000 })
    expect(payloadOf(seen[1]).outcome).toBe('placed')
  })

  it('chỉ nhận ngón đầu tiên; ngón thứ hai không đặt được thẻ', async () => {
    const { d, seen } = await started()
    d.pointerDown({ pointerId: 1, tMs: 1000, x: 150, y: 600, targetId: CARD_A })
    d.pointerDown({ pointerId: 2, tMs: 1050, x: 350, y: 600, targetId: CARD_B })
    d.pointerUp({ pointerId: 2, tMs: 1100, x: 350, y: 150, targetId: CARD_B })

    expect(payloadOf(seen[0])).toMatchObject({
      outcome: 'ignored',
      counted: false,
      reason: 'second_pointer',
    })
    expect(d.isPlaced(CARD_B)).toBe(false)

    d.pointerUp({ pointerId: 1, tMs: 1200, x: 150, y: 150, targetId: CARD_A })
    expect(payloadOf(seen[1]).outcome).toBe('placed')
  })

  it('giữ thẻ quá maxDurationMs thì không tính, ô vẫn trống', async () => {
    const { d, seen } = await started()
    dragCard(d, CARD_A, { x: 150, y: 150 }, { downTMs: 1000, upTMs: 3500 })

    expect(payloadOf(seen[0])).toMatchObject({ outcome: 'too_long', counted: false })
    expect(payloadOf(seen[0]).reason).toBeUndefined()
    expect(d.isPlaced(CARD_A)).toBe(false)
  })

  it('thẻ đã vào ô thì kéo lại không đổi gì', async () => {
    const { d, seen } = await started()
    dragCard(d, CARD_A, { x: 150, y: 150 })
    dragCard(d, CARD_A, { x: 350, y: 150 }, { pointerId: 2, downTMs: 2000 })

    expect(payloadOf(seen[1]).outcome).toBe('ignored')
    expect(d.placements.get(CARD_A)).toBe(0)
  })

  it('pointercancel bỏ hẳn; AbortSignal dừng detector', async () => {
    const { d, seen } = await started()
    d.pointerDown({ pointerId: 1, tMs: 1000, x: 150, y: 600, targetId: CARD_A })
    d.pointerCancel({ pointerId: 1, tMs: 1050 })
    d.pointerUp({ pointerId: 1, tMs: 1100, x: 150, y: 150, targetId: CARD_A })
    expect(seen).toHaveLength(0)

    const controller = new AbortController()
    const other = new TouchDragDetector({ slots: SLOTS })
    const otherSeen: DetectedResponse[] = []
    other.subscribe((r) => otherSeen.push(r))
    await other.start({ trialId: 't2', config: CONFIG, signal: controller.signal })
    controller.abort()
    dragCard(other, CARD_A, { x: 150, y: 150 })
    expect(otherSeen).toHaveLength(0)
  })

  it('start xoá thẻ đã đặt của lượt trước', async () => {
    const { d } = await started()
    dragCard(d, CARD_A, { x: 150, y: 150 })
    expect(d.placements.size).toBe(1)
    await d.start({ trialId: 't3', config: CONFIG, signal: new AbortController().signal })
    expect(d.placements.size).toBe(0)
  })
})
