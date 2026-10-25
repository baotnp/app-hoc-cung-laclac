// Hiệu ứng ăn mừng khi bé làm đúng (ba mẹ xin "animation vui nhộn").
//
// Ràng buộc giác quan (04 §1, §3):
//  - Mỗi hạt chỉ hiện ra và mờ đi MỘT lần, không lặp -> không có nhịp nhấp
//    nháy nào vượt 2 lần/giây.
//  - Không chữ, không màu đỏ, không rung; chỉ dùng biến màu đã có trong
//    tokens.css (có giá trị dự phòng vì các biến tiệc chỉ sống trong
//    [data-mode='festive']).
//  - Phủ toàn màn nhưng `pointer-events: none` và độ mờ ≤ 0,9 nên không che
//    hình bé đang nhìn.
//  - reduceMotion: bỏ hết hạt bay, chỉ một lần sáng lên rồi mờ trong 300 ms.

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRng, randomSeed } from "@/lib/random";
import "./Celebration.css";

export type CelebrationLevel = "calm" | "fun";

export interface CelebrationProps {
  /** Đổi từ false -> true là chạy một lượt ăn mừng. */
  run: boolean;
  level?: CelebrationLevel;
  reduceMotion?: boolean;
  onDone?: () => void;
}

/** Số hạt: đủ vui nhưng vẫn thưa để mắt bé theo kịp. */
const FUN_COUNT = 14;
const CALM_COUNT = 3;
/** Hạt nhỏ hơn 28 px: điểm nhấn, không thành vật che. */
const MAX_SIZE_PX = 28;
const MAX_OPACITY = 0.9;

/** Thời lượng một lượt (ms) — khớp với trần 1,6 s của âm ăn mừng. */
export const CELEBRATION_FUN_MS = 1400;
export const CELEBRATION_CALM_MS = 1100;
export const CELEBRATION_REDUCED_MS = 300;

/** Chỉ các biến màu ấm/mát đã có sẵn; không có đỏ. */
const PALETTE = [
  "var(--sun, #FFD35C)",
  "var(--sky, #6EC5E9)",
  "var(--mint, #7FD1B9)",
  "var(--lilac, #B79CF0)",
  "var(--star-on, #DDB65A)",
] as const;

export interface CelebrationParticle {
  id: number;
  shape: "star" | "dot";
  size: number;
  color: string;
  delayMs: number;
  durMs: number;
  /** Ba mốc của đường cong: bung ra, lên tới đỉnh, rồi rơi nhẹ. */
  path: { x: number[]; y: number[] };
  spinDeg: number;
}

/**
 * Dựng danh sách hạt (logic thuần, có hạt giống -> tái lập được).
 * 'fun': bung đều quanh tâm theo đường cong rồi rơi; 'calm': nổi lên chậm.
 */
export function buildCelebrationParticles(
  level: CelebrationLevel,
  seed: number,
): CelebrationParticle[] {
  const rng = createRng(seed);
  const count = level === "fun" ? FUN_COUNT : CALM_COUNT;
  const out: CelebrationParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    const size = (level === "fun" ? 14 : 18) + rng.next() * (MAX_SIZE_PX - 18);
    const color = PALETTE[rng.int(PALETTE.length)] ?? PALETTE[0];
    if (level === "calm") {
      // Ba hạt dàn ngang, trôi lên rồi tan: nhẹ cho buổi học yên tĩnh.
      const x = (i - 1) * (70 + rng.next() * 30);
      out.push({
        id: i,
        shape: "star",
        size,
        color,
        delayMs: i * 120,
        durMs: CELEBRATION_CALM_MS - 200,
        path: { x: [x, x + (rng.next() - 0.5) * 24, x], y: [20, -60, -130] },
        spinDeg: 0,
      });
      continue;
    }
    // Góc trải đều + lệch nhỏ: bung đều quanh tâm, không bị tụ một phía.
    const angle = (i / count) * Math.PI * 2 + (rng.next() - 0.5) * 0.35;
    const dist = 120 + rng.next() * 110;
    const peakX = Math.cos(angle) * dist * 0.62;
    const peakY = Math.sin(angle) * dist * 0.62 - 40;
    out.push({
      id: i,
      shape: i % 3 === 0 ? "dot" : "star",
      size,
      color,
      delayMs: rng.next() * 160,
      durMs: 900 + rng.next() * 300,
      path: {
        x: [0, peakX, Math.cos(angle) * dist],
        // Mốc cuối cộng thêm độ rơi: cong lên rồi rơi nhẹ xuống.
        y: [0, peakY, Math.sin(angle) * dist + 70 + rng.next() * 40],
      },
      spinDeg: (rng.next() - 0.5) * 120,
    });
  }
  return out;
}

/** Tổng thời lượng một lượt theo mức và cờ giảm chuyển động. */
export function celebrationDurationMs(
  level: CelebrationLevel,
  reduceMotion: boolean,
): number {
  if (reduceMotion) return CELEBRATION_REDUCED_MS;
  return level === "fun" ? CELEBRATION_FUN_MS : CELEBRATION_CALM_MS;
}

function particleStyle(p: CelebrationParticle): CSSProperties {
  return { width: p.size, height: p.size, background: p.color };
}

export function Celebration({
  run,
  level = "fun",
  reduceMotion = false,
  onDone,
}: CelebrationProps) {
  const [particles, setParticles] = useState<CelebrationParticle[]>([]);
  const [active, setActive] = useState(false);
  // Giữ onDone trong ref: ba mẹ truyền hàm mới mỗi lần render cũng không
  // làm lượt ăn mừng chạy lại giữa chừng.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!run) {
      setActive(false);
      setParticles([]);
      return;
    }
    setActive(true);
    setParticles(
      reduceMotion ? [] : buildCelebrationParticles(level, randomSeed()),
    );
    const timer = window.setTimeout(
      () => {
        // Tự dọn: không để hạt nào nằm lại trên màn của bé.
        setActive(false);
        setParticles([]);
        doneRef.current?.();
      },
      celebrationDurationMs(level, reduceMotion),
    );
    return () => window.clearTimeout(timer);
  }, [run, level, reduceMotion]);

  if (!active) return null;

  if (reduceMotion) {
    return (
      <div className="celebration" aria-hidden="true">
        <motion.div
          className="celebration__glow"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{
            duration: CELEBRATION_REDUCED_MS / 1000,
            ease: "easeOut",
            times: [0, 0.4, 1],
          }}
        />
      </div>
    );
  }

  return (
    <div className="celebration" aria-hidden="true">
      <div className="celebration__center">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className={`celebration__particle celebration__particle--${p.shape}`}
            style={particleStyle(p)}
            initial={{
              x: p.path.x[0] ?? 0,
              y: p.path.y[0] ?? 0,
              opacity: 0,
              scale: 0.4,
              rotate: 0,
            }}
            animate={{
              x: p.path.x,
              y: p.path.y,
              opacity: [0, MAX_OPACITY, MAX_OPACITY, 0],
              scale: [0.4, 1, 0.92],
              // Đủ 3 mốc như x/y để dùng chung `times`.
              rotate: [0, p.spinDeg * 0.6, p.spinDeg],
            }}
            transition={{
              duration: p.durMs / 1000,
              delay: p.delayMs / 1000,
              ease: "easeOut",
              times: [0, 0.45, 1],
              opacity: {
                duration: p.durMs / 1000,
                times: [0, 0.15, 0.65, 1],
                ease: "easeOut",
              },
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default Celebration;
