// Linh vật "Lạc Lạc" — hạt đậu phộng tự thiết kế (docs/04 §7).
// SVG nhiều lớp: body (2 thùy + eo thắt), dots, eyes, mouth, cheeks, armL/armR, legL/legR, shoes.
// Không chữ, không font, không giọng riêng. Không có trạng thái buồn/giận/khóc.
// API giữ nguyên khi đổi sang Rive ở giai đoạn 2: <LacLac state size reduceMotion />

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import './LacLac.css'
import {
  mascotPalette as C,
  mascotStaticVariants,
  mascotTiming,
  mascotVariants,
  type MascotState,
} from './states'

export interface LacLacProps {
  state: MascotState
  /** Chiều rộng tính bằng px; chiều cao = size × 1,4. */
  size?: number
  /** Ba mẹ bật "Tắt chuyển động" → chỉ đổi khung tĩnh, không vòng lặp. */
  reduceMotion?: boolean
  className?: string
}

const VIEW_W = 200
const VIEW_H = 280

/* --- Hình khối (docs/04 §7.1): rộng 140, cao ≈ 200 → tỷ lệ ≈ 1 : 1,43 --- */
const LOWER = { cx: 100, cy: 176, rx: 70, ry: 56 }
const UPPER = { cx: 100, cy: 100, rx: 60, ry: 52 } // đường kính ≈ 86% thùy dưới
// Eo thắt: nửa bề ngang 54,6 ở y=133 → 109/140 ≈ 78% bề ngang (đúng brief).
const WAIST_PATH =
  'M 58 100 C 48 115, 45.4 126, 45.4 133 C 45.4 142, 48 158, 58 170 ' +
  'L 142 170 C 152 158, 154.6 142, 154.6 133 C 154.6 126, 152 115, 142 100 Z'
const WAIST_CREASE = 'M 47 138 C 62 148, 80 151, 100 151 C 120 151, 138 148, 153 138'

const EYE = { rx: 6, ry: 9, cy: 96, dx: 22 } // oval dọc 12 × 18 đơn vị, không lòng trắng
const SHOULDER_Y = 118
const SHOULDER_DX = 50

/** Chấm vỏ đậu, độ đục 7% (brief: 6–8%), không chữ. */
const SHELL_DOTS_LOWER: readonly (readonly [number, number, number])[] = [
  [70, 158, -18],
  [100, 150, 6],
  [130, 158, 18],
  [56, 182, -10],
  [86, 180, 4],
  [114, 180, -4],
  [144, 182, 10],
  [70, 204, 14],
  [100, 208, -6],
  [130, 204, -14],
  [88, 226, 8],
  [112, 226, -8],
]
const SHELL_DOTS_UPPER: readonly (readonly [number, number, number])[] = [
  [78, 62, -16],
  [100, 56, 0],
  [122, 62, 16],
  [58, 86, -8],
  [142, 86, 8],
  [60, 112, -12],
  [140, 112, 12],
]

function ShellDots({ dots }: { dots: readonly (readonly [number, number, number])[] }) {
  return (
    <g data-layer="dots" fill={C.dot} opacity={0.07}>
      {dots.map(([x, y, rot]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={7} ry={4.5} transform={`rotate(${rot} ${x} ${y})`} />
      ))}
    </g>
  )
}

/** Chớp mắt mỗi 4–6 giây (docs/04 §7.3). Tắt khi ngủ/ngáp hoặc khi tắt chuyển động. */
function useBlink(enabled: boolean): boolean {
  const [blinking, setBlinking] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setBlinking(false)
      return
    }
    let openTimer: number | undefined
    let closeTimer: number | undefined
    const { blinkMinMs, blinkMaxMs, blinkMs } = mascotTiming

    const schedule = () => {
      const wait = blinkMinMs + Math.random() * (blinkMaxMs - blinkMinMs)
      closeTimer = window.setTimeout(() => {
        setBlinking(true)
        openTimer = window.setTimeout(() => {
          setBlinking(false)
          schedule()
        }, blinkMs)
      }, wait)
    }
    schedule()
    return () => {
      window.clearTimeout(openTimer)
      window.clearTimeout(closeTimer)
    }
  }, [enabled])

  return blinking
}

