import { describe, expect, it } from 'vitest'
import { ALL_CARDS, cards } from '../../engine/Card'
import { Deal } from '../../engine/Deal'
import { Deck } from '../../engine/Deck'
import { pick, seededRandom } from '../../engine/random'
import {
  beatsIndex,
  bitCount,
  cardAt,
  cardIndex,
  cardsIn,
  marriageSuits,
  marriageTotal,
  maskOf,
  pointsOfMask,
} from '../../engine/players/bits'
import { greedyCard, tacticalCard } from '../../engine/players/heuristics'
import { PlayState } from '../../engine/players/PlayState'
import { beats } from '../../engine/rules'

describe('card masks', () => {
  it('maps every card to one bit and back', () => {
    ALL_CARDS.forEach((card, i) => {
      expect(cardIndex(card)).toBe(i)
      expect(cardAt(i)).toBe(card)
    })
    const hand = cards('A♥ 10♦ K♣ 9♠')
    expect(cardsIn(maskOf(hand))).toEqual(hand)
    expect(bitCount(maskOf(ALL_CARDS))).toBe(24)
    expect(pointsOfMask(maskOf(ALL_CARDS))).toBe(120)
  })

  it('finds marriages from the most valuable suit', () => {
    const hand = maskOf(cards('K♠ Q♠ K♥ Q♥ K♦'))
    expect(marriageSuits(hand)).toEqual([0, 3])
    expect(marriageTotal(hand)).toBe(140)
  })

  it('compares cards like the rules', () => {
    for (const a of ALL_CARDS) {
      for (const b of ALL_CARDS) {
        if (a === b) continue
        for (const trump of [null, ...[1, 2, 3, 4]] as const) {
          expect(
            beatsIndex(cardIndex(a), cardIndex(b), trump === null ? -1 : trump - 1),
          ).toBe(beats(a, b, trump))
        }
      }
    }
  })
})

describe('PlayState', () => {
  it('follows Deal exactly for random, tactical and greedy play', () => {
    const random = seededRandom(1)
    for (let game = 0; game < 300; game++) {
      const deal = Deal.deal(game % 3, Deck.shuffle(Deck.generate(), random))
      while (deal.phase !== 'play') deal.apply(pick(random, deal.legalActions()))
      const st = PlayState.fromDeal(deal)
      while (!deal.isFinished) {
        expect(st.turn).toBe(deal.turn)
        expect(st.legal()).toBe(maskOf(deal.playableCards()))
        const policy = game % 3
        const card =
          policy === 0
            ? cardIndex(pick(random, deal.playableCards()))
            : policy === 1
              ? tacticalCard(st)
              : greedyCard(st)
        expect(st.legal() & (1 << card)).not.toBe(0)
        expect(st.isMeld(card)).toBe(deal.isMeld(cardAt(card)))
        deal.apply({ type: 'play', card: cardAt(card) })
        st.play(card)
        expect(st).toEqual(PlayState.fromDeal(deal))
      }
      expect(st.deltas()).toEqual(deal.result()!.deltas)
    }
  })

  it('reads a view with the hidden hands empty', () => {
    const deal = Deal.deal(0, Deck.shuffle(Deck.generate(), seededRandom(2)))
    while (deal.phase !== 'play') deal.apply(deal.legalActions()[0])
    const st = PlayState.fromDeal(deal.viewFor(1))
    expect(st.hands[1]).toBe(maskOf(deal.hand(1)))
    expect(st.hands[0]).toBe(0)
    expect(st.hands[2]).toBe(0)
    expect(st.leader).toBe(deal.declarer)
  })
})
