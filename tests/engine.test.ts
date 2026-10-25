import { describe, expect, it } from 'vitest'
import type { DisplayedChoice, Trial } from '@/data/types'
import { parseExerciseFile } from '@/engine/schema'
import { chooseFromTwoGame, chooseFromTwoRects } from '@/engine/games/chooseFromTwo'
import { getGame, registerGame, requireGame } from '@/engine/registry'
import { buildTrialSetup, effectiveTiming } from '@/engine/loader'
import { TouchChoiceDetector } from '@/engine/detectors/touchChoice'
import { ParentConfirmDetector } from '@/engine/detectors/parentConfirm'
import { createDetectorRegistry, detectorRegistry } from '@/engine/detectors/registry'
import type { DetectedResponse } from '@/engine/detectors/types'
import type { TrialAction, TrialSetup, TrialState } from '@/engine/trialMachine'
import { createTrialState, isAudioEffect, trialReducer } from '@/engine/trialMachine'

// ------------------------------------------------------------ dữ liệu mẫu

/** Nguyên văn ví dụ COG-01 của docs/06 §4.2. */
function cog01(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'ex.cog01.choose_pet_animal',
    code: 'COG-01',
    type: 'choose_from_two',
    title: 'Chọn 1 trong 2 hình con vật nuôi',
    group: 'cognition_receptive',
    phase: 1,
    configVersion: 1,

    itemPool: {
      category: 'pet_animal',
      keys: ['animal.dog', 'animal.cat', 'animal.cow', 'animal.chicken'],
      minItems: 2,
    },
    requiredAudio: ['instruction', 'praise', 'bridge'],

    response: {
      detector: 'touch_choice',
      acceptOn: 'pointerup',
      maxMovePx: 24,
      ignoreFirstMs: 150,
      hitSlopPx: 24,
    },

    params: {
      choices: 2,
      layout: { minCardAreaRatio: 0.334 },
      positions: { strategy: 'balanced_shuffle', maxSameSideRun: 3 },
      distractor: { strategy: 'random_other_in_pool', avoidRepeatLast: 1 },
    },

    timing: {
      waitBeforeCueMs: 5000,
      afterCueTimeoutMs: 15000,
      rewardMaxMs: 1200,
      cue: { kind: 'raise_correct', repeatInstruction: true },
    },

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

    reward: {
      perTrial: ['mascot_nod', 'praise_audio', 'star_ting'],
      echoWord: true,
      onRoundComplete: 'party_standard',
      party: { showAnimals: 'from_round_items', max: 3 },
    },

    bridge: {
      target: 'newest_or_ready_item',
      promptAudioRole: 'bridge',
      levels: {
        '2': { guide: 'Đưa 2 thẻ giấy in hình con vật (một là {label}).' },
        '3': { guide: 'Đặt 2 đồ chơi/mô hình con vật (một là {label}).' },
        '4': { guide: 'Khi thấy {label} ngoài đường, hỏi bé: "{instruction}".' },
      },
    },

    sensory: { noWrongSound: true, noText: true },

    confirm: {
      status: 'assumed',
      fields: ['instruction', 'timing.waitBeforeCueMs', 'mastery'],
    },
  }
}

const TARGET = 'item-dog'
const DISTRACTOR = 'item-cat'

const DISPLAYED: DisplayedChoice[] = [
  { itemId: TARGET, itemKey: 'animal.dog', slot: 0, rect: { x: 40, y: 40, w: 460, h: 680 } },
  { itemId: DISTRACTOR, itemKey: 'animal.cat', slot: 1, rect: { x: 524, y: 40, w: 460, h: 680 } },
]

const VIEWPORT: Trial['viewport'] = { w: 1024, h: 768, dpr: 2, orientation: 'landscape' }

