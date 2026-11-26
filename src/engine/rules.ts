import { COLORS, Color, Figure, type Card } from './Card'

export const PLAYER_COUNT = 3
export const HAND_SIZE = 7
export const MUSIK_SIZE = 3
export const TRICK_COUNT = 8
export const OPENING_BID = 100
export const BID_STEP = 10
/** Highest declaration possible without a marriage in hand. */
export const BASE_MAX_BID = 120
export const TARGET_SCORE = 1000
export const TOTAL_CARD_POINTS = 120

export const MARRIAGE_POINTS: Record<Color, number> = {
  [Color.Kier]: 100,
  [Color.Karo]: 80,
  [Color.Trefl]: 60,
  [Color.Pik]: 40,
}

export function nextSeat(seat: number, step = 1): number {
  return (seat + step + PLAYER_COUNT * 4) % PLAYER_COUNT
}

export function cardPoints(cards: readonly Card[]): number {
  return cards.reduce((sum, card) => sum + card.points, 0)
}

/** Defenders write their result rounded to the nearest ten (5 rounds up). */
export function roundScore(points: number): number {
  return Math.round(points / 10) * 10
}

export function hasCard(hand: readonly Card[], card: Card): boolean {
  return hand.some(c => c === card)
}

/** Suits in which the hand holds both the king and the queen. */
export function marriagesIn(hand: readonly Card[]): Color[] {
  return COLORS.filter(
    color =>
      hand.some(c => c.color === color && c.figure === Figure.K) &&
      hand.some(c => c.color === color && c.figure === Figure.Q),
  )
}

export function marriageValue(hand: readonly Card[]): number {
  return marriagesIn(hand).reduce((sum, color) => sum + MARRIAGE_POINTS[color], 0)
}

/**
 * Declarations above 120 require a marriage; the limit is 120 plus the value
 * of all marriages currently held.
 */
export function maxBidFor(hand: readonly Card[]): number {
  return BASE_MAX_BID + marriageValue(hand)
}

/** All bid values from `from` to `to`, inclusive, in steps of ten. */
export function bidRange(from: number, to: number): number[] {
  const values: number[] = []
  for (let value = from; value <= to; value += BID_STEP) values.push(value)
  return values
}

/** Does `challenger` beat the currently winning `winning` card? */
export function beats(challenger: Card, winning: Card, trump: Color | null): boolean {
  if (challenger.color === winning.color) return challenger.rank > winning.rank
  return trump !== null && challenger.color === trump
}

/** Index of the winning card in a trick (cards in play order). */
export function trickWinnerIndex(trick: readonly Card[], trump: Color | null): number {
  let best = 0
  for (let i = 1; i < trick.length; i++) {
    if (beats(trick[i], trick[best], trump)) best = i
  }
  return best
}

/**
 * Follow the led suit when possible. Without it, play a trump if one is
 * declared and held; otherwise any card. Overtaking is not compulsory.
 */
export function legalPlays(
  hand: readonly Card[],
  trick: readonly Card[],
  trump: Color | null,
): Card[] {
  if (!trick.length) return [...hand]
  const led = trick[0].color
  const follow = hand.filter(card => card.color === led)
  if (follow.length) return follow
  if (trump !== null) {
    const trumps = hand.filter(card => card.color === trump)
    if (trumps.length) return trumps
  }
  return [...hand]
}

/**
 * Leading the king or queen of a held marriage declares it, except in the
 * first trick of the deal.
 */
export function isMeldLead(
  hand: readonly Card[],
  card: Card,
  trickNumber: number,
  isLeading: boolean,
): boolean {
  if (!isLeading || trickNumber === 0 || !card.isMarriageCard) return false
  const partner = card.marriagePartner
  return !!partner && hasCard(hand, card) && hasCard(hand, partner)
}
