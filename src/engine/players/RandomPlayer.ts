import type { Action, Deal } from '../Deal'
import { Player } from '../Player'
import { PlayerType } from '../PlayerType'
import { pick } from '../random'

/** Temporary baseline; replaced by the bot implementation. */
export class RandomPlayer extends Player {
  readonly type = PlayerType.Random

  choose(deal: Deal, actions: Action[]): Action {
    if (deal.phase === 'bidding') {
      const pass = actions.find(action => action.type === 'pass')!
      const raise = actions.find(action => action.type === 'bid')
      return raise && this.random() < 0.5 ? raise : pass
    }
    if (deal.phase === 'contract') return actions[0]
    return pick(this.random, actions)
  }
}
