import { ChildStage, HoldButton } from '@/ui'
import { LacLac } from '@/mascot/LacLac'
import { vi } from '@/i18n/vi'

/**
 * S21 — nông trại. Giai đoạn 1 chỉ dựng route lazy (F-18): màn rỗng, không chữ ở lớp của bé.
 * Giai đoạn 2 sẽ thay bằng react-three-fiber; chunk này nằm riêng nên three.js không
 * vào bundle chính.
 */
export default function FarmScene({ onExit }: { onExit: () => void }) {
  return (
    <ChildStage mode="calm">
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <LacLac state="idle" size={220} />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0 }}>
        <HoldButton
          holdMs={3000}
          className="parent-gate"
          ariaLabel={vi.parent.exitToChild}
          onComplete={onExit}
        >
          <span />
        </HoldButton>
      </div>
    </ChildStage>
  )
}
