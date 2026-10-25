// Màn tiệc S08 — docs/03 §5 (khung cố định 5–8 giây, mục tiêu 7) + docs/04 §3.
//
// Trình tự:  0–0,5 s  nền chuyển sang tông rộn ràng
//            0,5–2 s  Lạc Lạc nhảy + bong bóng bay lên (+ nhạc do người gọi phát)
//            2–6 s    tối đa 3 con vật vừa học chạy qua, mỗi con kèm tiếng kêu
//            6–7 s    Lạc Lạc vẫy tay
//            7 s      nền trở lại tông yên tĩnh → onDone
//
// Hai công tắc độc lập (docs/03 §5):
//  - reduceMotion: chỉ đổi PHẦN HÌNH (khung tĩnh chuyển mờ, không bong bóng, không hạt).
//  - phần ÂM do người gọi quyết (playMusic / animal.playSound có thể bỏ trống).
// Cấm: nhấp nháy > 2 lần/giây, đỏ chói toàn màn, rung màn hình.

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { LacLac } from '@/mascot/LacLac'
import type { MascotState } from '@/mascot/states'
import { createRng } from '@/lib/random'
import { localDate } from '@/lib/time'
import './PartyScene.css'

export interface PartyAnimal {
  id: string
  /** URL object của ảnh mục (nếu ba mẹ đã thêm ảnh). */
  imageUrl?: string
  /** Người gọi quyết định có phát tiếng hay không ("Tiệc yên lặng"). */
  playSound?: () => void
}

export interface PartySceneProps {
  animals?: PartyAnimal[]
  onDone: () => void
  reduceMotion?: boolean
  /** 'high' = 120 hạt, 'light' = 40 hạt (docs/04 §2). */
  quality?: 'high' | 'light'
  playMusic?: () => void
  /** Hạt giống để biến tấu nhẹ hằng ngày tái lập được (mặc định theo ngày). */
  seed?: number
}

/** Mốc thời gian (ms) — khung cố định, không đổi giữa các ngày. */
const T = {
  jump: 500,
  animalsStart: 2000,
  animalGap: 1000,
  animalRunMs: 1900,
  wave: 6000,
  calmBack: 7000,
  done: 7300,
} as const

const PARTICLES = { high: 120, light: 40 } as const
const MAX_ANIMALS = 3

/** 4 bảng màu bong bóng, xoay vòng theo ngày (docs/03 §5). */
const BUBBLE_PALETTES: readonly (readonly string[])[] = [
  ['var(--sun, #FFD35C)', 'var(--sky, #6EC5E9)', 'var(--mint, #7FD1B9)'],
  ['var(--lilac, #B79CF0)', 'var(--sky, #6EC5E9)', 'var(--sun, #FFD35C)'],
  ['var(--mint, #7FD1B9)', 'var(--coral, #FF8E72)', 'var(--lilac, #B79CF0)'],
  ['var(--coral, #FF8E72)', 'var(--sun, #FFD35C)', 'var(--sky, #6EC5E9)'],
]

type Phase = 'enter' | 'jump' | 'animals' | 'wave' | 'exit'

interface Particle {
  id: number
  leftPct: number
  size: number
  delayMs: number
  durationMs: number
  driftPx: number
  color: string
  opacity: number
}

function buildParticles(count: number, seed: number, palette: readonly string[]): Particle[] {
  const rng = createRng(seed)
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      id: i,
      leftPct: rng.next() * 100,
      size: 10 + rng.next() * 26,
      // Trải đều trong 0–3,5 giây: không có nhịp chớp đồng loạt.
      delayMs: rng.next() * 3500,
      durationMs: 2600 + rng.next() * 2200,
      driftPx: (rng.next() - 0.5) * 120,
      color: palette[rng.int(palette.length)] ?? palette[0] ?? 'var(--sun, #FFD35C)',
      opacity: 0.4 + rng.next() * 0.35,
    })
  }
  return out
}

/** Kiểu nội tuyến của một hạt; `--drift` là biến CSS dùng trong keyframes. */
function particleStyle(p: Particle, wScale: number, hScale: number): CSSProperties {
  return {
    left: `${p.leftPct}%`,
    width: p.size * wScale,
    height: p.size * hScale,
    background: p.color,
    opacity: p.opacity,
    animationDelay: `${p.delayMs}ms`,
    animationDuration: `${p.durationMs}ms`,
    '--drift': `${p.driftPx}px`,
  } as CSSProperties
}

function dailySeed(): number {
  const d = localDate()
  let h = 0
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0
  return h
}

