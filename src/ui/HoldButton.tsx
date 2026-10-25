// Nút nhấn giữ có vòng tiến trình.
// Dùng cho: cổng ba mẹ (3 giây, vòng hiện sau 0,5 giây — docs/03 §7.1, docs/04 §5),
// thanh xác nhận trong buổi (0,6 giây) và thao tác xóa dữ liệu (1,5 giây).
// Hủy khi: nhả sớm, có ngón thứ hai, kéo ra ngoài vùng nút.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import './HoldButton.css'

export interface HoldButtonProps {
  /** Thời gian phải giữ, tính bằng ms. */
  holdMs: number
  onComplete: () => void
  /** Vòng tiến trình chỉ hiện sau ngần này ms (mặc định 500). */
  showRingAfterMs?: number
  /** Nhãn cho trình đọc màn hình; không hiển thị thành chữ. */
  ariaLabel?: string
  className?: string
  disabled?: boolean
  children?: ReactNode
}

/** Kéo quá ngần này px thì coi như quệt tay, hủy lượt giữ (docs/04 §5). */
const MOVE_CANCEL_PX = 24

const RING_R = 44
const RING_C = 2 * Math.PI * RING_R

export function HoldButton({
  holdMs,
  onComplete,
  showRingAfterMs = 500,
  ariaLabel,
  className,
  disabled = false,
  children,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0)
  const [ringVisible, setRingVisible] = useState(false)
  const pointerId = useRef<number | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const startedAt = useRef(0)
  const raf = useRef<number | null>(null)
  const doneRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const stop = useCallback(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
    pointerId.current = null
    origin.current = null
    doneRef.current = false
    setProgress(0)
    setRingVisible(false)
  }, [])

  useEffect(() => stop, [stop])

  const tick = useCallback(() => {
    const elapsed = performance.now() - startedAt.current
    const ratio = holdMs > 0 ? Math.min(elapsed / holdMs, 1) : 1
    setProgress(ratio)
    if (elapsed >= showRingAfterMs) setRingVisible(true)
    if (ratio >= 1) {
      if (!doneRef.current) {
        doneRef.current = true
        const fire = onCompleteRef.current
        stop()
        fire()
      }
      return
    }
    raf.current = requestAnimationFrame(tick)
  }, [holdMs, showRingAfterMs, stop])

  const handleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return
    // Ngón thứ hai khi đang giữ: hủy (docs/03 §7.1).
    if (pointerId.current !== null) {
      stop()
      return
    }
    pointerId.current = e.pointerId
    origin.current = { x: e.clientX, y: e.clientY }
    startedAt.current = performance.now()
    doneRef.current = false
    setProgress(0)
    setRingVisible(showRingAfterMs <= 0)
    // Giữ pointer lại: ngón tay rung hoặc trượt sát mép nút không làm mất lượt giữ.
    // Một số trình duyệt ném khi pointerId không còn hoạt động; mất capture không sao.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // vẫn giữ được nhờ ngưỡng dịch chuyển ở handleMove
    }
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
  }

  const handleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== e.pointerId) return
    const from = origin.current
    if (!from) return
    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) stop()
  }

  const handleUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== null && pointerId.current !== e.pointerId) return
    stop()
  }

  const dashoffset = RING_C * (1 - progress)

  return (
    <button
      type="button"
      className={className ? `hold-button ${className}` : 'hold-button'}
      data-holding={pointerId.current !== null ? 'true' : 'false'}
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onLostPointerCapture={handleUp}
      onPointerCancel={handleUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="hold-button__content">{children}</span>
      <svg
        className="hold-button__ring"
        data-visible={ringVisible ? 'true' : 'false'}
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="hold-button__track" cx="50" cy="50" r={RING_R} />
        <circle
          className="hold-button__fill"
          cx="50"
          cy="50"
          r={RING_R}
          strokeDasharray={RING_C}
          strokeDashoffset={dashoffset}
        />
      </svg>
    </button>
  )
}

export default HoldButton
