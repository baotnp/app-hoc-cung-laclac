import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { DisplayedChoice } from '@/data/types'
import type { TrialRecord } from '@/engine'
import { useTrial } from '@/engine'
import { readPeekabooParams } from '@/engine/games/peekaboo'
import { ChildStage, StarBoard } from '@/ui'
import { LacLac } from '@/mascot/LacLac'
import type { MascotState } from '@/mascot/states'
import { vi } from '@/i18n/vi'
import type { TrialScreenProps } from './TrialScreen'

/** Thời gian khăn hé ra rồi về chỗ cũ khi mời bé chạm (gợi ý, không phải báo sai). */
const PEEK_MS = 600

/**
 * Màn bài 1 (IMI-01 "ú òa"): một tấm khăn phủ kín một thẻ hình.
 * Bé chạm khăn → khăn trượt lên, nghiêng nhẹ, lộ hình và phát tiếng "ú òa" của ba mẹ.
 * Không có hình nào để chọn sai nên mọi cú chạm đều dẫn tới niềm vui (học không lỗi).
 */
export function PeekabooScreen({
  setup,
  images,
  starsLit,
  starsTotal,
  reduceMotion,
  audio,
  speak,
  onComplete,
}: TrialScreenProps) {
  const [peeking, setPeeking] = useState(false)
  const [mascot, setMascot] = useState<MascotState>('idle')
  const [reading, setReading] = useState<'instruction' | 'praise' | null>(
    speak?.instruction ? 'instruction' : null,
  )

  const playInstruction = useCallback(
    (opts: { repeat: boolean }) => {
      if (speak?.instruction) setReading('instruction')
      return audio.playInstruction(opts)
    },
    [audio, speak],
  )

  const handleComplete = useCallback(
    (trial: TrialRecord) => {
      setPeeking(false)
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
        // Tiếng "ú òa" là vai `praise` của bài này — dùng đúng cổng âm sẵn có.
        await Promise.all([audio.playPraise(), audio.playStar(starsLit)])
        setMascot('idle')
      },
    },
    onCue: () => setPeeking(true),
    onComplete: handleComplete,
  })

  // Khăn chỉ hé một lúc rồi phủ lại: đây là lời mời, không được giữ hình hở mãi.
  useEffect(() => {
    if (!peeking) return
    const id = setTimeout(() => setPeeking(false), reduceMotion ? PEEK_MS / 2 : PEEK_MS)
    return () => clearTimeout(id)
  }, [peeking, reduceMotion])

  const choice: DisplayedChoice | undefined = [...setup.displayed].sort(
    (a, b) => a.slot - b.slot,
  )[0]
  const url = choice ? images.urls.get(choice.itemId) : undefined

  const params = readPeekabooParams(setup.gameData)

  // Vào phần thưởng nghĩa là bé đã chạm: khăn trượt hẳn lên.
  // `repeatInvite`: xong lượt thì khăn phủ lại, mời bé chơi ú òa lần nữa (bước 3 của cô).
  const revealed =
    trial.phase === 'reward' || (trial.phase === 'done' && !params.repeatInvite)

  const pointerProps = () => {
    const api = trial.pointer
    if (!api || !choice) return {}
    const at = (e: React.PointerEvent) => ({
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      targetId: choice.itemId,
    })
    return {
      onPointerDown: (e: React.PointerEvent) => api.down(at(e)),
      onPointerMove: (e: React.PointerEvent) => api.move(at(e)),
      onPointerUp: (e: React.PointerEvent) => api.up(at(e)),
      onPointerCancel: (e: React.PointerEvent) => api.cancel({ pointerId: e.pointerId }),
    }
  }

  // `hands` (hai bàn tay che mặt) mở sang hai bên; `cloth` (khăn) trượt lên và nghiêng nhẹ.
  const hands = params.cover === 'hands'
  const clothY = hands ? '0%' : revealed ? '-115%' : peeking ? '-18%' : '0%'
  const clothX = hands ? (revealed ? '-110%' : peeking ? '-12%' : '0%') : '0%'
  const clothRotate = hands ? 0 : revealed ? -6 : peeking ? -3 : 0
  const revealMs = reduceMotion ? 200 : params.revealMs

  const readingLine = reading ? speak?.[reading] : undefined
  const readingLabel =
    reading === 'praise' ? vi.session.parentReadsPraise : vi.session.parentReadsInstruction

  return (
    <ChildStage mode="calm">
      <div
        style={{
          display: 'grid',
          gridTemplateRows: readingLine ? 'auto 1fr auto' : 'auto 1fr',
          width: '100%',
          height: '100%',
          padding: readingLine ? '1vh var(--stage-pad)' : 'var(--stage-pad)',
          gap: readingLine ? 'var(--space-1)' : 'var(--space-2)',
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <StarBoard total={starsTotal} lit={starsLit} reduceMotion={reduceMotion} />
        </div>

        <div style={{ display: 'grid', placeItems: 'center', minHeight: 0 }}>
          {/* Thẻ hình + khăn nằm chung một khung: khăn trượt lên trong khung này. */}
          <div
            role="button"
            aria-label={choice?.itemKey ?? ''}
            {...pointerProps()}
            style={{
              position: 'relative',
              width: 'min(76vw, 120vh)',
              height: '100%',
              maxHeight: '72vh',
              borderRadius: 'var(--radius-card)',
              background: 'var(--bg-soft)',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              touchAction: 'manipulation',
            }}
          >
            {url ? (
              <img
                className="child-image"
                src={url}
                alt=""
                style={{ width: '82%', height: '82%', objectFit: 'contain' }}
              />
            ) : null}

            {/* Tấm khăn: màu dịu lấy từ token, bo tròn, không chữ, không hoa văn nhấp nháy. */}
            <motion.div
              aria-hidden
              animate={{ x: clothX, y: clothY, rotate: clothRotate }}
              transition={{ duration: revealMs / 1000, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'var(--radius-card)',
                background: 'var(--star-off)',
                boxShadow: '0 6px 24px rgba(0,0,0,0.10)',
                transformOrigin: '50% 100%',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Lớp của ba mẹ — ngoại lệ chữ duy nhất trên màn của bé. */}
        {readingLine ? (
          <div
            data-ui="parent"
            style={{
              justifySelf: 'center',
              maxWidth: 'min(80vw, 760px)',
              padding: '6px var(--space-2)',
              background: 'var(--p-surface)',
              border: '1px solid var(--p-border)',
              borderRadius: 'var(--radius-chip)',
              color: 'var(--p-ink)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--space-1)',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--p-ink-muted)', whiteSpace: 'nowrap' }}>
              {readingLabel}
            </span>
            <span style={{ fontSize: 18, lineHeight: 1.25 }}>{readingLine}</span>
          </div>
        ) : null}
      </div>

      {/* Lạc Lạc ngồi cạnh khăn, chơi cùng bé. */}
      <div style={{ position: 'absolute', right: '2vw', bottom: '1vh', pointerEvents: 'none' }}>
        <LacLac state={mascot} size={140} reduceMotion={reduceMotion} />
      </div>
    </ChildStage>
  )
}
