import type { Action, Deal } from '../Deal'
import { PlayerType } from '../PlayerType'
import { BotPlayer } from './BotPlayer'
import {
  flatMonteCarloPlay,
  monteCarloBid,
  monteCarloContract,
  monteCarloGift,
} from './montecarlo'

/**
 * Bruno, flat Monte Carlo: every legal card is tried on the same sampled
 * layouts of the hidden cards and played out with the tactical policy; the
 * average utility d_i − (d_j + d_k) / 2 decides. The auction, gifts and the
 * contract come from simulated deals with Bruno as the declarer.
 */
export class RolloutPlayer extends BotPlayer {
  readonly type = PlayerType.Rollout
  /** Sampled layouts per decision in the play; each legal card is played out on all. */
  samples = 100
  auctionSamples = 150
  contractSamples = 200
  giftSamples = 60
  giftCandidates = 4
  /** Bid the next value only if P(points ≥ value) reaches this. */
  bidThreshold = 0.6
  /** Safety net in milliseconds; the sample counts normally finish well before. */
  timeLimit = 250

  private deadline(): number {
    return performance.now() + this.timeLimit
  }

  protected bid(deal: Deal, actions: Action[]): Action {
    return monteCarloBid(
      deal,
      actions,
      this.random,
      this.auctionSamples,
      this.bidThreshold,
      this.deadline(),
    )
  }

  protected give(deal: Deal, actions: Action[]): Action {
    return monteCarloGift(
      deal,
      actions,
      this.random,
      this.giftSamples,
      this.giftCandidates,
      this.deadline(),
    )
  }

  protected declare(deal: Deal, actions: Action[]): Action {
    return monteCarloContract(
      deal,
      actions,
      this.random,
      this.contractSamples,
      this.deadline(),
    )
  }

  protected play(deal: Deal, actions: Action[]): Action {
    return flatMonteCarloPlay(deal, actions, this.random, this.samples, this.deadline())
  }
}
