import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChildStage } from '@/ui'
import { LacLac } from '@/mascot/LacLac'

type Step = 'wave' | 'then' | 'yawn' | 'sleep'

const FULL: { step: Step; ms: number }[] = [
  { step: 'wave', ms: 1800 },
  { step: 'then', ms: 2600 },
  { step: 'yawn', ms: 1200 },
  { step: 'sleep', ms: 2000 },
]

const SHORT: { step: Step; ms: number }[] = [
  { step: 'wave', ms: 1400 },
  { step: 'sleep', ms: 1600 },
]

/**
 * S10 + S12 — nghi thức kết thúc (F-11, docs/03 §6).
 * Luôn cùng một trình tự: vẫy tay → hiện lại ô "Sau đó" → ngáp → ngủ.
 * Bản rút gọn dùng khi ba mẹ dừng buổi sớm. Không chữ.
 */
export function Goodbye({
  thenImageUrl,
  reduceMotion,
  short = false,
  onWave,
  onDone,
}: {
  thenImageUrl?: string
  reduceMotion: boolean
  short?: boolean
  onWave?: () => void
  onDone: () => void
}) {
  const steps = short ? SHORT : FULL
  const [index, setIndex] = useState(0)
  const current = steps[index]?.step ?? 'sleep'

  useEffect(() => {
    if (index === 0) onWave?.()
    const item = steps[index]
    if (!item) return
    const id = window.setTimeout(() => {
      if (index + 1 < steps.length) setIndex(index + 1)
      else onDone()
    }, item.ms)
    return () => window.clearTimeout(id)
  }, [index, steps, onDone, onWave])

  const mascotState = current === 'then' ? 'idle' : current

  return (
    <ChildStage mode="calm">
      <motion.div
        animate={{ opacity: current === 'sleep' ? 0.75 : 1 }}
        transition={{ duration: reduceMotion ? 0.2 : 1.2 }}
        style={{
          display: 'grid',
          placeItems: 'center',
          gap: 'var(--space-4)',
          width: '100%',
          height: '100%',
        }}
      >
        <LacLac state={mascotState} size={300} reduceMotion={reduceMotion} />
        {current === 'then' && thenImageUrl ? (
          <img
            className="child-image"
            src={thenImageUrl}
            alt=""
            style={{
              width: '30vw',
              height: '30vh',
              objectFit: 'contain',
              borderRadius: 'var(--radius-card)',
              background: 'var(--bg-soft)',
            }}
          />
        ) : null}
      </motion.div>
    </ChildStage>
  )
}
