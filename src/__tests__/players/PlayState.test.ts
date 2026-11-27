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
  MELD_VALUES,
  bestMarriageSuit,
  marriageSuits,
  marriageTotal,
  maskOf,
  pointsOfMask,
} from '../../engine/players/bits'
import { greedyCard, tacticalCard } from '../../engine/players/heuristics'
import { PlayState } from '../../engine/players/PlayState'
import { MELD_SYSTEMS, beats } from '../../engine/rules'

const CLASSIC = MELD_VALUES.classic
const GERMAN = MELD_VALUES.german

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
    expect(marriageSuits(hand, CLASSIC)).toEqual([0, 3])
    expect(marriageTotal(hand, CLASSIC)).toBe(140)
    expect(bestMarriageSuit(hand, CLASSIC)).toBe(0)
    // German values: wino (♠) 80 before serce (♥) 60.
    expect(marriageSuits(hand, GERMAN)).toEqual([3, 0])
    expect(marriageTotal(hand, GERMAN)).toBe(140)
    expect(bestMarriageSuit(hand, GERMAN)).toBe(3)
    expect(bestMarriageSuit(maskOf(cards('K♠ Q♥')), GERMAN)).toBe(-1)
  })

  it('lists the marriage values per suit index of each system', () => {
    expect(CLASSIC).toEqual([100, 80, 60, 40])
    expect(GERMAN).toEqual([60, 40, 100, 80])
    expect(Object.isFrozen(GERMAN)).toBe(true)
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
  it.each(MELD_SYSTEMS)(
    'follows Deal exactly in %s values: legal cards, marriages, inference and scores',
    meldSystem => {
      const random = seededRandom(meldSystem === 'classic' ? 1 : 2)
      let excludedSeen = 0
      let partialSeen = 0
      let firstTrickMelds = 0
      for (let game = 0; game < 600; game++) {
        const deal = Deal.deal(game % 3, Deck.shuffle(Deck.generate(), random), {
          meldSystem,
        })
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
          const meld = st.isMeld(card) ? st.meldValues[cardAt(card).color - 1] : 0
          const melded = st.meldPoints[st.turn]
          deal.apply({ type: 'play', card: cardAt(card) })
          const player = st.turn
          st.play(card)
          expect(st.meldPoints[player] - melded).toBe(meld)
          expect(st).toEqual(PlayState.fromDeal(deal))
          // A view carries the same public inference.
          expect(PlayState.fromDeal(deal.viewFor(deal.turn)).excluded).toEqual(
            st.excluded,
          )
        }
        expect(st.deltas()).toEqual(deal.result()!.deltas)
        expect(st.meldPoints).toEqual(deal.result()!.meldPoints)
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
    },
    60_000,
  )

  it('makes a follower beat the trick and a void player trump over', () => {
    // ♠ led by seat 0 with the jack; seat 1 holds the ace and the nine.
    const st = new PlayState(
      [maskOf(cards('J♠ A♦')), maskOf(cards('A♠ 9♠ K♣')), maskOf(cards('Q♥ 9♥ 10♣'))],
      0,
      100,
      0,
      CLASSIC,
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
      CLASSIC,
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
      CLASSIC,
    )
    expect(st.isMeld(cardIndex(cards('Q♥')[0]))).toBe(true)
    st.play(cardIndex(cards('Q♥')[0]))
    expect(st.trump).toBe(suitOf('♥'))
    expect(st.meldPoints[0]).toBe(100)
  })

  it('scores marriages in the German values it carries', () => {
    const hands = [
      maskOf(cards('K♣ Q♣ K♦ Q♦ 9♠')),
      maskOf(cards('A♥ 9♦ J♠ 9♣ 10♠')),
      maskOf(cards('9♥ 10♥ J♦ J♣ A♠')),
    ]
    const st = new PlayState(hands, 0, 100, 0, GERMAN)
    st.play(cardIndex(cards('K♣')[0]))
    expect(st.trump).toBe(suitOf('♣'))
    expect(st.meldPoints[0]).toBe(100)
    st.play(cardIndex(cards('9♣')[0]))
    st.play(cardIndex(cards('J♣')[0]))
    expect(st.leader).toBe(0)
    st.play(cardIndex(cards('Q♦')[0]))
    expect(st.trump).toBe(suitOf('♦'))
    expect(st.meldPoints[0]).toBe(140)
    expect(st.clone().meldValues).toBe(GERMAN)
  })

  it('reads a view with the hidden hands empty', () => {
    const deal = Deal.deal(0, Deck.shuffle(Deck.generate(), seededRandom(2)))
    while (deal.phase !== 'play') deal.apply(deal.legalActions()[0])
    const st = PlayState.fromDeal(deal.viewFor(1))
    expect(st.meldValues).toBe(CLASSIC)
    expect(st.hands[1]).toBe(maskOf(deal.hand(1)))
    expect(st.hands[0]).toBe(0)
    expect(st.hands[2]).toBe(0)
    expect(st.leader).toBe(deal.declarer)
    const german = Deal.deal(0, Deck.generate(), { meldSystem: 'german' })
    expect(PlayState.fromDeal(german.viewFor(2)).meldValues).toBe(GERMAN)
  })
})

/** Suit index of a colour symbol. */
function suitOf(symbol: string): number {
  return ['♥', '♦', '♣', '♠'].indexOf(symbol)
}
