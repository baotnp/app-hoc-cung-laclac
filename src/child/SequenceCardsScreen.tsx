// S07b — màn một lượt cho bài 6 "Tập xếp thẻ tranh thành hàng" (FIN-03, docs/10 §4).
// Bé kéo từng thẻ ở nửa dưới lên hàng ô trống ở nửa trên; xếp đủ hàng là xong lượt.
//
// Học không lỗi: thả hụt ô thì thẻ tự trượt về chỗ cũ, không tiếng, không màu đỏ.
// Hết giờ chờ: ô trống kế tiếp sáng halo vàng và câu lệnh lặp một lần (máy trạng thái lo).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import type { DisplayedChoice, ULID } from '@/data/types'
import type { TrialRecord } from '@/engine'
import { useTrial } from '@/engine'
import type { DetectorRegistry, DetectedResponse, ResponseDetector } from '@/engine/detectors/types'
import { detectorRegistry as defaultDetectorRegistry } from '@/engine/detectors/registry'
import type { DragSlot, TouchDragPayload } from '@/engine/detectors/touchDrag'
import { TouchDragDetector } from '@/engine/detectors/touchDrag'
import {
  readSequenceCardsParams,
  sequenceCardsLayout,
} from '@/engine/games/sequenceCards'
import { ChildStage, StarBoard } from '@/ui'
import { LacLac } from '@/mascot/LacLac'
import type { MascotState } from '@/mascot/states'
import { vi } from '@/i18n/vi'
import type { TrialScreenProps } from './TrialScreen'

/** Thời gian thẻ hút vào ô / trượt về chỗ cũ (ms). Dưới 2 Hz, không giật (docs/04 §2). */
const SNAP_MS = 320
const SNAP_MS_REDUCED = 140

function rectOf(el: HTMLElement): DragSlot['rect'] {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}