export function PartyScene({
  animals = [],
  onDone,
  reduceMotion = false,
  quality = 'high',
  playMusic,
  seed,
}: PartySceneProps) {
  const [phase, setPhase] = useState<Phase>('enter')
  const [visibleAnimals, setVisibleAnimals] = useState<number>(0)

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const playMusicRef = useRef(playMusic)
  playMusicRef.current = playMusic

  const cast = useMemo(() => animals.slice(0, MAX_ANIMALS), [animals])
  const castRef = useRef(cast)
  castRef.current = cast

  const effectiveSeed = useMemo(() => seed ?? dailySeed(), [seed])
  const palette = BUBBLE_PALETTES[effectiveSeed % BUBBLE_PALETTES.length] ?? BUBBLE_PALETTES[0] ?? []

  // ≤ 3 lớp hạt đồng thời (docs/04 §3): bong bóng + giấy màu = 2 lớp.
  const total = PARTICLES[quality]
  const bubbles = useMemo(
    () => (reduceMotion ? [] : buildParticles(Math.round(total * 0.55), effectiveSeed, palette)),
    [reduceMotion, total, effectiveSeed, palette],
  )
  const confetti = useMemo(
    () =>
      reduceMotion ? [] : buildParticles(total - Math.round(total * 0.55), effectiveSeed + 7, palette),
    [reduceMotion, total, effectiveSeed, palette],
  )

  useEffect(() => {
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))

    at(T.jump, () => {
      setPhase('jump')
      playMusicRef.current?.()
    })
    at(T.animalsStart, () => setPhase('animals'))

    castRef.current.forEach((animal, i) => {
      // Khoảng cách giữa hai sự kiện âm ≥ 300 ms (docs/04 §4) — ở đây 1300 ms.
      at(T.animalsStart + i * T.animalGap, () => {
        setVisibleAnimals((n) => Math.max(n, i + 1))
        animal.playSound?.()
      })
    })

    at(T.wave, () => setPhase('wave'))
    at(T.calmBack, () => setPhase('exit'))
    at(T.done, () => onDoneRef.current())

    return () => {
      for (const id of timers) window.clearTimeout(id)
    }
  }, [])

  // 0,5–2 s nhảy; 2–6 s đứng thở trong lúc con vật chạy qua; 6–7 s vẫy tay.
  const mascotState: MascotState =
    phase === 'jump' ? 'jump' : phase === 'wave' ? 'wave' : 'idle'

  const festive = phase !== 'exit'

  return (
    <div
      className="party"
      data-mode={festive ? 'festive' : 'calm'}
      data-phase={phase}
      data-reduced={reduceMotion ? 'true' : 'false'}
      aria-hidden="true"
    >
      {/* Nền chuyển mềm giữa hai tông, không chớp sáng toàn màn */}
      <div className="party__bg" data-festive={festive ? 'true' : 'false'} />

      {!reduceMotion && (
        <>
          <div className="party__layer party__layer--bubbles">
            {bubbles.map((p) => (
              <span key={p.id} className="party__bubble" style={particleStyle(p, 1, 1)} />
            ))}
          </div>
          <div className="party__layer party__layer--confetti">
            {confetti.map((p) => (
              <span key={p.id} className="party__confetti" style={particleStyle(p, 0.5, 0.32)} />
            ))}
          </div>
        </>
      )}

      {/* Các con vật vừa học: chạy qua, hoặc chuyển mờ khi tắt chuyển động */}
      <div className="party__animals">
        <AnimatePresence>
          {cast.slice(0, visibleAnimals).map((animal, i) =>
            reduceMotion ? (
              <motion.div
                key={animal.id}
                className="party__animal"
                style={{ left: `${18 + i * 28}%` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <AnimalFigure animal={animal} index={i} />
              </motion.div>
            ) : (
              <motion.div
                key={animal.id}
                className="party__animal"
                initial={{ x: '-40vw', opacity: 0 }}
                animate={{ x: '110vw', opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: T.animalRunMs / 1000, ease: 'linear' }}
                style={{ bottom: `${16 + i * 7}%` }}
              >
                <AnimalFigure animal={animal} index={i} />
              </motion.div>
            ),
          )}
        </AnimatePresence>
      </div>

      <div className="party__mascot">
        <LacLac state={mascotState} size={240} reduceMotion={reduceMotion} />
      </div>
    </div>
  )
}

/** Ảnh con vật; nếu chưa có ảnh thì chỉ là một khối màu dịu — không chữ. */
function AnimalFigure({ animal, index }: { animal: PartyAnimal; index: number }) {
  const fallback = ['var(--mint, #7FD1B9)', 'var(--sky, #6EC5E9)', 'var(--sun, #FFD35C)']
  if (animal.imageUrl) {
    return <img className="party__animal-img child-image" src={animal.imageUrl} alt="" />
  }
  return (
    <span
      className="party__animal-dot"
      style={{ background: fallback[index % fallback.length] ?? fallback[0] }}
    />
  )
}

export default PartyScene
