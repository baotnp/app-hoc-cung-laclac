import type { ReactNode } from 'react'
import { vi } from '@/i18n/vi'

export function Shell({
  title,
  onBack,
  children,
}: {
  title: string
  onBack?: (() => void) | undefined
  children: ReactNode
}) {
  return (
    <div
      data-ui="parent"
      style={{
        minHeight: '100%',
        padding: 'var(--space-3)',
        paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}
      >
        {onBack ? (
          <button type="button" onClick={onBack}>
            {vi.parent.back}
          </button>
        ) : null}
        <h1 style={{ margin: 0 }}>{title}</h1>
      </header>
      <div style={{ display: 'grid', gap: 'var(--space-3)', maxWidth: '68ch' }}>{children}</div>
    </div>
  )
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card">
      {title ? <h2 style={{ marginTop: 0 }}>{title}</h2> : null}
      {children}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '4px', marginBottom: 'var(--space-2)' }}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>{children}</div>
  )
}

/** Vòng tròn trung tính cho lịch tuần: đầy = đã luyện, rỗng = chưa (không dấu X, không đỏ). */
export function DayDots({ days }: { days: { date: string; practiced: boolean }[] }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
      {days.map((d) => (
        <span
          key={d.date}
          aria-label={d.date}
          title={d.date}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '2px solid var(--p-border)',
            background: d.practiced ? 'var(--p-accent)' : 'transparent',
          }}
        />
      ))}
    </div>
  )
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>
}
