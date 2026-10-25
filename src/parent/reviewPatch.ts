import type { PromptLevel, Trial } from '@/data/types'

export type InvalidReason = NonNullable<Trial['invalidReason']>

export type PromptLevelPatch = Pick<Trial, 'promptLevel' | 'promptLevelAuto' | 'promptLevelSource'>

/**
 * Ba mẹ sửa mức gợi ý: giữ nguyên giá trị app tự ghi (`promptLevelAuto`)
 * và đánh dấu nguồn là `parent_edit` (F-14 tiêu chí 1).
 */
export function promptLevelPatch(
  trial: Pick<Trial, 'promptLevelAuto'>,
  next: PromptLevel,
): PromptLevelPatch {
  return {
    promptLevel: next,
    promptLevelAuto: trial.promptLevelAuto,
    promptLevelSource: 'parent_edit',
  }
}

export interface ValidityPatch {
  valid: boolean
  invalidReason?: InvalidReason
}

export function validityPatch(valid: boolean, reason?: InvalidReason): ValidityPatch {
  return valid ? { valid: true, invalidReason: undefined } : { valid: false, invalidReason: reason ?? 'other' }
}

/** Chữ trung tính cho kết quả một lượt: "Tự làm" hoặc "Có gợi ý" (không dùng đúng/sai). */
export function trialResultKey(
  trial: Pick<Trial, 'promptLevel' | 'correctFirstTry'>,
): 'independent' | 'prompted' {
  return trial.promptLevel === 'independent' && trial.correctFirstTry ? 'independent' : 'prompted'
}
