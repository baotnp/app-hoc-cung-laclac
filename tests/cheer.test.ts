import { afterEach, describe, expect, it, vi } from "vitest";

import { dbToGain, PEAK_TARGET_TONE_DBFS } from "@/audio/normalize";
import { noteHz } from "@/audio/tones";
import { createRng } from "@/lib/random";
import {
  CHEER_CALM_MAX_MS,
  CHEER_CALM_TRIM_DB,
  CHEER_MAX_MS,
  CHEER_PEAK_CEILING,
  CLAP_BAND_MAX_HZ,
  CLAP_BAND_MIN_HZ,
  CLAP_DELAY_MS,
  CLAP_GAP_MAX_MS,
  CLAP_GAP_MIN_MS,
  CLAP_MAX_COUNT,
  CLAP_MIN_COUNT,
  buildCheerPlan,
  buildClapPlan,
  buildFanfarePlan,
  cheerPlanPeak,
  playCheer,
} from "@/audio/cheer";

// jsdom không có Web Audio: dùng một AudioContext giả chỉ để đếm nguồn âm
// và kiểm mốc thời gian đã đặt lịch.

class FakeParam {
  readonly events: { kind: string; value: number; at: number }[] = [];
  value = 0;
  setValueAtTime(value: number, at: number) {
    this.events.push({ kind: "set", value, at });
    this.value = value;
    return this;
  }
  exponentialRampToValueAtTime(value: number, at: number) {
    this.events.push({ kind: "exp", value, at });
    return this;
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.events.push({ kind: "lin", value, at });
    return this;
  }
  cancelScheduledValues(at: number) {
    this.events.push({ kind: "cancel", value: 0, at });
    return this;
  }
  /** Đỉnh lớn nhất từng được đặt lịch (bỏ qua mức sàn của ramp mũ). */
  peak(): number {
    return this.events.reduce((m, e) => Math.max(m, e.value), 0);
  }
}

class FakeNode {
  connect() {
    return this;
  }
  disconnect() {}
}

