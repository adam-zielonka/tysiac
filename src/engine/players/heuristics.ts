import type { Action, Deal } from '../Deal'
import { BID_STEP } from '../rules'
import {
  ACE,
  FULL_MASK,
  JACK,
  KING,
  MARRIAGE_MASK,
  MELD_VALUE,
  ORDER_OF,
  POINTS_OF,
  QUEEN,
  SUITS,
  SUIT_MASK,
  SUIT_OF,
  TEN,
  beatsIndex,
  bitCount,
  cardAt,
  hasMarriage,
  highestBit,
  lowestBit,
  maskOf,
  strongerInSuit,
} from './bits'
import type { PlayState } from './PlayState'

/*
 * Shared knowledge-based heuristics: hand strength for the auction, gifts,
 * contract choice and the tactical card play that also drives the rollouts
 * of the Monte Carlo bots. Card play only looks at the player's own hand and
 * public information (played cards, voids, trump, the current trick).
 */

// ---------------------------------------------------------------- card play

/** King and queen of every marriage still held. */
function marriageCards(hand: number): number {
  let mask = 0
  for (let suit = 0; suit < SUITS; suit++) {
    if (hasMarriage(hand, suit)) mask |= MARRIAGE_MASK[suit]
  }
  return mask
}

/** No unseen card of the same suit is stronger. */
function isTop(card: number, unseen: number): boolean {
  return !strongerInSuit(unseen, card)
}

/** Card of `mask` with the best score; ties go to the weaker card. */
function best(mask: number, score: (card: number) => number): number {
  let chosen = -1
  let top = -Infinity
  for (let bits = mask; bits; bits &= bits - 1) {
    const card = lowestBit(bits)
    const value = score(card)
    if (value >= top) {
      top = value
      chosen = card
    }
  }
  return chosen
}

interface Seat {
  st: PlayState
  seat: number
  hand: number
  /** Cards that may still be in other hands. */
  unseen: number
  /** K and Q of held marriages: never wasted. */
  kept: number
  isDeclarer: boolean
}

/** Could an opponent of `seat` ruff a lead in `suit`? */
function ruffRisk(t: Seat, suit: number): boolean {
  const { st, unseen } = t
  const trump = st.trump
  if (trump < 0 || suit === trump || !(unseen & SUIT_MASK[trump])) return false
  const opponents = t.isDeclarer
    ? [(st.declarer + 1) % 3, (st.declarer + 2) % 3]
    : [st.declarer]
  for (const opponent of opponents) {
    const voids = st.voids[opponent]
    if (voids & (1 << suit) && !(voids & (1 << trump))) return true
  }
  // With fewer than two cards out, somebody is already out of the suit.
  return bitCount(unseen & SUIT_MASK[suit]) < 2
}

/** Would `card` win the trick once `opponent` (the last to play) has played? */
function holdsAgainst(t: Seat, card: number, opponent: number): boolean {
  const { st, unseen } = t
  const trump = st.trump
  const led = SUIT_OF[st.trick[0]]
  const suit = SUIT_OF[card]
  const voids = st.voids[opponent]
  const voidInLed = !!(voids & (1 << led)) || !(unseen & SUIT_MASK[led])
  const mayRuff =
    trump >= 0 &&
    trump !== led &&
    !!(unseen & SUIT_MASK[trump]) &&
    !(voids & (1 << trump))
  if (suit === led) {
    if (!voidInLed && strongerInSuit(unseen, card)) return false
    return !(mayRuff && voidInLed)
  }
  if (suit === trump) {
    if (!strongerInSuit(unseen, card) || voids & (1 << trump)) return true
    return !voidInLed
  }
  return false
}

/** Highest-scoring sure winner to cash: aces and tens first, side suits first. */
function cash(t: Seat, sure: number): number {
  return best(sure, card => POINTS_OF[card] - (SUIT_OF[card] === t.st.trump ? 20 : 0))
}

/** A low lead that gives away little. */
function lowLead(t: Seat): number {
  const { st, hand, unseen, kept, isDeclarer } = t
  const trump = st.trump
  const candidates = hand & ~kept || hand
  const declarerVoids = st.voids[st.declarer]
  return best(candidates, card => {
    const suit = SUIT_OF[card]
    const order = ORDER_OF[card]
    let cost = POINTS_OF[card] * 2
    if (suit === trump) cost += 25
    if (order === TEN && strongerInSuit(unseen, card)) cost += 10
    if (kept & (1 << card)) cost += 60
    if (
      !isDeclarer &&
      trump >= 0 &&
      suit !== trump &&
      declarerVoids & (1 << suit) &&
      !(declarerVoids & (1 << trump))
    ) {
      cost += 15
    }
    if (
      isDeclarer &&
      trump >= 0 &&
      suit !== trump &&
      bitCount(hand & SUIT_MASK[suit]) === 1
    ) {
      cost -= 3
    }
    return -cost
  })
}

