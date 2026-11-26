import type { Action } from '../Deal'
import { Player } from '../Player'
import { PlayerType } from '../PlayerType'

/** Moves come from the interface; `choose` is never called by the game. */
export class HumanPlayer extends Player {
  readonly type = PlayerType.Human

  choose(_deal: unknown, actions: Action[]): Action {
    return actions[0]
  }
}