class FakeOsc extends FakeNode {
  type = "sine";
  readonly frequency = new FakeParam();
  onended: (() => void) | null = null;
  startedAt = -1;
  stoppedAt = -1;
  start(at: number) {
    this.startedAt = at;
  }
  stop(at: number) {
    this.stoppedAt = at;
  }
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  readonly playbackRate = new FakeParam();
  onended: (() => void) | null = null;
  startedAt = -1;
  stoppedAt = -1;
  start(at: number) {
    this.startedAt = at;
  }
  stop(at: number) {
    this.stoppedAt = at;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeFilter extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
}

class FakeBuffer {
  readonly #data: Float32Array;
  constructor(frames: number) {
    this.#data = new Float32Array(frames);
  }
  getChannelData() {
    return this.#data;
  }
}

class FakeCtx {
  readonly sampleRate = 48000;
  currentTime = 1;
  readonly oscillators: FakeOsc[] = [];
  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  readonly filters: FakeFilter[] = [];
  createOscillator() {
    const osc = new FakeOsc();
    this.oscillators.push(osc);
    return osc;
  }
  createBufferSource() {
    const src = new FakeSource();
    this.sources.push(src);
    return src;
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createBiquadFilter() {
    const f = new FakeFilter();
    this.filters.push(f);
    return f;
  }
  createBuffer(_ch: number, frames: number) {
    return new FakeBuffer(frames);
  }
}

function fake() {
  const ctx = new FakeCtx();
  const dest = new FakeNode();
  return {
    ctx,
    dest,
    args: [
      ctx as unknown as BaseAudioContext,
      dest as unknown as AudioNode,
    ] as const,
  };
}

/** Mốc kết thúc muộn nhất đã đặt lịch, tính từ `currentTime` (ms). */
function lastStopMs(ctx: FakeCtx): number {
  const stops = [...ctx.oscillators, ...ctx.sources].map((n) => n.stoppedAt);
  return (Math.max(...stops) - ctx.currentTime) * 1000;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("cheer — kế hoạch fanfare", () => {
  it("fun đi lên 4 nốt hợp âm trưởng C5-E5-G5-C6", () => {
    const notes = buildFanfarePlan("fun");
    expect(notes).toHaveLength(4);
    expect(notes[0]?.freq).toBeCloseTo(noteHz("C5"), 3);
    expect(notes[1]?.freq).toBeCloseTo(noteHz("E5"), 3);
    expect(notes[2]?.freq).toBeCloseTo(noteHz("G5"), 3);
    expect(notes[3]?.freq).toBeCloseTo(noteHz("C6"), 3);
    for (let i = 1; i < notes.length; i += 1) {
      expect(notes[i]!.freq).toBeGreaterThan(notes[i - 1]!.freq);
      expect(notes[i]!.startMs).toBeGreaterThan(notes[i - 1]!.startMs);
    }
  });

  it("calm chỉ 3 nốt và nhẹ hơn fun đúng 6 dB", () => {
    const calm = buildFanfarePlan("calm");
    const fun = buildFanfarePlan("fun");
    expect(calm).toHaveLength(3);
    expect(calm[0]!.peak).toBeCloseTo(
      fun[0]!.peak * dbToGain(CHEER_CALM_TRIM_DB),
      6,
    );
  });

  it("âm lượng của ba mẹ nhân thẳng vào đỉnh", () => {
    const full = buildFanfarePlan("fun", 1);
    const half = buildFanfarePlan("fun", 0.5);
    expect(half[0]!.peak).toBeCloseTo(full[0]!.peak * 0.5, 6);
  });
});

describe("cheer — kế hoạch vỗ tay", () => {
  it("fun có 5–7 tiếng vỗ, vào sau fanfare và cách nhau 90–150 ms", () => {
    for (const seed of [1, 7, 42, 1234, 99999]) {
      const claps = buildClapPlan("fun", 1, createRng(seed));
      expect(claps.length).toBeGreaterThanOrEqual(CLAP_MIN_COUNT);
      expect(claps.length).toBeLessThanOrEqual(CLAP_MAX_COUNT);
      const plan = buildCheerPlan({ level: "fun", seed });
      expect(plan.claps[0]?.startMs).toBe(CLAP_DELAY_MS);
      for (let i = 1; i < plan.claps.length; i += 1) {
        const gap = plan.claps[i]!.startMs - plan.claps[i - 1]!.startMs;
        expect(gap).toBeGreaterThanOrEqual(CLAP_GAP_MIN_MS);
        expect(gap).toBeLessThanOrEqual(CLAP_GAP_MAX_MS);
      }
      for (const clap of plan.claps) {
        expect(clap.centerHz).toBeGreaterThanOrEqual(CLAP_BAND_MIN_HZ);
        expect(clap.centerHz).toBeLessThanOrEqual(CLAP_BAND_MAX_HZ);
        expect(clap.durMs).toBeLessThanOrEqual(30);
      }
    }
  });

  it("calm không vỗ tay", () => {
    expect(buildClapPlan("calm")).toHaveLength(0);
    expect(buildCheerPlan({ level: "calm", seed: 5 }).claps).toHaveLength(0);
  });

  it("cùng hạt giống cho cùng nhịp vỗ", () => {
    const a = buildCheerPlan({ level: "fun", seed: 2024 });
    const b = buildCheerPlan({ level: "fun", seed: 2024 });
    expect(a.claps).toEqual(b.claps);
  });
});

describe("cheer — thời lượng và đỉnh", () => {
  it("fun không quá 1,6 giây với mọi hạt giống", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      expect(
        buildCheerPlan({ level: "fun", seed }).totalMs,
      ).toBeLessThanOrEqual(CHEER_MAX_MS);
    }
  });

  it("calm ngắn hơn fun và không quá 0,9 giây", () => {
    const calm = buildCheerPlan({ level: "calm", seed: 3 });
    const fun = buildCheerPlan({ level: "fun", seed: 3 });
    expect(calm.totalMs).toBeLessThanOrEqual(CHEER_CALM_MAX_MS);
    expect(calm.totalMs).toBeLessThan(fun.totalMs);
    expect(cheerPlanPeak(calm)).toBeLessThan(cheerPlanPeak(fun));
  });

  it('đỉnh không vượt "ting" của sao quá 3 dB', () => {
    expect(CHEER_PEAK_CEILING).toBeCloseTo(
      dbToGain(PEAK_TARGET_TONE_DBFS + 3),
      6,
    );
    for (const level of ["calm", "fun"] as const) {
      const plan = buildCheerPlan({ level, seed: 11 });
      expect(cheerPlanPeak(plan)).toBeLessThanOrEqual(CHEER_PEAK_CEILING);
    }
  });
});

describe("cheer — đặt lịch lên AudioContext", () => {
  it("fun tạo 2 bộ dao động mỗi nốt và 1 nguồn nhiễu mỗi tiếng vỗ", async () => {
    vi.useFakeTimers();
    const { ctx, args } = fake();
    const plan = buildCheerPlan({ level: "fun", seed: 77 });
    const done = playCheer(...args, { level: "fun", seed: 77 });
    expect(ctx.oscillators).toHaveLength(plan.notes.length * 2);
    expect(ctx.sources).toHaveLength(plan.claps.length);
    expect(ctx.filters).toHaveLength(plan.claps.length);
    // Mọi nguồn đều đã hẹn giờ tắt, và cả cụm gọn trong 1,6 s (+ đuôi tắt).
    expect(lastStopMs(ctx)).toBeLessThanOrEqual(CHEER_MAX_MS + 100);
    for (const node of [...ctx.oscillators, ...ctx.sources]) {
      expect(node.startedAt).toBeGreaterThanOrEqual(ctx.currentTime);
      expect(node.stoppedAt).toBeGreaterThan(node.startedAt);
    }
    await vi.advanceTimersByTimeAsync(CHEER_MAX_MS + 200);
    await expect(done).resolves.toBeUndefined();
  });

  it("calm chỉ có fanfare, nhẹ hơn và ngắn hơn fun", async () => {
    vi.useFakeTimers();
    const calm = fake();
    const fun = fake();
    const calmDone = playCheer(...calm.args, { level: "calm", seed: 5 });
    const funDone = playCheer(...fun.args, { level: "fun", seed: 5 });

    expect(calm.ctx.sources).toHaveLength(0);
    expect(calm.ctx.oscillators).toHaveLength(6);
    expect(calm.ctx.oscillators.length).toBeLessThan(
      fun.ctx.oscillators.length,
    );
    expect(lastStopMs(calm.ctx)).toBeLessThanOrEqual(CHEER_CALM_MAX_MS + 100);
    expect(lastStopMs(calm.ctx)).toBeLessThan(lastStopMs(fun.ctx));

    const calmPeak = Math.max(...calm.ctx.gains.map((g) => g.gain.peak()));
    const funPeak = Math.max(...fun.ctx.gains.map((g) => g.gain.peak()));
    expect(calmPeak).toBeLessThan(funPeak);

    await vi.advanceTimersByTimeAsync(CHEER_MAX_MS + 200);
    await Promise.all([calmDone, funDone]);
  });

  it("không nguồn nào vượt trần đỉnh đã chốt", () => {
    const { ctx, args } = fake();
    void playCheer(...args, { level: "fun", seed: 9 });
    for (const gain of ctx.gains) {
      expect(gain.gain.peak()).toBeLessThanOrEqual(CHEER_PEAK_CEILING);
    }
  });
});
