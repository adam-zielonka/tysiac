import type { Action, Deal } from '../Deal'
import { BASE_MAX_BID, BID_STEP, bidRange, nextSeat } from '../rules'
import type { Random } from '../random'
import { sampleDeal } from '../sampling'
import { cardAt, cardIndex, marriageTotal, maskOf } from './bits'
import { giftOrder, tacticalCard } from './heuristics'
import { MATCH_WIN_BONUS, matchDeltas, moodOf, valueToWin } from './match'
import { PlayState } from './PlayState'

/*
 * Monte Carlo helpers shared by Bruno and Monte. Every hidden card comes
 * from `sampleDeal(view)`; the rest of the deal is played out with the
 * tactical policy.
 */

/** Plays the deal to the end with `tacticalCard` for every seat. */
export function rollout(st: PlayState): PlayState {
  while (!st.isFinished) st.play(tacticalCard(st))
  return st
}

/** u_i = d_i − (d_j + d_k) / 2 from the final score changes of a deal. */
export function utility(deltas: readonly number[], player: number): number {
  return deltas[player] - (deltas[0] + deltas[1] + deltas[2] - deltas[player]) / 2
}

/** Share of outcomes reaching at least `value`. */
export function chance(outcomes: readonly number[], value: number): number {
  let count = 0
  for (const outcome of outcomes) if (outcome >= value) count++
  return outcomes.length ? count / outcomes.length : 0
}

/**
 * Expected score of declaring `value`: b · (2 P(points ≥ b) − 1). When making
 * it reaches `toWin` (wins the match), a made contract is worth `toWin` plus
 * `MATCH_WIN_BONUS` instead: points beyond 1000 do not matter.
 */
export function contractValue(
  outcomes: readonly number[],
  value: number,
  toWin = Infinity,
): number {
  const p = chance(outcomes, value)
  const gain = value >= toWin ? toWin + MATCH_WIN_BONUS : value
  return p * gain - (1 - p) * value
}

/** Contract option with the best `contractValue`; ties keep the lower one. */
export function bestContract(
  outcomes: readonly number[],
  options: readonly number[],
  toWin = Infinity,
): number {
  let chosen = options[0]
  let top = -Infinity
  for (const value of options) {
    const expected = contractValue(outcomes, value, toWin)
    if (expected > top + 1e-9) {
      top = expected
      chosen = value
    }
  }
  return chosen
}

/** True once `deadline` (a `performance.now()` value) has passed. */
export function pastDeadline(deadline: number): boolean {
  return performance.now() > deadline
}

/**
 * Points the player on turn in the auction would make as declarer: each
 * sample deals the hidden hands and the musik, takes the musik, gives away
 * the two least useful cards and plays the deal out.
 */
export function auctionOutcomes(
  view: Deal,
  random: Random,
  samples: number,
  deadline = Infinity,
): number[] {
  const me = view.turn
  const outcomes: number[] = []
  for (let i = 0; i < samples && !(i && pastDeadline(deadline)); i++) {
    const sample = sampleDeal(view, random)
    const hands = sample.s.hands.map(hand => maskOf(hand))
    const full = hands[me] | maskOf(sample.s.musik)
    const order = giftOrder(full)
    hands[me] = full & ~(1 << order[0]) & ~(1 << order[1])
    hands[nextSeat(me)] |= 1 << order[0]
    hands[nextSeat(me, 2)] |= 1 << order[1]
    const st = rollout(new PlayState(hands, me, view.s.highestBid, me))
    outcomes.push(st.points(me))
  }
  return outcomes
}

/** Declarer points over sampled layouts once the gifts are made. */
export function contractOutcomes(
  view: Deal,
  random: Random,
  samples: number,
  deadline = Infinity,
): number[] {
  const declarer = view.declarer
  const outcomes: number[] = []
  for (let i = 0; i < samples && !(i && pastDeadline(deadline)); i++) {
    const st = rollout(PlayState.fromDeal(sampleDeal(view, random)))
    outcomes.push(st.points(declarer))
  }
  return outcomes
}

/**
 * Raise by one step only if P(points ≥ next bid) reaches `threshold`, moved
 * by `MOOD_CHANCE` towards boldness or caution by the match score.
 */
