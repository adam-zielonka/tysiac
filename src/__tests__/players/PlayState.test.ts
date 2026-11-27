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
  it('follows Deal exactly: legal cards, marriages, inference and scores', () => {
    const random = seededRandom(1)
    let excludedSeen = 0
    let partialSeen = 0
    let firstTrickMelds = 0
    for (let game = 0; game < 600; game++) {
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
        if (st.isMeld(card) && st.trickNumber === 0) firstTrickMelds++
        deal.apply({ type: 'play', card: cardAt(card) })
        st.play(card)
        expect(st).toEqual(PlayState.fromDeal(deal))
        // A view carries the same public inference.
        expect(PlayState.fromDeal(deal.viewFor(deal.turn)).excluded).toEqual(st.excluded)
      }
      expect(st.deltas()).toEqual(deal.result()!.deltas)
      for (const mask of st.excluded) {
        if (mask) excludedSeen++
        for (let suit = 0; suit < 4; suit++) {
          const bits = (mask >>> (suit * 6)) & 63
          if (bits && bits !== 63) partialSeen++
        }
      }
    }
    // The series covers voids, partial exclusions and first-trick marriages.
    expect(excludedSeen).toBeGreaterThan(1000)
    expect(partialSeen).toBeGreaterThan(400)
    expect(firstTrickMelds).toBeGreaterThan(80)
  }, 60_000)

  it('makes a follower beat the trick and a void player trump over', () => {
    // ♠ led by seat 0 with the jack; seat 1 holds the ace and the nine.
    const st = new PlayState(
      [maskOf(cards('J♠ A♦')), maskOf(cards('A♠ 9♠ K♣')), maskOf(cards('Q♥ 9♥ 10♣'))],
      0,
      100,
      0,
      suitOf('♥'),
    )
    st.play(cardIndex(cards('J♠')[0]))
    expect(cardsIn(st.legal())).toEqual(cards('A♠'))
    st.play(cardIndex(cards('A♠')[0]))
    // Seat 2 has no spade: it must trump, and either heart beats the ace.
    expect(cardsIn(st.legal())).toEqual(cards('Q♥ 9♥'))
    st.play(cardIndex(cards('9♥')[0]))
    expect(st.leader).toBe(2)
    expect(st.excluded[2] & maskOf(cards('9♠ K♠ A♠'))).toBe(maskOf(cards('9♠ K♠ A♠')))

    // Trick trumped already: a void player must trump over, or plays anything.
    const next = new PlayState(
      [maskOf(cards('A♣ 9♦')), maskOf(cards('K♥ J♦')), maskOf(cards('Q♣ J♥'))],
      2,
      100,
      2,
      suitOf('♥'),
    )
    next.play(cardIndex(cards('Q♣')[0]))
    // Seat 0 must beat the queen with the ace.
    expect(cardsIn(next.legal())).toEqual(cards('A♣'))
    next.hands[0] = maskOf(cards('9♦ 10♦'))
    next.play(cardIndex(cards('9♦')[0]))
    // Seat 0 did not trump: it holds no heart at all.
    expect(next.voids[0]).toBe((1 << suitOf('♣')) | (1 << suitOf('♥')))
    expect(cardsIn(next.legal())).toEqual(cards('K♥'))
  })

  it('declares a marriage on the very first lead', () => {
    const st = new PlayState(
      [maskOf(cards('K♥ Q♥ 9♠')), maskOf(cards('A♥ 9♦ J♠')), maskOf(cards('9♥ 10♠ J♦'))],
      0,
      100,
      0,
    )
    expect(st.isMeld(cardIndex(cards('Q♥')[0]))).toBe(true)
    st.play(cardIndex(cards('Q♥')[0]))
    expect(st.trump).toBe(suitOf('♥'))
    expect(st.meldPoints[0]).toBe(100)
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

/** Suit index of a colour symbol. */
function suitOf(symbol: string): number {
  return ['♥', '♦', '♣', '♠'].indexOf(symbol)
}