function lead(t: Seat): number {
  const { st, hand, unseen, kept, isDeclarer } = t
  const trump = st.trump
  let sure = 0
  for (let bits = hand & ~kept; bits; bits &= bits - 1) {
    const card = lowestBit(bits)
    if (isTop(card, unseen) && !ruffRisk(t, SUIT_OF[card])) sure |= 1 << card
  }
  if (st.trickNumber > 0 && kept) {
    // Without a trump every top card is safe: cash them before declaring.
    if (trump < 0 && sure) return cash(t, sure)
    const suit = SUIT_OF[lowestBit(kept)]
    const king = suit * 6 + KING
    return isTop(king, unseen) ? king : suit * 6 + QUEEN
  }
  if (isDeclarer && trump >= 0) {
    const mine = hand & SUIT_MASK[trump]
    const theirs = unseen & SUIT_MASK[trump]
    // Draw trumps while holding the highest one.
    if (mine && theirs && lowestBit(mine) < lowestBit(theirs)) return lowestBit(mine)
  }
  if (sure) return cash(t, sure)
  return lowLead(t)
}

/** Adds points to a trick the partner already holds. */
function smear(t: Seat, legal: number): number {
  const { st, unseen, kept } = t
  const candidates = legal & ~kept || legal
  return best(candidates, card => {
    const top = isTop(card, unseen)
    let score = POINTS_OF[card]
    if (top) score -= 15
    else if (ORDER_OF[card] === TEN) score += 5
    if (SUIT_OF[card] === st.trump) score -= 12
    return score
  })
}

/** Throws the least useful card into a trick that is lost. */
function discard(t: Seat, legal: number): number {
  const { st, hand, unseen, kept } = t
  const trump = st.trump
  const haveTrumps = trump >= 0 && !!(hand & SUIT_MASK[trump])
  return best(legal, card => {
    const suit = SUIT_OF[card]
    let cost = POINTS_OF[card] * 2
    if (kept & (1 << card)) cost += 60
    if (isTop(card, unseen)) cost += 20
    if (suit === trump) cost += 10
    if (haveTrumps && suit !== trump && bitCount(hand & SUIT_MASK[suit]) === 1) cost -= 2
    return -cost
  })
}

/**
 * The cheapest card that takes the trick. With `keepTops`, a lower card wins
 * and sure winners stay for later tricks (the trick is already safe).
 */
function takeWith(t: Seat, beaters: number, keepTops: boolean): number {
  const { st, unseen, kept } = t
  const led = SUIT_OF[st.trick[0]]
  const sameSuit = beaters & SUIT_MASK[led]
  if (!sameSuit) {
    // Ruff with the lowest trump that wins.
    return highestBit(beaters & ~kept || beaters)
  }
  const free = sameSuit & ~kept || sameSuit
  if (keepTops) {
    let low = 0
    for (let bits = free; bits; bits &= bits - 1) {
      const card = lowestBit(bits)
      if (!isTop(card, unseen)) low |= 1 << card
    }
    if (low) return best(low, card => POINTS_OF[card])
  }
  return best(free, card => -POINTS_OF[card])
}

function follow(t: Seat, legal: number): number {
  const { st, seat } = t
  const trick = st.trick
  const trump = st.trump
  let win = 0
  for (let i = 1; i < trick.length; i++)
    if (beatsIndex(trick[i], trick[win], trump)) win = i
  const winnerSeat = (st.leader + win) % 3
  const winning = trick[win]
  let beaters = 0
  for (let bits = legal; bits; bits &= bits - 1) {
    const card = lowestBit(bits)
    if (beatsIndex(card, winning, trump)) beaters |= 1 << card
  }
  const partnerWins = !t.isDeclarer && winnerSeat !== st.declarer

  if (trick.length === 2) {
    if (partnerWins) return smear(t, legal)
    if (beaters) return takeWith(t, beaters, true)
    return discard(t, legal)
  }

  const next = (seat + 1) % 3
  if (t.isDeclarer) {
    let safe = 0
    for (let bits = beaters; bits; bits &= bits - 1) {
      const card = lowestBit(bits)
      if (holdsAgainst(t, card, next)) safe |= 1 << card
    }
    if (safe) return takeWith(t, safe, false)
    return discard(t, legal)
  }
  if (winnerSeat === st.declarer) {
    // The declarer led and the partner plays last.
    if (beaters) return takeWith(t, beaters, true)
    return discard(t, legal)
  }
  // The partner led; the declarer plays last.
  if (holdsAgainst(t, winning, st.declarer)) return smear(t, legal)
  let safe = 0
  for (let bits = beaters; bits; bits &= bits - 1) {
    const card = lowestBit(bits)
    if (holdsAgainst(t, card, st.declarer)) safe |= 1 << card
  }
  if (safe) return takeWith(t, safe, false)
  return discard(t, legal)
}