export function SequenceCardsScreen({
  setup,
  images,
  starsLit,
  starsTotal,
  reduceMotion,
  audio,
  speak,
  onComplete,
}: TrialScreenProps) {
  const params = useMemo(() => readSequenceCardsParams(setup.gameData), [setup.gameData])
  const layout = useMemo(
    () => sequenceCardsLayout(setup.viewport, params),
    [setup.viewport, params],
  )

  const [cued, setCued] = useState(false)
  const [mascot, setMascot] = useState<MascotState>('idle')
  const [reading, setReading] = useState<'instruction' | 'praise' | null>(
    speak?.instruction ? 'instruction' : null,
  )
  /** `itemId` → ô đã nhận thẻ. Bản sao để vẽ; nguồn sự thật nằm trong detector. */
  const [placed, setPlaced] = useState<ReadonlyMap<ULID, number>>(new Map())
  /** Thẻ đang theo ngón tay và độ lệch so với chỗ xuất phát. */
  const [drag, setDrag] = useState<{ cardId: ULID; dx: number; dy: number } | null>(null)

  const slotEls = useRef<(HTMLDivElement | null)[]>([])
  const dragRef = useRef<{ pointerId: number; cardId: ULID; x0: number; y0: number } | null>(null)

  // Màn tự giữ detector để biết thẻ nào vừa vào ô nào (useTrial chỉ cho dispatch, không cho
  // đọc kết quả chi tiết) và để truyền hình học các ô đo được từ DOM vào detector.
  const detectorRef = useRef<TouchDragDetector | null>(null)
  if (detectorRef.current === null) {
    detectorRef.current = new TouchDragDetector({
      config: { snapPx: params.snapPx },
      completionTargetId: setup.targetItemId,
    })
  }

  const detectors = useMemo<DetectorRegistry>(
    () => ({
      register: () => undefined,
      has: (kind) => kind === 'touch_drag' || defaultDetectorRegistry.has(kind),
      create: (kind): ResponseDetector =>
        kind === 'touch_drag'
          ? (detectorRef.current as TouchDragDetector)
          : defaultDetectorRegistry.create(kind),
    }),
    [],
  )

  useEffect(() => {
    detectorRef.current?.setFallbackConfig({ snapPx: params.snapPx })
    detectorRef.current?.setCompletionTargetId(setup.targetItemId)
  }, [params.snapPx, setup.targetItemId])

  // Lượt mới: xoá hàng cũ ngay cả khi SessionFlow dùng lại cùng một màn (không remount).
  useEffect(() => {
    detectorRef.current?.resetPlacements()
    setPlaced(new Map())
    setDrag(null)
    dragRef.current = null
    setCued(false)
  }, [setup.sessionId, setup.roundIndex, setup.trialIndex])

  // Đo ô đích từ DOM: toạ độ phải cùng hệ với `clientX/clientY` của sự kiện chạm,
  // kể cả khi safe-area hay xoay máy làm bố cục lệch so với tính toán theo khung nhìn.
  useEffect(() => {
    const detector = detectorRef.current
    if (!detector) return
    const measure = () => {
      const slots: DragSlot[] = []
      slotEls.current.forEach((el, index) => {
        if (el) slots.push({ index, rect: rectOf(el) })
      })
      detector.setSlots(slots)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [layout])

  // Nghe chính detector của mình: "ting" + hút thẻ vào ô khi đặt được.
  useEffect(() => {
    const detector = detectorRef.current
    if (!detector) return
    return detector.subscribe((response: DetectedResponse) => {
      const payload = response.payload as TouchDragPayload | undefined
      if (!payload?.cardId || payload.slotIndex === undefined) return
      if (payload.outcome !== 'placed' && payload.outcome !== 'row_complete') return
      const cardId = payload.cardId
      const slotIndex = payload.slotIndex
      setPlaced((prev) => new Map(prev).set(cardId, slotIndex))
      // Thẻ cuối không kêu riêng: bước thưởng của lượt đã có "ting" + lời khen.
      if (payload.outcome === 'placed') {
        void Promise.resolve(audio.playStar(payload.placedCount - 1)).catch(() => undefined)
      }
    })
  }, [audio])

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
    detectors,
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

  const pointerApi = trial.pointer

  const handleDown = (cardId: ULID) => (e: ReactPointerEvent<HTMLDivElement>) => {
    pointerApi?.down({ pointerId: e.pointerId, x: e.clientX, y: e.clientY, targetId: cardId })
    // Thẻ đã vào ô thì khoá: cô dạy "xếp vào" một chiều, không có bước lấy ra.
    if (placed.has(cardId) || dragRef.current !== null) return
    dragRef.current = { pointerId: e.pointerId, cardId, x0: e.clientX, y0: e.clientY }
    setDrag({ cardId, dx: 0, dy: 0 })
    // Safari iOS từng ném ở đây và làm chết thẻ; mất capture vẫn kéo được nhờ
    // pointermove bắn trên chính thẻ (xem src/ui/HoldButton.tsx).
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // bỏ qua: chỉ mất phần bám ngón khi trượt ra ngoài mép thẻ
    }
  }

  const handleMove = (cardId: ULID) => (e: ReactPointerEvent<HTMLDivElement>) => {
    pointerApi?.move({ pointerId: e.pointerId, x: e.clientX, y: e.clientY, targetId: cardId })
    const current = dragRef.current
    if (!current || current.pointerId !== e.pointerId) return
    setDrag({ cardId: current.cardId, dx: e.clientX - current.x0, dy: e.clientY - current.y0 })
  }

  const releaseDrag = (pointerId: number) => {
    if (dragRef.current?.pointerId !== pointerId) return
    dragRef.current = null
    setDrag(null)
  }

  const handleUp = (cardId: ULID) => (e: ReactPointerEvent<HTMLDivElement>) => {
    pointerApi?.up({ pointerId: e.pointerId, x: e.clientX, y: e.clientY, targetId: cardId })
    releaseDrag(e.pointerId)
  }

  const handleCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointerApi?.cancel({ pointerId: e.pointerId })
    releaseDrag(e.pointerId)
  }

  const taken = new Set(placed.values())
  const nextFreeSlot = layout.slots.findIndex((_, index) => !taken.has(index))
  const cards = [...setup.displayed].sort((a, b) => a.slot - b.slot)
  const readingLine = reading ? speak?.[reading] : undefined
  const readingLabel =
    reading === 'praise' ? vi.session.parentReadsPraise : vi.session.parentReadsInstruction
  const snapMs = reduceMotion ? SNAP_MS_REDUCED : SNAP_MS

  const cardOffset = (card: DisplayedChoice) => {
    if (drag?.cardId === card.itemId) return { x: drag.dx, y: drag.dy, dragging: true }
    const slotIndex = placed.get(card.itemId)
    const slot = slotIndex === undefined ? undefined : layout.slots[slotIndex]
    const start = layout.starts[card.slot] ?? card.rect
    if (!slot) return { x: 0, y: 0, dragging: false }
    // Hút vào giữa ô bằng dịch chuyển (không đổi left/top) để chuyển động mượt một mạch.
    return {
      x: slot.x + (slot.w - start.w) / 2 - start.x,
      y: slot.y + (slot.h - start.h) / 2 - start.y,
      dragging: false,
    }
  }

  return (
    <ChildStage mode="calm">
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            top: '2vh',
            left: 0,
            right: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <StarBoard total={starsTotal} lit={starsLit} reduceMotion={reduceMotion} />
        </div>

        {/* Ô đích: viền đứt nhạt, không chữ, không hình — chỉ là chỗ để đặt thẻ vào. */}
        {layout.slots.map((slot, index) => {
          const highlight = cued && index === nextFreeSlot
          return (
            <motion.div
              key={`slot-${index}`}
              ref={(el: HTMLDivElement | null) => {
                slotEls.current[index] = el
              }}
              animate={{
                boxShadow: highlight ? '0 0 0 14px var(--cue-halo)' : '0 0 0 0px rgba(0,0,0,0)',
              }}
              transition={{ duration: reduceMotion ? 0.2 : 0.6, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'absolute',
                left: slot.x,
                top: slot.y,
                width: slot.w,
                height: slot.h,
                borderRadius: 'var(--radius-card)',
                border: '3px dashed var(--star-off)',
                background: 'var(--bg-soft)',
                pointerEvents: 'none',
              }}
            />
          )
        })}

        {cards.map((card) => {
          const start = layout.starts[card.slot] ?? card.rect
          const offset = cardOffset(card)
          const url = images.urls.get(card.itemId)
          const isPlaced = placed.has(card.itemId)
          return (
            <motion.div
              key={card.itemId}
              role="button"
              aria-label={card.itemKey}
              onPointerDown={handleDown(card.itemId)}
              onPointerMove={handleMove(card.itemId)}
              onPointerUp={handleUp(card.itemId)}
              onPointerCancel={handleCancel}
              animate={{
                x: offset.x,
                y: offset.y,
                scale: offset.dragging && !reduceMotion ? 1.04 : 1,
              }}
              transition={
                offset.dragging
                  ? { duration: 0 }
                  : { duration: snapMs / 1000, ease: [0.4, 0, 0.2, 1] }
              }
              style={{
                position: 'absolute',
                left: start.x,
                top: start.y,
                width: start.w,
                height: start.h,
                borderRadius: 'var(--radius-card)',
                background: 'var(--bg-soft)',
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                zIndex: offset.dragging ? 3 : isPlaced ? 1 : 2,
                // Bắt buộc cho iPad: không có dòng này Safari cuộn/zoom thay vì kéo thẻ.
                touchAction: 'none',
              }}
            >
              {url ? (
                <img
                  className="child-image"
                  src={url}
                  alt=""
                  style={{ width: '88%', height: '88%', objectFit: 'contain' }}
                  draggable={false}
                />
              ) : null}
            </motion.div>
          )
        })}

        {/* Lớp của ba mẹ — ngoại lệ chữ duy nhất trên màn của bé (docs/03 §4). */}
        {readingLine ? (
          <div
            data-ui="parent"
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              top: 'calc(2vh + 64px)',
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

        <div style={{ position: 'absolute', right: '2vw', bottom: '1vh', pointerEvents: 'none' }}>
          <LacLac state={mascot} size={140} reduceMotion={reduceMotion} />
        </div>
      </div>
    </ChildStage>
  )
}
