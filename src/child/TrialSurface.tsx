// Chọn màn một lượt theo `Exercise.type` (05 §3). Buổi học không cần biết loại bài nào;
// thêm loại mới = thêm một màn và một dòng ở đây.

import type { ExerciseType } from '@/data/types'
import { TrialScreen } from './TrialScreen'
import type { TrialScreenProps } from './TrialScreen'
import { PeekabooScreen } from './PeekabooScreen'
import { SayNameScreen } from './SayNameScreen'
import { SequenceCardsScreen } from './SequenceCardsScreen'
import { CoachDemoScreen } from './CoachDemoScreen'

export type { TrialScreenProps } from './TrialScreen'

const screens: Partial<Record<ExerciseType, (props: TrialScreenProps) => React.ReactElement>> = {
  choose_from_two: TrialScreen,
  peekaboo: PeekabooScreen,
  say_name: SayNameScreen,
  sequence_cards: SequenceCardsScreen,
  coach_demo: CoachDemoScreen,
}

export function TrialSurface({ type, ...props }: TrialScreenProps & { type: ExerciseType }) {
  // Loại chưa có màn riêng thì dùng màn chọn hình — bài vẫn chạy được thay vì
  // làm hỏng cả buổi học của bé.
  const Screen = screens[type] ?? TrialScreen
  return <Screen {...props} />
}
