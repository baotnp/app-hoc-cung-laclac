/**
 * Âm "ting" của sao và nhạc màn tiệc — **tự tổng hợp bằng Web Audio**,
 * không dùng file hay thư viện ngoài (04 §4, §8).
 *
 * Quy tắc: "ting" 5 nốt tăng dần C5 D5 E5 G5 A5, ≤ 400 ms, đỉnh ≈ −12 dBFS,
 * envelope mềm (không có tiếng "tách"). Nhạc tiệc 5–8 giây, không lặp lại,
 * đỉnh ≈ −10 dBFS. **Không có bất kỳ âm báo sai nào trong module này.**
 *
 * Phần dựng "bản nhạc" (`starToneSpec`, `buildPartyScore`) là dữ liệu thuần,
 * test được mà không cần Web Audio.
 */

import {
  MIN_RAMP_GAIN,
  PEAK_TARGET_PARTY_DBFS,
  PEAK_TARGET_TONE_DBFS,
  dbToGain,
} from "./normalize";

// ------------------------------------------------------------------ nốt nhạc

const SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Tên nốt ('C5', 'F#4', 'Bb3') -> tần số theo bình quân luật, A4 = 440 Hz. */
export function noteHz(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
  if (!m) throw new Error(`nốt không hợp lệ: ${name}`);
  const [, letter = "C", accidental = "", octaveText = "4"] = m;
  const base = SEMITONES[letter] ?? 0;
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const octave = Number.parseInt(octaveText, 10);
  const midi = (octave + 1) * 12 + base + shift;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Các bậc của hợp âm trưởng đi lên, tính bằng nửa cung từ nốt gốc. */
const MAJOR_STEPS = [0, 4, 7, 12, 16, 19] as const;

/**
 * Tần số của `count` nốt hợp âm trưởng đi lên từ `root` (C5 -> C5,E5,G5,C6…).
 * Dùng cho fanfare ăn mừng: đi lên nghe như "giỏi quá!", không nghịch tai.
 */
export function majorArpeggioHz(root: string, count: number): number[] {
  const base = noteHz(root);
  const n = Math.max(0, Math.min(count, MAJOR_STEPS.length));
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = base * Math.pow(2, (MAJOR_STEPS[i] ?? 0) / 12);
  }
  return out;
}

// ------------------------------------------------------------------ mô hình

export type ToneVoice = "marimba" | "bell" | "bass";

export interface ToneNote {
  /** Thời điểm bắt đầu tính từ đầu đoạn, ms. */
  startMs: number;
  /** Thời lượng vang, ms. */
  durMs: number;
  freq: number;
  /** Đỉnh biên độ (0..1) của nốt. */
  peak: number;
  voice: ToneVoice;
}

export type StarToneIndex = 0 | 1 | 2 | 3 | 4;

/** 5 nốt của bảng sao (04 §4). */
export const STAR_TONE_NOTES = ["C5", "D5", "E5", "G5", "A5"] as const;
export const STAR_TONE_FREQS: readonly number[] = STAR_TONE_NOTES.map(noteHz);
/** ≤ 400 ms theo 04 §4. */
export const STAR_TONE_MS = 380;
export const STAR_TONE_PEAK = dbToGain(PEAK_TARGET_TONE_DBFS);

/** Nốt "ting" thứ `index` (0..4). */
export function starToneSpec(index: StarToneIndex): ToneNote {
  const freq = STAR_TONE_FREQS[index] ?? STAR_TONE_FREQS[0] ?? noteHz("C5");
  return {
    startMs: 0,
    durMs: STAR_TONE_MS,
    freq,
    peak: STAR_TONE_PEAK,
    voice: "marimba",
  };
}

// ------------------------------------------------------------------ nhạc tiệc

/** Nhịp của đoạn nhạc tiệc (ms cho một phách). */
export const PARTY_BEAT_MS = 340;

interface ScoreEntry {
  beat: number;
  beats: number;
  note: string;
}

