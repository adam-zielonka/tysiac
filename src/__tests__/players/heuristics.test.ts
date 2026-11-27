import { describe, expect, it } from 'vitest'
import { Figure, cards, type Card } from '../../engine/Card'
import { Deck } from '../../engine/Deck'
import { seededRandom } from '../../engine/random'
import type { Action } from '../../engine/Deal'
import { PlayerType } from '../../engine/PlayerType'
import { cardAt, cardIndex, isMarriageCard, maskOf } from '../../engine/players/bits'
import {
  auctionEstimate,
  bidUpTo,
  contractUpTo,
  declarerEstimate,
  giftOrder,
  greedyCard,
  tacticalCard,
} from '../../engine/players/heuristics'
import { PlayState } from '../../engine/players/PlayState'
import { bot, dealOf, decide, play, toPlay } from './helpers'

/** Seat 1 opens and plays 100 holding the ♥ marriage and the ace of spades. */
function marriageDeal(withSecondAce: boolean) {
  const deal = dealOf(
    withSecondAce
      ? ['A♥ 10♥ J♦ 10♦ A♣ 10♣ K♠', 'A♠ A♦ K♥ Q♥ 9♣ 9♦ J♣', '10♠ Q♠ K♦ Q♦ K♣ Q♣ J♥']
      : ['A♥ 10♥ A♦ 10♦ A♣ 10♣ K♠', 'A♠ J♦ K♥ Q♥ 9♣ 9♦ J♣', '10♠ Q♠ K♦ Q♦ K♣ Q♣ J♥'],
    '9♠ 9♥ J♠',
  )
  return toPlay(deal, ['9♠', '9♥'])
}

/** Seat 1 declares; seat 2 wins the first trick and leads the ace of hearts. */
function defenceDeal() {
  const deal = dealOf(
    ['K♠ 10♦ J♦ 9♦ J♣ 9♣ Q♣', 'Q♥ J♥ 9♥ A♦ K♦ Q♦ 9♠', 'A♠ A♥ 10♥ K♥ A♣ 10♣ K♣'],
    '10♠ Q♠ J♠',
  )
  return toPlay(deal, ['10♠', 'Q♠'])
}

function playedCard(action: Action): string {
  return action.type === 'play' ? action.card.id : action.type
}

