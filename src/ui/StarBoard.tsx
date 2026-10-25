// Bảng sao 5 ô (docs/03 §1 màn S07, docs/04 §2).
// Không chữ, không số. Sao chỉ sáng dần theo thứ tự và KHÔNG BAO GIỜ giảm
// (docs/04 §1 nguyên tắc 3 — không phạt, không mất sao).

import { motion } from 'framer-motion'
import { useState } from 'react'
import './StarBoard.css'

export interface StarBoardProps {
  /** Số ô của bảng (mặc định 5 — một "bảng" của docs/01). */
  total?: number
  /** Số ô đã sáng. Nếu prop giảm, bảng vẫn giữ mức cao nhất đã đạt. */
  lit: number
  reduceMotion?: boolean
  className?: string
}

const STAR_PATH =
  'M 12 2.6 L 14.78 8.74 L 21.4 9.52 L 16.5 14.06 L 17.82 20.6 ' +
  'L 12 17.32 L 6.18 20.6 L 7.5 14.06 L 2.6 9.52 L 9.22 8.74 Z'

export function StarBoard({ total = 5, lit, reduceMotion = false, className }: StarBoardProps) {
  // Mức cao nhất đã đạt trong phiên hiển thị này: chỉ tăng (không phạt).
  const [peak, setPeak] = useState(() => Math.max(lit, 0))
  if (lit > peak) setPeak(lit)

  const count = Math.min(Math.max(lit, peak), total)

  return (
    <div className={className ? `starboard ${className}` : 'starboard'} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const on = i < count
        return (
          <motion.svg
            key={i}
            className="starboard__star"
            data-on={on ? 'true' : 'false'}
            viewBox="0 0 24 24"
            preserveAspectRatio="xMidYMid meet"
            focusable="false"
            initial={false}
            animate={{ scale: on ? 1 : 0.86, opacity: on ? 1 : 0.65 }}
            transition={
              reduceMotion
                ? { duration: 0.2, ease: 'easeOut' }
                : { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
            }
          >
            <path d={STAR_PATH} />
          </motion.svg>
        )
      })}
    </div>
  )
}

export default StarBoard
