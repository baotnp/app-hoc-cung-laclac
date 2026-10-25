import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import type { TrialRecord } from "@/engine";
import { useTrial } from "@/engine";
import { readSayNameParams } from "@/engine/games/sayName";
import { ChildStage, StarBoard } from "@/ui";
import { LacLac } from "@/mascot/LacLac";
import type { MascotState } from "@/mascot/states";
import { vi } from "@/i18n/vi";
import type { TrialScreenProps } from "./TrialScreen";

/**
 * Màn bài 13 (LAN-01 "Tập gọi tên các con vật nuôi bằng từ đơn").
 * Bé không chạm gì cả: iPad chỉ là tấm tranh lớn ngang tầm mắt.
 * Ba mẹ làm mẫu → hỏi "Con gì đây?" → đợi `waitBeforeCueMs` → mớm lời → chấm bằng hai nút.
 */
export function SayNameScreen({
  setup,
  images,
  starsLit,
  starsTotal,
  reduceMotion,
  audio,
  speak,
  onComplete,
}: TrialScreenProps) {
  const [cued, setCued] = useState(false);
  const [mascot, setMascot] = useState<MascotState>("idle");
  const [reading, setReading] = useState<"instruction" | "praise" | null>(
    speak?.instruction ? "instruction" : null,
  );

  const playInstruction = useCallback(
    (opts: { repeat: boolean }) => {
      if (speak?.instruction) setReading("instruction");
      return audio.playInstruction(opts);
    },
    [audio, speak],
  );

  const handleComplete = useCallback(
    (trial: TrialRecord) => {
      setCued(false);
      setMascot("idle");
      setReading(null);
      onComplete(trial);
    },
    [onComplete],
  );

  const trial = useTrial({
    setup,
    audio: {
      playInstruction,
      playReward: async () => {
        setMascot("nod");
        setReading(speak?.praise ? "praise" : null);
        await Promise.all([audio.playPraise(), audio.playStar(starsLit)]);
        setMascot("idle");
      },
    },
    onCue: () => setCued(true),
    onComplete: handleComplete,
  });

  const choice = [...setup.displayed].sort((a, b) => a.slot - b.slot)[0];
  const url = choice ? images.urls.get(choice.itemId) : undefined;

  const params = readSayNameParams(setup.gameData);
  // Cạnh ô tranh = căn bậc hai của tỷ lệ diện tích, giữ nguyên dáng khung nhìn.
  const imageSide = `${Math.round(Math.sqrt(Math.min(1, params.imageAreaRatio)) * 100)}%`;

  /**
   * "Chưa nói" không phải là tín hiệu sai: lần bấm đầu (khi còn đang chờ) chỉ chuyển sang
   * bước mớm lời — tranh nhích to lên và câu lệnh của ba mẹ phát lại một lần.
   * Bấm lần nữa thì khép lượt lại (ghi nhận có gợi ý) để đi tiếp, không âm báo, không màu đỏ.
   */
  const notYet = () => {
    if (trial.phase === "waiting") {
      trial.dispatch({ type: "wait_timeout", tMs: trial.elapsedMs() });
      return;
    }
    trial.confirm(setup.targetItemId);
  };

  const canScore =
    trial.phase === "waiting" ||
    trial.phase === "cueing" ||
    trial.phase === "awaitingAfterCue" ||
    trial.phase === "parked";

  const readingLine = reading ? speak?.[reading] : undefined;
  const readingLabel =
    reading === "praise"
      ? vi.session.parentReadsPraise
      : vi.session.parentReadsInstruction;

  return (
    <ChildStage mode="calm">
      <div
        style={{
          display: "grid",
          gridTemplateRows: readingLine
            ? "auto 1fr auto auto"
            : "auto 1fr auto",
          width: "100%",
          height: "100%",
          padding: "1vh var(--stage-pad)",
          gap: "var(--space-1)",
        }}
      >
        <div style={{ display: "grid", placeItems: "center" }}>
          <StarBoard
            total={starsTotal}
            lit={starsLit}
            reduceMotion={reduceMotion}
          />
        </div>

        {/* Tranh rất lớn, giữa màn, không nhận chạm — bé chỉ nhìn và nói. */}
        <div style={{ display: "grid", placeItems: "center", minHeight: 0 }}>
          <motion.div
            aria-label={choice?.itemKey ?? ""}
            animate={{ scale: cued && !reduceMotion ? 1.04 : 1 }}
            transition={{
              duration: reduceMotion ? 0.2 : 0.6,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{
              width: `min(${imageSide}, 128vh)`,
              height: imageSide,
              maxHeight: "72vh",
              borderRadius: "var(--radius-card)",
              background: "var(--bg-soft)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            {url ? (
              <img
                className="child-image"
                src={url}
                alt=""
                style={{ width: "92%", height: "92%", objectFit: "contain" }}
              />
            ) : null}
          </motion.div>
        </div>

        {/* Lớp của ba mẹ — ngoại lệ chữ duy nhất trên màn của bé. */}
        {readingLine ? (
          <div
            data-ui="parent"
            style={{
              justifySelf: "center",
              maxWidth: "min(80vw, 760px)",
              padding: "6px var(--space-2)",
              background: "var(--p-surface)",
              border: "1px solid var(--p-border)",
              borderRadius: "var(--radius-chip)",
              color: "var(--p-ink)",
              display: "flex",
              alignItems: "baseline",
              gap: "var(--space-1)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "var(--p-ink-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {readingLabel}
            </span>
            <span style={{ fontSize: 18, lineHeight: 1.25 }}>
              {readingLine}
            </span>
          </div>
        ) : null}
        {/* Hai nút chấm của ba mẹ: nhỏ, sát mép dưới, không cạnh tranh với tranh.
          Không nút nào màu đỏ — "Chưa nói" chỉ là viền nhạt trung tính.
          Nằm trong lưới (không `position: absolute`) để không bao giờ chồng lên thẻ
          câu ba mẹ đọc — đã xảy ra khi hai khối cùng bám mép dưới. */}
        <div
          data-ui="parent"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "6px 10px",
          }}
        >
          <span className="muted" style={{ fontSize: 12 }}>
            {vi.session.waitBeforePrompt}
          </span>
          <button
            type="button"
            className="primary"
            disabled={!canScore}
            onClick={() => trial.confirm(setup.targetItemId)}
            style={{ fontSize: 14, padding: "6px 14px", minHeight: 36 }}
          >
            {vi.session.childSaidIt}
          </button>
          <button
            type="button"
            disabled={!canScore}
            onClick={notYet}
            style={{
              fontSize: 14,
              padding: "6px 14px",
              minHeight: 36,
              background: "transparent",
              border: "1px solid var(--p-border)",
              color: "var(--p-ink-muted)",
            }}
          >
            {vi.session.childNotYet}
          </button>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: "2vw",
          bottom: "6vh",
          pointerEvents: "none",
        }}
      >
        <LacLac state={mascot} size={120} reduceMotion={reduceMotion} />
      </div>
    </ChildStage>
  );
}
