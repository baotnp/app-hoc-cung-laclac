import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Item } from '@/data/types'
import { ChildStage } from '@/ui'
import { LacLac } from '@/mascot/LacLac'

export interface RewardOption {
  item: Item
  imageUrl?: string
}

/**
 * S05 — bé chọn 1 trong 2 phần thưởng thật (F-09, docs/03 §2).
 * Sau 10 giây không chạm: một hình nổi nhẹ. Sau 10 giây nữa: ba mẹ có thể chạm hộ.
 * Không chữ, không âm báo.
 */
export function RewardChoice({
  options,
  reduceMotion,
  onChoose,
}: {
  options: [RewardOption, RewardOption]
  reduceMotion: boolean
  onChoose: (itemId: string, by: 'child' | 'parent') => void
}) {
  const [hintIndex, setHintIndex] = useState<number | null>(null)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    const hint = window.setTimeout(() => setHintIndex(Math.random() < 0.5 ? 0 : 1), 10_000)
    return () => window.clearTimeout(hint)
  }, [])

  const choose = (index: 0 | 1) => {
    const by = Date.now() - startedAt.current > 20_000 ? 'parent' : 'child'
    onChoose(options[index].item.id, by)
  }

  return (
    <ChildStage mode="calm">
      <div
        style={{
          display: 'flex',
          gap: 'var(--card-gap)',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: 'var(--stage-pad)',
        }}
      >
        {options.map((opt, i) => (
          <motion.button
            key={opt.item.id}
            type="button"
            aria-label={opt.item.label}
            onPointerUp={() => choose(i as 0 | 1)}
            animate={
              reduceMotion || hintIndex !== i ? { scale: 1 } : { scale: [1, 1.06, 1] }
            }
            transition={{ duration: 0.6, repeat: hintIndex === i ? Infinity : 0, repeatDelay: 2 }}
            style={{
              all: 'unset',
              cursor: 'pointer',
              width: 'var(--card-w)',
              height: 'var(--card-h)',
              borderRadius: 'var(--radius-card)',
              background: 'var(--bg-soft)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
            }}
          >
            {opt.imageUrl ? (
              <img
                className="child-image"
                src={opt.imageUrl}
                alt=""
                style={{ width: '88%', height: '88%', objectFit: 'contain' }}
              />
            ) : (
              <LacLac state="idle" size={180} reduceMotion={reduceMotion} />
            )}
          </motion.button>
        ))}
      </div>
    </ChildStage>
  )
}
