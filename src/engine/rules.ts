import { COLORS, Color, Figure, suitMask, type Card } from './Card'

export const PLAYER_COUNT = 3
export const HAND_SIZE = 7
export const MUSIK_SIZE = 3
export const TRICK_COUNT = 8
export const OPENING_BID = 100
export const BID_STEP = 10
/** Highest declaration possible without a marriage in hand. */
export const BASE_MAX_BID = 120
export const TARGET_SCORE = 1000
/** From this score on, points count only as the declarer. */
export const LOCK_SCORE = 800
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

/** Is the card (or an equal card object) in the hand? */
export function hasCard(hand: readonly Card[], card: Card): boolean {
  return hand.some(
    c => c === card || (c.figure === card.figure && c.color === card.color),
  )
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
 * Polish rules: follow the led suit and beat the winning card when possible
 * (any card of the led suit once the trick is trumped). Without the led suit,
 * play a trump that wins the trick if you hold one (any trump while none is
 * in the trick, a higher one when it is); otherwise any card (nobody is
 * forced to under-trump). Without a declared trump a void allows any card.
 */
export function legalPlays(
  hand: readonly Card[],
  trick: readonly Card[],
  trump: Color | null,
): Card[] {
  if (!trick.length) return [...hand]
  const led = trick[0].color
  const winning = trick[trickWinnerIndex(trick, trump)]
  const follow = hand.filter(card => card.color === led)
  if (follow.length) {
    const higher = follow.filter(card => beats(card, winning, trump))
    return higher.length ? higher : follow
  }
  if (trump !== null) {
    const trumps = hand.filter(
      card => card.color === trump && beats(card, winning, trump),
    )
    if (trumps.length) return trumps
  }
  return [...hand]
}

/**
 * Leading the king or queen of a held marriage declares it, in any trick
 * including the first one.
 */
export function isMeldLead(
  hand: readonly Card[],
  card: Card,
  isLeading: boolean,
): boolean {
  if (!isLeading || !card.isMarriageCard) return false
  const partner = card.marriagePartner
  return !!partner && hasCard(hand, card) && hasCard(hand, partner)
}

/**
 * Public inference from a legal follow: the mask (bits `cardIndex`) of every
 * card whose presence in the hand would have made playing `card` to `trick`
 * (earlier cards, in play order) illegal. Not following reveals a void in
 * the led suit; a void player who does not win with a trump has no trump
 * above the winning one (no trump at all while none is in the trick); a
 * player who follows without beating a led-suit winner has no higher card of
 * that suit. Leading reveals nothing.
 */
export function excludedByPlay(
  trick: readonly Card[],
  trump: Color | null,
  card: Card,
): number {
  if (!trick.length) return 0
  const led = trick[0].color
  const winning = trick[trickWinnerIndex(trick, trump)]
  if (beats(card, winning, trump)) return card.color === led ? 0 : suitMask(led)
  if (card.color === led) return winning.color === led ? suitMask(led, winning.rank) : 0
  let mask = suitMask(led)
  if (trump !== null) {
    mask |= winning.color === trump ? suitMask(trump, winning.rank) : suitMask(trump)
  }
  return mask
}
