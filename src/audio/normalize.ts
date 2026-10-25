/**
 * Chuẩn hóa âm lượng (04 §4).
 *
 * Mọi hàm ở đây là logic thuần (không chạm Web Audio) để test được trong jsdom.
 * Mục tiêu đỉnh theo nhóm âm:
 *  - giọng ba mẹ: −3 dBFS
 *  - "ting" của sao: −12 dBFS
 *  - tiếng kêu con vật: −9 dBFS
 *  - nhạc tiệc: −10 dBFS
 */

export const PEAK_TARGET_VOICE_DBFS = -3
export const PEAK_TARGET_ANIMAL_DBFS = -9
export const PEAK_TARGET_PARTY_DBFS = -10
export const PEAK_TARGET_TONE_DBFS = -12

/** Hạ 8 dB cho các âm khác khi giọng ba mẹ đang phát (04 §4). */
export const DUCK_DB = -8

/** Giá trị gain tối thiểu dùng cho ramp mũ (không được bằng 0). */
export const MIN_RAMP_GAIN = 0.0001

/** dB -> hệ số biên độ. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

/** Hệ số biên độ -> dB (gain ≤ 0 trả về -Infinity). */
export function gainToDb(gain: number): number {
  if (gain <= 0) return Number.NEGATIVE_INFINITY
  return 20 * Math.log10(gain)
}

/** Đỉnh tuyệt đối của một mảng mẫu PCM (-1..1). */
export function peakOfSamples(samples: ArrayLike<number>): number {
  let peak = 0
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i]
    if (v === undefined) continue
    const abs = v < 0 ? -v : v
    if (abs > peak) peak = abs
  }
  return peak
}

/** Đỉnh tuyệt đối của mọi kênh trong một AudioBuffer. */
export function peakOfBuffer(buffer: AudioBuffer): number {
  let peak = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const channelPeak = peakOfSamples(buffer.getChannelData(ch))
    if (channelPeak > peak) peak = channelPeak
  }
  return peak
}

export interface NormalisationOptions {
  /** Mục tiêu đỉnh sau khi nhân gain (mặc định −3 dBFS cho giọng ba mẹ). */
  targetDbfs?: number
  /** Giới hạn khuếch đại để không kéo nền ồn lên quá mức. */
  maxGain?: number
  /** Dưới ngưỡng này coi như clip im lặng -> giữ gain 1. */
  silenceFloor?: number
}

/**
 * Tính gain chuẩn hóa đỉnh. Clip im lặng giữ nguyên gain 1;
 * clip to hơn mục tiêu sẽ bị hạ xuống (gain < 1).
 */
export function normalisationGain(peak: number, opts: NormalisationOptions = {}): number {
  const target = dbToGain(opts.targetDbfs ?? PEAK_TARGET_VOICE_DBFS)
  const maxGain = opts.maxGain ?? 8
  const floor = opts.silenceFloor ?? 1e-4
  if (!Number.isFinite(peak) || peak <= floor) return 1
  const gain = target / peak
  if (gain > maxGain) return maxGain
  return gain
}

/** Tính gain chuẩn hóa trực tiếp từ mảng mẫu. */
export function normalisationGainForSamples(
  samples: ArrayLike<number>,
  opts: NormalisationOptions = {},
): number {
  return normalisationGain(peakOfSamples(samples), opts)
}

/** Giới hạn một hệ số âm lượng về khoảng 0..1. */
export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 1
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}
