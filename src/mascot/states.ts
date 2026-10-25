// Trạng thái + biến đổi chuyển động của linh vật "Lạc Lạc".
// Nguồn: docs/04-design-system.md §3 (ngưỡng chuyển động) và §7 (brief linh vật).
//
// Ngưỡng bắt buộc:
//  - idle: thở ±2% scale, vòng ~3 giây; chớp mắt mỗi 4–6 giây
//  - wake: 0,8 giây   - nod: y 6px / xoay 4°, 0,6 giây, 2 nhịp
//  - jump: scale ≤ 1,12, 0,9 giây     - wave: tay ±25°, 3 vòng, 1,5 giây
//  - yawn: 1,0 giây   - sleep: mắt nhắm, thở chậm vòng 4 giây
// KHÔNG có trạng thái buồn/giận/khóc (docs/01 §5.4).

import type { Transition, Variants } from 'framer-motion'

export type MascotState = 'idle' | 'wake' | 'nod' | 'jump' | 'wave' | 'yawn' | 'sleep'

export const MASCOT_STATES: readonly MascotState[] = [
  'idle',
  'wake',
  'nod',
  'jump',
  'wave',
  'yawn',
  'sleep',
]

/** Bảng màu docs/04 §7.2 — vật nhỏ, HSL S ≤ 66%. */
export const mascotPalette = {
  shell: '#E4CCA6',
  shellDark: '#CFAE7C',
  dot: '#B98F5A',
  shoe: '#6FA8A0',
  cheek: '#E6B8A8',
  ink: '#3A352E',
  highlight: '#FFFFFF',
} as const

/** Thời lượng (giây) theo docs/04 §7.3; PartyScene dùng lại để xếp lịch. */
export const mascotTiming = {
  breatheLoopSec: 3,
  sleepLoopSec: 4,
  wakeSec: 0.8,
  nodSec: 0.6,
  jumpSec: 0.9,
  waveSec: 1.5,
  yawnSec: 1,
  blinkMinMs: 4000,
  blinkMaxMs: 6000,
  blinkMs: 120,
  reducedSec: 0.2,
} as const

/** Tư thế nghỉ của hai tay (độ). Dương = xoay ra ngoài cho tay trái. */
const ARM_REST = 35

const breathe = (sec: number): Transition => ({
  duration: sec,
  repeat: Infinity,
  repeatType: 'loop',
  ease: 'easeInOut',
})

const once = (sec: number, times?: number[]): Transition => ({
  duration: sec,
  ease: 'easeInOut',
  ...(times ? { times } : {}),
})

/** Chuyển mờ 200 ms khi ba mẹ bật "Tắt chuyển động" (docs/04 §3). */
const reduced: Transition = { duration: mascotTiming.reducedSec, ease: 'easeOut' }

const WAVE_TIMES = [0, 0.1, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.9, 1]
const JUMP_TIMES = [0, 0.15, 0.35, 0.6, 0.85, 1]
const NOD_TIMES = [0, 0.25, 0.5, 0.75, 1]

export interface MascotVariantSet {
  body: Variants
  head: Variants
  armL: Variants
  armR: Variants
  eyesOpen: Variants
  eyesClosed: Variants
  mouthSmile: Variants
  mouthOpen: Variants
  moon: Variants
}

/* ===================== Bộ chuyển động đầy đủ ===================== */

const body: Variants = {
  mount: { scaleX: 1, scaleY: 1, y: 0 },
  // Thở ±2%, vòng 3 giây (ngoại lệ duy nhất của trần 0,5 Hz).
  idle: { scaleX: [1, 1.01, 1], scaleY: [1, 1.02, 1], y: 0, transition: breathe(3) },
  wake: {
    scaleX: [1, 0.98, 1.02, 1],
    scaleY: [0.96, 1.06, 0.99, 1],
    y: [6, -4, 1, 0],
    transition: once(mascotTiming.wakeSec),
  },
  nod: { scaleX: [1, 1.01, 1], scaleY: [1, 1.02, 1], y: 0, transition: breathe(3) },
  // Giãn – nén, scale tối đa 1,12 (docs/04 §3).
  jump: {
    scaleX: [1, 1.08, 0.94, 1, 1.04, 1],
    scaleY: [1, 0.9, 1.12, 1, 0.96, 1],
    y: [0, 6, -30, -30, 4, 0],
    transition: once(mascotTiming.jumpSec, JUMP_TIMES),
  },
  wave: { scaleX: [1, 1.01, 1], scaleY: [1, 1.02, 1], y: 0, transition: breathe(3) },
  yawn: {
    scaleX: [1, 0.99, 1],
    scaleY: [1, 1.04, 1],
    y: [0, -3, 0],
    transition: once(mascotTiming.yawnSec),
  },
  // Thở chậm, vòng 4 giây.
  sleep: {
    scaleX: [1, 1.008, 1],
    scaleY: [1, 1.015, 1],
    y: 0,
    transition: breathe(mascotTiming.sleepLoopSec),
  },
}

