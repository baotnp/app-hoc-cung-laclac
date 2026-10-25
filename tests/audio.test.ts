import { describe, expect, it } from 'vitest'

import {
  DUCK_DB,
  PEAK_TARGET_PARTY_DBFS,
  PEAK_TARGET_TONE_DBFS,
  PEAK_TARGET_VOICE_DBFS,
  clampVolume,
  dbToGain,
  gainToDb,
  normalisationGain,
  normalisationGainForSamples,
  peakOfSamples,
} from '@/audio/normalize'
import { RECORDING_MIME_CANDIDATES, pickRecordingMime } from '@/audio/recorder'
import {
  PARTY_BEAT_MS,
  STAR_TONE_FREQS,
  STAR_TONE_MS,
  buildPartyScore,
  maxOverlap,
  noteHz,
  normalisedPartials,
  scoreDurationMs,
  starToneSpec,
} from '@/audio/tones'
import { isVoiceRole } from '@/audio/AudioManager'

// Không test Web Audio thật trong jsdom: chỉ logic thuần tách được.

describe('normalize — dB và gain', () => {
  it('đổi qua lại dB <-> biên độ', () => {
    expect(dbToGain(0)).toBeCloseTo(1, 6)
    expect(dbToGain(-6)).toBeCloseTo(0.5012, 3)
    expect(gainToDb(dbToGain(-3))).toBeCloseTo(-3, 6)
    expect(gainToDb(0)).toBe(Number.NEGATIVE_INFINITY)
  })

  it('ducking đúng 8 dB', () => {
    expect(DUCK_DB).toBe(-8)
    expect(dbToGain(DUCK_DB)).toBeCloseTo(0.3981, 4)
  })
})

describe('normalize — đỉnh của mảng mẫu', () => {
  it('lấy biên độ tuyệt đối lớn nhất', () => {
    expect(peakOfSamples([0, 0.2, -0.8, 0.5])).toBeCloseTo(0.8, 6)
    expect(peakOfSamples(new Float32Array([0.1, -0.25, 0.05]))).toBeCloseTo(0.25, 6)
    expect(peakOfSamples([])).toBe(0)
  })
})

describe('normalize — gain chuẩn hóa đỉnh', () => {
  it('đưa đỉnh về −3 dBFS cho giọng ba mẹ', () => {
    const gain = normalisationGain(0.5)
    expect(0.5 * gain).toBeCloseTo(dbToGain(PEAK_TARGET_VOICE_DBFS), 6)
  })

  it('hạ gain khi clip to hơn mục tiêu', () => {
    const gain = normalisationGain(1)
    expect(gain).toBeLessThan(1)
    expect(gain).toBeCloseTo(dbToGain(PEAK_TARGET_VOICE_DBFS), 6)
  })

  it('giới hạn khuếch đại để không kéo nền ồn lên', () => {
    expect(normalisationGain(0.001)).toBe(8)
    expect(normalisationGain(0.001, { maxGain: 4 })).toBe(4)
  })

  it('clip im lặng giữ gain 1', () => {
    expect(normalisationGain(0)).toBe(1)
    expect(normalisationGain(Number.NaN)).toBe(1)
    expect(normalisationGainForSamples(new Float32Array(128))).toBe(1)
  })

  it('đổi mục tiêu theo nhóm âm', () => {
    const gain = normalisationGain(0.9, { targetDbfs: PEAK_TARGET_TONE_DBFS })
    expect(0.9 * gain).toBeCloseTo(dbToGain(PEAK_TARGET_TONE_DBFS), 6)
  })

  it('tính gain từ mảng mẫu', () => {
    const samples = new Float32Array([0, 0.25, -0.5, 0.1])
    expect(normalisationGainForSamples(samples)).toBeCloseTo(normalisationGain(0.5), 6)
  })
})

describe('normalize — clampVolume', () => {
  it('giữ trong khoảng 0..1', () => {
    expect(clampVolume(-1)).toBe(0)
    expect(clampVolume(0.6)).toBe(0.6)
    expect(clampVolume(2)).toBe(1)
    expect(clampVolume(Number.NaN)).toBe(1)
  })
})

describe('recorder — chọn định dạng ghi âm', () => {
  it('ưu tiên audio/mp4 (Safari iOS)', () => {
    const supported = ['audio/mp4', 'audio/webm;codecs=opus']
    expect(pickRecordingMime((m) => supported.includes(m))).toBe('audio/mp4')
  })

  it('rơi xuống webm/opus khi không có mp4', () => {
    const supported = ['audio/webm;codecs=opus', 'audio/webm']
    expect(pickRecordingMime((m) => supported.includes(m))).toBe('audio/webm;codecs=opus')
  })

  it('trả undefined khi không định dạng nào được hỗ trợ', () => {
    expect(pickRecordingMime(() => false)).toBeUndefined()
  })

  it('bỏ qua định dạng làm isTypeSupported ném lỗi', () => {
    const picked = pickRecordingMime((mime) => {
      if (mime === 'audio/mp4') throw new TypeError('bad mime')
      return mime === 'audio/webm;codecs=opus'
    })
    expect(picked).toBe('audio/webm;codecs=opus')
  })

  it('giữ đúng thứ tự dò của 05 §6 mục 7', () => {
    expect(RECORDING_MIME_CANDIDATES[0]).toBe('audio/mp4')
    expect(RECORDING_MIME_CANDIDATES[1]).toBe('audio/webm;codecs=opus')
  })
})