function setup(overrides: Partial<TrialSetup> = {}): TrialSetup {
  return {
    childId: 'child-1',
    sessionId: 'session-1',
    roundIndex: 0,
    trialIndex: 0,
    date: '2026-10-24',
    weekStart: '2026-10-19',

    exerciseId: 'ex.cog01.choose_pet_animal',
    exerciseCode: 'COG-01',
    configVersion: 1,

    targetItemId: TARGET,
    targetItemKey: 'animal.dog',
    isNewItem: false,
    displayed: DISPLAYED,
    targetSlot: 0,

    detectorKind: 'touch_choice',
    startedAt: 1_700_000_000_000,

    timing: { showingMs: 300, waitBeforeCueMs: 5000, afterCueTimeoutMs: 15000, rewardMaxMs: 1200 },
    cue: { kind: 'raise_correct', repeatInstruction: true },
    reward: { perTrial: ['mascot_nod', 'praise_audio', 'star_ting'], echoWord: true },

    viewport: VIEWPORT,
    schedulerId: 'simple@1',
    ...overrides,
  }
}

interface Run {
  state: TrialState
  /** Mọi hiệu ứng đã sinh ra từ đầu lượt, theo thứ tự. */
  effects: TrialState['effects']
}

function run(initial: TrialSetup | TrialState, actions: TrialAction[]): Run {
  let state = 'phase' in initial ? initial : createTrialState(initial)
  const effects = [...state.effects]
  for (const action of actions) {
    state = trialReducer(state, action)
    effects.push(...state.effects)
  }
  return { state, effects }
}

/** Mở màn chung: hiện hình xong → phát câu lệnh → bắt đầu đếm. */
const OPENING: TrialAction[] = [
  { type: 'shown', tMs: 300 },
  { type: 'instruction_started', tMs: 320 },
  { type: 'instruction_ended', tMs: 1200 },
]

// --------------------------------------------------------------- schema

describe('parseExerciseFile', () => {
  it('nhận ví dụ COG-01 của docs/06 §4.2', () => {
    const result = parseExerciseFile(cog01(), 1_700_000_000_000)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.id).toBe('ex.cog01.choose_pet_animal')
    expect(result.value.code).toBe('COG-01')
    expect(result.value.active).toBe(true)
    expect(result.value.schemaVersion).toBe(1)
    expect(result.value.config.timing.waitBeforeCueMs).toBe(5000)
    expect(result.value.config.scheduling.trialsPerRound).toBe(5)
    expect(result.value.config.sensory).toEqual({ noWrongSound: true, noText: true })
    // Trường danh tính không được lẫn vào config.
    expect('id' in result.value.config).toBe(false)
    expect('schemaVersion' in result.value.config).toBe(false)
  })

  it('điền mặc định cho response khi JSON bài bỏ trống', () => {
    const file = cog01()
    file['response'] = { detector: 'touch_choice' }
    const result = parseExerciseFile(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.config.response).toEqual({
      detector: 'touch_choice',
      acceptOn: 'pointerup',
      maxMovePx: 24,
      ignoreFirstMs: 150,
      hitSlopPx: 24,
    })
  })

  it('từ chối rewardMaxMs = 1500', () => {
    const file = cog01()
    file['timing'] = { ...(file['timing'] as object), rewardMaxMs: 1500 }
    const result = parseExerciseFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('timing.rewardMaxMs')
  })

  it('từ chối trialsPerRound = 3', () => {
    const file = cog01()
    file['scheduling'] = { ...(file['scheduling'] as object), trialsPerRound: 3 }
    const result = parseExerciseFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('scheduling.trialsPerRound')
  })

  it('từ chối khi thiếu firstTrialKnownItem', () => {
    const file = cog01()
    const scheduling = { ...(file['scheduling'] as Record<string, unknown>) }
    delete scheduling['firstTrialKnownItem']
    file['scheduling'] = scheduling
    const result = parseExerciseFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('scheduling.firstTrialKnownItem')
  })

  it('từ chối noWrongSound = false', () => {
    const file = cog01()
    file['sensory'] = { noWrongSound: false, noText: true }
    const result = parseExerciseFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('sensory.noWrongSound')
  })

  it('từ chối afterCueTimeoutMs không lớn hơn waitBeforeCueMs', () => {
    const file = cog01()
    file['timing'] = { ...(file['timing'] as object), waitBeforeCueMs: 15000 }
    const result = parseExerciseFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('afterCueTimeoutMs phải lớn hơn waitBeforeCueMs')
  })

  it('từ chối minItems lớn hơn số keys', () => {
    const file = cog01()
    file['itemPool'] = { category: 'pet_animal', keys: ['animal.dog', 'animal.cat'], minItems: 3 }
    const result = parseExerciseFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('minItems không được lớn hơn số keys')
  })

  it('từ chối requiredAudio rỗng', () => {
    const file = cog01()
    file['requiredAudio'] = []
    const result = parseExerciseFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('requiredAudio không được rỗng')
  })

  it('từ chối params sai của choose_from_two', () => {
    const file = cog01()
    file['params'] = {
      choices: 2,
      layout: { minCardAreaRatio: 0.2 },
      positions: { strategy: 'balanced_shuffle', maxSameSideRun: 9 },
      distractor: { strategy: 'random_other_in_pool' },
    }
    const result = parseExerciseFile(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    const text = result.errors.join('\n')
    expect(text).toContain('params.layout.minCardAreaRatio')
    expect(text).toContain('params.positions.maxSameSideRun')
  })

  it('từ chối id/code sai khuôn và khóa lạ', () => {
    const badId = parseExerciseFile({ ...cog01(), id: 'cog01' })
    expect(badId.ok).toBe(false)
    const badCode = parseExerciseFile({ ...cog01(), code: 'XYZ-1' })
    expect(badCode.ok).toBe(false)
    const extra = parseExerciseFile({ ...cog01(), somethingElse: true })
    expect(extra.ok).toBe(false)
  })
})

