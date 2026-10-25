/**
 * Âm ăn mừng khi bé làm đúng (ba mẹ xin "tiếng hoan hô vui nhộn").
 *
 * Tất cả tổng hợp bằng Web Audio: app chạy offline, không tải file nhị phân,
 * và mọi **giọng người** trong app chỉ đến từ bản thu thật của ba mẹ (04 §4)
 * — ở đây chỉ có nhạc cụ và tiếng vỗ tay bằng nhiễu, không có giọng tổng hợp.
 *
 * Bé nhạy cảm âm thanh nên đỉnh của cả cụm được ghim ở −10 dBFS: chỉ hơn
 * "ting" của sao (−12 dBFS) đúng 2 dB, dưới trần +3 dB đã thống nhất.
 *
 * Phần "kế hoạch" (buildCheerPlan…) là logic thuần, không chạm Web Audio,
 * để test được trong jsdom; phần phát chỉ đọc kế hoạch rồi đặt lịch.
 */

import {
  MIN_RAMP_GAIN,
  PEAK_TARGET_TONE_DBFS,
  clampVolume,
  dbToGain,
} from "./normalize";
import { majorArpeggioHz } from "./tones";
import { createRng, randomSeed } from "@/lib/random";
import type { Rng } from "@/lib/random";

// ------------------------------------------------------------------ hằng số

export type CheerLevel = "calm" | "fun";

export interface CheerOptions {
  /** 'calm' = chỉ 3 nốt, nhẹ hơn 6 dB; 'fun' = fanfare + vỗ tay. */
  level?: CheerLevel;
  /** Hệ số âm lượng 0..1 của ba mẹ (mặc định 1). */
  volume?: number;
  /** Hạt giống để nhịp vỗ tay tái lập được trong test. */
  seed?: number;
}

/** Trần thời lượng của cả cụm ăn mừng (không được dài hơn một nhịp chú ý). */
export const CHEER_MAX_MS = 1600;
/** Mức 'calm' phải ngắn hơn nữa. */
export const CHEER_CALM_MAX_MS = 900;

/** Đỉnh mục tiêu của cụm ăn mừng; ≤ đỉnh "ting" của sao + 3 dB. */
export const PEAK_TARGET_CHEER_DBFS = -10;
/** Mức 'calm' hạ thêm 6 dB. */
export const CHEER_CALM_TRIM_DB = -6;

const CHEER_PEAK = dbToGain(PEAK_TARGET_CHEER_DBFS);
/** Chia đỉnh cho 2 bè: khi fanfare và vỗ tay chồng nhau tổng vẫn đúng mục tiêu. */
const FANFARE_PEAK = CHEER_PEAK * 0.62;
const CLAP_PEAK = CHEER_PEAK * 0.38;

/** Vỗ tay vào sau fanfare một chút để nghe như "reo lên rồi mới vỗ". */
export const CLAP_DELAY_MS = 120;
export const CLAP_MIN_COUNT = 5;
export const CLAP_MAX_COUNT = 7;
/** Khoảng cách giữa hai tiếng vỗ: lệch ngẫu nhiên nhẹ cho giống người thật. */
export const CLAP_GAP_MIN_MS = 90;
export const CLAP_GAP_MAX_MS = 150;
export const CLAP_MS = 25;
/** Dải bandpass của tiếng vỗ tay. */
export const CLAP_BAND_MIN_HZ = 1500;
export const CLAP_BAND_MAX_HZ = 2500;
const CLAP_Q = 1.2;
const CLAP_ATTACK_S = 0.0015;

/** Hợp âm trưởng đi lên: C5–E5–G5–C6 (mức 'fun'), bỏ nốt cuối ở mức 'calm'. */
export const CHEER_ROOT_NOTE = "C5";
const FUN_NOTE_COUNT = 4;
const CALM_NOTE_COUNT = 3;
/** Mỗi nốt vào cách nhau ~140 ms; phần dư là tiếng ngân chồng lên nốt sau. */
const FUN_STEP_MS = 140;
const FUN_RING_MS = 320;
const FUN_LAST_RING_MS = 520;
const CALM_STEP_MS = 160;
const CALM_RING_MS = 300;
const CALM_LAST_RING_MS = 420;

/** Biên độ hai thành phần: triangle nền + chút sine bội 2 cho sáng tiếng. */
const PARTIAL_TRIANGLE = 1;
const PARTIAL_SINE = 0.25;
const PARTIAL_SUM = PARTIAL_TRIANGLE + PARTIAL_SINE;

// ------------------------------------------------------------------ kế hoạch

export interface CheerNote {
  startMs: number;
  /** Gồm cả tiếng ngân. */
  durMs: number;
  freq: number;
  peak: number;
}

