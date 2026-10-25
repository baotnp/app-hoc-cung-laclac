// Lượt chơi phải chạy tiếp sau khi React gắn lại component (StrictMode gắn → gỡ → gắn).
// Trước đây cleanup xoá bộ đếm nhưng dấu `appliedSeq` chặn đặt lại, làm lượt kẹt ở bước đầu:
// không có câu lệnh, không có gợi ý, không có thưởng — màn hình im lặng hoàn toàn.

import { StrictMode } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTrial } from '@/engine'
import type { TrialRecord, TrialSetup, UseTrialApi } from '@/engine'

const setup: TrialSetup = {
  childId: 'child',
  sessionId: 'session',
  roundIndex: 0,
  trialIndex: 0,
  date: '2026-10-25',
  weekStart: '2026-10-19',
  exerciseId: 'ex.cog01.choose_pet_animal',
  exerciseCode: 'COG-01',
  configVersion: 1,
  targetItemId: 'A',
  targetItemKey: 'animal.dog',
  isNewItem: false,
  displayed: [
    { itemId: 'A', itemKey: 'animal.dog', slot: 0, rect: { x: 0, y: 0, w: 500, h: 600 } },
    { itemId: 'B', itemKey: 'animal.cat', slot: 1, rect: { x: 600, y: 0, w: 500, h: 600 } },
  ],
  targetSlot: 0,
  detectorKind: 'touch_choice',
  startedAt: 0,
  timing: { showingMs: 300, waitBeforeCueMs: 5000, afterCueTimeoutMs: 15000, rewardMaxMs: 1200 },
  cue: { kind: 'raise_correct', repeatInstruction: true },
  reward: { perTrial: ['mascot_nod', 'praise_audio', 'star_ting'], echoWord: true },
  viewport: { w: 1194, h: 834, dpr: 2, orientation: 'landscape' },
  schedulerId: 'simple@1',
}

interface Harness {
  instructions: number
  rewards: number
  completed: TrialRecord | null
}

function renderTrial(wrapInStrictMode: boolean) {
  const calls: Harness = { instructions: 0, rewards: 0, completed: null }
  let api: UseTrialApi | null = null

  function Probe() {
    api = useTrial({
      setup,
      audio: {
        playInstruction: () => {
          calls.instructions += 1
        },
        playReward: () => {
          calls.rewards += 1
        },
      },
      onComplete: (trial) => {
        calls.completed = trial
      },
    })
    return null
  }

  render(wrapInStrictMode ? <StrictMode><Probe /></StrictMode> : <Probe />)
  return { calls, get api() { return api } }
}

/** Đưa lượt từ lúc hiện hình tới lúc chờ bé chạm. */
async function advanceToWaiting() {
  await act(async () => {
    vi.advanceTimersByTime(300) // bộ đếm 'showing'
  })
  // Promise của câu lệnh resolve ở microtask: act(async) xả hàng chờ đó.
  await act(async () => {})
}

describe('useTrial', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  for (const strict of [false, true]) {
    it(`chạy trọn lượt${strict ? ' khi bị gắn lại (StrictMode)' : ''}`, async () => {
      const h = renderTrial(strict)
      await advanceToWaiting()

      // Câu lệnh đã phát và lượt đã rời bước 'showing'.
      expect(h.calls.instructions).toBeGreaterThanOrEqual(1)
      expect(h.api?.phase).toBe('waiting')

      // Bé chạm đúng hình.
      act(() => {
        h.api?.confirm('A')
      })
      expect(h.calls.rewards).toBe(1)

      // Hết thời gian thưởng thì lượt kết thúc và ghi lại bản ghi.
      await act(async () => {
        vi.advanceTimersByTime(1300)
      })
      expect(h.calls.completed?.targetItemId).toBe('A')
      expect(h.calls.completed?.correctFirstTry).toBe(true)
    })
  }

  it('hết giờ chờ thì gợi ý hình đúng, không có âm báo sai', async () => {
    const cues: string[] = []
    const box: { api: UseTrialApi | null } = { api: null }
    function Probe() {
      box.api = useTrial({
        setup,
        audio: { playInstruction: () => undefined },
        onCue: (kind) => cues.push(kind),
        onComplete: () => undefined,
      })
      return null
    }
    render(<StrictMode><Probe /></StrictMode>)
    await advanceToWaiting()

    await act(async () => {
      vi.advanceTimersByTime(5000) // waitBeforeCueMs
    })
    expect(cues).toEqual(['raise_correct'])
    // Câu lệnh được lặp đúng một lần rồi lượt chờ bé chạm hình đúng.
    await act(async () => {})
    expect(box.api?.phase).toBe('awaitingAfterCue')
  })
})
