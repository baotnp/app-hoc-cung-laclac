// Màn một lượt cho loại bài `coach_demo` (12/18 bài của cô — docs/10 §4).
// Hoạt động diễn ra ngoài đời: iPad chỉ (1) giữ chú ý của bé bằng một hình minh họa lớn
// + linh vật làm động tác liên quan, (2) nhắc ba mẹ đúng câu/đúng bước ở lớp `data-ui="parent"`,
// (3) nhận kết quả do ba mẹ chấm. Không có tín hiệu "sai": không đỏ, không âm báo, không rung.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import type { TrialRecord } from '@/engine'
import { useTrial } from '@/engine'
import { ChildStage, StarBoard } from '@/ui'
import { LacLac } from '@/mascot/LacLac'
import type { MascotState } from '@/mascot/states'
import { vi } from '@/i18n/vi'
import {
  COACH_PARENT_STRIP_PX,
  readCoachDemoParams,
  type CoachMascotCue,
} from '@/engine/games/coachDemo'
import type { TrialScreenProps } from './TrialScreen'

/**
 * Linh vật chỉ có sẵn 'wave' trong `src/mascot/states.ts`. Các động tác còn lại (vỗ tay, đi, bò)
 * được dựng bằng chuyển động bọc NGOÀI `<LacLac>` ở ngay file này, vì không được sửa LacLac.tsx.
 */
const MASCOT_STATE_FOR: Record<CoachMascotCue, MascotState> = {
  wave: 'wave',
  clap: 'nod',
  walk: 'idle',
  crawl: 'idle',
  none: 'idle',
}

/** Bao lâu thì linh vật về tư thế nghỉ sau một lần làm động tác (ms). */
const CUE_MS: Record<CoachMascotCue, number> = {
  wave: 1500,
  clap: 1600,
  walk: 2400,
  crawl: 2600,
  none: 0,
}

