// Bảng tra `Exercise.type` → `GameModule` (05 §2). Engine không biết trước loại bài nào;
// thêm loại mới bằng `registerGame` mà không sửa máy trạng thái.

import type { ExerciseType } from '@/data/types'
import type { GameModule } from './games/types'
import { chooseFromTwoGame } from './games/chooseFromTwo'
import { peekabooGame } from './games/peekaboo'
import { sayNameGame } from './games/sayName'
import { sequenceCardsGame } from './games/sequenceCards'
import { coachDemoGame } from './games/coachDemo'

const games = new Map<ExerciseType, GameModule<unknown>>()

export function registerGame(type: ExerciseType, module: GameModule<unknown>): void {
  games.set(type, module)
}

export function getGame(type: ExerciseType): GameModule<unknown> | undefined {
  return games.get(type)
}

export function requireGame(type: ExerciseType): GameModule<unknown> {
  const module = games.get(type)
  if (!module) throw new Error(`Chưa có GameModule cho loại bài: ${type}`)
  return module
}

export function registeredGameTypes(): ExerciseType[] {
  return [...games.keys()]
}

registerGame('choose_from_two', chooseFromTwoGame)
registerGame('peekaboo', peekabooGame as GameModule<unknown>)
registerGame('say_name', sayNameGame as GameModule<unknown>)
registerGame('sequence_cards', sequenceCardsGame as GameModule<unknown>)
registerGame('coach_demo', coachDemoGame as GameModule<unknown>)
