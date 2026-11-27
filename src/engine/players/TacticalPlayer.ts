import type { Action, Deal } from '../Deal'
import { PlayerType } from '../PlayerType'
import { BID_STEP } from '../rules'
import { maskOf, meldValuesOf } from './bits'
import {
  auctionEstimate,
  bidUpTo,
  contractUpTo,
  declarerEstimate,
  heuristicGift,
  playAction,
  tacticalCard,
} from './heuristics'
import { MOOD_POINTS, moodOf, safeContractLimit } from './match'
import { PlayState } from './PlayState'
import { BotPlayer } from './BotPlayer'

/** Points kept in reserve below the hand estimate when bidding. */
export const TACTICAL_MARGIN = 10
/**
 * Points kept in reserve below the estimate of the eight kept cards when
 * raising the contract. The estimate misses by about 21 points (RMSE), and
 * b · (2 P(b) − 1) is highest about 30 points below it; seeded Tosia-only
 * series confirm 30 (+6 points per deal over 10).
 */
export const TACTICAL_CONTRACT_MARGIN = 30

/**
 * Tosia: bids up to the hand estimate minus a margin (10 points less or more
 * as the match score asks, see `auctionMood`), gives away the least useful
 * cards, raises the contract up to the estimate of the eight kept cards
 * minus a larger margin (but not beyond what wins the match) and plays with
 * `tacticalCard` (played cards, voids, trump and the overtaking inference in
 * mind).
 */
export class TacticalPlayer extends BotPlayer {
  readonly type = PlayerType.Tactical
  /** Points kept in reserve below the estimate in the auction. */
  margin = TACTICAL_MARGIN
  /** Points kept in reserve below the estimate when raising the contract. */
  contractMargin = TACTICAL_CONTRACT_MARGIN

  protected bid(deal: Deal, actions: Action[]): Action {
    const mood = moodOf(deal, this.matchScores)
    const estimate = auctionEstimate(maskOf(deal.hand(deal.turn)), meldValuesOf(deal))
    return bidUpTo(deal, actions, estimate - this.margin + mood * MOOD_POINTS)
  }

  protected give(deal: Deal, actions: Action[]): Action {
    return heuristicGift(deal, actions)
  }

  protected declare(deal: Deal, actions: Action[]): Action {
    const estimate = declarerEstimate(maskOf(deal.hand(deal.turn)), meldValuesOf(deal))
    const limit = Math.floor((estimate - this.contractMargin) / BID_STEP) * BID_STEP
    return contractUpTo(actions, safeContractLimit(this.matchScores, deal.turn, limit))
  }

  protected play(deal: Deal, actions: Action[]): Action {
    return playAction(actions, tacticalCard(PlayState.fromDeal(deal)))
  }
}
