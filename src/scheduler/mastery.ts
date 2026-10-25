/**
 * Trạng thái một mục (06 Q4 / 01 §5.2). Hàm thuần: nhận dữ liệu đã lọc theo mục.
 * Không dùng từ ngữ đánh giá tiêu cực; `ItemStatus` chỉ mô tả tiến trình.
 */
import type { GeneralizationCheck, ItemStatus, Trial } from '@/data/types'

export interface MasteryRule {
  metric?: 'independent_correct_rate'
  threshold: number
  lastSessions: number
  minTrials: number
}

export const DEFAULT_MASTERY: MasteryRule = {
  metric: 'independent_correct_rate',
  threshold: 0.8,
  lastSessions: 5,
  minTrials: 6,
}

/** `generalized` = ≥2 xác nhận `did_it` bậc ≥3 vào ≥2 ngày khác nhau (GĐ-05). */
export function isGeneralized(checks: GeneralizationCheck[]): boolean {
  const dates = new Set<string>()
  for (const c of checks) {
    if (c.result === 'did_it' && c.level >= 3) dates.add(c.date)
  }
  return dates.size >= 2
}

/**
 * `trials` và `checks` đã lọc theo một mục. Trial `valid=false` bị loại.
 * `generalized` ưu tiên hơn `mastered_ipad`.
 */
export function itemStatusFrom(
  trials: Trial[],
  checks: GeneralizationCheck[],
  mastery: MasteryRule = DEFAULT_MASTERY,
): ItemStatus {
  if (isGeneralized(checks)) return 'generalized'

  const valid = trials.filter(t => t.valid)
  if (valid.length === 0) return 'new'

  // `lastSessions` buổi gần nhất **có mục này**, xếp theo lượt mới nhất của mỗi buổi.
  const lastAtBySession = new Map<string, number>()
  for (const t of valid) {
    const prev = lastAtBySession.get(t.sessionId)
    if (prev === undefined || t.startedAt > prev) lastAtBySession.set(t.sessionId, t.startedAt)
  }
  const recentSessions = new Set(
    [...lastAtBySession.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, mastery.lastSessions))
      .map(([sessionId]) => sessionId),
  )

  const recentTrials = valid.filter(t => recentSessions.has(t.sessionId))
  const total = recentTrials.length
  if (total < mastery.minTrials) return 'learning'
  const independent = recentTrials.filter(t => t.correctFirstTry && t.promptLevel === 'independent').length
  return independent / total >= mastery.threshold ? 'mastered_ipad' : 'learning'
}
