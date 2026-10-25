/**
 * Điểm vào của module âm thanh (05 §3).
 *
 * Dùng: `import { audio } from '@/audio'` rồi `audio.unlock()` trong handler
 * chạm của màn "chạm để bắt đầu", `audio.preloadBlobs(...)` trước buổi học,
 * `audio.play(mediaId, { role: 'instruction' })` khi chạy lượt.
 *
 * Module này **không** có bất kỳ hàm nào phát âm báo sai (04 §4).
 */

import { AudioManager } from "./AudioManager";

export {
  AudioManager,
  isVoiceRole,
  FADE_IN_S,
  FADE_OUT_S,
  MAX_CONCURRENT,
  MIN_GAP_MS,
} from "./AudioManager";
export type {
  PreloadEntry,
  PlayOptions,
  PlaySeqOptions,
  InterruptionListener,
  ReadyListener,
} from "./AudioManager";

export type { AudioInterruptionReason } from "./unlock";
export { isAudioSupported } from "./unlock";

export {
  ToneGenerator,
  buildPartyScore,
  majorArpeggioHz,
  maxOverlap,
  noteHz,
  normalisedPartials,
  scoreDurationMs,
  starToneSpec,
  PARTY_BEAT_MS,
  STAR_TONE_FREQS,
  STAR_TONE_MS,
  STAR_TONE_NOTES,
  STAR_TONE_PEAK,
} from "./tones";
export type { StarToneIndex, ToneNote, ToneVoice } from "./tones";

export {
  CHEER_CALM_MAX_MS,
  CHEER_CALM_TRIM_DB,
  CHEER_MAX_MS,
  CHEER_PEAK_CEILING,
  CLAP_DELAY_MS,
  PEAK_TARGET_CHEER_DBFS,
  buildCheerPlan,
  buildClapPlan,
  buildFanfarePlan,
  cheerMaxMs,
  cheerPlanDurationMs,
  cheerPlanPeak,
  playCheer,
  playClap,
  playFanfare,
} from "./cheer";
export type {
  CheerClap,
  CheerLevel,
  CheerNote,
  CheerOptions,
  CheerPlan,
} from "./cheer";

export {
  MAX_RECORDING_MS,
  RECORDING_MIME_CANDIDATES,
  RecorderError,
  analyseAudioBlob,
  canRecord,
  cancelRecording,
  isRecording,
  pickRecordingMime,
  startRecording,
  stopRecording,
} from "./recorder";
export type {
  AudioAnalysis,
  RecorderErrorCode,
  RecordingHandle,
  RecordingResult,
  StartRecordingOptions,
} from "./recorder";

export {
  DUCK_DB,
  PEAK_TARGET_ANIMAL_DBFS,
  PEAK_TARGET_PARTY_DBFS,
  PEAK_TARGET_TONE_DBFS,
  PEAK_TARGET_VOICE_DBFS,
  clampVolume,
  dbToGain,
  gainToDb,
  normalisationGain,
  normalisationGainForSamples,
  peakOfBuffer,
  peakOfSamples,
} from "./normalize";

/** Thể hiện dùng chung cho toàn app (một AudioContext duy nhất). */
export const audio = new AudioManager();
