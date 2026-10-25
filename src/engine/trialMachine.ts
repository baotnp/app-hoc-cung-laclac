// Máy trạng thái một lượt (03 §3). Reducer **thuần**: không hẹn giờ, không phát âm, không chạm DOM.
// Mọi mốc thời gian do bên ngoài truyền vào (`tMs` tính từ đầu lượt); mọi việc có tác dụng phụ
// được trả ra dưới dạng `TrialEffect` để `useTrial` (hoặc test) thực thi.
//
// Nguyên tắc không đổi:
// - Lượt chỉ kết thúc khi bé chạm hình đúng (học không lỗi).
// - Chạm hình sai: KHÔNG âm báo, KHÔNG đổi màu hình sai — chỉ chuyển sang gợi ý.
// - Hết `afterCueTimeoutMs`: đỗ lại, không tiếng, không chữ, không tính là thất bại.

import type {
  BaseRecord,
  DetectorKind,
  DisplayedChoice,
  EpochMs,
  LocalDate,
  PromptLevel,
  Trial,
  TrialTouch,
  ULID,
  WeekStart,
} from '@/data/types'

// ------------------------------------------------------------------ kiểu dữ liệu

export type TrialPhase =
  | 'showing'
  | 'instructing'
  | 'waiting'
  | 'cueing'
  | 'awaitingAfterCue'
  | 'parked'
  | 'reward'
  | 'done'

export type TrialTimer = 'showing' | 'wait_cue' | 'after_cue' | 'reward'

export type CueKind = 'raise_correct' | 'mascot_point' | 'none'
export type RewardPart = 'mascot_nod' | 'praise_audio' | 'star_ting'

/** Mọi hằng số đến từ JSON bài sau khi áp ưu tiên cấu hình (06 §1) — engine không tự đặt. */
export interface TrialTiming {
  /** Thời gian hai ảnh mờ dần vào (03 §3, 300 ms). */
  showingMs: number
  waitBeforeCueMs: number
  afterCueTimeoutMs: number
  rewardMaxMs: number
}

export interface TrialSetup {
  childId: ULID
  sessionId: ULID
  roundIndex: number
  trialIndex: number
  date: LocalDate
  weekStart: WeekStart

  exerciseId: string
  exerciseCode: string
  configVersion: number

  targetItemId: ULID
  targetItemKey: string
  isNewItem: boolean
  displayed: DisplayedChoice[]
  targetSlot: 0 | 1

  detectorKind: DetectorKind
  /** Phần `response.*` của `ExerciseConfig`, chuyển nguyên vẹn cho detector. */
  detectorConfig?: Record<string, unknown>
  startedAt: EpochMs

  timing: TrialTiming
  cue: { kind: CueKind; repeatInstruction: boolean }
  reward: { perTrial: RewardPart[]; echoWord: boolean }

  viewport: Trial['viewport']
  schedulerId: string
  gameData?: Record<string, unknown>
}

export type TrialEffect =
  | { type: 'schedule'; timer: TrialTimer; atMs: number }
  | { type: 'cancel'; timer: TrialTimer }
  | { type: 'play_instruction'; repeat: boolean }
  | { type: 'cue'; kind: CueKind }
  | { type: 'reward'; parts: RewardPart[]; echoWord: boolean }
  | { type: 'complete'; trial: TrialRecord }

/** Bản ghi lượt do máy sản sinh; repo gắn thêm `BaseRecord` khi lưu. */
export type TrialRecord = Omit<Trial, keyof BaseRecord>

export interface TrialState {
  phase: TrialPhase
  setup: TrialSetup
  instructionStartMs: number | null
  instructionEndMs: number | null
  appCue: { reason: 'wrong_choice' | 'timeout'; atMs: number } | null
  firstChoice: Trial['firstChoice']
  correctFirstTry: boolean
  parked: boolean
  completedAtMs: number | null
  touches: TrialTouch[]
  /** Tác dụng phụ sinh ra bởi hành động vừa rồi (chỉ của bước đó). */
  effects: TrialEffect[]
  /** Tăng sau mỗi bước có hiệu ứng, để giao diện chạy hiệu ứng đúng một lần. */
  effectSeq: number
  result: TrialRecord | null
}

export type TrialAction =
  | { type: 'shown'; tMs: number }
  | { type: 'instruction_started'; tMs: number }
  | { type: 'instruction_ended'; tMs: number }
  | { type: 'touch'; tMs: number; x: number; y: number; itemId: ULID | null; counted?: boolean }
  | { type: 'wait_timeout'; tMs: number }
  | { type: 'cue_done'; tMs: number }
  | { type: 'after_cue_timeout'; tMs: number }
  | { type: 'reward_done'; tMs: number }
  | { type: 'cancel'; tMs: number }