/** Giai điệu: 5 ô nhịp, mỗi ô một hình khác nhau -> không lặp lại. */
const PARTY_MELODY: ScoreEntry[] = [
  { beat: 0, beats: 1, note: "C5" },
  { beat: 1, beats: 1, note: "E5" },
  { beat: 2, beats: 0.5, note: "G5" },
  { beat: 2.5, beats: 0.5, note: "E5" },
  { beat: 3, beats: 1, note: "A5" },

  { beat: 4, beats: 1, note: "G5" },
  { beat: 5, beats: 1, note: "C6" },
  { beat: 6, beats: 0.5, note: "A5" },
  { beat: 6.5, beats: 0.5, note: "G5" },
  { beat: 7, beats: 1, note: "E5" },

  { beat: 8, beats: 0.5, note: "D5" },
  { beat: 8.5, beats: 0.5, note: "E5" },
  { beat: 9, beats: 1, note: "G5" },
  { beat: 10, beats: 1, note: "A5" },
  { beat: 11, beats: 1, note: "C6" },

  { beat: 12, beats: 0.5, note: "A5" },
  { beat: 12.5, beats: 0.5, note: "C6" },
  { beat: 13, beats: 1, note: "D6" },
  { beat: 14, beats: 1, note: "C6" },
  { beat: 15, beats: 1, note: "G5" },

  { beat: 16, beats: 0.5, note: "E5" },
  { beat: 16.5, beats: 0.5, note: "G5" },
  { beat: 17, beats: 0.5, note: "A5" },
  { beat: 17.5, beats: 0.5, note: "C6" },
  { beat: 18, beats: 2, note: "C6" },
];

const PARTY_BASS: ScoreEntry[] = [
  { beat: 0, beats: 2, note: "C3" },
  { beat: 2, beats: 2, note: "E3" },
  { beat: 4, beats: 2, note: "A2" },
  { beat: 6, beats: 2, note: "E3" },
  { beat: 8, beats: 2, note: "F3" },
  { beat: 10, beats: 2, note: "C3" },
  { beat: 12, beats: 2, note: "G2" },
  { beat: 14, beats: 2, note: "D3" },
  { beat: 16, beats: 2, note: "C3" },
  { beat: 18, beats: 2, note: "G3" },
];

const PARTY_BELLS: ScoreEntry[] = [
  { beat: 4, beats: 1, note: "C6" },
  { beat: 12, beats: 1, note: "E6" },
  { beat: 18, beats: 2, note: "G6" },
];

/** Tổng đỉnh mục tiêu của nhạc tiệc (−10 dBFS) chia cho 3 bè. */
const PARTY_PEAK = dbToGain(PEAK_TARGET_PARTY_DBFS);
const MELODY_PEAK = PARTY_PEAK * 0.48;
const BASS_PEAK = PARTY_PEAK * 0.3;
const BELL_PEAK = PARTY_PEAK * 0.22;

function toNotes(
  entries: ScoreEntry[],
  voice: ToneVoice,
  peak: number,
): ToneNote[] {
  return entries.map((e) => ({
    startMs: e.beat * PARTY_BEAT_MS,
    durMs: e.beats * PARTY_BEAT_MS,
    freq: noteHz(e.note),
    peak,
    voice,
  }));
}

/** Bản nhạc tiệc: 5–8 giây, một lượt duy nhất, không lặp. */
export function buildPartyScore(): ToneNote[] {
  return [
    ...toNotes(PARTY_MELODY, "marimba", MELODY_PEAK),
    ...toNotes(PARTY_BASS, "bass", BASS_PEAK),
    ...toNotes(PARTY_BELLS, "bell", BELL_PEAK),
  ].sort((a, b) => a.startMs - b.startMs);
}

/** Tổng thời lượng của một bản nhạc (ms). */
export function scoreDurationMs(score: ToneNote[]): number {
  let end = 0;
  for (const n of score) {
    const noteEnd = n.startMs + n.durMs;
    if (noteEnd > end) end = noteEnd;
  }
  return end;
}

/** Số bè vang cùng lúc nhiều nhất trong một bản nhạc. */
export function maxOverlap(score: ToneNote[]): number {
  const edges: { t: number; delta: number }[] = [];
  for (const n of score) {
    edges.push({ t: n.startMs, delta: 1 });
    edges.push({ t: n.startMs + n.durMs, delta: -1 });
  }
  edges.sort((a, b) => a.t - b.t || a.delta - b.delta);
  let cur = 0;
  let max = 0;
  for (const e of edges) {
    cur += e.delta;
    if (cur > max) max = cur;
  }
  return max;
}

// ------------------------------------------------------------------ tổng hợp

interface VoiceShape {
  /** Các thành phần hình sin: [bội số tần số, tỉ lệ biên độ]. */
  partials: [number, number][];
  type: OscillatorType;
  attackS: number;
  /** Hệ số thời lượng vang so với `durMs`. */
  releaseScale: number;
}

const SHAPES: Record<ToneVoice, VoiceShape> = {
  // Marimba: sóng sin cơ bản + bội 4 (đặc trưng thanh gỗ) + chút bội 10.
  marimba: {
    partials: [
      [1, 1],
      [4, 0.22],
      [10, 0.05],
    ],
    type: "sine",
    attackS: 0.008,
    releaseScale: 1,
  },
  bell: {
    partials: [
      [1, 1],
      [2.76, 0.3],
    ],
    type: "sine",
    attackS: 0.012,
    releaseScale: 1.4,
  },
  bass: {
    partials: [
      [1, 1],
      [2, 0.18],
    ],
    type: "triangle",
    attackS: 0.02,
    releaseScale: 0.9,
  },
};

