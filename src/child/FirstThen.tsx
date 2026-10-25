import { useEffect } from 'react'
import { ChildStage } from '@/ui'
import { LacLac } from '@/mascot/LacLac'

/**
 * S06 — bảng "Đầu tiên – Sau đó" (F-09, docs/03 §2).
 * Ô "Đầu tiên" là buổi học (hình linh vật), ô "Sau đó" là phần thưởng bé vừa chọn.
 * Không chữ; mũi tên là hình. Tự chuyển sau khoảng 4 giây.
 */
export function FirstThen({
  thenImageUrl,
  reduceMotion,
  holdMs = 4000,
  onDone,
}: {
  thenImageUrl?: string
  reduceMotion: boolean
  holdMs?: number
  onDone: () => void
}) {
  useEffect(() => {
    const id = window.setTimeout(onDone, holdMs)
    return () => window.clearTimeout(id)
  }, [holdMs, onDone])

  const box: React.CSSProperties = {
    width: '34vw',
    height: '52vh',
    borderRadius: 'var(--radius-card)',
    background: 'var(--bg-soft)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  }

  return (
    <ChildStage mode="calm">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3vw',
          width: '100%',
          height: '100%',
        }}
      >
        <div style={box}>
          <LacLac state="idle" size={200} reduceMotion={reduceMotion} />
        </div>
        <svg width="72" height="48" viewBox="0 0 72 48" aria-hidden="true">
          <path
            d="M4 24h54M44 10l16 14-16 14"
            stroke="var(--ink-child)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.6"
          />
        </svg>
        <div style={box}>
          {thenImageUrl ? (
            <img
              className="child-image"
              src={thenImageUrl}
              alt=""
              style={{ width: '86%', height: '86%', objectFit: 'contain' }}
            />
          ) : null}
        </div>
      </div>
    </ChildStage>
  )
}