export interface CheerClap {
  startMs: number;
  durMs: number;
  peak: number;
  /** Tần số giữa của bandpass. */
  centerHz: number;
  /** Đổi tốc độ phát nhiễu -> mỗi tiếng vỗ một màu khác nhau. */
  rate: number;
}

export interface CheerPlan {
  level: CheerLevel;
  notes: CheerNote[];
  claps: CheerClap[];
  /** Tổng thời lượng (ms), đã gồm tiếng ngân của nốt cuối. */
  totalMs: number;
}

function levelGain(level: CheerLevel, volume: number): number {
  const trim = level === "calm" ? dbToGain(CHEER_CALM_TRIM_DB) : 1;
  return trim * clampVolume(volume);
}

/** Chuỗi nốt đi lên của fanfare. */
export function buildFanfarePlan(level: CheerLevel, volume = 1): CheerNote[] {
  const calm = level === "calm";
  const freqs = majorArpeggioHz(
    CHEER_ROOT_NOTE,
    calm ? CALM_NOTE_COUNT : FUN_NOTE_COUNT,
  );
  const step = calm ? CALM_STEP_MS : FUN_STEP_MS;
  const ring = calm ? CALM_RING_MS : FUN_RING_MS;
  const lastRing = calm ? CALM_LAST_RING_MS : FUN_LAST_RING_MS;
  const peak = FANFARE_PEAK * levelGain(level, volume);
  return freqs.map((freq, i) => ({
    startMs: i * step,
    durMs: i === freqs.length - 1 ? lastRing : ring,
    freq,
    peak,
  }));
}

/** Chuỗi 5–7 tiếng vỗ tay; mức 'calm' không vỗ tay. */
export function buildClapPlan(
  level: CheerLevel,
  volume = 1,
  rng?: Rng,
): CheerClap[] {
  if (level === "calm") return [];
  const r = rng ?? createRng(randomSeed());
  const count = CLAP_MIN_COUNT + r.int(CLAP_MAX_COUNT - CLAP_MIN_COUNT + 1);
  const peak = CLAP_PEAK * levelGain(level, volume);
  const out: CheerClap[] = [];
  let at = CLAP_DELAY_MS;
  for (let i = 0; i < count; i += 1) {
    out.push({
      startMs: at,
      durMs: CLAP_MS,
      peak,
      centerHz:
        CLAP_BAND_MIN_HZ + r.next() * (CLAP_BAND_MAX_HZ - CLAP_BAND_MIN_HZ),
      rate: 0.9 + r.next() * 0.3,
    });
    at += CLAP_GAP_MIN_MS + r.next() * (CLAP_GAP_MAX_MS - CLAP_GAP_MIN_MS);
  }
  return out;
}

/** Thời điểm kết thúc muộn nhất của cả kế hoạch (ms). */
export function cheerPlanDurationMs(
  notes: CheerNote[],
  claps: CheerClap[],
): number {
  let end = 0;
  for (const n of notes) end = Math.max(end, n.startMs + n.durMs);
  for (const c of claps) end = Math.max(end, c.startMs + c.durMs);
  return Math.round(end);
}

/** Đỉnh lớn nhất có thể khi hai bè chồng nhau. */
export function cheerPlanPeak(plan: CheerPlan): number {
  const note = plan.notes.reduce((m, n) => Math.max(m, n.peak), 0);
  const clap = plan.claps.reduce((m, c) => Math.max(m, c.peak), 0);
  return note + clap;
}

export function buildCheerPlan(opts: CheerOptions = {}): CheerPlan {
  const level = opts.level ?? "fun";
  const volume = opts.volume ?? 1;
  const rng = createRng(opts.seed ?? randomSeed());
  const notes = buildFanfarePlan(level, volume);
  const claps = buildClapPlan(level, volume, rng);
  return { level, notes, claps, totalMs: cheerPlanDurationMs(notes, claps) };
}

// ------------------------------------------------------------------ phát âm

/** Lookahead nhỏ để tiếng đầu không bị cắt khi luồng audio đang bận. */
const LOOKAHEAD_S = 0.02;
/** Nhiễu trắng dài hơn một tiếng vỗ để còn đổi tốc độ phát. */
const NOISE_MS = 120;

/** Một bộ đệm nhiễu cho mỗi AudioContext — không tạo lại mỗi tiếng vỗ. */
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const frames = Math.max(1, Math.round((ctx.sampleRate * NOISE_MS) / 1000));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buffer);
  return buffer;
}

