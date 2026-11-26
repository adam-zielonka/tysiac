import {
  ALL_CARDS,
  COLORS,
  Card,
  Color,
  FIGURES,
  Figure,
  card,
  cardById,
  cards,
} from '../../engine/Card'
import { Deck } from '../../engine/Deck'
import { TOTAL_CARD_POINTS, cardPoints } from '../../engine/rules'
import { ids } from './helpers'

describe('Card', () => {
  it('has a 24 card deck of shared instances', () => {
    expect(ALL_CARDS).toHaveLength(24)
    expect(new Set(ALL_CARDS.map(value => value.id)).size).toBe(24)
    for (const value of ALL_CARDS) {
      expect(card(value.figure, value.color)).toBe(value)
      expect(cardById(value.id)).toBe(value)
    }
    expect(cardById('7♥')).toBeUndefined()
    expect(Deck.generate()).toEqual([...ALL_CARDS])
    expect(Deck.generate()).not.toBe(ALL_CARDS)
  })

  it('lists suits in marriage order and figures from the strongest', () => {
    expect(COLORS).toEqual([Color.Kier, Color.Karo, Color.Trefl, Color.Pik])
    expect(FIGURES.map(Card.figureToString)).toEqual(['A', '10', 'K', 'Q', 'J', '9'])
    expect(COLORS.map(Card.colorToString)).toEqual(['♥', '♦', '♣', '♠'])
  })

  it('ranks A > 10 > K > Q > J > 9', () => {
    const ranks = FIGURES.map(figure => card(figure, Color.Pik).rank)
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a))
    expect(new Set(ranks).size).toBe(6)
    expect(card(Figure.f10, Color.Kier).rank).toBeGreaterThan(
      card(Figure.K, Color.Kier).rank,
    )
  })

  it('counts A 11, 10 10, K 4, Q 3, J 2, 9 0 and 120 in total', () => {
    expect(FIGURES.map(figure => card(figure, Color.Karo).points)).toEqual([
      11, 10, 4, 3, 2, 0,
    ])
    expect(cardPoints(ALL_CARDS)).toBe(TOTAL_CARD_POINTS)
    expect(TOTAL_CARD_POINTS).toBe(120)
  })

  it('describes itself', () => {
    const tenOfHearts = card(Figure.f10, Color.Kier)
    expect(tenOfHearts.id).toBe('10♥')
    expect(tenOfHearts.text).toBe('10♥')
    expect(`${tenOfHearts}`).toBe('10♥')
    expect(tenOfHearts.figureText).toBe('10')
    expect(tenOfHearts.colorText).toBe('♥')
    expect(tenOfHearts.colorStyle).toBe('red')
    expect(card(Figure.A, Color.Karo).colorStyle).toBe('red')
    expect(card(Figure.A, Color.Trefl).colorStyle).toBe('black')
    expect(card(Figure.A, Color.Pik).colorStyle).toBe('black')
    expect(tenOfHearts.isEqual(new Card(Figure.f10, Color.Kier))).toBe(true)
    expect(tenOfHearts.isEqual(card(Figure.f10, Color.Karo))).toBe(false)
  })

  it('knows marriage partners', () => {
    expect(card(Figure.K, Color.Pik).marriagePartner).toBe(card(Figure.Q, Color.Pik))
    expect(card(Figure.Q, Color.Kier).marriagePartner).toBe(card(Figure.K, Color.Kier))
    expect(card(Figure.K, Color.Trefl).isMarriageCard).toBe(true)
    expect(card(Figure.Q, Color.Karo).isMarriageCard).toBe(true)
    for (const figure of [Figure.A, Figure.f10, Figure.J, Figure.f9]) {
      expect(card(figure, Color.Kier).marriagePartner).toBeUndefined()
      expect(card(figure, Color.Kier).isMarriageCard).toBe(false)
    }
  })

  it('parses card lists', () => {
    expect(cards(' A♥  10♠ 9♦ ')).toEqual([
      card(Figure.A, Color.Kier),
      card(Figure.f10, Color.Pik),
      card(Figure.f9, Color.Karo),
    ])
    expect(cards('')).toEqual([])
    expect(() => cards('A♥ 1♠')).toThrow('Unknown card: 1♠')
  })

  it('sorts a hand by alternating suits, then from the strongest', () => {
    const hand = cards('9♠ A♦ K♥ 10♣ J♥ A♠ 10♥ Q♣ 9♦ A♥')
    const sorted = Card.sortHand(hand)
    expect(sorted).toBe(hand)
    expect(ids(sorted)).toBe('A♥ 10♥ K♥ J♥ 10♣ Q♣ A♦ 9♦ A♠ 9♠')
    expect(
      Card.compareInHand(card(Figure.f9, Color.Kier), card(Figure.A, Color.Trefl)),
    ).toBeLessThan(0)
    expect(Card.compareInHand(card(Figure.A, Color.Pik), card(Figure.A, Color.Pik))).toBe(
      0,
    )
  })
})