export function monteCarloBid(
  view: Deal,
  actions: Action[],
  random: Random,
  samples: number,
  threshold: number,
  scores: readonly number[],
  deadline = Infinity,
): Action {
  const pass = actions.find(action => action.type === 'pass') ?? actions[0]
  const next = view.s.highestBid + BID_STEP
  const raise = actions.find(action => action.type === 'bid' && action.value === next)
  if (!raise) return pass
  const mood = moodOf(view, scores)
  const outcomes = auctionOutcomes(view, random, samples, deadline)
  return chance(outcomes, next) >= threshold - mood * MOOD_CHANCE ? raise : pass
}

/** Change of the bid threshold for a bold (−) or careful (+) auction mood. */
export const MOOD_CHANCE = 0.1

export function monteCarloContract(
  view: Deal,
  actions: Action[],
  random: Random,
  samples: number,
  scores: readonly number[],
  deadline = Infinity,
): Action {
  const outcomes = contractOutcomes(view, random, samples, deadline)
  const values = actions.flatMap(action =>
    action.type === 'contract' ? [action.value] : [],
  )
  const value = bestContract(outcomes, values, valueToWin(scores, view.declarer))
  return actions.find(action => action.type === 'contract' && action.value === value)!
}

/**
 * Compares gifts of the `candidates` least useful cards (every assignment to
 * the waiting defenders) on the same sampled layouts and keeps the one with
 * the best expected contract value.
 */
export function monteCarloGift(
  view: Deal,
  actions: Action[],
  random: Random,
  samples: number,
  candidates: number,
  scores: readonly number[],
  deadline = Infinity,
): Action {
  const me = view.turn
  const toWin = valueToWin(scores, me)
  const hand = maskOf(view.hand(me))
  const recipients = view.pendingRecipients()
  const order = giftOrder(hand).slice(0, candidates)
  const options: number[][] = []
  for (const first of order) {
    if (recipients.length < 2) options.push([first])
    else for (const second of order) if (second !== first) options.push([first, second])
  }
  const layouts: number[][] = []
  for (let i = 0; i < samples && !(i && pastDeadline(deadline)); i++) {
    layouts.push(sampleDeal(view, random).s.hands.map(cards => maskOf(cards)))
  }
  const bid = view.s.highestBid
  let chosen = options[0]
  let top = -Infinity
  for (const option of options) {
    let kept = hand
    for (const card of option) kept &= ~(1 << card)
    const outcomes = layouts.map(layout => {
      const hands = layout.slice()
      option.forEach((card, i) => {
        hands[me] &= ~(1 << card)
        hands[recipients[i]] |= 1 << card
      })
      return rollout(new PlayState(hands, me, bid, me)).points(me)
    })
    const limit = Math.max(bid, BASE_MAX_BID + marriageTotal(kept))
    const mean = outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length
    const options = bidRange(bid, limit)
    const value = bestContract(outcomes, options, toWin)
    const score = contractValue(outcomes, value, toWin) + mean * 1e-3
    if (score > top) {
      top = score
      chosen = option
    }
  }
  const card = cardAt(chosen[0])
  return (
    actions.find(a => a.type === 'give' && a.card === card && a.to === recipients[0]) ??
    actions[0]
  )
}

/**
 * Flat Monte Carlo over the legal cards: every card is tried on the same
 * sampled layouts, the deal is played out and the utility of the score
 * changes the match would write (`matchDeltas`) is averaged.
 */
export function flatMonteCarloPlay(
  view: Deal,
  actions: Action[],
  random: Random,
  samples: number,
  scores: readonly number[],
  deadline = Infinity,
): Action {
  const me = view.turn
  const cards = actions.map(action =>
    action.type === 'play' ? cardIndex(action.card) : -1,
  )
  const totals = cards.map(() => 0)
  for (let i = 0; i < samples && !(i && pastDeadline(deadline)); i++) {
    const base = PlayState.fromDeal(sampleDeal(view, random))
    cards.forEach((card, k) => {
      const st = base.clone()
      st.play(card)
      totals[k] += utility(matchDeltas(rollout(st).deltas(), st.declarer, scores), me)
    })
  }
  let best = 0
  for (let k = 1; k < totals.length; k++) if (totals[k] > totals[best]) best = k
  return actions[best]
}
