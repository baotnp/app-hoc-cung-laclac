// Hook cho màn lượt của bé: giữ bộ đếm thời gian và gọi âm thanh qua callback do giao diện
// truyền vào (KHÔNG import `@/audio` để máy trạng thái vẫn test được không cần trình duyệt).

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ULID } from '@/data/types'
import type {
  DetectedResponse,
  DetectorRegistry,
  ResponseDetector,
  TouchPayload,
} from './detectors/types'
import { isConfirmSink, isPointerSink } from './detectors/types'
import { detectorRegistry as defaultDetectorRegistry } from './detectors/registry'
import type {
  CueKind,
  RewardPart,
  TrialAction,
  TrialEffect,
  TrialPhase,
  TrialRecord,
  TrialSetup,
  TrialState,
  TrialTimer,
} from './trialMachine'
import { createTrialState, trialReducer } from './trialMachine'

export interface TrialAudioCallbacks {
  /** Phát câu lệnh; promise kết thúc khi phát xong (`repeat` = lần lặp lúc gợi ý). */
  playInstruction(opts: { repeat: boolean }): Promise<void> | void
  /** Thưởng lượt: khen bằng giọng ba mẹ + "ting". Không có âm báo sai. */
  playReward?(opts: { parts: RewardPart[]; echoWord: boolean }): Promise<void> | void
}

export interface UseTrialOptions {
  setup: TrialSetup
  audio: TrialAudioCallbacks
  onComplete(trial: TrialRecord): void
  /** Gợi ý hình đúng (nổi lên) — giao diện tự lo hiệu ứng, luôn ≤ 600 ms, không nháy. */
  onCue?(kind: CueKind): void
  detectors?: DetectorRegistry
  /** Đồng hồ ngoài để test; mặc định `Date.now`. */
  now?(): number
}

export interface TrialPointerApi {
  down(e: { pointerId: number; x: number; y: number; targetId: ULID | null }): void
  move(e: { pointerId: number; x: number; y: number; targetId: ULID | null }): void
  up(e: { pointerId: number; x: number; y: number; targetId: ULID | null }): void
  cancel(e: { pointerId: number }): void
}

export interface UseTrialApi {
  state: TrialState
  phase: TrialPhase
  /** Mili giây từ đầu lượt. */
  elapsedMs(): number
  /** Có khi detector nhận chạm (`touch_*`). */
  pointer: TrialPointerApi | null
  /** Ba mẹ xác nhận bé đã chọn đúng (detector `parent_confirm`, hoặc giúp bé ở trạng thái đỗ). */
  confirm(targetId?: ULID): void
  dispatch(action: TrialAction): void
  /** Ba mẹ dừng buổi: hủy lượt, không ghi bản ghi nào. */
  cancel(): void
}

function timerAction(timer: TrialTimer, tMs: number): TrialAction {
  switch (timer) {
    case 'showing':
      return { type: 'shown', tMs }
    case 'wait_cue':
      return { type: 'wait_timeout', tMs }
    case 'after_cue':
      return { type: 'after_cue_timeout', tMs }
    case 'reward':
      return { type: 'reward_done', tMs }
  }
}