const head: Variants = {
  mount: { y: 0, rotate: 0 },
  idle: { y: 0, rotate: 0, transition: once(0.3) },
  wake: { y: [2, -3, 0], rotate: [0, -5, 0], transition: once(mascotTiming.wakeSec) },
  // Gật đầu: y 6 px, xoay 4°, 2 nhịp trong 0,6 giây.
  nod: {
    y: [0, 6, 0, 6, 0],
    rotate: [0, 4, 0, 4, 0],
    transition: once(mascotTiming.nodSec, NOD_TIMES),
  },
  jump: { y: [0, 2, -4, -4, 2, 0], rotate: 0, transition: once(mascotTiming.jumpSec, JUMP_TIMES) },
  wave: { y: 0, rotate: [0, -3, 0, -3, 0], transition: once(mascotTiming.waveSec) },
  yawn: { y: [0, -2, -2, 0], rotate: [0, -4, -4, 0], transition: once(mascotTiming.yawnSec) },
  sleep: { y: 2, rotate: 3, transition: once(0.5) },
}

const armL: Variants = {
  mount: { rotate: ARM_REST },
  idle: { rotate: [ARM_REST, ARM_REST - 4, ARM_REST], transition: breathe(3) },
  wake: { rotate: [ARM_REST, 155, 45, ARM_REST], transition: once(mascotTiming.wakeSec) },
  nod: { rotate: ARM_REST, transition: once(0.3) },
  jump: {
    rotate: [ARM_REST, 110, 145, 145, 90, ARM_REST],
    transition: once(mascotTiming.jumpSec, JUMP_TIMES),
  },
  wave: { rotate: [ARM_REST, ARM_REST - 6, ARM_REST], transition: once(mascotTiming.waveSec) },
  yawn: { rotate: [ARM_REST, 70, 70, ARM_REST], transition: once(mascotTiming.yawnSec) },
  sleep: { rotate: 12, transition: once(0.5) },
}

/** Tay vẫy: dao động giữa −165° và −115° → biên độ ±25°, 3 vòng trong 1,5 giây. */
const armR: Variants = {
  mount: { rotate: -ARM_REST },
  idle: { rotate: [-ARM_REST, -ARM_REST + 4, -ARM_REST], transition: breathe(3) },
  wake: { rotate: [-ARM_REST, -155, -45, -ARM_REST], transition: once(mascotTiming.wakeSec) },
  nod: { rotate: -ARM_REST, transition: once(0.3) },
  jump: {
    rotate: [-ARM_REST, -110, -145, -145, -90, -ARM_REST],
    transition: once(mascotTiming.jumpSec, JUMP_TIMES),
  },
  wave: {
    // nghỉ → giơ lên → 3 lần vẫy ra/vào (±25° quanh −140°) → giữ tư thế giơ
    rotate: [-ARM_REST, -140, -165, -115, -165, -115, -165, -115, -165, -140],
    transition: once(mascotTiming.waveSec, WAVE_TIMES),
  },
  yawn: { rotate: [-ARM_REST, -70, -70, -ARM_REST], transition: once(mascotTiming.yawnSec) },
  sleep: { rotate: -12, transition: once(0.5) },
}

const eyesOpen: Variants = {
  mount: { opacity: 1 },
  idle: { opacity: 1, transition: once(0.25) },
  wake: { opacity: [0, 1], transition: once(mascotTiming.wakeSec) },
  nod: { opacity: 1, transition: once(0.25) },
  jump: { opacity: 1, transition: once(0.25) },
  wave: { opacity: 1, transition: once(0.25) },
  // Mắt khép dần ở nửa sau của cái ngáp.
  yawn: { opacity: [1, 1, 0], transition: once(mascotTiming.yawnSec, [0, 0.55, 1]) },
  sleep: { opacity: 0, transition: once(0.4) },
}

const eyesClosed: Variants = {
  mount: { opacity: 0 },
  idle: { opacity: 0, transition: once(0.25) },
  wake: { opacity: [1, 0], transition: once(mascotTiming.wakeSec) },
  nod: { opacity: 0, transition: once(0.25) },
  jump: { opacity: 0, transition: once(0.25) },
  wave: { opacity: 0, transition: once(0.25) },
  yawn: { opacity: [0, 0, 1], transition: once(mascotTiming.yawnSec, [0, 0.55, 1]) },
  sleep: { opacity: 1, transition: once(0.4) },
}

const mouthSmile: Variants = {
  mount: { opacity: 1 },
  idle: { opacity: 1, transition: once(0.25) },
  wake: { opacity: 1, transition: once(0.4) },
  nod: { opacity: 1, transition: once(0.25) },
  jump: { opacity: 0, transition: once(0.2) },
  wave: { opacity: 1, transition: once(0.25) },
  yawn: { opacity: [1, 0, 0, 1], transition: once(mascotTiming.yawnSec, [0, 0.2, 0.8, 1]) },
  sleep: { opacity: 1, transition: once(0.4) },
}

