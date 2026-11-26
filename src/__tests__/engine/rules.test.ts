import { Color, cards } from '../../engine/Card'
import {
  BASE_MAX_BID,
  BID_STEP,
  HAND_SIZE,
  MARRIAGE_POINTS,
  MUSIK_SIZE,
  OPENING_BID,
  PLAYER_COUNT,
  TARGET_SCORE,
  TRICK_COUNT,
  beats,
  bidRange,
  cardPoints,
  hasCard,
  isMeldLead,
  legalPlays,
  marriageValue,
  marriagesIn,
  maxBidFor,
  nextSeat,
  roundScore,
  trickWinnerIndex,
} from '../../engine/rules'
import { ids } from './helpers'

const [AH, TEN_H, KH, QH, JH, NINE_H] = cards('A♥ 10♥ K♥ Q♥ J♥ 9♥')

describe('rules', () => {
  it('has the constants of this version', () => {
    expect(PLAYER_COUNT).toBe(3)
    expect(PLAYER_COUNT * HAND_SIZE + MUSIK_SIZE).toBe(24)
    expect(TRICK_COUNT * PLAYER_COUNT).toBe(24)
    expect([OPENING_BID, BID_STEP, BASE_MAX_BID, TARGET_SCORE]).toEqual([
      100, 10, 120, 1000,
    ])
    expect(MARRIAGE_POINTS).toEqual({
      [Color.Kier]: 100,
      [Color.Karo]: 80,
      [Color.Trefl]: 60,
      [Color.Pik]: 40,
    })
  })

  it('moves clockwise around three seats', () => {
    expect([0, 1, 2].map(seat => nextSeat(seat))).toEqual([1, 2, 0])
    expect([0, 1, 2].map(seat => nextSeat(seat, 2))).toEqual([2, 0, 1])
    expect(nextSeat(0, -1)).toBe(2)
    expect(nextSeat(1, 3)).toBe(1)
  })

  it('counts card points', () => {
    expect(cardPoints([])).toBe(0)
    expect(cardPoints(cards('A♥ 10♥ K♥ Q♥ J♥ 9♥'))).toBe(30)
  })

  it.each([
    [0, 0],
    [4, 0],
    [5, 10],
    [14, 10],
    [15, 20],
    [24, 20],
    [25, 30],
    [35, 40],
    [45, 50],
    [55, 60],
    [65, 70],
    [75, 80],
    [85, 90],
    [95, 100],
    [105, 110],
    [115, 120],
    [119, 120],
    [120, 120],
    [125, 130],
    [185, 190],
    [221, 220],
  ])('rounds defender points %i to %i (5 rounds up)', (points, rounded) => {
    expect(roundScore(points)).toBe(rounded)
  })

  it('finds marriages and their value', () => {
    expect(hasCard(cards('K♥ Q♥'), KH)).toBe(true)
    expect(hasCard(cards('K♥ Q♥'), AH)).toBe(false)
    expect(marriagesIn(cards('K♥ A♠ Q♥ K♠ J♠ Q♦'))).toEqual([Color.Kier])
    expect(marriagesIn(cards('Q♠ K♣ K♠ Q♣ K♦ Q♦ K♥ Q♥'))).toEqual([
      Color.Kier,
      Color.Karo,
      Color.Trefl,
      Color.Pik,
    ])
    expect(marriageValue(cards('Q♠ K♣ K♠ Q♣ K♦ Q♦ K♥ Q♥'))).toBe(280)
    expect(marriageValue(cards('K♥ K♦ K♣ K♠ Q♥'))).toBe(100)
    expect(marriageValue([])).toBe(0)
  })

  it('limits bids to 120 plus the marriages held', () => {
    expect(maxBidFor(cards('A♥ 10♥ A♦ 10♦ A♣ 10♣ A♠'))).toBe(120)
    expect(maxBidFor(cards('K♠ Q♠ A♥ 9♥ 9♦ 9♣ 9♠'))).toBe(160)
    expect(maxBidFor(cards('K♥ Q♥ K♦ Q♦ A♠ 9♦ 9♣'))).toBe(300)
    expect(maxBidFor(cards('K♥ Q♥ K♦ Q♦ K♣ Q♣ K♠ Q♠'))).toBe(400)
  })

  it('builds bid ranges in steps of ten', () => {
    expect(bidRange(100, 130)).toEqual([100, 110, 120, 130])
    expect(bidRange(120, 120)).toEqual([120])
    expect(bidRange(130, 120)).toEqual([])
  })

  describe('legalPlays', () => {
    const hand = cards('A♥ 9♥ K♦ 10♣ J♣ Q♠')

    it('allows any card when leading', () => {
      expect(legalPlays(hand, [], null)).toEqual(hand)
      expect(legalPlays(hand, [], Color.Pik)).toEqual(hand)
      expect(legalPlays(hand, [], null)).not.toBe(hand)
    })

    it('forces following the led suit without forcing to overtake', () => {
      expect(ids(legalPlays(hand, cards('10♥'), null))).toBe('A♥ 9♥')
      expect(ids(legalPlays(hand, cards('J♣ A♣'), Color.Kier))).toBe('10♣ J♣')
      // Following beats trumping even when a trump is held.
      expect(ids(legalPlays(hand, cards('A♦'), Color.Kier))).toBe('K♦')
    })

    it('forces a trump when void in the led suit', () => {
      const noSpades = cards('A♥ 9♥ K♦ 10♣')
      expect(ids(legalPlays(noSpades, cards('9♠'), Color.Kier))).toBe('A♥ 9♥')
      // A trump is forced even if it cannot win the trick.
      expect(ids(legalPlays(noSpades, cards('9♠ A♥'), Color.Kier))).toBe('A♥ 9♥')
      expect(ids(legalPlays(noSpades, cards('9♠ 10♣'), Color.Karo))).toBe('K♦')
    })

    it('allows any card when void in the led suit and in trumps', () => {
      const hand2 = cards('A♥ 9♥ K♦ 10♣')
      expect(legalPlays(hand2, cards('9♠'), null)).toEqual(hand2)
      expect(legalPlays(hand2, cards('9♠'), Color.Pik)).toEqual(hand2)
      expect(legalPlays(cards('A♥ 9♥'), cards('9♠'), Color.Trefl)).toEqual(cards('A♥ 9♥'))
    })
  })

  describe('trick winner', () => {
    it('without trump the highest card of the led suit wins', () => {
      expect(trickWinnerIndex(cards('K♥ A♠ 10♥'), null)).toBe(2)
      expect(trickWinnerIndex(cards('9♦ A♠ A♣'), null)).toBe(0)
      expect(trickWinnerIndex(cards('10♣ K♣ A♣'), null)).toBe(2)
      expect(trickWinnerIndex(cards('10♣ K♣ Q♣'), null)).toBe(0)
      expect(trickWinnerIndex(cards('J♠ Q♠ 9♠'), null)).toBe(1)
    })

    it('trumps beat the led suit, and the highest trump wins', () => {
      expect(trickWinnerIndex(cards('A♥ 9♠ 10♥'), Color.Pik)).toBe(1)
      expect(trickWinnerIndex(cards('A♥ 9♠ J♠'), Color.Pik)).toBe(2)
      expect(trickWinnerIndex(cards('A♥ J♠ 9♠'), Color.Pik)).toBe(1)
      expect(trickWinnerIndex(cards('9♠ A♥ A♦'), Color.Pik)).toBe(0)
      // A trump that is not played does not matter.
      expect(trickWinnerIndex(cards('K♣ A♥ A♣'), Color.Pik)).toBe(2)
      // A trump led and followed: still the highest trump.
      expect(trickWinnerIndex(cards('Q♦ K♦ 9♦'), Color.Karo)).toBe(1)
    })

    it('beats() compares a challenger with the current winner', () => {
      expect(beats(TEN_H, KH, null)).toBe(true)
      expect(beats(KH, TEN_H, null)).toBe(false)
      expect(beats(cards('A♠')[0], NINE_H, null)).toBe(false)
      expect(beats(cards('9♠')[0], AH, Color.Pik)).toBe(true)
      expect(beats(AH, cards('9♠')[0], Color.Pik)).toBe(false)
      expect(beats(cards('A♣')[0], cards('9♠')[0], Color.Kier)).toBe(false)
    })

    it('an empty or single card trick is won by its first card', () => {
      expect(trickWinnerIndex([], null)).toBe(0)
      expect(trickWinnerIndex(cards('9♣'), Color.Kier)).toBe(0)
    })
  })

  describe('isMeldLead', () => {
    const hand = cards('K♥ Q♥ K♠ J♠ A♦')

    it('declares a marriage by leading its king or queen from the second trick', () => {
      expect(isMeldLead(hand, KH, 1, true)).toBe(true)
      expect(isMeldLead(hand, QH, 7, true)).toBe(true)
    })

    it('does not declare in the first trick', () => {
      expect(isMeldLead(hand, KH, 0, true)).toBe(false)
      expect(isMeldLead(hand, QH, 0, true)).toBe(false)
    })

    it('does not declare when following', () => {
      expect(isMeldLead(hand, KH, 3, false)).toBe(false)
    })

    it('needs both partners in hand', () => {
      expect(isMeldLead(hand, cards('K♠')[0], 3, true)).toBe(false)
      expect(isMeldLead(cards('K♥ J♥'), KH, 3, true)).toBe(false)
      expect(isMeldLead(cards('Q♥'), KH, 3, true)).toBe(false)
      expect(isMeldLead(hand, JH, 3, true)).toBe(false)
      expect(isMeldLead(hand, AH, 3, true)).toBe(false)
    })
  })
})
