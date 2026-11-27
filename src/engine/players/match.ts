import type { Deal } from '../Deal'
import { BASE_MAX_BID, BID_STEP, LOCK_SCORE, TARGET_SCORE } from '../rules'

/*
 * Match awareness from `Player.matchScores` (totals before the deal, public).
 * Three simple rules cover the situations where the score changes what a
 * deal is worth:
 *
 * - from 800 on a defender writes nothing, so only declaring can score;
 * - a declarer who makes a contract that takes them to 1000 wins the match
 *   at once, which is worth more than the points themselves;
 * - well ahead in the match, an extra risky declaration is not needed.
 *
 * Simulated deals ignore the match; only the final choices use these rules.
 * With all scores at zero (simulations, tests) nothing changes.
 */

/** Extra utility for winning the match by making a contract. */
export const MATCH_WIN_BONUS = 300
/** Lead over both rivals from which a bot takes less risk in the auction. */
export const SAFE_LEAD = 200
/** Points added to (bold) or taken from (careful) a heuristic bid limit. */
export const MOOD_POINTS = 10

/**
 * Appetite for risk in the auction: 1 bolder, −1 more careful, 0 neutral.
 * Bolder when defending scores nothing for this seat (800+) or when the
 * rival leading the auction could reach 1000 with the current bid (or a
 * contract of 120 after the musik); more careful when it leads both rivals
 * by `SAFE_LEAD` or more and neither applies.
 */
export function auctionMood(
  scores: readonly number[],
  seat: number,
  highestBid: number,
  highestBidder: number,
): number {
  const own = scores[seat]
  if (own >= LOCK_SCORE) return 1
  if (
    highestBidder >= 0 &&
    highestBidder !== seat &&
    scores[highestBidder] + Math.max(highestBid, BASE_MAX_BID) >= TARGET_SCORE
  ) {
    return 1
  }
  const lead = Math.min(
    ...scores.map((score, other) => (other === seat ? Infinity : own - score)),
  )
  return lead >= SAFE_LEAD ? -1 : 0
}

/** Auction mood of the player on turn in `deal` (see `auctionMood`). */
export function moodOf(deal: Deal, scores: readonly number[]): number {
  return auctionMood(scores, deal.turn, deal.s.highestBid, deal.s.highestBidder)
}

/** Contract value that would take `seat` to 1000 (may be far above any option). */
export function valueToWin(scores: readonly number[], seat: number): number {
  return TARGET_SCORE - scores[seat]
}

/**
 * Score changes as the match writes them: a defender at 800+ gets nothing,
 * a declarer reaching 1000 also gets `MATCH_WIN_BONUS`.
 */
export function matchDeltas(
  deltas: readonly number[],
  declarer: number,
  scores: readonly number[],
): number[] {
  return deltas.map((delta, seat) => {
    if (seat !== declarer) return scores[seat] >= LOCK_SCORE ? 0 : delta
    return scores[seat] + delta >= TARGET_SCORE ? delta + MATCH_WIN_BONUS : delta
  })
}

/**
 * The smallest contract that still wins the match when `limit` already
 * reaches it: points beyond 1000 only add risk. Otherwise `limit` unchanged.
 */
export function safeContractLimit(
  scores: readonly number[],
  seat: number,
  limit: number,
): number {
  const toWin = Math.ceil(valueToWin(scores, seat) / BID_STEP) * BID_STEP
  return limit >= toWin ? toWin : limit
}

/**
 * Do a defender's own points not matter in this deal? True at 800+ and when
 * the declarer would win the match by making the contract: then only
 * defeating it counts.
 */
export function onlyDefeatCounts(
  scores: readonly number[],
  seat: number,
  declarer: number,
  contract: number,
): boolean {
  return scores[seat] >= LOCK_SCORE || scores[declarer] + contract >= TARGET_SCORE
}