describe('tones — nốt nhạc', () => {
  it('tính tần số theo bình quân luật', () => {
    expect(noteHz('A4')).toBeCloseTo(440, 6)
    expect(noteHz('C5')).toBeCloseTo(523.25, 2)
    expect(noteHz('A5')).toBeCloseTo(880, 6)
    expect(noteHz('C3')).toBeCloseTo(130.81, 2)
    expect(() => noteHz('H9')).toThrow()
  })
})

describe('tones — "ting" của sao', () => {
  it('đúng 5 nốt C5 D5 E5 G5 A5 tăng dần', () => {
    expect(STAR_TONE_FREQS).toHaveLength(5)
    for (let i = 1; i < STAR_TONE_FREQS.length; i += 1) {
      const prev = STAR_TONE_FREQS[i - 1] ?? 0
      const cur = STAR_TONE_FREQS[i] ?? 0
      expect(cur).toBeGreaterThan(prev)
    }
    expect(STAR_TONE_FREQS[0]).toBeCloseTo(noteHz('C5'), 6)
    expect(STAR_TONE_FREQS[4]).toBeCloseTo(noteHz('A5'), 6)
  })

  it('ngắn hơn 400 ms và đỉnh ≈ −12 dBFS', () => {
    expect(STAR_TONE_MS).toBeLessThanOrEqual(400)
    for (const index of [0, 1, 2, 3, 4] as const) {
      const spec = starToneSpec(index)
      expect(spec.durMs).toBeLessThanOrEqual(400)
      expect(spec.peak).toBeCloseTo(dbToGain(PEAK_TARGET_TONE_DBFS), 6)
      expect(spec.voice).toBe('marimba')
    }
  })
})

describe('tones — biên độ thành phần', () => {
  it('tổng biên độ các sin bằng 1 để đỉnh đúng mục tiêu', () => {
    for (const voice of ['marimba', 'bell', 'bass'] as const) {
      const sum = normalisedPartials(voice).reduce((acc, [, amp]) => acc + amp, 0)
      expect(sum).toBeCloseTo(1, 6)
    }
  })
})

describe('tones — nhạc tiệc', () => {
  const score = buildPartyScore()

  it('dài 5–8 giây', () => {
    const total = scoreDurationMs(score)
    expect(total).toBeGreaterThanOrEqual(5000)
    expect(total).toBeLessThanOrEqual(8000)
  })

  it('không lặp: mỗi ô nhịp của giai điệu là một chuỗi nốt khác nhau', () => {
    const barMs = PARTY_BEAT_MS * 4
    const bars = new Map<number, number[]>()
    for (const note of score) {
      if (note.voice !== 'marimba') continue
      const bar = Math.floor(note.startMs / barMs)
      const list = bars.get(bar) ?? []
      list.push(Math.round(note.freq))
      bars.set(bar, list)
    }
    expect(bars.size).toBeGreaterThanOrEqual(4)
    const shapes = [...bars.values()].map((list) => list.join('-'))
    expect(new Set(shapes).size).toBe(shapes.length)
  })

  it('không quá 3 bè cùng lúc và tổng đỉnh ≈ −10 dBFS', () => {
    expect(maxOverlap(score)).toBeLessThanOrEqual(3)
    const peakByVoice = new Map<string, number>()
    for (const note of score) peakByVoice.set(note.voice, note.peak)
    const sum = [...peakByVoice.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(dbToGain(PEAK_TARGET_PARTY_DBFS), 6)
  })

  it('mọi nốt đều có thời lượng dương và nằm trong đoạn', () => {
    const total = scoreDurationMs(score)
    for (const note of score) {
      expect(note.durMs).toBeGreaterThan(0)
      expect(note.startMs).toBeGreaterThanOrEqual(0)
      expect(note.startMs + note.durMs).toBeLessThanOrEqual(total)
      expect(note.freq).toBeGreaterThan(20)
    }
  })
})

describe('AudioManager — ducking theo vai clip', () => {
  it('chỉ giọng câu lệnh và lời khen mới hạ âm khác', () => {
    expect(isVoiceRole('instruction')).toBe(true)
    expect(isVoiceRole('praise')).toBe(true)
    expect(isVoiceRole('sound')).toBe(false)
    expect(isVoiceRole('bridge')).toBe(false)
    expect(isVoiceRole(undefined)).toBe(false)
  })
})
