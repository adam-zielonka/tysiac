import type { Action, Deal } from '../Deal'
import { PlayerType } from '../PlayerType'
import { pick } from '../random'
import { BotPlayer } from './BotPlayer'

/**
 * Felek: in the auction passes or raises by one step with equal chance,
 * declares the minimal contract, gives random cards and plays a uniformly
 * random legal card.
 */
export class RandomPlayer extends BotPlayer {
  readonly type = PlayerType.Random

  protected bid(_deal: Deal, actions: Action[]): Action {
    const pass = actions.find(action => action.type === 'pass')!
    const raise = actions.find(action => action.type === 'bid')
    return raise && this.random() < 0.5 ? raise : pass
  }

  protected give(_deal: Deal, actions: Action[]): Action {
    return pick(this.random, actions)
  }

  protected declare(_deal: Deal, actions: Action[]): Action {
    return actions[0]
  }

  protected play(_deal: Deal, actions: Action[]): Action {
    return pick(this.random, actions)
  }
}
