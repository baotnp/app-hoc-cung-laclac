import { vi } from '@/i18n/vi'
import type { AudioRole, GeneralizationCheck, ItemCategory, ItemStatus } from '@/data/types'

export const AUDIO_ROLE_LABEL: Record<AudioRole, string> = {
  instruction: vi.content.roleInstruction,
  praise: vi.content.rolePraise,
  bridge: vi.content.roleBridge,
  sound: vi.content.roleSound,
  then: vi.content.roleThen,
}

/** Các vai ba mẹ thu được ở màn Nội dung (vai "then" dùng chung cho phần thưởng). */
export const EDITABLE_AUDIO_ROLES: AudioRole[] = ['instruction', 'praise', 'bridge', 'sound']

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  pet_animal: vi.category.pet_animal,
  personal_object: vi.category.personal_object,
  daily_object: vi.category.daily_object,
  reward: vi.category.reward,
  fruit: vi.category.fruit,
  vehicle: vi.category.vehicle,
  other: vi.category.other,
}

export const CATEGORY_ORDER: ItemCategory[] = [
  'pet_animal',
  'personal_object',
  'daily_object',
  'fruit',
  'vehicle',
  'reward',
  'other',
]

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  new: vi.progress.statusNew,
  learning: vi.progress.statusLearning,
  mastered_ipad: vi.progress.statusMasteredIpad,
  generalized: vi.progress.statusGeneralized,
}

export const CHECK_RESULT_LABEL: Record<GeneralizationCheck['result'], string> = {
  did_it: vi.session.resultDidIt,
  with_help: vi.session.resultWithHelp,
  not_yet: vi.session.resultNotYet,
}
