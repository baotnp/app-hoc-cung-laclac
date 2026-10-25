import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { ChildStage } from '@/ui'
import { LacLac } from '@/mascot/LacLac'
import { vi } from '@/i18n/vi'

/**
 * Lưới an toàn cho buổi học của bé.
 *
 * Một lỗi trong màn lượt từng làm cả app trắng xóa giữa buổi (bài xếp thẻ nhận thiếu
 * thẻ). Với bé, màn trắng là hỏng hoàn toàn: không có gì để nhìn, không có gì để chạm,
 * và ba mẹ không biết phải làm gì. Thay vào đó: giữ linh vật trên màn cho bé, và đưa
 * ba mẹ một nút thoát ở lớp `data-ui="parent"`.
 */
export class SessionBoundary extends Component<
  { onExit: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Ghi ra console để ba mẹ chụp lại gửi khi báo lỗi; app không gửi gì ra ngoài.
    console.error('Buổi học gặp lỗi:', error, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <ChildStage mode="calm">
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <LacLac state="idle" size={240} reduceMotion={false} />
        </div>
        <div
          data-ui="parent"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '4vh',
            transform: 'translateX(-50%)',
            display: 'grid',
            justifyItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-2)',
            background: 'var(--p-surface)',
            border: '1px solid var(--p-border)',
            borderRadius: 'var(--radius-chip)',
            color: 'var(--p-ink)',
            maxWidth: 'min(80vw, 560px)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 16 }}>{vi.session.crashed}</span>
          <button type="button" className="primary" onClick={this.props.onExit}>
            {vi.session.toParent}
          </button>
        </div>
      </ChildStage>
    )
  }
}
