import type { Action, Deal } from '../Deal'
import { PlayerType } from '../PlayerType'
import { BID_STEP } from '../rules'
import { maskOf } from './bits'
import {
  auctionEstimate,
  bidUpTo,
  contractUpTo,
  declarerEstimate,
  heuristicGift,
  playAction,
  tacticalCard,
} from './heuristics'
import { PlayState } from './PlayState'
import { BotPlayer } from './BotPlayer'

/** Points kept in reserve below the hand estimate when bidding. */
export const TACTICAL_MARGIN = 10

/**
 * Tosia: bids up to the hand estimate minus a margin, gives away the least
 * useful cards, raises the contract when the eight kept cards allow it and
 * plays with `tacticalCard` (played cards, voids and trump in mind).
 */
export class TacticalPlayer extends BotPlayer {
  readonly type = PlayerType.Tactical

  protected bid(deal: Deal, actions: Action[]): Action {
    const estimate = auctionEstimate(maskOf(deal.hand(deal.turn)))
    return bidUpTo(deal, actions, estimate - TACTICAL_MARGIN)
  }

  protected give(deal: Deal, actions: Action[]): Action {
    return heuristicGift(deal, actions)
  }

  protected declare(deal: Deal, actions: Action[]): Action {
    const estimate = declarerEstimate(maskOf(deal.hand(deal.turn)))
    const limit = Math.floor((estimate - TACTICAL_MARGIN) / BID_STEP) * BID_STEP
    return contractUpTo(actions, limit)
  }

  protected play(deal: Deal, actions: Action[]): Action {
    return playAction(actions, tacticalCard(PlayState.fromDeal(deal)))
  }
}