/**
 * Biên độ các thành phần sin, đã chia cho tổng để đỉnh tổng hợp của một nốt
 * đúng bằng `note.peak` (các sin đều bắt đầu ở pha 0 nên cộng dồn lúc đầu).
 */
export function normalisedPartials(voice: ToneVoice): [number, number][] {
  const partials = SHAPES[voice].partials;
  const sum = partials.reduce((acc, [, amp]) => acc + amp, 0);
  return partials.map(([ratio, amp]): [number, number] => [ratio, amp / sum]);
}

interface ScheduledVoice {
  osc: OscillatorNode;
  gain: GainNode;
}

/**
 * Sinh âm bằng Web Audio vào một nút đích cho trước.
 * Không giữ tham chiếu tới AudioManager để tránh phụ thuộc vòng.
 */
export class ToneGenerator {
  readonly #ctx: AudioContext;
  readonly #toneOut: AudioNode;
  readonly #partyOut: AudioNode;
  readonly #live = new Set<ScheduledVoice>();

  constructor(ctx: AudioContext, toneOut: AudioNode, partyOut: AudioNode) {
    this.#ctx = ctx;
    this.#toneOut = toneOut;
    this.#partyOut = partyOut;
  }

  /** Nốt "ting" thứ `index` của bảng sao (0..4). */
  playStarTone(index: StarToneIndex): Promise<void> {
    return this.#playScore([starToneSpec(index)], this.#toneOut);
  }

  /**
   * Đoạn nhạc ngắn của màn tiệc (5–8 giây, không lặp).
   * `silent` = cờ "tiệc yên lặng" của ba mẹ: bỏ nhạc, không đổi phần hình.
   */
  playPartyMusic(opts: { silent?: boolean } = {}): Promise<void> {
    if (opts.silent) return Promise.resolve();
    return this.#playScore(buildPartyScore(), this.#partyOut);
  }

  /** Dừng mọi nốt đang vang, fade ra 50 ms. */
  stopAll(): void {
    const now = this.#ctx.currentTime;
    for (const voice of this.#live) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(
          Math.max(voice.gain.gain.value, MIN_RAMP_GAIN),
          now,
        );
        voice.gain.gain.exponentialRampToValueAtTime(MIN_RAMP_GAIN, now + 0.05);
        voice.osc.stop(now + 0.06);
      } catch {
        // nốt đã kết thúc
      }
    }
  }

  #playScore(score: ToneNote[], out: AudioNode): Promise<void> {
    if (score.length === 0) return Promise.resolve();
    const ctx = this.#ctx;
    // Lookahead nhỏ để nốt đầu không bị cắt khi luồng audio đang bận.
    const t0 = ctx.currentTime + 0.02;
    for (const note of score) {
      this.#scheduleNote(note, out, t0 + note.startMs / 1000);
    }
    const totalMs = scoreDurationMs(score);
    return new Promise((resolve) => {
      setTimeout(resolve, totalMs + 80);
    });
  }

  #scheduleNote(note: ToneNote, out: AudioNode, at: number): void {
    const ctx = this.#ctx;
    const shape = SHAPES[note.voice];
    const durS = (note.durMs / 1000) * shape.releaseScale;
    for (const [ratio, amp] of normalisedPartials(note.voice)) {
      const freq = note.freq * ratio;
      if (freq >= ctx.sampleRate / 2) continue;
      const osc = ctx.createOscillator();
      osc.type = shape.type;
      osc.frequency.setValueAtTime(freq, at);
      const gain = ctx.createGain();
      const peak = Math.max(note.peak * amp, MIN_RAMP_GAIN * 2);
      gain.gain.setValueAtTime(MIN_RAMP_GAIN, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + shape.attackS);
      // Tắt dần theo hàm mũ: mềm, không có tiếng "tách".
      gain.gain.exponentialRampToValueAtTime(MIN_RAMP_GAIN, at + durS);
      osc.connect(gain);
      gain.connect(out);
      const entry: ScheduledVoice = { osc, gain };
      this.#live.add(entry);
      osc.onended = () => {
        this.#live.delete(entry);
        try {
          gain.disconnect();
          osc.disconnect();
        } catch {
          // đã ngắt kết nối
        }
      };
      osc.start(at);
      osc.stop(at + durS + 0.02);
    }
  }
}