// --------------------------------------------------------------- registry + game

describe('registry và GameModule', () => {
  it('có sẵn năm loại bài của cô và cho đăng ký loại mới', () => {
    expect(getGame('choose_from_two')).toBe(chooseFromTwoGame)
    // 18 bài của cô dùng 5 loại trò; đăng ký đủ thì buổi học không rơi về màn mặc định.
    for (const type of ['choose_from_two', 'peekaboo', 'say_name', 'sequence_cards', 'coach_demo'] as const) {
      expect(requireGame(type).type).toBe(type)
    }

    // Loại chưa dùng vẫn phải báo thiếu rõ ràng thay vì im lặng.
    expect(getGame('drag_to_jar')).toBeUndefined()
    expect(() => requireGame('drag_to_jar')).toThrow()

    registerGame('drag_to_jar', {
      type: 'drag_to_jar',
      defaultDetector: 'touch_drag',
      choices: 1,
      parseParams: () => ({ ok: true, value: {} }),
      buildDisplayed: () => [],
    })
    expect(requireGame('drag_to_jar').defaultDetector).toBe('touch_drag')
  })

  it('mỗi thẻ chiếm ít nhất minCardAreaRatio khung nhìn', () => {
    for (const viewport of [
      VIEWPORT,
      { w: 768, h: 1024, dpr: 2, orientation: 'portrait' } as const,
      { w: 390, h: 844, dpr: 3, orientation: 'portrait' } as const,
    ]) {
      const [a, b] = chooseFromTwoRects(viewport, 0.334)
      const area = viewport.w * viewport.h
      expect((a.w * a.h) / area).toBeGreaterThanOrEqual(0.33)
      expect(a.w).toBe(b.w)
      expect(a.h).toBe(b.h)
    }
  })

  it('dựng displayed theo targetSlot của kế hoạch', () => {
    const params = chooseFromTwoGame.parseParams(cog01()['params'])
    expect(params.ok).toBe(true)
    if (!params.ok) return

    const displayed = chooseFromTwoGame.buildDisplayed({
      planned: {
        trialIndex: 0,
        exerciseId: 'ex.cog01.choose_pet_animal',
        targetItemId: TARGET,
        distractorItemIds: [DISTRACTOR],
        targetSlot: 1,
        isNewItem: false,
        waitBeforeCueMs: 5000,
      },
      items: [
        { itemId: TARGET, itemKey: 'animal.dog' },
        { itemId: DISTRACTOR, itemKey: 'animal.cat' },
      ],
      params: params.value,
      viewport: VIEWPORT,
    })

    expect(displayed.map((d) => d.itemId)).toEqual([DISTRACTOR, TARGET])
    expect(displayed.map((d) => d.slot)).toEqual([0, 1])
    expect(displayed[1]?.rect.x ?? 0).toBeGreaterThan(displayed[0]?.rect.x ?? 0)
  })
})

