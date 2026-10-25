/**
 * Mục tiêu ngày của bé (01 §5.2): bảng sao vòng 1 đủ + tiệc đã chạy.
 * Vòng 2 là phần thêm, không bắt buộc. Không có đường nào làm giảm sao.
 */
import type { Round, Session } from '@/data/types'

/** MVP: bảng sao 5 ô (GĐ-06); giá trị thật lấy từ `configSnapshot.trialsPerRound`. */
export const DEFAULT_TRIALS_PER_ROUND = 5

/** Số ô sao sáng của một vòng: mỗi lượt xong sáng 1 ô, chỉ tăng, không vượt số ô của bảng. */
export function starsForRound(completedTrials: number, trialsPerRound = DEFAULT_TRIALS_PER_ROUND): number {
  const done = Math.max(0, Math.floor(completedTrials))
  return Math.min(done, Math.max(0, trialsPerRound))
}

export function isRoundComplete(
  round: Pick<Round, 'starsLit' | 'partyShown'>,
  trialsPerRound = DEFAULT_TRIALS_PER_ROUND,
): boolean {
  return round.starsLit >= trialsPerRound && round.partyShown
}

/** Ngày của bé xong = vòng 1 đủ sao và tiệc đã chạy. */
export function isDayComplete(
  session: Pick<Session, 'rounds'> & { configSnapshot?: Pick<Session['configSnapshot'], 'trialsPerRound'> },
): boolean {
  const first = session.rounds.find(r => r.index === 0) ?? session.rounds[0]
  if (!first) return false
  const trialsPerRound = session.configSnapshot?.trialsPerRound ?? DEFAULT_TRIALS_PER_ROUND
  return isRoundComplete(first, trialsPerRound)
}
