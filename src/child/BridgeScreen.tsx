import { useEffect, useState } from 'react'
import type { GeneralizationCheck } from '@/data/types'
import { ChildStage, HoldButton } from '@/ui'
import { LacLac } from '@/mascot/LacLac'
import { t, vi } from '@/i18n/vi'

export type BridgeLevel = 2 | 3 | 4
export type BridgeResult = GeneralizationCheck['result']

/**
 * S09 — bước cầu nối (F-10, docs/03 §4).
 * Hai lớp: lớp của bé (linh vật + ảnh mục, KHÔNG chữ) và thanh xác nhận của ba mẹ
 * (`data-ui="parent"`), chỉ hiện sau khi nhấn giữ 0,6 giây.
 */
export function BridgeScreen({
  label,
  instruction,
  readAloud,
  imageUrl,
  guides,
  reduceMotion,
  onSpeak,
  onAnswer,
  onSkip,
}: {
  /** Tên mục để thay `{label}` trong hướng dẫn, ví dụ "con chó". */
  label: string
  /** Câu lệnh ba mẹ đã thu, để thay `{instruction}`. */
  instruction?: string
  /**
   * Câu cầu nối chưa có bản thu: app không phát gì, chỉ hiện để ba mẹ đọc trực tiếp
   * (docs/04 §4 — giọng luôn là giọng ba mẹ thật).
   */
  readAloud?: string
  imageUrl?: string
  guides: Record<'2' | '3' | '4', { guide: string }>
  reduceMotion: boolean
  onSpeak?: () => void
  onAnswer: (level: BridgeLevel, result: BridgeResult) => void
  onSkip: () => void
}) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<BridgeLevel | null>(null)

  useEffect(() => {
    onSpeak?.()
  }, [onSpeak])

  const levelLabels: Record<BridgeLevel, string> = {
    2: vi.session.bridgeLevel2,
    3: vi.session.bridgeLevel3,
    4: vi.session.bridgeLevel4,
  }

  return (
    <ChildStage mode="calm">
      {/* Lớp của bé */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4vw',
          width: '100%',
          height: '100%',
        }}
      >
        <LacLac state="idle" size={240} reduceMotion={reduceMotion} />
        {imageUrl ? (
          <img
            className="child-image"
            src={imageUrl}
            alt=""
            style={{
              width: '36vw',
              height: '48vh',
              objectFit: 'contain',
              borderRadius: 'var(--radius-card)',
              background: 'var(--bg-soft)',
            }}
          />
        ) : null}
      </div>

      {/* Lớp của ba mẹ */}
      {!open ? (
        <>
          {readAloud ? (
            <div
              data-ui="parent"
              style={{
                position: 'absolute',
                left: '2vw',
                bottom: '2vh',
                maxWidth: 'min(58vw, 520px)',
                padding: 'var(--space-2)',
                background: 'var(--p-surface)',
                border: '1px solid var(--p-border)',
                borderRadius: 'var(--radius-chip)',
                color: 'var(--p-ink)',
                display: 'grid',
                gap: 2,
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--p-ink-muted)' }}>
                {vi.session.parentReadsInstruction}
              </span>
              <span style={{ fontSize: 18, lineHeight: 1.3 }}>{readAloud}</span>
            </div>
          ) : null}
          <div style={{ position: 'absolute', right: '2vw', bottom: '2vh' }}>
            <HoldButton
              holdMs={600}
              className="parent-confirm"
              ariaLabel={vi.session.bridgeTitle}
              onComplete={() => setOpen(true)}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 12.5l5 5L20 6.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </HoldButton>
          </div>
        </>
      ) : (
        <div
          data-ui="parent"
          style={{
            position: 'absolute',
            inset: 'auto 0 0 0',
            background: 'var(--p-surface)',
            borderTop: '1px solid var(--p-border)',
            padding: 'var(--space-3)',
            display: 'grid',
            gap: 'var(--space-2)',
            maxHeight: '62vh',
            overflowY: 'auto',
          }}
        >
          <h3 style={{ margin: 0 }}>{vi.session.bridgeTitle}</h3>
          {readAloud ? (
            <p style={{ margin: 0 }}>
              <span className="label">{vi.session.parentReadsInstruction}</span>
              <br />
              {readAloud}
            </p>
          ) : null}
          {level === null ? (
            <>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {([2, 3, 4] as BridgeLevel[]).map((lv) => (
                  <button key={lv} type="button" onClick={() => setLevel(lv)}>
                    {levelLabels[lv]}
                  </button>
                ))}
              </div>
              <button type="button" className="muted" onClick={onSkip}>
                {vi.session.bridgeLater}
              </button>
            </>
          ) : (
            <>
              <p className="muted" style={{ margin: 0 }}>
                {t(guides[String(level) as '2' | '3' | '4']?.guide ?? '', {
                  label,
                  instruction: instruction ?? label,
                })}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => onAnswer(level, 'did_it')}
                >
                  {vi.session.resultDidIt}
                </button>
                <button type="button" onClick={() => onAnswer(level, 'with_help')}>
                  {vi.session.resultWithHelp}
                </button>
                <button type="button" onClick={() => onAnswer(level, 'not_yet')}>
                  {vi.session.resultNotYet}
                </button>
              </div>
              <button type="button" className="muted" onClick={() => setLevel(null)}>
                {vi.parent.back}
              </button>
            </>
          )}
        </div>
      )}
    </ChildStage>
  )
}