// --------------------------------------------------------------- loader

describe('buildTrialSetup', () => {
  it('ghép bài + kế hoạch lượt thành TrialSetup', () => {
    const parsed = parseExerciseFile(cog01())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const built = buildTrialSetup({
      exercise: parsed.value,
      planned: {
        trialIndex: 2,
        exerciseId: parsed.value.id,
        targetItemId: TARGET,
        distractorItemIds: [DISTRACTOR],
        targetSlot: 0,
        isNewItem: true,
        waitBeforeCueMs: 5000,
      },
      items: [
        { itemId: TARGET, itemKey: 'animal.dog' },
        { itemId: DISTRACTOR, itemKey: 'animal.cat' },
      ],
      context: {
        childId: 'child-1',
        sessionId: 'session-1',
        roundIndex: 0,
        date: '2026-10-24',
        weekStart: '2026-10-19',
        schedulerId: 'simple@1',
        startedAt: 1_700_000_000_000,
      },
      viewport: VIEWPORT,
    })

    expect(built.trialIndex).toBe(2)
    expect(built.targetItemKey).toBe('animal.dog')
    expect(built.detectorKind).toBe('touch_choice')
    expect(built.timing.waitBeforeCueMs).toBe(5000)
    expect(built.timing.rewardMaxMs).toBe(1200)
    expect(built.cue).toEqual({ kind: 'raise_correct', repeatInstruction: true })
    expect(built.displayed).toHaveLength(2)
  })

  it('ghi đè của ba mẹ thắng giá trị trong JSON bài (06 §1)', () => {
    const parsed = parseExerciseFile(cog01())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const timing = effectiveTiming(
      parsed.value.config,
      { waitBeforeCueMsOverride: 8000, afterCueTimeoutMsOverride: 20000 },
      5000,
    )
    expect(timing.waitBeforeCueMs).toBe(8000)
    expect(timing.afterCueTimeoutMs).toBe(20000)
  })
})

// --------------------------------------------------------------- trialMachine