const ALL_TIMERS: TrialTimer[] = ['showing', 'wait_cue', 'after_cue', 'reward']

/** Hiệu ứng có phát ra tiếng (dùng để kiểm "đỗ lại thì im lặng"). */
export function isAudioEffect(effect: TrialEffect): boolean {
  if (effect.type === 'play_instruction') return true
  if (effect.type === 'reward') {
    return effect.parts.includes('praise_audio') || effect.parts.includes('star_ting')
  }
  return false
}

// ----------------------------------------------------------------- khởi tạo

export function createTrialState(setup: TrialSetup): TrialState {
  return {
    phase: 'showing',
    setup,
    instructionStartMs: null,
    instructionEndMs: null,
    appCue: null,
    firstChoice: null,
    correctFirstTry: false,
    parked: false,
    completedAtMs: null,
    touches: [],
    effects: [{ type: 'schedule', timer: 'showing', atMs: setup.timing.showingMs }],
    effectSeq: 1,
    result: null,
  }
}

// ----------------------------------------------------------------- reducer

export function trialReducer(state: TrialState, action: TrialAction): TrialState {
  switch (action.type) {
    case 'shown':
      if (state.phase !== 'showing') return idle(state)
      return next(state, { phase: 'instructing' }, [
        { type: 'cancel', timer: 'showing' },
        { type: 'play_instruction', repeat: false },
      ])

    case 'instruction_started':
      if (state.phase !== 'instructing') return idle(state)
      return next(state, { instructionStartMs: action.tMs }, [])

    case 'instruction_ended': {
      if (state.phase !== 'instructing') return idle(state)
      const startMs = state.instructionStartMs ?? action.tMs
      return next(
        state,
        { phase: 'waiting', instructionStartMs: startMs, instructionEndMs: action.tMs },
        [{ type: 'schedule', timer: 'wait_cue', atMs: action.tMs + state.setup.timing.waitBeforeCueMs }],
      )
    }

    case 'touch':
      return onTouch(state, action)

    case 'wait_timeout':
      if (state.phase !== 'waiting') return idle(state)
      return enterCue(state, action.tMs, 'timeout')

    case 'cue_done':
      if (state.phase !== 'cueing') return idle(state)
      return next(state, { phase: 'awaitingAfterCue' }, [
        {
          type: 'schedule',
          timer: 'after_cue',
          atMs: action.tMs + state.setup.timing.afterCueTimeoutMs,
        },
      ])

    case 'after_cue_timeout':
      if (state.phase !== 'awaitingAfterCue') return idle(state)
      // Đỗ lại: không tiếng, không chữ, không tự tính thất bại (03 §3).
      return next(state, { phase: 'parked', parked: true }, [{ type: 'cancel', timer: 'after_cue' }])

    case 'reward_done':
      if (state.phase !== 'reward') return idle(state)
      return finish(state, action.tMs)

    case 'cancel': {
      if (state.phase === 'done') return idle(state)
      return next(
        state,
        { phase: 'done' },
        ALL_TIMERS.map((timer) => ({ type: 'cancel', timer }) as const),
      )
    }
  }
}

// ----------------------------------------------------------------- nội bộ

function idle(state: TrialState): TrialState {
  return state.effects.length === 0 ? state : { ...state, effects: [] }
}

function next(state: TrialState, patch: Partial<TrialState>, effects: TrialEffect[]): TrialState {
  return {
    ...state,
    ...patch,
    effects,
    effectSeq: effects.length === 0 ? state.effectSeq : state.effectSeq + 1,
  }
}

function touchPhaseOf(phase: TrialPhase): TrialTouch['phase'] {
  if (phase === 'showing' || phase === 'instructing') return 'before_audio_end'
  if (phase === 'waiting') return 'waiting'
  return 'after_cue'
}

function onTouch(
  state: TrialState,
  action: Extract<TrialAction, { type: 'touch' }>,
): TrialState {
  if (state.phase === 'done') return idle(state)

  const phase = touchPhaseOf(state.phase)
  const acceptsChoice =
    state.phase === 'waiting' ||
    state.phase === 'cueing' ||
    state.phase === 'awaitingAfterCue' ||
    state.phase === 'parked'
  // Chạm khi câu lệnh chưa phát xong, ngón thứ hai, trong ignoreFirstMs đầu, hoặc ngoài hình:
  // vẫn ghi lại nhưng không tính là lựa chọn (06 §2.5).
  const counted = action.counted !== false && action.itemId !== null && acceptsChoice

  const touch: TrialTouch = {
    tMs: action.tMs,
    x: action.x,
    y: action.y,
    itemId: action.itemId,
    phase,
    counted,
  }
  const touches = [...state.touches, touch]

  if (!counted) return next(state, { touches }, [])

  const isFirstCounted = state.firstChoice === null
  const firstChoice = isFirstCounted
    ? {
        itemId: action.itemId,
        slot: slotOf(state, action.itemId),
        tMs: action.tMs,
        latencyMs: action.tMs - (state.instructionEndMs ?? 0),
      }
    : state.firstChoice

  if (action.itemId === state.setup.targetItemId) {
    const correctFirstTry = isFirstCounted && state.appCue === null
    return enterReward(state, action.tMs, { touches, firstChoice, correctFirstTry })
  }

  // Chạm hình sai: không âm báo, không đổi màu hình sai — chuyển sang gợi ý (03 §3).
  if (state.phase === 'waiting') {
    return enterCue(state, action.tMs, 'wrong_choice', { touches, firstChoice })
  }
  // Sau gợi ý, chạm hình sai: không phản hồi thêm.
  return next(state, { touches, firstChoice }, [])
}

