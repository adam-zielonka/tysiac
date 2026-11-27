import { ALL_CARDS, COLORS, cardIndex, type Card, type Color } from '../Card'
import { MARRIAGE_POINTS } from '../rules'

/*
 * Compact card sets for the bots. Bit `i` stands for `ALL_CARDS[i]`: six cards
 * per suit in the order ♥ ♦ ♣ ♠, inside a suit from the ace down to the nine.
 * A lower index in the same suit is therefore a stronger card.
 */

export const FULL_MASK = 0xffffff
export const SUITS = 4
export const ACE = 0
export const TEN = 1
export const KING = 2
export const QUEEN = 3
export const JACK = 4
export const NINE = 5

export const SUIT_MASK: readonly number[] = [0x3f, 0x3f << 6, 0x3f << 12, 0x3f << 18]
export const SUIT_OF: readonly number[] = ALL_CARDS.map((_, i) => (i / 6) | 0)
/** Position inside the suit: 0 ace, 1 ten, 2 king, 3 queen, 4 jack, 5 nine. */
export const ORDER_OF: readonly number[] = ALL_CARDS.map((_, i) => i % 6)
export const POINTS_OF: readonly number[] = ALL_CARDS.map(card => card.points)
/** Marriage value per suit index: ♥ 100, ♦ 80, ♣ 60, ♠ 40. */
export const MELD_VALUE: readonly number[] = COLORS.map(color => MARRIAGE_POINTS[color])
/** King and queen of a suit. */
export const MARRIAGE_MASK: readonly number[] = [0, 1, 2, 3].map(
  suit => (1 << (suit * 6 + KING)) | (1 << (suit * 6 + QUEEN)),
)

/** Points of every 6-bit suit pattern, used to add up a mask quickly. */
const SUIT_POINTS: number[] = Array.from({ length: 64 }, (_, bits) => {
  let sum = 0
  for (let order = 0; order < 6; order++) if (bits & (1 << order)) sum += POINTS_OF[order]
  return sum
})

export { cardIndex }

export function cardAt(index: number): Card {
  return ALL_CARDS[index]
}

export function suitOfColor(color: Color): number {
  return color - 1
}

export function colorOfSuit(suit: number): Color {
  return COLORS[suit]
}

export function maskOf(cards: readonly Card[]): number {
  let mask = 0
  for (const card of cards) mask |= 1 << cardIndex(card)
  return mask
}

export function cardsIn(mask: number): Card[] {
  const result: Card[] = []
  for (let bits = mask; bits; bits &= bits - 1) result.push(ALL_CARDS[lowestBit(bits)])
  return result
}

export function indicesIn(mask: number): number[] {
  const result: number[] = []
  for (let bits = mask; bits; bits &= bits - 1) result.push(lowestBit(bits))
  return result
}

export function bitCount(mask: number): number {
  let x = mask - ((mask >>> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

/** Index of the lowest set bit (the strongest card of a one-suit mask), or -1. */
export function lowestBit(mask: number): number {
  return mask ? 31 - Math.clz32(mask & -mask) : -1
}

/** Index of the highest set bit (the weakest card of a one-suit mask), or -1. */
export function highestBit(mask: number): number {
  return mask ? 31 - Math.clz32(mask) : -1
}

export function pointsOfMask(mask: number): number {
  return (
    SUIT_POINTS[mask & 63] +
    SUIT_POINTS[(mask >>> 6) & 63] +
    SUIT_POINTS[(mask >>> 12) & 63] +
    SUIT_POINTS[(mask >>> 18) & 63]
  )
}

export function hasMarriage(hand: number, suit: number): boolean {
  return (hand & MARRIAGE_MASK[suit]) === MARRIAGE_MASK[suit]
}

/** Suits with a held marriage, the most valuable first. */
export function marriageSuits(hand: number): number[] {
  const result: number[] = []
  for (let suit = 0; suit < SUITS; suit++) if (hasMarriage(hand, suit)) result.push(suit)
  return result
}

export function marriageTotal(hand: number): number {
  let sum = 0
  for (let suit = 0; suit < SUITS; suit++)
    if (hasMarriage(hand, suit)) sum += MELD_VALUE[suit]
  return sum
}

/** Is `card` a king or queen whose partner is also in `hand`? */
export function isMarriageCard(hand: number, card: number): boolean {
  const order = ORDER_OF[card]
  return (order === KING || order === QUEEN) && hasMarriage(hand, SUIT_OF[card])
}

/** Does card `a` beat card `b` that currently wins the trick? */
export function beatsIndex(a: number, b: number, trump: number): boolean {
  const suit = SUIT_OF[a]
  return suit === SUIT_OF[b] ? a < b : suit === trump
}

/** Cards of `mask` stronger than `card` in the same suit. */
export function strongerInSuit(mask: number, card: number): number {
  return mask & SUIT_MASK[SUIT_OF[card]] & ((1 << card) - 1)
}

/**
 * Legal cards of `hand` in a trick led in `led` and won so far by `winning`
 * (Polish overtaking rule, see `rules.legalPlays`).
 */
export function legalMask(
  hand: number,
  led: number,
  winning: number,
  trump: number,
): number {
  const follow = hand & SUIT_MASK[led]
  if (follow) {
    // A trumped trick cannot be beaten with the led suit.
    const higher =
      SUIT_OF[winning] === led ? follow & strongerInSuit(FULL_MASK, winning) : 0
    return higher || follow
  }
  if (trump >= 0) {
    const trumps =
      hand &
      (SUIT_OF[winning] === trump ? strongerInSuit(FULL_MASK, winning) : SUIT_MASK[trump])
    if (trumps) return trumps
  }
  return hand
}

/**
 * Cards a player provably lacks after playing `card` to a trick led in `led`
 * and won so far by `winning`, exactly like `Deal`: the led suit when not
 * following, then the trumps that would have won when not trumping, or the
 * led-suit cards above the winner when following without beating it.
 */
export function inferred(
  card: number,
  led: number,
  winning: number,
  trump: number,
): number {
  const suit = SUIT_OF[card]
  if (beatsIndex(card, winning, trump)) return suit === led ? 0 : SUIT_MASK[led]
  if (suit === led) {
    return SUIT_OF[winning] === led ? strongerInSuit(FULL_MASK, winning) : 0
  }
  // Void without winning: no led suit and no trump that would have won
  // (also after an under-trump, which is legal only without a higher trump).
  let mask = SUIT_MASK[led]
  if (trump >= 0) {
    mask |=
      SUIT_OF[winning] === trump ? strongerInSuit(FULL_MASK, winning) : SUIT_MASK[trump]
  }
  return mask
}
