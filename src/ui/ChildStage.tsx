// Khung nền chung cho mọi màn của bé (docs/04 §1–2, docs/03 §1).
// Đặt data-mode (calm | festive) để đổi bộ token, nền trơn, tôn trọng safe-area,
// khóa cuộn và cử chỉ hệ thống. Không chữ ở lớp này.

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import './ChildStage.css'

export type StageMode = 'calm' | 'festive'

export interface ChildStageProps {
  mode?: StageMode
  children?: ReactNode
  className?: string
}

export function ChildStage({ mode = 'calm', children, className }: ChildStageProps) {
  // Khóa cuộn toàn trang khi bé đang dùng máy.
  useEffect(() => {
    const root = document.documentElement
    const prevHtml = root.style.overflow
    const prevBody = document.body.style.overflow
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [])

  // Nền của tài liệu đi theo tông hiện tại để không thấy viền lạ khi xoay máy.
  useEffect(() => {
    const root = document.documentElement
    const prev = root.getAttribute('data-mode')
    root.setAttribute('data-mode', mode)
    return () => {
      if (prev === null) root.removeAttribute('data-mode')
      else root.setAttribute('data-mode', prev)
    }
  }, [mode])

  return (
    <div className={className ? `child-stage ${className}` : 'child-stage'} data-mode={mode}>
      {children}
    </div>
  )
}

export default ChildStage