export function CoachDemoScreen({
  setup,
  images,
  starsLit,
  starsTotal,
  reduceMotion,
  audio,
  speak,
  onComplete,
}: TrialScreenProps) {
  const params = useMemo(() => readCoachDemoParams(setup.gameData), [setup.gameData])
  const steps = params.parentSteps
  const stepTimerMs = params.showStepTimerMs ?? 0

  const [stepIndex, setStepIndex] = useState(0)
  const [cued, setCued] = useState(false)
  const [mascot, setMascot] = useState<MascotState>('idle')
  const [imageFailed, setImageFailed] = useState(false)
  const [reading, setReading] = useState<'instruction' | 'praise' | null>(
    speak?.instruction ? 'instruction' : null,
  )

  const wrap = useAnimationControls()
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** Linh vật làm động tác của bài đúng một lần (lúc vào lượt và lúc nhắc lại). */
  const playMascotCue = useCallback(() => {
    const cue = params.mascotCue
    setMascot(MASCOT_STATE_FOR[cue])
    // Đối số truyền thẳng vào `start` để framer-motion tự áp kiểu cho keyframes.
    if (!reduceMotion) {
      if (cue === 'clap') {
        void wrap.start({
          scale: [1, 1.06, 1, 1.06, 1],
          transition: { duration: 1.6, ease: 'easeInOut' },
        })
      } else if (cue === 'walk') {
        void wrap.start({
          x: [0, 18, 0, -18, 0],
          y: [0, -6, 0, -6, 0],
          transition: { duration: 2.4, ease: 'easeInOut' },
        })
      } else if (cue === 'crawl') {
        void wrap.start({
          y: [0, 14, 8, 14, 0],
          rotate: [0, 4, 0, -4, 0],
          transition: { duration: 2.6, ease: 'easeInOut' },
        })
      }
    }
    clearTimeout(idleTimer.current)
    if (CUE_MS[cue] > 0) {
      idleTimer.current = setTimeout(() => setMascot('idle'), CUE_MS[cue])
    }
  }, [params.mascotCue, reduceMotion, wrap])

  useEffect(() => {
    playMascotCue()
    return () => {
      clearTimeout(idleTimer.current)
    }
  }, [playMascotCue])

  const playInstruction = useCallback(
    (opts: { repeat: boolean }) => {
      if (speak?.instruction) setReading('instruction')
      return audio.playInstruction(opts)
    },
    [audio, speak],
  )

  const handleComplete = useCallback(
    (trial: TrialRecord) => {
      setCued(false)
      setMascot('idle')
      setReading(null)
      onComplete(trial)
    },
    [onComplete],
  )

  const trial = useTrial({
    setup,
    audio: {
      playInstruction,
      playReward: async () => {
        setMascot('nod')
        setReading(speak?.praise ? 'praise' : null)
        await Promise.all([audio.playPraise(), audio.playStar(starsLit)])
        setMascot('idle')
      },
    },
    // Hết giờ chờ: nhắc nhẹ — linh vật làm lại động tác, câu lệnh lặp một lần. Không phải báo sai.
    onCue: () => {
      setCued(true)
      playMascotCue()
    },
    onComplete: handleComplete,
  })

  const scoring = trial.phase !== 'reward' && trial.phase !== 'done'

  const handleDone = useCallback(() => {
    trial.confirm()
  }, [trial])

  /**
   * "Cần hỗ trợ": ba mẹ đã phải cầm tay/mớm lời. Cho máy ghi nhận có gợi ý trước
   * (`promptLevelAuto` thành 'gesture') rồi mới xác nhận, để bản ghi không tính là tự làm được.
   * Vẫn là một lượt hoàn thành — không có nhánh nào mang nghĩa "sai".
   */
  const handleNeedHelp = useCallback(() => {
    if (trial.phase === 'waiting') {
      trial.dispatch({ type: 'wait_timeout', tMs: trial.elapsedMs() })
    }
    trial.confirm()
  }, [trial])

  const choice = setup.displayed[0]
  const imageUrl = choice ? images.urls.get(choice.itemId) : undefined
  const fallbackUrl =
    !imageUrl && params.activity
      ? `${import.meta.env.BASE_URL}starter/images/object.${params.activity}.svg`
      : undefined
  const shownUrl = imageUrl ?? (imageFailed ? undefined : fallbackUrl)

  const step = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))]
  const readingLine = reading ? speak?.[reading] : undefined
  const readingLabel =
    reading === 'praise' ? vi.session.parentReadsPraise : vi.session.parentReadsInstruction
  // Dòng to: ưu tiên câu ba mẹ phải đọc ngay (chưa có bản thu), nếu không thì câu của bước hiện tại.
  const headline = readingLine ?? step?.label
  const subline = readingLine ? step?.label : step?.detail

  return (
    <ChildStage mode="calm">
      <div
        style={{
          display: 'grid',
          gridTemplateRows: `auto 1fr ${COACH_PARENT_STRIP_PX}px`,
          width: '100%',
          height: '100%',
          padding: '1vh var(--stage-pad) 0',
          gap: 'var(--space-1)',
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <StarBoard total={starsTotal} lit={starsLit} reduceMotion={reduceMotion} />
        </div>

        {/* Vùng của bé: hình minh họa lớn + linh vật. Tuyệt đối không chữ. */}
        <div style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: 0 }}>
          <motion.div
            role="img"
            aria-label={choice?.itemKey ?? ''}
            animate={{
              scale: cued && !reduceMotion ? 1.04 : 1,
              boxShadow: cued ? '0 0 0 18px var(--cue-halo)' : '0 0 0 0px rgba(0,0,0,0)',
            }}
            transition={{ duration: reduceMotion ? 0.2 : 0.6, ease: [0.4, 0, 0.2, 1] }}
            style={{
              width: '100%',
              height: '100%',
              maxWidth: choice ? choice.rect.w : '100%',
              maxHeight: choice ? choice.rect.h : '100%',
              borderRadius: 'var(--radius-card)',
              background: 'var(--bg-soft)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
            }}
          >
            {shownUrl ? (
              <img
                className="child-image"
                src={shownUrl}
                alt=""
                onError={() => setImageFailed(true)}
                style={{ width: '82%', height: '82%', objectFit: 'contain' }}
              />
            ) : null}
          </motion.div>

          <motion.div
            animate={wrap}
            style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none' }}
          >
            <LacLac state={mascot} size={150} reduceMotion={reduceMotion} />
          </motion.div>
        </div>

        {/* Dải của ba mẹ — ngoại lệ chữ duy nhất trên màn của bé (docs/03 §4). */}
        <div
          data-ui="parent"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '8px var(--space-2)',
            background: 'var(--p-surface)',
            borderTop: '1px solid var(--p-border)',
            color: 'var(--p-ink)',
          }}
        >
          <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
            {readingLine ? (
              <span style={{ fontSize: 12, color: 'var(--p-ink-muted)' }}>{readingLabel}</span>
            ) : null}
            <span
              style={{
                fontSize: 22,
                lineHeight: 1.2,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {headline}
            </span>
            {subline ? (
              <span
                style={{
                  fontSize: 14,
                  lineHeight: 1.25,
                  color: 'var(--p-ink-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {subline}
              </span>
            ) : null}

            {/* Các bước: chấm tròn nhỏ, chạm để chuyển bước. */}
            {steps.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {steps.map((s, i) => (
                  <button
                    key={`${i}-${s.label}`}
                    type="button"
                    aria-label={`${vi.session.step} ${i + 1}`}
                    aria-current={i === stepIndex}
                    onClick={() => setStepIndex(i)}
                    style={{
                      width: 18,
                      height: 18,
                      minHeight: 18,
                      padding: 0,
                      borderRadius: '50%',
                      border: '2px solid var(--p-border)',
                      background: i === stepIndex ? 'var(--p-accent)' : 'transparent',
                      borderColor: i === stepIndex ? 'var(--p-accent)' : 'var(--p-border)',
                    }}
                  />
                ))}
                {/* Đếm giờ bước (nếu bài có): thanh chạy đều, hết thì tự sang bước sau. Không tiếng. */}
                {stepTimerMs > 0 && stepIndex < steps.length - 1 ? (
                  <motion.div
                    key={`timer-${stepIndex}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: stepTimerMs / 1000, ease: 'linear' }}
                    onAnimationComplete={() =>
                      setStepIndex((i) => Math.min(i + 1, steps.length - 1))
                    }
                    style={{
                      width: 90,
                      height: 4,
                      borderRadius: 2,
                      transformOrigin: 'left center',
                      background: 'var(--p-accent)',
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Hai nút chấm. Nút thứ hai dùng viền trung tính — không đỏ, không mang nghĩa "sai". */}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="primary" disabled={!scoring} onClick={handleDone}>
              {vi.session.childDidIt}
            </button>
            <button type="button" disabled={!scoring} onClick={handleNeedHelp}>
              {vi.session.needsHelp}
            </button>
          </div>
        </div>
      </div>
    </ChildStage>
  )
}