describe('trialMachine', () => {
  it('chạm đúng ngay lần đầu → independent + correctFirstTry', () => {
    const { state, effects } = run(setup(), [
      ...OPENING,
      { type: 'touch', tMs: 2000, x: 200, y: 300, itemId: TARGET },
      { type: 'reward_done', tMs: 3200 },
    ])

    expect(state.phase).toBe('done')
    const trial = state.result
    expect(trial).not.toBeNull()
    if (!trial) return

    expect(trial.correctFirstTry).toBe(true)
    expect(trial.promptLevelAuto).toBe('independent')
    expect(trial.promptLevel).toBe('independent')
    expect(trial.promptLevelSource).toBe('auto')
    expect(trial.appCue).toBeUndefined()
    expect(trial.parked).toBe(false)
    expect(trial.firstChoice).toEqual({ itemId: TARGET, slot: 0, tMs: 2000, latencyMs: 800 })
    expect(trial.completedAtMs).toBe(2000)
    expect(trial.completedLatencyMs).toBe(800)
    expect(trial.instructionStartMs).toBe(320)
    expect(trial.instructionEndMs).toBe(1200)
    expect(trial.touches).toHaveLength(1)
    expect(trial.touches[0]?.counted).toBe(true)
    expect(trial.touches[0]?.phase).toBe('waiting')
    expect(trial.valid).toBe(true)
    expect(trial.viewport).toEqual(VIEWPORT)
    expect(trial.schedulerId).toBe('simple@1')
    expect(trial.displayed).toEqual(DISPLAYED)

    // Không hề có gợi ý nào.
    expect(effects.some((e) => e.type === 'cue')).toBe(false)
  })

  it('chọn sai rồi chọn đúng → gesture, không âm báo sai', () => {
    const { state, effects } = run(setup(), [
      ...OPENING,
      { type: 'touch', tMs: 2500, x: 700, y: 300, itemId: DISTRACTOR },
      { type: 'cue_done', tMs: 3600 },
      { type: 'touch', tMs: 5000, x: 200, y: 300, itemId: TARGET },
      { type: 'reward_done', tMs: 6200 },
    ])

    const trial = state.result
    expect(trial).not.toBeNull()
    if (!trial) return

    expect(trial.correctFirstTry).toBe(false)
    expect(trial.promptLevelAuto).toBe('gesture')
    expect(trial.promptLevel).toBe('gesture')
    expect(trial.appCue).toEqual({ reason: 'wrong_choice', atMs: 2500 })
    expect(trial.parked).toBe(false)
    // Lựa chọn đầu được tính vẫn là hình sai (ghi lại đúng sự thật).
    expect(trial.firstChoice).toEqual({ itemId: DISTRACTOR, slot: 1, tMs: 2500, latencyMs: 1300 })
    expect(trial.completedAtMs).toBe(5000)
    expect(trial.touches.map((t) => t.itemId)).toEqual([DISTRACTOR, TARGET])

    // Hiệu ứng khi chạm sai: chỉ hủy đếm + nổi hình đúng + lặp câu lệnh. Không có âm "sai".
    const atWrong = trialReducer(
      run(setup(), OPENING).state,
      { type: 'touch', tMs: 2500, x: 700, y: 300, itemId: DISTRACTOR },
    )
    expect(atWrong.phase).toBe('cueing')
    expect(atWrong.effects.map((e) => e.type)).toEqual(['cancel', 'cue', 'play_instruction'])
    expect(atWrong.effects.some((e) => e.type === 'reward')).toBe(false)

    // Chỉ phát 2 lần câu lệnh (lần đầu + lặp 1 lần khi gợi ý).
    const instructions = effects.filter((e) => e.type === 'play_instruction')
    expect(instructions).toHaveLength(2)
    expect(instructions[1]).toEqual({ type: 'play_instruction', repeat: true })
  })

  it('hết waitBeforeCueMs → appCue.reason = timeout', () => {
    const { state } = run(setup(), [
      ...OPENING,
      { type: 'wait_timeout', tMs: 6200 },
      { type: 'cue_done', tMs: 7300 },
      { type: 'touch', tMs: 9000, x: 200, y: 300, itemId: TARGET },
      { type: 'reward_done', tMs: 10_200 },
    ])

    const trial = state.result
    expect(trial).not.toBeNull()
    if (!trial) return
    expect(trial.appCue).toEqual({ reason: 'timeout', atMs: 6200 })
    expect(trial.promptLevelAuto).toBe('gesture')
    expect(trial.correctFirstTry).toBe(false)
    expect(trial.firstChoice?.itemId).toBe(TARGET)
    expect(trial.parked).toBe(false)
  })

  it('chạm khi câu lệnh chưa phát xong: ghi lại nhưng không tính', () => {
    const early = run(setup(), [
      { type: 'shown', tMs: 300 },
      { type: 'instruction_started', tMs: 320 },
      { type: 'touch', tMs: 600, x: 700, y: 300, itemId: DISTRACTOR },
      { type: 'instruction_ended', tMs: 1200 },
    ])

    expect(early.state.phase).toBe('waiting')
    expect(early.state.firstChoice).toBeNull()
    expect(early.state.appCue).toBeNull()
    const touch = early.state.touches[0]
    expect(touch?.phase).toBe('before_audio_end')
    expect(touch?.counted).toBe(false)

    // Chạm trong 150 ms đầu / ngón thứ hai: detector báo counted=false.
    const ignored = run(early.state, [
      { type: 'touch', tMs: 1300, x: 700, y: 300, itemId: DISTRACTOR, counted: false },
    ])
    expect(ignored.state.phase).toBe('waiting')
    expect(ignored.state.firstChoice).toBeNull()
    expect(ignored.state.touches[1]?.counted).toBe(false)

    // Lựa chọn đầu được tính là lần chạm sau khi câu lệnh phát xong.
    const done = run(ignored.state, [
      { type: 'touch', tMs: 2400, x: 200, y: 300, itemId: TARGET },
      { type: 'reward_done', tMs: 3600 },
    ])
    expect(done.state.result?.correctFirstTry).toBe(true)
    expect(done.state.result?.firstChoice?.tMs).toBe(2400)
    expect(done.state.result?.touches).toHaveLength(3)
  })

  it('quá afterCueTimeoutMs → parked, hoàn toàn im lặng', () => {
    const toParked = run(setup(), [
      ...OPENING,
      { type: 'wait_timeout', tMs: 6200 },
      { type: 'cue_done', tMs: 7300 },
      { type: 'after_cue_timeout', tMs: 22_300 },
    ])

    expect(toParked.state.phase).toBe('parked')
    expect(toParked.state.parked).toBe(true)
    expect(toParked.state.result).toBeNull()

    // Từ lúc đỗ lại trở đi: không hiệu ứng nào, đặc biệt là không âm.
    const parkedState = run(setup(), [
      ...OPENING,
      { type: 'wait_timeout', tMs: 6200 },
      { type: 'cue_done', tMs: 7300 },
    ]).state
    const parked = trialReducer(parkedState, { type: 'after_cue_timeout', tMs: 22_300 })
    expect(parked.effects.every((e) => !isAudioEffect(e))).toBe(true)
    expect(parked.effects.map((e) => e.type)).toEqual(['cancel'])

    // Chạm sai khi đã đỗ: vẫn im lặng.
    const stillParked = trialReducer(parked, {
      type: 'touch',
      tMs: 25_000,
      x: 700,
      y: 300,
      itemId: DISTRACTOR,
    })
    expect(stillParked.phase).toBe('parked')
    expect(stillParked.effects).toEqual([])

    // Ba mẹ giúp bé chạm hình đúng → lượt vẫn kết thúc bình thường, parked = true.
    const finished = run(stillParked, [
      { type: 'touch', tMs: 30_000, x: 200, y: 300, itemId: TARGET },
      { type: 'reward_done', tMs: 31_200 },
    ])
    const trial = finished.state.result
    expect(trial).not.toBeNull()
    if (!trial) return
    expect(trial.parked).toBe(true)
    expect(trial.correctFirstTry).toBe(false)
    expect(trial.promptLevelAuto).toBe('gesture')
    expect(trial.completedAtMs).toBe(30_000)
  })

  it('lượt chỉ kết thúc khi chạm hình đúng (học không lỗi)', () => {
    const many = run(setup(), [
      ...OPENING,
      { type: 'touch', tMs: 2000, x: 700, y: 300, itemId: DISTRACTOR },
      { type: 'cue_done', tMs: 3100 },
      { type: 'touch', tMs: 4000, x: 700, y: 300, itemId: DISTRACTOR },
      { type: 'touch', tMs: 5000, x: 700, y: 300, itemId: DISTRACTOR },
      { type: 'touch', tMs: 6000, x: 10, y: 10, itemId: null },
    ])
    expect(many.state.phase).toBe('awaitingAfterCue')
    expect(many.state.result).toBeNull()
    expect(many.state.touches).toHaveLength(4)
    // Chạm ngoài hình không được tính.
    expect(many.state.touches[3]?.counted).toBe(false)
  })

  it('không bao giờ sinh hiệu ứng ngoài sơ đồ khi nhận hành động lạc chỗ', () => {
    const shown = run(setup(), [{ type: 'shown', tMs: 300 }]).state
    const stray = trialReducer(shown, { type: 'reward_done', tMs: 400 })
    expect(stray.phase).toBe('instructing')
    expect(stray.effects).toEqual([])
  })

  it('ba mẹ dừng buổi: hủy mọi bộ đếm, không sinh bản ghi', () => {
    const cancelled = run(setup(), [...OPENING, { type: 'cancel', tMs: 2000 }])
    expect(cancelled.state.phase).toBe('done')
    expect(cancelled.state.result).toBeNull()
    expect(cancelled.state.effects.every((e) => e.type === 'cancel')).toBe(true)
  })

  it('cue kind = none và không lặp câu lệnh thì vào thẳng chờ sau gợi ý', () => {
    const quiet = run(setup({ cue: { kind: 'none', repeatInstruction: false } }), [
      ...OPENING,
      { type: 'wait_timeout', tMs: 6200 },
    ])
    expect(quiet.state.phase).toBe('awaitingAfterCue')
    expect(quiet.state.appCue).toEqual({ reason: 'timeout', atMs: 6200 })
    expect(quiet.state.effects.some((e) => e.type === 'cue')).toBe(false)
    expect(quiet.state.effects.some((e) => isAudioEffect(e))).toBe(false)
  })

  it('đặt hẹn giờ đúng mốc của JSON bài', () => {
    const start = createTrialState(setup())
    expect(start.effects).toEqual([{ type: 'schedule', timer: 'showing', atMs: 300 }])

    const waiting = run(setup(), OPENING).state
    expect(waiting.effects).toEqual([{ type: 'schedule', timer: 'wait_cue', atMs: 6200 }])

    const afterCue = trialReducer(
      trialReducer(waiting, { type: 'wait_timeout', tMs: 6200 }),
      { type: 'cue_done', tMs: 7300 },
    )
    expect(afterCue.effects).toEqual([
      { type: 'schedule', timer: 'after_cue', atMs: 22_300 },
    ])
  })

  it('reducer thuần: cùng đầu vào cho cùng đầu ra, không sửa state cũ', () => {
    const before = run(setup(), OPENING).state
    const snapshot = JSON.stringify(before)
    const a = trialReducer(before, { type: 'touch', tMs: 2000, x: 1, y: 2, itemId: TARGET })
    const b = trialReducer(before, { type: 'touch', tMs: 2000, x: 1, y: 2, itemId: TARGET })
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(before.touches).toHaveLength(0)
  })
})