/**
 * Tosia's card play, also the rollout policy: declares marriages (the most
 * valuable first, after cashing sure winners while there is no trump), draws
 * trumps as a strong declarer, cashes sure winners, helps a fellow defender
 * and throws cheap cards into lost tricks. Reads only the player's own hand
 * and public information from `st`.
 */
export function tacticalCard(st: PlayState): number {
  const legal = st.legal()
  if (!(legal & (legal - 1))) return lowestBit(legal)
  const seat = st.turn
  const hand = st.hands[seat]
  const t: Seat = {
    st,
    seat,
    hand,
    unseen: FULL_MASK & ~hand & ~st.played,
    kept: marriageCards(hand),
    isDeclarer: seat === st.declarer,
  }
  return st.trick.length ? follow(t, legal) : lead(t)
}

/**
 * Bolek's card play without memory: declares a marriage when leading (the
 * king of the most valuable one), otherwise leads the strongest card; when
 * following, takes the trick with the cheapest winning card or throws the
 * card with the fewest points.
 */
export function greedyCard(st: PlayState): number {
  const legal = st.legal()
  if (!(legal & (legal - 1))) return lowestBit(legal)
  const hand = st.hands[st.turn]
  const kept = marriageCards(hand)
  const trump = st.trump
  if (!st.trick.length) {
    if (st.trickNumber > 0 && kept) return SUIT_OF[lowestBit(kept)] * 6 + KING
    return best(hand & ~kept || hand, card => {
      const strength = (5 - ORDER_OF[card]) * 100
      return strength + (SUIT_OF[card] === trump ? 50 : 0) - SUIT_OF[card]
    })
  }
  const trick = st.trick
  let win = 0
  for (let i = 1; i < trick.length; i++)
    if (beatsIndex(trick[i], trick[win], trump)) win = i
  let beaters = 0
  for (let bits = legal; bits; bits &= bits - 1) {
    const card = lowestBit(bits)
    if (beatsIndex(card, trick[win], trump)) beaters |= 1 << card
  }
  if (beaters) {
    const led = SUIT_OF[trick[0]]
    const sameSuit = beaters & SUIT_MASK[led]
    const pool = sameSuit || beaters
    return highestBit(pool & ~kept || pool)
  }
  const pool = legal & ~kept || legal
  return best(pool, card => -POINTS_OF[card] * 10 + ORDER_OF[card])
}

// -------------------------------------------------------------------- gifts

/** How much the declarer wants to keep a card of a 10-card hand. */
export function keepValue(hand: number, card: number, trumpSuit: number): number {
  const suit = SUIT_OF[card]
  const order = ORDER_OF[card]
  const inSuit = hand & SUIT_MASK[suit]
  const length = bitCount(inSuit)
  let value: number
  if (order === ACE) value = 100
  else if (order === TEN)
    value = inSuit & (1 << (suit * 6)) ? 80 : 30 + (length >= 3 ? 8 : 0)
  else if (order === KING || order === QUEEN) {
    // A lone king or queen could complete a defender's marriage.
    value = hasMarriage(hand, suit) ? 95 : 30 + MELD_VALUE[suit] / 4
  } else value = order === JACK ? 10 : 6
  if (suit === trumpSuit) value += 20
  if (length >= 4) value += 4
  if (length === 1 && order >= JACK && trumpSuit >= 0) value -= 3
  return value
}

/** Suit of the most valuable marriage, or -1. */
export function bestMarriageSuit(hand: number): number {
  for (let suit = 0; suit < SUITS; suit++) if (hasMarriage(hand, suit)) return suit
  return -1
}

/** Cards of the hand from the least to the most useful. */
export function giftOrder(hand: number): number[] {
  const trumpSuit = bestMarriageSuit(hand)
  const cards: number[] = []
  for (let bits = hand; bits; bits &= bits - 1) cards.push(lowestBit(bits))
  const value = cards.map(card => keepValue(hand, card, trumpSuit))
  return cards
    .map((card, i) => ({ card, value: value[i] }))
    .sort((a, b) => a.value - b.value || b.card - a.card)
    .map(entry => entry.card)
}

/** Heuristic gift: the least useful card goes to the first waiting defender. */
export function heuristicGift(deal: Deal, actions: Action[]): Action {
  const hand = maskOf(deal.hand(deal.turn))
  const card = cardAt(giftOrder(hand)[0])
  const to = deal.pendingRecipients()[0]
  return (
    actions.find(a => a.type === 'give' && a.card === card && a.to === to) ?? actions[0]
  )
}