function slotOf(state: TrialState, itemId: ULID | null): number | null {
  if (itemId === null) return null
  return state.setup.displayed.find((d) => d.itemId === itemId)?.slot ?? null
}

function enterCue(
  state: TrialState,
  tMs: number,
  reason: 'wrong_choice' | 'timeout',
  patch: Partial<TrialState> = {},
): TrialState {
  const { kind, repeatInstruction } = state.setup.cue
  const effects: TrialEffect[] = [{ type: 'cancel', timer: 'wait_cue' }]
  if (kind !== 'none') effects.push({ type: 'cue', kind })
  if (repeatInstruction) effects.push({ type: 'play_instruction', repeat: true })

  const base: Partial<TrialState> = { ...patch, appCue: { reason, atMs: tMs } }
  // Không có gì để chờ (không gợi ý hình, không lặp câu lệnh) thì vào thẳng bước chờ sau gợi ý.
  if (kind === 'none' && !repeatInstruction) {
    return next(state, { ...base, phase: 'awaitingAfterCue' }, [
      ...effects,
      { type: 'schedule', timer: 'after_cue', atMs: tMs + state.setup.timing.afterCueTimeoutMs },
    ])
  }
  return next(state, { ...base, phase: 'cueing' }, effects)
}

function enterReward(state: TrialState, tMs: number, patch: Partial<TrialState>): TrialState {
  const { perTrial, echoWord } = state.setup.reward
  return next(
    state,
    { ...patch, phase: 'reward', completedAtMs: tMs },
    [
      { type: 'cancel', timer: 'wait_cue' },
      { type: 'cancel', timer: 'after_cue' },
      { type: 'reward', parts: perTrial, echoWord },
      { type: 'schedule', timer: 'reward', atMs: tMs + state.setup.timing.rewardMaxMs },
    ],
  )
}

function finish(state: TrialState, tMs: number): TrialState {
  const trial = buildTrialRecord(state, tMs)
  return next(state, { phase: 'done', result: trial }, [
    { type: 'cancel', timer: 'reward' },
    { type: 'complete', trial },
  ])
}

/** 06 §2.5 + §2.5 ghi chú: `promptLevelAuto` = `gesture` khi app đã gợi ý, ngược lại `independent`. */
export function buildTrialRecord(state: TrialState, tMs: number): TrialRecord {
  const { setup } = state
  const instructionStartMs = state.instructionStartMs ?? 0
  const instructionEndMs = state.instructionEndMs ?? instructionStartMs
  const completedAtMs = state.completedAtMs ?? tMs
  const promptLevelAuto: PromptLevel = state.appCue ? 'gesture' : 'independent'

  return {
    childId: setup.childId,
    sessionId: setup.sessionId,
    roundIndex: setup.roundIndex,
    trialIndex: setup.trialIndex,
    date: setup.date,
    weekStart: setup.weekStart,

    exerciseId: setup.exerciseId,
    exerciseCode: setup.exerciseCode,
    configVersion: setup.configVersion,

    targetItemId: setup.targetItemId,
    targetItemKey: setup.targetItemKey,
    isNewItem: setup.isNewItem,
    displayed: setup.displayed,
    targetSlot: setup.targetSlot,

    detectorKind: setup.detectorKind,
    startedAt: setup.startedAt,
    instructionStartMs,
    instructionEndMs,

    firstChoice: state.firstChoice,
    correctFirstTry: state.correctFirstTry,
    ...(state.appCue ? { appCue: state.appCue } : {}),
    parked: state.parked,
    completedAtMs,
    completedLatencyMs: completedAtMs - instructionEndMs,

    promptLevel: promptLevelAuto,
    promptLevelAuto,
    promptLevelSource: 'auto',

    touches: state.touches,
    valid: true,
    ...(setup.gameData ? { gameData: setup.gameData } : {}),

    viewport: setup.viewport,
    schedulerId: setup.schedulerId,
  }
}