// --------------------------------------------------------------- detectors

function collect(detector: { subscribe(cb: (r: DetectedResponse) => void): () => void }): DetectedResponse[] {
  const seen: DetectedResponse[] = []
  detector.subscribe((r) => seen.push(r))
  return seen
}

describe('TouchChoiceDetector', () => {
  const config = { acceptOn: 'pointerup', maxMovePx: 24, ignoreFirstMs: 150, hitSlopPx: 24 }

  async function started(): Promise<{ d: TouchChoiceDetector; seen: DetectedResponse[] }> {
    const d = new TouchChoiceDetector()
    const seen = collect(d)
    await d.start({ trialId: 't1', config, signal: new AbortController().signal })
    return { d, seen }
  }

  it('nhận tại pointerup khi cùng hình và dịch chuyển nhỏ', async () => {
    const { d, seen } = await started()
    d.pointerDown({ pointerId: 1, tMs: 800, x: 200, y: 300, targetId: TARGET })
    d.pointerMove({ pointerId: 1, tMs: 830, x: 205, y: 304, targetId: TARGET })
    d.pointerUp({ pointerId: 1, tMs: 860, x: 206, y: 305, targetId: TARGET })

    expect(seen).toHaveLength(1)
    expect(seen[0]?.tMs).toBe(860)
    expect(seen[0]?.targetId).toBe(TARGET)
    expect(seen[0]?.payload?.['counted']).toBe(true)
  })

  it('bỏ chạm trong ignoreFirstMs đầu', async () => {
    const { d, seen } = await started()
    d.pointerDown({ pointerId: 1, tMs: 40, x: 200, y: 300, targetId: TARGET })
    d.pointerUp({ pointerId: 1, tMs: 90, x: 200, y: 300, targetId: TARGET })
    expect(seen[0]?.payload).toMatchObject({ counted: false, reason: 'ignore_first_ms' })
  })

  it('bỏ ngón thứ hai', async () => {
    const { d, seen } = await started()
    d.pointerDown({ pointerId: 1, tMs: 800, x: 200, y: 300, targetId: TARGET })
    d.pointerDown({ pointerId: 2, tMs: 820, x: 700, y: 300, targetId: DISTRACTOR })
    d.pointerUp({ pointerId: 2, tMs: 840, x: 700, y: 300, targetId: DISTRACTOR })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.payload).toMatchObject({ counted: false, reason: 'second_pointer' })

    d.pointerUp({ pointerId: 1, tMs: 900, x: 200, y: 300, targetId: TARGET })
    expect(seen[1]?.payload?.['counted']).toBe(true)
  })

  it('bỏ khi vuốt quá maxMovePx hoặc nhấc tay ngoài hình', async () => {
    const { d, seen } = await started()
    d.pointerDown({ pointerId: 1, tMs: 800, x: 200, y: 300, targetId: TARGET })
    d.pointerMove({ pointerId: 1, tMs: 830, x: 260, y: 300, targetId: TARGET })
    d.pointerUp({ pointerId: 1, tMs: 860, x: 205, y: 300, targetId: TARGET })
    expect(seen[0]?.payload).toMatchObject({ counted: false, reason: 'moved_too_far' })

    d.pointerDown({ pointerId: 3, tMs: 1000, x: 200, y: 300, targetId: TARGET })
    d.pointerUp({ pointerId: 3, tMs: 1040, x: 210, y: 300, targetId: null })
    expect(seen[1]?.payload).toMatchObject({ counted: false, reason: 'off_target' })
  })

  it('pointercancel bỏ hẳn, không phát sự kiện', async () => {
    const { d, seen } = await started()
    d.pointerDown({ pointerId: 1, tMs: 800, x: 200, y: 300, targetId: TARGET })
    d.pointerCancel({ pointerId: 1, tMs: 820 })
    d.pointerUp({ pointerId: 1, tMs: 860, x: 200, y: 300, targetId: TARGET })
    expect(seen).toHaveLength(0)
  })

  it('acceptOn = pointerdown nhận ngay lúc đặt ngón', async () => {
    const d = new TouchChoiceDetector()
    const seen = collect(d)
    await d.start({
      trialId: 't1',
      config: { ...config, acceptOn: 'pointerdown' },
      signal: new AbortController().signal,
    })
    d.pointerDown({ pointerId: 1, tMs: 800, x: 200, y: 300, targetId: TARGET })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.payload?.['counted']).toBe(true)
    d.pointerUp({ pointerId: 1, tMs: 860, x: 200, y: 300, targetId: TARGET })
    expect(seen).toHaveLength(1)
  })

  it('dừng khi AbortSignal bị hủy', async () => {
    const d = new TouchChoiceDetector()
    const seen = collect(d)
    const controller = new AbortController()
    await d.start({ trialId: 't1', config, signal: controller.signal })
    controller.abort()
    d.pointerDown({ pointerId: 1, tMs: 800, x: 200, y: 300, targetId: TARGET })
    d.pointerUp({ pointerId: 1, tMs: 860, x: 200, y: 300, targetId: TARGET })
    expect(seen).toHaveLength(0)
  })
})