describe('tactical card play', () => {
  it('cashes an ace in the first trick and then declares the marriage', () => {
    const deal = marriageDeal(false)
    expect(deal.turn).toBe(1)
    const tosia = bot(PlayerType.Tactical, 1)
    expect(playedCard(decide(deal, tosia))).toBe('A♠')
    play(deal, 'A♠ Q♠ K♠')
    const lead = decide(deal, tosia)
    expect(lead.type === 'play' && deal.isMeld(lead.card)).toBe(true)
    // The king is not the top heart, so the queen is risked.
    expect(playedCard(lead)).toBe('Q♥')
  })

  it('cashes sure winners before declaring while there is no trump', () => {
    const deal = play(marriageDeal(true), 'A♠ Q♠ K♠')
    const tosia = bot(PlayerType.Tactical, 1)
    expect(playedCard(decide(deal, tosia))).toBe('A♦')
    play(deal, 'A♦ K♦ J♦')
    const lead = decide(deal, tosia)
    expect(lead.type === 'play' && deal.isMeld(lead.card)).toBe(true)
  })

  it('adds points to a trick the partner holds for sure', () => {
    const deal = play(defenceDeal(), '9♠ A♠ K♠ A♥')
    expect(deal.turn).toBe(0)
    expect(playedCard(decide(deal, bot(PlayerType.Tactical, 0)))).toBe('10♦')
  })

  it('throws the cheapest card under a winner of the declarer', () => {
    const deal = play(defenceDeal(), 'A♦ 10♥')
    expect(deal.turn).toBe(0)
    expect(playedCard(decide(deal, bot(PlayerType.Tactical, 0)))).toBe('9♦')
  })

  it('keeps marriage cards when discarding', () => {
    // The declarer (K♦ Q♦) has no clubs and no trump is declared yet.
    const deal = play(defenceDeal(), '9♠ A♠ K♠ A♣ 9♣')
    expect(deal.turn).toBe(1)
    const st = PlayState.fromDeal(deal)
    const card = tacticalCard(st)
    expect(isMarriageCard(st.hands[1], card)).toBe(false)
    expect(cardAt(card).id).toBe('9♥')
  })

  it('declares a marriage on the first lead without a sure winner', () => {
    const deal = toPlay(
      dealOf(
        ['A♥ 10♥ A♦ 10♦ A♣ 10♣ K♠', 'K♥ Q♥ J♥ 9♦ J♣ 9♣ Q♠', 'A♠ 10♠ K♦ Q♦ K♣ Q♣ 9♥'],
        '9♠ J♠ J♦',
      ),
      ['9♠', 'J♠'],
    )
    expect(deal.trickNumber).toBe(0)
    const lead = decide(deal, bot(PlayerType.Tactical, 1))
    expect(lead.type === 'play' && deal.isMeld(lead.card)).toBe(true)
    // The ace and ten of hearts are out: the queen is risked, not the king.
    expect(playedCard(lead)).toBe('Q♥')
  })

  it('cashes a ten once the overtaking rule shows the declarer lacks the ace', () => {
    const hands = [cards('9♠ Q♣ 9♦'), cards('10♠ 9♣ J♣'), cards('A♠ K♠ J♦')].map(maskOf)
    const played = 0xffffff & ~(hands[0] | hands[1] | hands[2])
    const st = new PlayState(hands, 0, 100, 1, -1, 5, [], [0, 0, 0], [0, 0, 0], played)
    // Unknown holders: the ten is not safe against the ace and the king.
    expect(cardAt(tacticalCard(st)).id).not.toBe('10♠')
    // The declarer once followed spades below a queen: no ace, ten or king.
    st.excluded[0] = maskOf(cards('A♠ 10♠ K♠'))
    expect(cardAt(tacticalCard(st)).id).toBe('10♠')
  })

  it('never reads other hands: a view gives the same card as the full deal', () => {
    const deal = play(defenceDeal(), '9♠ A♠ K♠ A♥')
    expect(tacticalCard(PlayState.fromDeal(deal.viewFor(0)))).toBe(
      tacticalCard(PlayState.fromDeal(deal)),
    )
  })
})

describe('greedy card play', () => {
  it('declares a marriage with the king when leading, the first lead too', () => {
    const deal = marriageDeal(false)
    expect(cardAt(greedyCard(PlayState.fromDeal(deal))).id).toBe('K♥')
    play(deal, 'A♠ Q♠ K♠')
    expect(cardAt(greedyCard(PlayState.fromDeal(deal))).id).toBe('K♥')
  })

  it('leads the strongest card otherwise and wins with the cheapest card', () => {
    const deal = toPlay(
      dealOf(
        ['A♥ 10♥ A♦ 10♦ A♣ 10♣ K♠', 'A♠ J♦ K♥ 9♥ 9♣ 9♦ J♣', '10♠ Q♠ K♦ Q♦ K♣ Q♣ J♥'],
        '9♠ Q♥ J♠',
      ),
      ['9♠', 'Q♥'],
    )
    expect(cardAt(greedyCard(PlayState.fromDeal(deal))).id).toBe('A♠')
    play(deal, 'J♦')
    // Seat 2 holds K♦ and Q♦ and must beat the jack: the queen is enough.
    expect(cardAt(greedyCard(PlayState.fromDeal(deal))).id).toBe('Q♦')
  })
})

