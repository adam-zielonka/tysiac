import { ALL_CARDS, COLORS, Card, Color, cardIndex, cards } from '../../engine/Card'
import { Deck } from '../../engine/Deck'
import { seededRandom } from '../../engine/random'
import {
  BASE_MAX_BID,
  BID_STEP,
  HAND_SIZE,
  LOCK_SCORE,
  MARRIAGE_POINTS,
  MUSIK_SIZE,
  OPENING_BID,
  PLAYER_COUNT,
  TARGET_SCORE,
  TRICK_COUNT,
  beats,
  bidRange,
  cardPoints,
  excludedByPlay,
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
import { ids, maskIds } from './helpers'

const [AH, TEN_H, KH, QH, JH, NINE_H] = cards('A♥ 10♥ K♥ Q♥ J♥ 9♥')

describe('rules', () => {
  it('has the constants of this version', () => {
    expect(PLAYER_COUNT).toBe(3)
    expect(PLAYER_COUNT * HAND_SIZE + MUSIK_SIZE).toBe(24)
    expect(TRICK_COUNT * PLAYER_COUNT).toBe(24)
    expect([OPENING_BID, BID_STEP, BASE_MAX_BID, TARGET_SCORE, LOCK_SCORE]).toEqual([
      100, 10, 120, 1000, 800,
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
    expect(hasCard(cards('K♥ Q♥'), new Card(KH.figure, KH.color))).toBe(true)
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

    it('forces following the led suit and beating the winning card when possible', () => {
      expect(ids(legalPlays(hand, cards('10♥'), null))).toBe('A♥')
      expect(ids(legalPlays(hand, cards('J♥'), Color.Pik))).toBe('A♥')
      expect(ids(legalPlays(cards('A♥ 10♥ K♥ 9♥ Q♠'), cards('Q♥'), null))).toBe(
        'A♥ 10♥ K♥',
      )
      // The winning card counts, not the led one.
      expect(ids(legalPlays(hand, cards('J♣ Q♣'), Color.Kier))).toBe('10♣')
      expect(ids(legalPlays(hand, cards('Q♣ 9♣'), null))).toBe('10♣')
      // Unable to beat it: any card of the led suit.
      expect(ids(legalPlays(hand, cards('J♣ A♣'), Color.Kier))).toBe('10♣ J♣')
      expect(ids(legalPlays(cards('K♥ J♥ 9♥ A♠'), cards('A♥'), null))).toBe('K♥ J♥ 9♥')
      // Following beats trumping even when a trump is held.
      expect(ids(legalPlays(hand, cards('A♦'), Color.Kier))).toBe('K♦')
      expect(ids(legalPlays(hand, cards('Q♦'), Color.Kier))).toBe('K♦')
    })

    it('allows any card of the led suit once the trick is trumped', () => {
      expect(ids(legalPlays(hand, cards('9♣ 9♥'), Color.Kier))).toBe('10♣ J♣')
      expect(ids(legalPlays(hand, cards('K♣ 10♥'), Color.Kier))).toBe('10♣ J♣')
    })

    it('forces over-trumping when trumps are led', () => {
      const trumps = cards('A♦ J♦ 9♦ A♠')
      expect(ids(legalPlays(trumps, cards('Q♦'), Color.Karo))).toBe('A♦')
      expect(ids(legalPlays(trumps, cards('10♦ K♦'), Color.Karo))).toBe('A♦')
      expect(ids(legalPlays(cards('J♦ 9♦ A♠'), cards('Q♦'), Color.Karo))).toBe('J♦ 9♦')
    })

    it('forces a trump that wins when void in the led suit', () => {
      const noSpades = cards('A♥ 9♥ K♦ 10♣')
      // No trump in the trick yet: any trump wins.
      expect(ids(legalPlays(noSpades, cards('9♠'), Color.Kier))).toBe('A♥ 9♥')
      expect(ids(legalPlays(noSpades, cards('9♠ A♠'), Color.Kier))).toBe('A♥ 9♥')
      expect(ids(legalPlays(noSpades, cards('9♠ 10♣'), Color.Karo))).toBe('K♦')
      // A trump in the trick: only a higher trump.
      expect(ids(legalPlays(noSpades, cards('9♠ 10♥'), Color.Kier))).toBe('A♥')
      expect(ids(legalPlays(noSpades, cards('9♠ K♥'), Color.Kier))).toBe('A♥')
      expect(ids(legalPlays(noSpades, cards('9♠ J♦'), Color.Karo))).toBe('K♦')
    })

    it('does not force an under-trump when no trump can win', () => {
      const hand2 = cards('K♥ 9♥ K♦ 10♣')
      expect(legalPlays(hand2, cards('9♠ A♥'), Color.Kier)).toEqual(hand2)
      expect(legalPlays(hand2, cards('J♠ 10♥'), Color.Kier)).toEqual(hand2)
      expect(legalPlays(hand2, cards('A♠ A♦'), Color.Karo)).toEqual(hand2)
    })

    it('allows any card when void in the led suit and in trumps', () => {
      const hand2 = cards('A♥ 9♥ K♦ 10♣')
      expect(legalPlays(hand2, cards('9♠'), null)).toEqual(hand2)
      expect(legalPlays(hand2, cards('9♠'), Color.Pik)).toEqual(hand2)
      expect(legalPlays(cards('A♥ 9♥'), cards('9♠'), Color.Trefl)).toEqual(cards('A♥ 9♥'))
      expect(legalPlays(cards('A♥ 9♥'), cards('9♠ 10♣'), Color.Trefl)).toEqual(
        cards('A♥ 9♥'),
      )
    })

    it('always allows at least one card and only cards from the hand', () => {
      const random = seededRandom(31)
      for (let n = 0; n < 2000; n++) {
        const deck = Deck.shuffle(Deck.generate(), random)
        const hand2 = deck.slice(0, 1 + (n % 8))
        const trick = deck.slice(8, 8 + (n % 3))
        const trump = n % 5 === 0 ? null : COLORS[n % 4]
        const legal = legalPlays(hand2, trick, trump)
        expect(legal.length).toBeGreaterThan(0)
        expect(legal.every(card => hand2.includes(card))).toBe(true)
      }
    })
  })

  describe('excludedByPlay', () => {
    it('reveals nothing for a lead or a card that beats the led-suit winner', () => {
      expect(excludedByPlay([], Color.Kier, AH)).toBe(0)
      expect(excludedByPlay(cards('10♥'), null, AH)).toBe(0)
      expect(excludedByPlay(cards('9♥ J♥'), Color.Pik, QH)).toBe(0)
      // Nothing beats an ace: following under it reveals nothing.
      expect(excludedByPlay(cards('A♥'), null, NINE_H)).toBe(0)
      expect(excludedByPlay(cards('J♥ A♥'), null, NINE_H)).toBe(0)
    })

    it('excludes the higher cards of the suit after following without beating', () => {
      expect(maskIds(excludedByPlay(cards('K♥'), null, JH))).toBe('A♥ 10♥')
      // The current winner counts, not the led card.
      expect(maskIds(excludedByPlay(cards('J♥ K♥'), null, NINE_H))).toBe('A♥ 10♥')
      expect(maskIds(excludedByPlay(cards('9♥'), Color.Kier, cards('9♦')[0]))).toBe(
        'A♥ 10♥ K♥ Q♥ J♥ 9♥',
      )
      expect(maskIds(excludedByPlay(cards('10♦'), Color.Karo, cards('9♦')[0]))).toBe('A♦')
    })

    it('reveals nothing about the led suit once the trick is trumped', () => {
      expect(excludedByPlay(cards('K♥ 9♦'), Color.Karo, JH)).toBe(0)
    })

    it('reveals a void in the led suit, and in trumps when no trump was played', () => {
      expect(maskIds(excludedByPlay(cards('K♥'), null, cards('9♠')[0]))).toBe(
        'A♥ 10♥ K♥ Q♥ J♥ 9♥',
      )
      expect(maskIds(excludedByPlay(cards('K♥'), Color.Karo, cards('9♠')[0]))).toBe(
        'A♥ 10♥ K♥ Q♥ J♥ 9♥ A♦ 10♦ K♦ Q♦ J♦ 9♦',
      )
      // Trumping reveals only the void.
      expect(maskIds(excludedByPlay(cards('K♥'), Color.Karo, cards('9♦')[0]))).toBe(
        'A♥ 10♥ K♥ Q♥ J♥ 9♥',
      )
      expect(maskIds(excludedByPlay(cards('K♥ J♦'), Color.Karo, cards('Q♦')[0]))).toBe(
        'A♥ 10♥ K♥ Q♥ J♥ 9♥',
      )
      // Void in trumps when trumps are led.
      expect(maskIds(excludedByPlay(cards('10♦'), Color.Karo, cards('9♠')[0]))).toBe(
        'A♦ 10♦ K♦ Q♦ J♦ 9♦',
      )
    })

    it('excludes the trumps above a winning trump after discarding or under-trumping', () => {
      expect(maskIds(excludedByPlay(cards('K♥ J♦'), Color.Karo, cards('9♠')[0]))).toBe(
        'A♥ 10♥ K♥ Q♥ J♥ 9♥ A♦ 10♦ K♦ Q♦',
      )
      expect(maskIds(excludedByPlay(cards('K♥ Q♦'), Color.Karo, cards('9♦')[0]))).toBe(
        'A♥ 10♥ K♥ Q♥ J♥ 9♥ A♦ 10♦ K♦',
      )
    })

    it('excludes exactly the cards that would have made the play illegal', () => {
      const random = seededRandom(32)
      let checked = 0
      for (let n = 0; n < 1500; n++) {
        const deck = Deck.shuffle(Deck.generate(), random)
        const hand2 = deck.slice(0, 1 + (n % 8))
        const trick = deck.slice(8, 9 + (n % 2))
        const trump = n % 5 === 0 ? null : COLORS[n % 4]
        for (const card of legalPlays(hand2, trick, trump)) {
          const mask = excludedByPlay(trick, trump, card)
          for (const other of ALL_CARDS) {
            const excluded = (mask & (1 << cardIndex(other))) !== 0
            const illegal =
              !hand2.includes(other) &&
              !legalPlays([...hand2, other], trick, trump).includes(card)
            if (excluded !== illegal) {
              throw new Error(
                `${card.id} on ${ids(trick)} (trump ${trump}) from ${ids(hand2)}: ${other.id}`,
              )
            }
          }
          checked++
        }
      }
      expect(checked).toBeGreaterThan(2000)
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

    it('declares a marriage by leading its king or queen, also in the first trick', () => {
      expect(isMeldLead(hand, KH, true)).toBe(true)
      expect(isMeldLead(hand, QH, true)).toBe(true)
    })

    it('does not declare when following', () => {
      expect(isMeldLead(hand, KH, false)).toBe(false)
      expect(isMeldLead(hand, QH, false)).toBe(false)
    })

    it('needs both partners in hand', () => {
      expect(isMeldLead(hand, cards('K♠')[0], true)).toBe(false)
      expect(isMeldLead(cards('K♥ J♥'), KH, true)).toBe(false)
      expect(isMeldLead(cards('Q♥'), KH, true)).toBe(false)
      expect(isMeldLead(hand, JH, true)).toBe(false)
      expect(isMeldLead(hand, AH, true)).toBe(false)
      // Equal but foreign card objects work too.
      expect(isMeldLead(hand, new Card(KH.figure, KH.color), true)).toBe(true)
    })
  })
})