export function LacLac({ state, size = 220, reduceMotion = false, className }: LacLacProps) {
  const v = reduceMotion ? mascotStaticVariants : mascotVariants
  const eyesAwake = state !== 'sleep' && state !== 'yawn'
  const blinking = useBlink(!reduceMotion && eyesAwake)

  const arm = (side: 'L' | 'R') => {
    const x = side === 'L' ? SHOULDER_DX : VIEW_W - SHOULDER_DX
    return (
      <g transform={`translate(${x} ${SHOULDER_Y})`}>
        <motion.rect
          data-layer={side === 'L' ? 'armL' : 'armR'}
          x={-9}
          y={-6}
          width={18}
          height={46}
          rx={9}
          fill={C.shellDark}
          variants={side === 'L' ? v.armL : v.armR}
          initial="mount"
          animate={state}
          style={{ transformOrigin: '50% 13%' }}
        />
      </g>
    )
  }

  return (
    <div
      className={className ? `laclac ${className}` : 'laclac'}
      data-state={state}
      style={{ width: size, height: (size * VIEW_H) / VIEW_W }}
    >
      <svg
        className="laclac__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height="100%"
        aria-hidden="true"
        focusable="false"
      >
        {/* Vầng trăng nhỏ cạnh linh vật khi ngủ */}
        <motion.path
          data-layer="moon"
          d="M 170 30 A 18 18 0 1 0 170 66 A 22 22 0 0 0 170 30 Z"
          fill="#E8D9A8"
          variants={v.moon}
          initial="mount"
          animate={state}
        />

        <motion.g
          data-layer="figure"
          variants={v.body}
          initial="mount"
          animate={state}
          style={{ transformOrigin: '50% 100%' }}
        >
          {/* Bóng đổ rất nhẹ trên nền trơn */}
          <ellipse cx={100} cy={262} rx={62} ry={7} fill={C.shellDark} opacity={0.12} />

          {/* Chân + giày */}
          <g data-layer="legs" stroke={C.shellDark} strokeWidth={14} strokeLinecap="round">
            <line data-layer="legL" x1={78} y1={222} x2={76} y2={240} />
            <line data-layer="legR" x1={122} y1={222} x2={124} y2={240} />
          </g>
          <g data-layer="shoes" fill={C.shoe}>
            <ellipse cx={74} cy={248} rx={21} ry={11} />
            <ellipse cx={126} cy={248} rx={21} ry={11} />
          </g>

          {/* Thân: thùy dưới + phần eo thắt */}
          <g data-layer="body">
            <path d={WAIST_PATH} fill={C.shell} />
            <ellipse cx={LOWER.cx} cy={LOWER.cy} rx={LOWER.rx} ry={LOWER.ry} fill={C.shell} />
            <path
              d={WAIST_CREASE}
              fill="none"
              stroke={C.shellDark}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.4}
            />
          </g>
          <ShellDots dots={SHELL_DOTS_LOWER} />

          {/* Đầu = thùy trên + mặt; gật đầu xoay quanh đáy thùy trên */}
          <motion.g
            data-layer="head"
            variants={v.head}
            initial="mount"
            animate={state}
            style={{ transformOrigin: '50% 100%' }}
          >
            <ellipse cx={UPPER.cx} cy={UPPER.cy} rx={UPPER.rx} ry={UPPER.ry} fill={C.shell} />
            <ShellDots dots={SHELL_DOTS_UPPER} />

            <g data-layer="cheeks" fill={C.cheek} opacity={0.55}>
              <ellipse cx={66} cy={115} rx={11} ry={7.5} />
              <ellipse cx={134} cy={115} rx={11} ry={7.5} />
            </g>

            {/* Mắt mở: oval dọc tối + 1 chấm sáng; không lòng trắng */}
            <motion.g data-layer="eyes" variants={v.eyesOpen} initial="mount" animate={state}>
              <motion.g
                data-layer="eyes-blink"
                animate={{ scaleY: blinking ? 0.08 : 1 }}
                transition={{ duration: mascotTiming.blinkMs / 1000, ease: 'easeInOut' }}
                style={{ transformOrigin: '50% 50%' }}
              >
                <ellipse cx={UPPER.cx - EYE.dx} cy={EYE.cy} rx={EYE.rx} ry={EYE.ry} fill={C.ink} />
                <ellipse cx={UPPER.cx + EYE.dx} cy={EYE.cy} rx={EYE.rx} ry={EYE.ry} fill={C.ink} />
                <circle cx={UPPER.cx - EYE.dx - 2} cy={EYE.cy - 4} r={2} fill={C.highlight} />
                <circle cx={UPPER.cx + EYE.dx - 2} cy={EYE.cy - 4} r={2} fill={C.highlight} />
              </motion.g>
            </motion.g>

            {/* Mắt nhắm: hai vòng cung */}
            <motion.g
              data-layer="eyes-closed"
              variants={v.eyesClosed}
              initial="mount"
              animate={state}
              fill="none"
              stroke={C.ink}
              strokeWidth={3.5}
              strokeLinecap="round"
            >
              <path d="M 70 96 Q 78 103 86 96" />
              <path d="M 114 96 Q 122 103 130 96" />
            </motion.g>

            <motion.path
              data-layer="mouth"
              d="M 88 120 Q 100 131 112 120"
              fill="none"
              stroke={C.ink}
              strokeWidth={4.5}
              strokeLinecap="round"
              variants={v.mouthSmile}
              initial="mount"
              animate={state}
            />
            <motion.ellipse
              data-layer="mouth-open"
              cx={100}
              cy={124}
              rx={9}
              ry={11}
              fill={C.ink}
              variants={v.mouthOpen}
              initial="mount"
              animate={state}
              style={{ transformOrigin: '50% 50%' }}
            />
          </motion.g>

          {/* Tay: khớp xoay ở vai */}
          {arm('L')}
          {arm('R')}
        </motion.g>
      </svg>
    </div>
  )
}

export default LacLac
