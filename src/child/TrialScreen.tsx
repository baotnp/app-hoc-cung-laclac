import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { DisplayedChoice, ULID } from '@/data/types'
import type { TrialRecord, TrialSetup } from '@/engine'
import { useTrial } from '@/engine'
import { ChildStage, StarBoard } from '@/ui'
import { LacLac } from '@/mascot/LacLac'
import type { MascotState } from '@/mascot/states'
import { vi } from '@/i18n/vi'

export interface TrialImages {
  /** itemId -> URL ảnh (object URL từ IndexedDB). */
  urls: Map<ULID, string>
}

export interface TrialAudioPort {
  playInstruction(opts: { repeat: boolean }): Promise<void> | void
  playPraise(): Promise<void> | void
  playStar(index: number): Promise<void> | void
}

/**
 * Câu cho ba mẹ đọc trực tiếp khi vai đó chưa có bản thu (docs/04 §4: giọng luôn là
 * giọng ba mẹ thật). Chỉ truyền vào khi thiếu bản thu; có bản thu thì để trống.
 */
export interface SpokenLines {
  instruction?: string
  praise?: string
}

/** Props dùng chung cho mọi màn một lượt, bất kể loại bài (05 §3). */
export interface TrialScreenProps {
  setup: TrialSetup
  images: TrialImages
  starsLit: number
  starsTotal: number
  reduceMotion: boolean
  audio: TrialAudioPort
  /** Chỉ truyền khi vai âm chưa có bản thu; app hiện câu để ba mẹ đọc trực tiếp. */
  speak?: SpokenLines
  onComplete: (trial: TrialRecord) => void
}

/**
 * S07 — màn một lượt của bé cho bài `choose_from_two` (F-04, F-05, F-07; docs/03 §3).
 * Học không lỗi: chạm hình khác hoặc hết giờ thì hình đúng nổi lên nhẹ,
 * câu lệnh lặp một lần. Không âm báo sai, không đổi màu hình khác, không rung.
 */
export function TrialScreen({
  setup,
  images,
  starsLit,
  starsTotal,
  reduceMotion,
  audio,
  speak,
  onComplete,
}: TrialScreenProps) {
  const [cued, setCued] = useState(false)
  const [mascot, setMascot] = useState<MascotState>('idle')
  // Vai đang cần ba mẹ đọc trực tiếp (nếu có câu cho vai đó).
  const [reading, setReading] = useState<'instruction' | 'praise' | null>(
    speak?.instruction ? 'instruction' : null,
  )
  const cardRefs = useRef(new Map<ULID, HTMLElement>())

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
    onCue: () => setCued(true),
    onComplete: handleComplete,
  })

  const pointerProps = (choice: DisplayedChoice) => {
    const api = trial.pointer
    if (!api) return {}
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

  const sorted = [...setup.displayed].sort((a, b) => a.slot - b.slot)
  const horizontal = setup.viewport.orientation === 'landscape'
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
          // Khi có thẻ nhắc của ba mẹ, thu gọn lề dọc để hai thẻ hình vẫn giữ
          // ≥1/3 diện tích khung nhìn (F-04 AC1).
          padding: readingLine ? '1vh var(--stage-pad)' : 'var(--stage-pad)',
          gap: readingLine ? 'var(--space-1)' : 'var(--space-2)',
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <StarBoard total={starsTotal} lit={starsLit} reduceMotion={reduceMotion} />
        </div>

        {/* `minHeight: 0` để hàng hình co lại nhường chỗ cho thẻ nhắc của ba mẹ;
            nếu không, chiều cao cố định của thẻ hình đẩy thẻ nhắc ra ngoài màn hình. */}
        <div
          style={{
            display: 'flex',
            flexDirection: horizontal ? 'row' : 'column',
            gap: 'var(--card-gap)',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
          }}
        >
          {sorted.map((choice) => {
            const isTarget = choice.itemId === setup.targetItemId
            const highlight = cued && isTarget
            const url = images.urls.get(choice.itemId)
            return (
              <motion.div
                key={choice.itemId}
                ref={(el: HTMLDivElement | null) => {
                  if (el) cardRefs.current.set(choice.itemId, el)
                  else cardRefs.current.delete(choice.itemId)
                }}
                role="button"
                aria-label={choice.itemKey}
                {...pointerProps(choice)}
                animate={{
                  scale: highlight && !reduceMotion ? 1.06 : 1,
                  boxShadow: highlight
                    ? '0 0 0 14px var(--cue-halo)'
                    : '0 0 0 0px rgba(0,0,0,0)',
                }}
                transition={{ duration: reduceMotion ? 0.2 : 0.6, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  width: horizontal ? 'var(--card-w)' : '76vw',
                  // Thẻ hình vẫn giữ ≥1/3 diện tích khung nhìn khi có thẻ nhắc
                  // (44vw × ~66vh ≈ 0,29 … 0,33; kiểm lại nếu đổi chiều cao thẻ nhắc).
                  height: '100%',
                  maxHeight: horizontal ? 'var(--card-h)' : '38vh',
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--bg-soft)',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                  touchAction: 'manipulation',
                }}
              >
                {url ? (
                  <img
                    className="child-image"
                    src={url}
                    alt=""
                    style={{ width: '88%', height: '88%', objectFit: 'contain' }}
                  />
                ) : null}
              </motion.div>
            )
          })}
        </div>

        {/* Lớp của ba mẹ — ngoại lệ chữ duy nhất trên màn của bé (docs/03 §4, docs/04 §2).
            Nằm trong lưới nên không bao giờ chồng lên hai thẻ hình của bé; không nhấp nháy. */}
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

      <div style={{ position: 'absolute', right: '2vw', bottom: '1vh', pointerEvents: 'none' }}>
        <LacLac state={mascot} size={140} reduceMotion={reduceMotion} />
      </div>
    </ChildStage>
  )
}