const mouthOpen: Variants = {
  mount: { opacity: 0, scaleY: 1 },
  idle: { opacity: 0, scaleY: 1, transition: once(0.25) },
  wake: { opacity: 0, scaleY: 1, transition: once(0.4) },
  nod: { opacity: 0, scaleY: 1, transition: once(0.25) },
  jump: { opacity: 1, scaleY: 1, transition: once(0.2) },
  wave: { opacity: 0, scaleY: 1, transition: once(0.25) },
  yawn: {
    opacity: [0, 1, 1, 0],
    scaleY: [0.6, 1.25, 1.25, 0.6],
    transition: once(mascotTiming.yawnSec, [0, 0.2, 0.8, 1]),
  },
  sleep: { opacity: 0, scaleY: 1, transition: once(0.4) },
}

/** Vầng trăng nhỏ cạnh linh vật, chỉ ở trạng thái ngủ (docs/04 §7.3). */
const moon: Variants = {
  mount: { opacity: 0 },
  idle: { opacity: 0, transition: once(0.3) },
  wake: { opacity: [1, 0], transition: once(mascotTiming.wakeSec) },
  nod: { opacity: 0, transition: once(0.3) },
  jump: { opacity: 0, transition: once(0.3) },
  wave: { opacity: 0, transition: once(0.3) },
  yawn: { opacity: [0, 0, 1], transition: once(mascotTiming.yawnSec, [0, 0.6, 1]) },
  sleep: { opacity: 1, transition: once(0.6) },
}

export const mascotVariants: MascotVariantSet = {
  body,
  head,
  armL,
  armR,
  eyesOpen,
  eyesClosed,
  mouthSmile,
  mouthOpen,
  moon,
}

/* ============ Bộ khung tĩnh khi "Tắt chuyển động" (docs/04 §3) ============ */
// Không vòng lặp, không keyframe: mỗi trạng thái là một khung tĩnh, chỉ chuyển mờ 200 ms.

const staticBody: Variants = {
  mount: { scaleX: 1, scaleY: 1, y: 0 },
  idle: { scaleX: 1, scaleY: 1, y: 0, transition: reduced },
  wake: { scaleX: 1, scaleY: 1, y: 0, transition: reduced },
  nod: { scaleX: 1, scaleY: 1, y: 0, transition: reduced },
  jump: { scaleX: 1, scaleY: 1.06, y: -14, transition: reduced },
  wave: { scaleX: 1, scaleY: 1, y: 0, transition: reduced },
  yawn: { scaleX: 1, scaleY: 1.02, y: 0, transition: reduced },
  sleep: { scaleX: 1, scaleY: 1, y: 0, transition: reduced },
}

const staticHead: Variants = {
  mount: { y: 0, rotate: 0 },
  idle: { y: 0, rotate: 0, transition: reduced },
  wake: { y: 0, rotate: 0, transition: reduced },
  nod: { y: 6, rotate: 4, transition: reduced },
  jump: { y: -4, rotate: 0, transition: reduced },
  wave: { y: 0, rotate: -3, transition: reduced },
  yawn: { y: -2, rotate: -4, transition: reduced },
  sleep: { y: 2, rotate: 3, transition: reduced },
}

const staticArmL: Variants = {
  mount: { rotate: ARM_REST },
  idle: { rotate: ARM_REST, transition: reduced },
  wake: { rotate: 45, transition: reduced },
  nod: { rotate: ARM_REST, transition: reduced },
  jump: { rotate: 120, transition: reduced },
  wave: { rotate: ARM_REST, transition: reduced },
  yawn: { rotate: 70, transition: reduced },
  sleep: { rotate: 12, transition: reduced },
}

const staticArmR: Variants = {
  mount: { rotate: -ARM_REST },
  idle: { rotate: -ARM_REST, transition: reduced },
  wake: { rotate: -45, transition: reduced },
  nod: { rotate: -ARM_REST, transition: reduced },
  jump: { rotate: -120, transition: reduced },
  wave: { rotate: -140, transition: reduced },
  yawn: { rotate: -70, transition: reduced },
  sleep: { rotate: -12, transition: reduced },
}

const staticOpacity = (on: (s: MascotState) => boolean, mount: number): Variants => {
  const out: Variants = { mount: { opacity: mount } }
  for (const s of MASCOT_STATES) out[s] = { opacity: on(s) ? 1 : 0, transition: reduced }
  return out
}

export const mascotStaticVariants: MascotVariantSet = {
  body: staticBody,
  head: staticHead,
  armL: staticArmL,
  armR: staticArmR,
  eyesOpen: staticOpacity((s) => s !== 'sleep' && s !== 'yawn', 1),
  eyesClosed: staticOpacity((s) => s === 'sleep' || s === 'yawn', 0),
  mouthSmile: staticOpacity((s) => s !== 'jump' && s !== 'yawn', 1),
  mouthOpen: staticOpacity((s) => s === 'jump' || s === 'yawn', 0),
  moon: staticOpacity((s) => s === 'sleep', 0),
}
