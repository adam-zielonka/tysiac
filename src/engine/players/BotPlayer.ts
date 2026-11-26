import type { Action, Deal } from '../Deal'
import { Player } from '../Player'

/** Splits a decision by phase; a single legal action is taken at once. */
export abstract class BotPlayer extends Player {
  choose(deal: Deal, actions: Action[]): Action {
    if (actions.length < 2) return actions[0]
    switch (deal.phase) {
      case 'bidding':
        return this.bid(deal, actions)
      case 'giving':
        return this.give(deal, actions)
      case 'contract':
        return this.declare(deal, actions)
      case 'play':
        return this.play(deal, actions)
      default:
        return actions[0]
    }
  }

  protected abstract bid(deal: Deal, actions: Action[]): Action
  protected abstract give(deal: Deal, actions: Action[]): Action
  protected abstract declare(deal: Deal, actions: Action[]): Action
  protected abstract play(deal: Deal, actions: Action[]): Action
}