/** Bao biên độ chung: lên rất nhanh rồi tắt theo hàm mũ (không có tiếng "tách"). */
function envelope(
  param: AudioParam,
  at: number,
  attackS: number,
  durS: number,
  peak: number,
): void {
  const top = Math.max(peak, MIN_RAMP_GAIN * 2);
  param.setValueAtTime(MIN_RAMP_GAIN, at);
  param.exponentialRampToValueAtTime(top, at + attackS);
  param.exponentialRampToValueAtTime(MIN_RAMP_GAIN, at + durS);
}

function scheduleNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  note: CheerNote,
  at: number,
): void {
  const durS = note.durMs / 1000;
  const partials: [OscillatorType, number, number][] = [
    ["triangle", 1, PARTIAL_TRIANGLE / PARTIAL_SUM],
    ["sine", 2, PARTIAL_SINE / PARTIAL_SUM],
  ];
  for (const [type, ratio, amp] of partials) {
    const freq = note.freq * ratio;
    if (freq >= ctx.sampleRate / 2) continue;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    const gain = ctx.createGain();
    envelope(gain.gain, at, 0.01, durS, note.peak * amp);
    osc.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // đã ngắt kết nối
      }
    };
    osc.start(at);
    osc.stop(at + durS + 0.02);
  }
}

function scheduleClap(
  ctx: BaseAudioContext,
  dest: AudioNode,
  clap: CheerClap,
  at: number,
): void {
  const durS = clap.durMs / 1000;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.playbackRate.setValueAtTime(clap.rate, at);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(clap.centerHz, at);
  band.Q.setValueAtTime(CLAP_Q, at);
  const gain = ctx.createGain();
  envelope(gain.gain, at, CLAP_ATTACK_S, durS, clap.peak);
  src.connect(band);
  band.connect(gain);
  gain.connect(dest);
  src.onended = () => {
    try {
      src.disconnect();
      band.disconnect();
      gain.disconnect();
    } catch {
      // đã ngắt kết nối
    }
  };
  src.start(at);
  src.stop(at + durS + 0.02);
}

// `Promise.withResolvers` chưa có trong lib ES2022 của dự án (và iPadOS cũ),
// nên giữ dạng executor như `ToneGenerator`.
/** Giải lời hứa khi âm cuối đã tắt hẳn (thêm 60 ms cho đuôi ngân). */
function settle(totalMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, totalMs + 60);
  });
}

/** Chuỗi tiếng vỗ tay (mức 'calm' không có gì để phát). */
export function playClap(
  ctx: BaseAudioContext,
  dest: AudioNode,
  opts: CheerOptions = {},
): Promise<void> {
  const rng = createRng(opts.seed ?? randomSeed());
  const claps = buildClapPlan(opts.level ?? "fun", opts.volume ?? 1, rng);
  if (claps.length === 0) return Promise.resolve();
  const t0 = ctx.currentTime + LOOKAHEAD_S;
  for (const clap of claps)
    scheduleClap(ctx, dest, clap, t0 + clap.startMs / 1000);
  return settle(cheerPlanDurationMs([], claps));
}

/** Chuỗi nốt đi lên theo hợp âm trưởng. */
export function playFanfare(
  ctx: BaseAudioContext,
  dest: AudioNode,
  opts: CheerOptions = {},
): Promise<void> {
  const notes = buildFanfarePlan(opts.level ?? "fun", opts.volume ?? 1);
  const t0 = ctx.currentTime + LOOKAHEAD_S;
  for (const note of notes)
    scheduleNote(ctx, dest, note, t0 + note.startMs / 1000);
  return settle(cheerPlanDurationMs(notes, []));
}

/**
 * Cả cụm ăn mừng: fanfare vào ngay, tiếng vỗ tay chồng lên sau ~120 ms.
 * Dùng một kế hoạch duy nhất để hai bè dùng chung mốc thời gian và chung đỉnh.
 */
export function playCheer(
  ctx: BaseAudioContext,
  dest: AudioNode,
  opts: CheerOptions = {},
): Promise<void> {
  const plan = buildCheerPlan(opts);
  const t0 = ctx.currentTime + LOOKAHEAD_S;
  for (const note of plan.notes)
    scheduleNote(ctx, dest, note, t0 + note.startMs / 1000);
  for (const clap of plan.claps)
    scheduleClap(ctx, dest, clap, t0 + clap.startMs / 1000);
  return settle(plan.totalMs);
}

/** Trần thời lượng theo mức, dùng cho phần hình chạy khớp với phần âm. */
export function cheerMaxMs(level: CheerLevel): number {
  return level === "calm" ? CHEER_CALM_MAX_MS : CHEER_MAX_MS;
}

/** Đỉnh của cụm ăn mừng không được vượt "ting" của sao quá 3 dB. */
export const CHEER_PEAK_CEILING = dbToGain(PEAK_TARGET_TONE_DBFS + 3);
