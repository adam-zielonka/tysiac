import type { Action, Deal } from '../Deal'
import { PlayerType } from '../PlayerType'
import {
  ACE,
  ORDER_OF,
  POINTS_OF,
  cardAt,
  cardIndex,
  isMarriageCard,
  maskOf,
} from './bits'
import { auctionEstimate, bidUpTo, greedyCard, playAction } from './heuristics'
import { PlayState } from './PlayState'
import { BotPlayer } from './BotPlayer'

/**
 * Bolek, greedy: bids while the hand estimate covers the next bid (no
 * margin), gives away the cards with the fewest points (aces and marriage
 * cards only when nothing else is left), plays exactly the bid and grabs
 * tricks with the cheapest winning card.
 */
export class SimplePlayer extends BotPlayer {
  readonly type = PlayerType.Simple

  protected bid(deal: Deal, actions: Action[]): Action {
    return bidUpTo(deal, actions, auctionEstimate(maskOf(deal.hand(deal.turn))))
  }

  protected give(deal: Deal, actions: Action[]): Action {
    const hand = maskOf(deal.hand(deal.turn))
    const to = deal.pendingRecipients()[0]
    let chosen = -1
    let cost = Infinity
    for (const card of deal.hand(deal.turn)) {
      const i = cardIndex(card)
      // Aces and marriage cards only when nothing else is left.
      const value =
        POINTS_OF[i] * 10 +
        (ORDER_OF[i] === ACE ? 1000 : 0) +
        (isMarriageCard(hand, i) ? 1000 : 0) -
        ORDER_OF[i]
      if (value < cost) {
        cost = value
        chosen = i
      }
    }
    const card = cardAt(chosen)
    return (
      actions.find(a => a.type === 'give' && a.card === card && a.to === to) ?? actions[0]
    )
  }

  protected declare(_deal: Deal, actions: Action[]): Action {
    return actions[0]
  }

  protected play(deal: Deal, actions: Action[]): Action {
    return playAction(actions, greedyCard(PlayState.fromDeal(deal)))
  }
}
