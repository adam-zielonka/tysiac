import type { Player } from './Player'
import { PlayerType } from './PlayerType'
import type { Random } from './random'
import { AZPlayer } from './players/AZPlayer'
import { HumanPlayer } from './players/HumanPlayer'
import { MCTSPlayer } from './players/MCTSPlayer'
import { RandomPlayer } from './players/RandomPlayer'
import { RolloutPlayer } from './players/RolloutPlayer'
import { SimplePlayer } from './players/SimplePlayer'
import { TacticalPlayer } from './players/TacticalPlayer'

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
    case PlayerType.Random:
      return new RandomPlayer(id, random)
    case PlayerType.Simple:
      return new SimplePlayer(id, random)
    case PlayerType.Tactical:
      return new TacticalPlayer(id, random)
    case PlayerType.Rollout:
      return new RolloutPlayer(id, random)
    case PlayerType.MCTS:
      return new MCTSPlayer(id, random)
    case PlayerType.AZ:
      return new AZPlayer(id, random)
  }
}