// ----------------------------------------------------------- hand strength

/**
 * Features of the declarer's final eight cards. Weights below come from a
 * least-squares fit to 40 000 simulated deals played out with `tacticalCard`.
 */
function features(hand: number): number[] {
  let aces = 0
  let tensWithAce = 0
  let bareTens = 0
  let loneKings = 0
  let loneQueens = 0
  let low = 0
  const marriages: number[] = []
  for (let suit = 0; suit < SUITS; suit++) {
    const inSuit = hand & SUIT_MASK[suit]
    const base = suit * 6
    const ace = inSuit & (1 << base)
    if (ace) aces++
    if (inSuit & (1 << (base + TEN))) {
      if (ace) tensWithAce++
      else bareTens++
    }
    const king = inSuit & (1 << (base + KING))
    const queen = inSuit & (1 << (base + QUEEN))
    if (king && queen) marriages.push(suit)
    else if (king) loneKings++
    else if (queen) loneQueens++
    if (inSuit & (1 << (base + JACK))) low++
    if (inSuit & (1 << (base + 5))) low++
  }
  const trumpSuit = marriages.length ? marriages[0] : -1
  const first = marriages.length ? MELD_VALUE[marriages[0]] : 0
  const rest = marriages.slice(1).reduce((sum, suit) => sum + MELD_VALUE[suit], 0)
  let trumpLength = 0
  let trumpTops = 0
  let voids = 0
  if (trumpSuit >= 0) {
    const trumps = hand & SUIT_MASK[trumpSuit]
    trumpLength = bitCount(trumps)
    trumpTops = bitCount(trumps & (3 << (trumpSuit * 6)))
    for (let suit = 0; suit < SUITS; suit++) {
      if (suit !== trumpSuit && !(hand & SUIT_MASK[suit])) voids++
    }
  }
  const hasAce = aces ? 1 : 0
  return [
    1,
    aces,
    hasAce,
    tensWithAce,
    bareTens,
    loneKings,
    loneQueens,
    low,
    first,
    rest,
    trumpLength,
    trumpTops,
    voids,
    hasAce * first,
    hasAce * rest,
  ]
}

const WEIGHTS = [
  -19.33, 20.94, -2.94, 19.83, 5.19, 3.5, 3.03, 4.39, -0.034, 0.102, 4.17, 3.34, 11.96,
  1.04, 0.48,
]

/** Expected points (cards and marriages) of a declarer keeping these eight cards. */
export function declarerEstimate(hand: number): number {
  const values = features(hand)
  let sum = 0
  for (let i = 0; i < values.length; i++) sum += values[i] * WEIGHTS[i]
  return sum
}

/** Exposed for calibration scripts. */
export const estimateFeatures = features

/** The eight cards kept after giving away the two least useful ones. */
export function keptAfterGifts(hand10: number): number {
  const order = giftOrder(hand10)
  return hand10 & ~(1 << order[0]) & ~(1 << order[1])
}

/**
 * Expected declarer points of a 7-card hand before the musik: averages the
 * estimate over every possible musik (680 combinations of the 17 unseen
 * cards), each time keeping the best eight cards.
 */
export function auctionEstimate(hand: number): number {
  const unseen: number[] = []
  for (let bits = FULL_MASK & ~hand; bits; bits &= bits - 1) unseen.push(lowestBit(bits))
  let total = 0
  let count = 0
  for (let a = 0; a < unseen.length; a++) {
    for (let b = a + 1; b < unseen.length; b++) {
      for (let c = b + 1; c < unseen.length; c++) {
        const full = hand | (1 << unseen[a]) | (1 << unseen[b]) | (1 << unseen[c])
        total += declarerEstimate(keptAfterGifts(full))
        count++
      }
    }
  }
  return total / count
}

/** Highest legal bid not above `limit`, or a pass. */
export function bidUpTo(deal: Deal, actions: Action[], limit: number): Action {
  const next = deal.s.highestBid + BID_STEP
  const raise = actions.find(a => a.type === 'bid' && a.value === next)
  if (raise && next <= limit) return raise
  return actions.find(a => a.type === 'pass') ?? actions[0]
}

/** Highest contract option not above `limit` (at least the bid). */
export function contractUpTo(actions: Action[], limit: number): Action {
  let chosen = actions[0]
  for (const action of actions) {
    if (action.type === 'contract' && action.value <= limit) {
      if (chosen.type !== 'contract' || action.value > chosen.value) chosen = action
    }
  }
  return chosen
}

/** The play action for a card index. */
export function playAction(actions: Action[], card: number): Action {
  const target = cardAt(card)
  return actions.find(a => a.type === 'play' && a.card === target) ?? actions[0]
}
