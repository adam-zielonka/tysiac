import type { Player } from './Player'
import { PlayerType } from './PlayerType'
import type { Random } from './random'
import { HumanPlayer } from './players/HumanPlayer'
import { RandomPlayer } from './players/RandomPlayer'

export { PlayerType }

export const DEFAULT_PLAYERS: readonly PlayerType[] = [
  PlayerType.Human,
  PlayerType.Tactical,
  PlayerType.Rollout,
]

export function createPlayer(
  type: PlayerType,
  id: number,
  random: Random = Math.random,
): Player {
  switch (type) {
    case PlayerType.Human:
      return new HumanPlayer(id, random)
    default:
      return new RandomPlayer(id, random)
  }
}
