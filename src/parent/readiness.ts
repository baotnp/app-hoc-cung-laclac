import type { AudioRole, Exercise, Item } from '@/data/types'
import { audioDelivery } from '@/session/sessionService'

/** Ba mức của một mục ở màn ba mẹ (docs/04 §4: giọng luôn là giọng ba mẹ thật). */
export type ReadinessLevel =
  /** Đủ dùng: ảnh và mọi vai đều đã có bản thu. */
  | 'recorded'
  /** Ba mẹ đọc trực tiếp: còn vai chưa thu nhưng đã có câu chữ. */
  | 'live'
  /** Còn thiếu: chưa có ảnh, hoặc còn vai không có cả bản thu lẫn câu chữ. */
  | 'missing'

export interface ItemReadiness {
  item: Item
  missingImage: boolean
  /** Vai thiếu hẳn (không bản thu, không câu chữ) — mục chưa vào được buổi học. */
  missingAudio: AudioRole[]
  /** Vai đã có câu chữ nhưng chưa thu — buổi học vẫn chạy, ba mẹ đọc trực tiếp. */
  liveAudio: AudioRole[]
  /** Mục vào được buổi học (có thể còn vai cần ba mẹ đọc trực tiếp). */
  ready: boolean
}

export function requiredRolesFor(exercise: Exercise): AudioRole[] {
  return [...(exercise.config.requiredAudio ?? [])]
}

/**
 * Mục vào được buổi học khi có ảnh và, với mỗi vai bài yêu cầu, có bản thu HOẶC câu chữ
 * để ba mẹ đọc trực tiếp (F-03 tiêu chí 4, đã nới theo chế độ ba mẹ đọc trực tiếp).
 */
export function checkItem(item: Item, requiredAudio: readonly AudioRole[]): ItemReadiness {
  const missingImage = item.imageMediaId === undefined
  const missingAudio: AudioRole[] = []
  const liveAudio: AudioRole[] = []
  for (const role of requiredAudio) {
    const delivery = audioDelivery(item, role)
    if (delivery === 'live') liveAudio.push(role)
    else if (delivery === 'none') missingAudio.push(role)
  }
  return {
    item,
    missingImage,
    missingAudio,
    liveAudio,
    ready: !item.archived && !missingImage && missingAudio.length === 0,
  }
}

export function readinessLevel(check: ItemReadiness): ReadinessLevel {
  if (!check.ready) return 'missing'
  return check.liveAudio.length > 0 ? 'live' : 'recorded'
}

/** Vai âm cần có cho từng mã mục, gộp từ các bài đang bật. */
export function requiredRolesByItemKey(exercises: readonly Exercise[]): Map<string, AudioRole[]> {
  const map = new Map<string, AudioRole[]>()
  for (const ex of exercises) {
    const roles = requiredRolesFor(ex)
    for (const key of ex.config.itemPool.keys) {
      const current = map.get(key) ?? []
      for (const role of roles) if (!current.includes(role)) current.push(role)
      map.set(key, current)
    }
  }
  return map
}