export function useTrial(options: UseTrialOptions): UseTrialApi {
  const { setup, audio, onComplete, onCue, detectors, now } = options

  const [state, dispatch] = useReducer(trialReducer, setup, createTrialState)

  const clock = useRef(now ?? Date.now)
  clock.current = now ?? Date.now
  const startRef = useRef<number | null>(null)
  if (startRef.current === null) startRef.current = clock.current()

  const callbacks = useRef({ audio, onComplete, onCue })
  callbacks.current = { audio, onComplete, onCue }

  const timers = useRef(new Map<TrialTimer, ReturnType<typeof setTimeout>>())
  const aliveRef = useRef(true)
  const appliedSeq = useRef(0)
  const setupRef = useRef(setup)
  setupRef.current = setup

  const elapsedMs = useCallback(() => clock.current() - (startRef.current ?? 0), [])

  // ----------------------------------------------------------------- detector
  const registry = detectors ?? defaultDetectorRegistry
  const detector = useMemo<ResponseDetector | null>(() => {
    if (!registry.has(setup.detectorKind)) return null
    return registry.create(setup.detectorKind)
  }, [registry, setup.detectorKind])

  useEffect(() => {
    if (!detector) return
    const current = setupRef.current
    const controller = new AbortController()
    const unsubscribe = detector.subscribe((response: DetectedResponse) => {
      const payload = (response.payload ?? {}) as Partial<TouchPayload>
      dispatch({
        type: 'touch',
        tMs: response.tMs,
        x: typeof payload.x === 'number' ? payload.x : 0,
        y: typeof payload.y === 'number' ? payload.y : 0,
        itemId: response.targetId ?? null,
        counted: payload.counted !== false,
      })
    })
    void detector.start({
      trialId: `${current.sessionId}:${current.roundIndex}:${current.trialIndex}`,
      config: current.detectorConfig ?? {},
      signal: controller.signal,
    })
    return () => {
      unsubscribe()
      controller.abort()
      detector.stop()
    }
  }, [detector])

  // ------------------------------------------------------------------- hiệu ứng
  const runEffect = useCallback(
    (effect: TrialEffect) => {
      const map = timers.current
      switch (effect.type) {
        case 'schedule': {
          clearTimeout(map.get(effect.timer))
          const delay = Math.max(0, effect.atMs - elapsedMs())
          const handle = setTimeout(() => {
            map.delete(effect.timer)
            if (!aliveRef.current) return
            dispatch(timerAction(effect.timer, elapsedMs()))
          }, delay)
          map.set(effect.timer, handle)
          return
        }
        case 'cancel': {
          clearTimeout(map.get(effect.timer))
          map.delete(effect.timer)
          return
        }
        case 'play_instruction': {
          const repeat = effect.repeat
          if (!repeat) dispatch({ type: 'instruction_started', tMs: elapsedMs() })
          void Promise.resolve(callbacks.current.audio.playInstruction({ repeat })).then(
            () => {
              if (!aliveRef.current) return
              dispatch(
                repeat
                  ? { type: 'cue_done', tMs: elapsedMs() }
                  : { type: 'instruction_ended', tMs: elapsedMs() },
              )
            },
            () => {
              // Âm lỗi (bị gián đoạn, chưa mở khóa…): vẫn đi tiếp, không báo lỗi cho bé.
              if (!aliveRef.current) return
              dispatch(
                repeat
                  ? { type: 'cue_done', tMs: elapsedMs() }
                  : { type: 'instruction_ended', tMs: elapsedMs() },
              )
            },
          )
          return
        }
        case 'cue':
          callbacks.current.onCue?.(effect.kind)
          return
        case 'reward':
          void Promise.resolve(
            callbacks.current.audio.playReward?.({ parts: effect.parts, echoWord: effect.echoWord }),
          ).catch(() => undefined)
          return
        case 'complete':
          callbacks.current.onComplete(effect.trial)
          return
      }
    },
    [elapsedMs],
  )

  const effects = state.effects
  const effectSeq = state.effectSeq
  useEffect(() => {
    // StrictMode chạy effect hai lần: chỉ áp dụng mỗi bước của máy trạng thái đúng một lần,
    // nếu không câu lệnh sẽ phát đôi.
    if (appliedSeq.current >= effectSeq) return
    appliedSeq.current = effectSeq
    for (const effect of effects) runEffect(effect)
  }, [effectSeq, effects, runEffect])

  useEffect(() => {
    aliveRef.current = true
    const map = timers.current
    return () => {
      aliveRef.current = false
      for (const handle of map.values()) clearTimeout(handle)
      map.clear()
      // Cleanup đã xoá bộ đếm của bước hiện tại. Lùi dấu để lần mount sau đặt lại chúng;
      // nếu không, StrictMode (mount → unmount → mount) làm lượt kẹt ở bước đầu.
      appliedSeq.current = 0
    }
  }, [])

  // --------------------------------------------------------------------- API
  const pointer = useMemo<TrialPointerApi | null>(() => {
    if (!detector || !isPointerSink(detector)) return null
    return {
      down: (e) => detector.pointerDown({ ...e, tMs: elapsedMs() }),
      move: (e) => detector.pointerMove({ ...e, tMs: elapsedMs() }),
      up: (e) => detector.pointerUp({ ...e, tMs: elapsedMs() }),
      cancel: (e) => detector.pointerCancel({ ...e, tMs: elapsedMs() }),
    }
  }, [detector, elapsedMs])

  const confirm = useCallback(
    (targetId?: ULID) => {
      const tMs = elapsedMs()
      const itemId = targetId ?? setup.targetItemId
      if (detector && isConfirmSink(detector)) {
        detector.confirm({ tMs, targetId: itemId })
        return
      }
      dispatch({ type: 'touch', tMs, x: 0, y: 0, itemId, counted: true })
    },
    [detector, elapsedMs, setup.targetItemId],
  )

  const cancel = useCallback(() => {
    dispatch({ type: 'cancel', tMs: elapsedMs() })
  }, [elapsedMs])

  return {
    state,
    phase: state.phase,
    elapsedMs,
    pointer,
    confirm,
    dispatch,
    cancel,
  }
}