describe('ParentConfirmDetector và registry', () => {
  it('phát sự kiện khi ba mẹ xác nhận', async () => {
    const d = new ParentConfirmDetector()
    const seen = collect(d)
    await d.start({ trialId: 't1', config: {}, signal: new AbortController().signal })
    d.confirm({ tMs: 4200, targetId: TARGET })
    expect(seen).toEqual([
      {
        kind: 'parent_confirm',
        tMs: 4200,
        confidence: 1,
        targetId: TARGET,
        payload: { counted: true, source: 'parent' },
      },
    ])
    d.stop()
    d.confirm({ tMs: 5000, targetId: TARGET })
    expect(seen).toHaveLength(1)
  })

  it('registry mặc định có touch_choice và parent_confirm; thêm detector mới không sửa engine', () => {
    expect(detectorRegistry.has('touch_choice')).toBe(true)
    expect(detectorRegistry.has('parent_confirm')).toBe(true)
    expect(detectorRegistry.has('hand_pose')).toBe(false)
    expect(detectorRegistry.create('touch_choice').kind).toBe('touch_choice')

    const custom = createDetectorRegistry()
    expect(() => custom.create('voice_activity')).toThrow()
    custom.register('voice_activity', () => new ParentConfirmDetector())
    expect(custom.has('voice_activity')).toBe(true)
  })
})