describe('gifts and estimates', () => {
  it('gives away low cards, never an ace or a marriage card first', () => {
    const hand = maskOf(cards('A♥ 10♥ K♥ Q♥ A♠ K♣ 9♦ J♦ 9♠ J♣'))
    const [first, second] = giftOrder(hand).map(card => cardAt(card).id)
    expect(['9♦', 'J♦', '9♠', 'J♣']).toContain(first)
    expect(['9♦', 'J♦', '9♠', 'J♣']).toContain(second)
  })

  it('gives a lone king or queen only after nines, jacks and short unguarded tens', () => {
    // As Tosia's description says; longer unguarded tens may still go first.
    const random = seededRandom(7)
    for (let n = 0; n < 2000; n++) {
      const hand = Deck.shuffle(Deck.generate(), random).slice(0, 10)
      const order = giftOrder(maskOf(hand)).map(cardAt)
      const inSuit = (card: Card) => hand.filter(c => c.color === card.color)
      const lone = (card: Card) =>
        card.isMarriageCard && !inSuit(card).includes(card.marriagePartner!)
      const cheap = (card: Card) =>
        card.figure === Figure.f9 ||
        card.figure === Figure.J ||
        (card.figure === Figure.f10 &&
          inSuit(card).length < 3 &&
          !inSuit(card).some(c => c.figure === Figure.A))
      const firstLone = order.findIndex(lone)
      if (firstLone < 0) continue
      expect(order.slice(firstLone).some(cheap), order.map(c => c.id).join(' ')).toBe(
        false,
      )
    }
    // Bolek's gifts keep a marriage although a ten is worth more points.
    const deal = dealOf(
      ['A♥ 10♥ K♥ Q♥ A♣ 10♣ A♦', '9♥ J♦ 9♦ J♣ 9♣ J♠ 9♠', 'J♥ K♦ Q♦ K♣ Q♣ K♠ Q♠'],
      '10♦ A♠ 10♠',
      2,
    )
    deal.apply({ type: 'pass' })
    deal.apply({ type: 'pass' })
    deal.apply({ type: 'take' })
    const gift = decide(deal, bot(PlayerType.Simple, 0))
    expect(gift.type === 'give' && gift.card.figure).toBe(Figure.f10)
  })

  it('values aces, tens and marriages', () => {
    const strong = maskOf(cards('A♥ 10♥ K♥ Q♥ A♦ A♣ A♠'))
    const weak = maskOf(cards('9♥ J♦ 9♦ J♣ 9♣ J♠ 9♠'))
    expect(auctionEstimate(strong)).toBeGreaterThan(160)
    expect(auctionEstimate(weak)).toBeLessThan(60)
    expect(declarerEstimate(maskOf(cards('A♥ 10♥ K♥ Q♥ A♦ 10♦ A♣ A♠')))).toBeGreaterThan(
      declarerEstimate(maskOf(cards('A♥ 10♥ K♥ J♥ A♦ 10♦ A♣ A♠'))),
    )
  })

  it('bids one step while the limit allows and picks the highest contract below it', () => {
    const deal = dealOf(
      ['A♥ 10♥ K♥ Q♥ A♦ A♣ A♠', '9♥ J♦ 9♦ J♣ 9♣ J♠ 9♠', 'J♥ 10♦ K♦ Q♦ 10♣ K♣ Q♣'],
      '10♠ K♠ Q♠',
      2,
    )
    // Dealer 2: seat 0 opens at 100, seat 1 bids first.
    deal.apply({ type: 'pass' })
    const actions = deal.legalActions()
    expect(bidUpTo(deal, actions, 105)).toEqual({ type: 'pass' })
    expect(bidUpTo(deal, actions, 110)).toEqual({ type: 'bid', value: 110 })
    const contracts: Action[] = [100, 110, 120].map(value => ({
      type: 'contract',
      value,
    }))
    expect(contractUpTo(contracts, 115)).toEqual({ type: 'contract', value: 110 })
    expect(contractUpTo(contracts, 50)).toEqual({ type: 'contract', value: 100 })
  })

  it('indexes cards consistently', () => {
    for (const card of cards('A♥ 9♠ K♦ Q♣')) expect(cardAt(cardIndex(card))).toBe(card)
  })
})
