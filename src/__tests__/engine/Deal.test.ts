import { ALL_CARDS, Card, Color, Figure, cards } from '../../engine/Card'
import {
  Deal,
  actionKey,
  sameAction,
  type Action,
  type DealEvent,
} from '../../engine/Deal'
import { Deck } from '../../engine/Deck'
import { seededRandom } from '../../engine/random'
import { cardPoints } from '../../engine/rules'
import { dealWith, expectComplete, ids, maskIds, run } from './helpers'

/** Seat 0 holds the ♥ marriage and wins every trick (dealer 2, opener 0). */
function slamDeal(): Deal {
  return dealWith(
    2,
    ['A♥ 10♥ K♥ Q♥ A♠ 10♠ A♦', 'J♥ 9♥ K♠ Q♠ J♠ 9♠ 10♦', 'A♣ 10♣ K♣ Q♣ J♣ 9♣ K♦'],
    'Q♦ J♦ 9♦',
  )
}

/**
 * Dealer 0, opener 1. Seat 2 holds the ♠ marriage, seat 1 the ♥ one and seat 0
 * the ♦ one; the musik is K♣ 10♠ J♠.
 */
function threeMarriagesDeal(): Deal {
  return dealWith(
    0,
    ['J♥ A♠ 10♦ K♦ Q♦ J♣ Q♣', 'A♥ 10♥ K♥ Q♥ J♦ 9♦ 9♠', 'K♠ Q♠ A♣ 10♣ 9♣ A♦ 9♥'],
    'K♣ 10♠ J♠',
  )
}

const THREE_MARRIAGES_AUCTION = '110, pass, 120, 130, pass'
const THREE_MARRIAGES_SETUP = `${THREE_MARRIAGES_AUCTION}, take, g9♥>0, gJ♠>1, c130`
const THREE_MARRIAGES_TRICKS = [
  'Q♠, A♠, 9♠',
  'K♦, J♦, A♦',
  'K♠, Q♦, J♠',
  '9♥, 10♥, 9♣',
  'Q♥, K♣, J♥',
  '9♦, 10♠, 10♦',
  'J♣, K♥, 10♣',
  'A♥, A♣, Q♣',
]

/**
 * Dealer 2: seat 0 declares at 100 and plays for 150 with the ♠ and ♣
 * marriages. After the gifts seat 0 holds K♠ Q♠ K♣ Q♣ 10♣ 9♣ Q♥ J♦, seat 1
 * A♥ 10♥ K♥ J♥ A♦ K♦ 9♦ 9♠ and seat 2 A♠ 10♠ J♠ A♣ J♣ Q♦ 10♦ 9♥.
 */
function overtakingDeal(): Deal {
  const deal = dealWith(
    2,
    ['Q♠ K♠ Q♥ 9♣ J♦ K♣ Q♣', '9♠ A♥ 10♥ K♥ J♥ A♦ K♦', 'A♠ 10♠ J♠ 9♥ A♣ J♣ Q♦'],
    '10♣ 9♦ 10♦',
  )
  run(deal, 'pass, pass, take, g9♦>1, g10♦>2, c150')
  return deal
}

function events(deal: Deal, action: Action): string[] {
  return deal.apply(action).map(event => event.type)
}

describe('Deal', () => {
  describe('dealing', () => {
    it('gives 7 sorted cards to each player and 3 to the musik', () => {
      const deck = Deck.shuffle(Deck.generate(), seededRandom(5))
      const deal = Deal.deal(1, deck)
      expect([0, 1, 2].map(p => deal.hand(p).length)).toEqual([7, 7, 7])
      expect(deal.s.musik).toEqual(deck.slice(21))
      for (const p of [0, 1, 2]) {
        expect(new Set(deal.hand(p))).toEqual(new Set(deck.slice(p * 7, p * 7 + 7)))
        expect([...deal.hand(p)]).toEqual(Card.sortHand([...deal.hand(p)]))
      }
      expectComplete(deal)
      expect(deal.isMusikRevealed).toBe(false)
      expect(deal.s.musikCount).toBe(3)
      expect(deal.isView).toBe(false)
      expect(deal.isFinished).toBe(false)
      expect(deal.result()).toBeNull()
    })

    it('uses a random deck by default', () => {
      const deal = Deal.deal(0)
      expectComplete(deal)
    })

    it('rejects broken decks and dealers', () => {
      expect(() => Deal.deal(0, Deck.generate().slice(1))).toThrow('24 cards')
      const doubled = Deck.generate()
      doubled[0] = doubled[1]
      expect(() => Deal.deal(0, doubled)).toThrow('exactly once')
      expect(() => Deal.deal(3)).toThrow('Invalid dealer')
      expect(() => Deal.deal(-1)).toThrow('Invalid dealer')
    })

    it('maps equal but foreign card objects to the shared instances', () => {
      const foreign = Deck.generate().map(value => new Card(value.figure, value.color))
      const deal = Deal.deal(0, foreign)
      const shared = new Set<Card>(ALL_CARDS)
      expect(
        [...deal.hand(0), ...deal.hand(1), ...deal.hand(2), ...deal.s.musik].every(c =>
          shared.has(c),
        ),
      ).toBe(true)
    })
  })

  describe('auction', () => {
    it('forces the player after the dealer to open at 100', () => {
      for (const dealer of [0, 1, 2]) {
        const deal = Deal.deal(dealer, Deck.generate())
        const opener = (dealer + 1) % 3
        expect(deal.dealer).toBe(dealer)
        expect(deal.opener).toBe(opener)
        expect(deal.phase).toBe('bidding')
        expect(deal.s.bids[opener]).toBe(100)
        expect(deal.s.bids.filter(bid => bid !== null)).toEqual([100])
        expect(deal.s.highestBid).toBe(100)
        expect(deal.s.highestBidder).toBe(opener)
        // The opener has bid already; the next seat speaks first.
        expect(deal.turn).toBe((dealer + 2) % 3)
        expect(deal.declarer).toBe(-1)
      }
    })

    it('ends with the opener at 100 when both others pass', () => {
      const deal = slamDeal()
      expect(deal.turn).toBe(1)
      expect(events(deal, { type: 'pass' })).toEqual(['pass'])
      expect(deal.turn).toBe(2)
      const result = deal.apply({ type: 'pass' })
      expect(result).toEqual([
        { type: 'pass', player: 2 },
        { type: 'bidWon', player: 0, value: 100 },
      ])
      expect(deal.phase).toBe('musik')
      expect(deal.declarer).toBe(0)
      expect(deal.contract).toBe(100)
      expect(deal.turn).toBe(0)
      expect(deal.s.passed).toEqual([false, true, true])
      expect(deal.s.bids).toEqual([100, 'pass', 'pass'])
      expect(deal.s.maxBids).toEqual([100, 0, 0])
    })

    it('goes clockwise, skips players who passed and ends after two passes', () => {
      const deal = threeMarriagesDeal()
      expect(deal.turn).toBe(2)
      expect(events(deal, { type: 'bid', value: 110 })).toEqual(['bid'])
      expect(deal.turn).toBe(0)
      deal.apply({ type: 'pass' })
      expect(deal.turn).toBe(1)
      deal.apply({ type: 'bid', value: 120 })
      // Seat 0 passed for good: back to seat 2.
      expect(deal.turn).toBe(2)
      deal.apply({ type: 'bid', value: 130 })
      expect(deal.turn).toBe(1)
      expect(deal.s.highestBid).toBe(130)
      expect(deal.s.highestBidder).toBe(2)
      expect(deal.s.bids).toEqual(['pass', 120, 130])
      expect(events(deal, { type: 'pass' })).toEqual(['pass', 'bidWon'])
      // A pass replaces the shown bid; the highest bid of each seat stays public.
      expect(deal.s.bids).toEqual(['pass', 'pass', 130])
      expect(deal.s.maxBids).toEqual([0, 120, 130])
      expect(deal.viewFor(0).s.maxBids).toEqual([0, 120, 130])
      expect(deal.declarer).toBe(2)
      expect(deal.contract).toBe(130)
      expect(deal.turn).toBe(2)
    })

    it('allows passing or raising by steps of ten up to 120 without a marriage', () => {
      const deal = dealWith(
        0,
        ['A♥ 10♥ A♦ 10♦ A♣ 10♣ A♠', 'K♥ Q♥ K♦ J♦ 9♦ 10♠ K♠', 'J♥ 9♥ Q♦ K♣ Q♠ J♣ 9♣'],
        'Q♣ J♠ 9♠',
      )
      // Seat 2 holds no marriage.
      expect(deal.turn).toBe(2)
      expect(deal.maxBid(2)).toBe(120)
      expect(deal.bidOptions()).toEqual([110, 120])
      expect(deal.legalActions()).toEqual([
        { type: 'pass' },
        { type: 'bid', value: 110 },
        { type: 'bid', value: 120 },
      ])
      expect(deal.isLegal({ type: 'bid', value: 115 })).toBe(false)
      expect(deal.isLegal({ type: 'bid', value: 100 })).toBe(false)
      expect(deal.isLegal({ type: 'bid', value: 130 })).toBe(false)
      expect(() => deal.apply({ type: 'bid', value: 130 })).toThrow(
        'Illegal action bid:130',
      )
      deal.apply({ type: 'bid', value: 120 })
      // Seat 0 has no marriage either: it can only pass at 120.
      expect(deal.turn).toBe(0)
      expect(deal.bidOptions()).toEqual([])
      expect(deal.legalActions()).toEqual([{ type: 'pass' }])
      deal.apply({ type: 'pass' })
      // Seat 1 holds ♥: it may go up to 220.
      expect(deal.turn).toBe(1)
      expect(deal.maxBid(1)).toBe(220)
      expect(deal.bidOptions()).toEqual([
        130, 140, 150, 160, 170, 180, 190, 200, 210, 220,
      ])
      deal.apply({ type: 'bid', value: 220 })
      expect(deal.turn).toBe(2)
      expect(deal.legalActions()).toEqual([{ type: 'pass' }])
      deal.apply({ type: 'pass' })
      expect(deal.declarer).toBe(1)
      expect(deal.contract).toBe(220)
    })

    it('adds the value of every marriage held to the limit', () => {
      const deal = dealWith(
        0,
        ['A♥ 10♥ A♦ 10♦ A♣ 10♣ A♠', 'J♥ 9♥ J♦ 9♦ J♣ 9♣ 10♠', 'K♥ Q♥ K♦ Q♦ K♣ Q♣ K♠'],
        'Q♠ J♠ 9♠',
      )
      expect(deal.turn).toBe(2)
      expect(deal.maxBid(2)).toBe(360)
      expect(deal.bidOptions()).toHaveLength(26)
      expect(deal.bidOptions().at(-1)).toBe(360)
    })

    it('rejects out of turn phase actions', () => {
      const deal = slamDeal()
      for (const action of [
        { type: 'take' },
        { type: 'contract', value: 100 },
        { type: 'play', card: deal.hand(1)[0] },
        { type: 'give', card: deal.hand(1)[0], to: 2 },
      ] as Action[]) {
        expect(deal.isLegal(action)).toBe(false)
        expect(() => deal.apply(action)).toThrow('Illegal action')
      }
    })
  })

  describe('musik and contract', () => {
    it('reveals the musik, lets the declarer take it and give a card to each opponent', () => {
      const deal = threeMarriagesDeal()
      run(deal, THREE_MARRIAGES_AUCTION)
      expect(deal.phase).toBe('musik')
      expect(deal.isMusikRevealed).toBe(true)
      expect(ids(deal.s.musikCards)).toBe('K♣ 10♠ J♠')
      expect(deal.legalActions()).toEqual([{ type: 'take' }])
      expect(deal.pendingRecipients()).toEqual([])

      const taken = deal.apply({ type: 'take' })
      expect(taken).toEqual([{ type: 'take', player: 2, cards: cards('K♣ 10♠ J♠') }])
      expect(deal.phase).toBe('giving')
      expect(deal.turn).toBe(2)
      expect(deal.s.musik).toEqual([])
      expect(deal.s.musikCount).toBe(0)
      expect(ids(deal.s.musikCards)).toBe('K♣ 10♠ J♠')
      expect(ids(deal.hand(2))).toBe('9♥ A♣ 10♣ K♣ 9♣ A♦ 10♠ K♠ Q♠ J♠')
      expect(deal.pendingRecipients()).toEqual([0, 1])
      expect(deal.legalActions()).toHaveLength(20)
      expect(deal.isLegal({ type: 'give', card: cards('9♥')[0], to: 2 })).toBe(false)
      expect(deal.isLegal({ type: 'give', card: cards('A♥')[0], to: 0 })).toBe(false)

      expect(deal.apply({ type: 'give', card: cards('9♥')[0], to: 0 })).toEqual([
        { type: 'give', player: 2, to: 0, card: cards('9♥')[0] },
      ])
      expect(deal.pendingRecipients()).toEqual([1])
      expect(deal.isLegal({ type: 'give', card: cards('J♠')[0], to: 0 })).toBe(false)
      expect(deal.phase).toBe('giving')
      deal.apply({ type: 'give', card: cards('J♠')[0], to: 1 })

      expect(deal.phase).toBe('contract')
      expect(deal.turn).toBe(2)
      expect(deal.pendingRecipients()).toEqual([])
      expect([0, 1, 2].map(p => deal.handCount(p))).toEqual([8, 8, 8])
      expect(ids(deal.hand(0))).toBe('J♥ 9♥ Q♣ J♣ 10♦ K♦ Q♦ A♠')
      expect(ids(deal.hand(1))).toBe('A♥ 10♥ K♥ Q♥ J♦ 9♦ J♠ 9♠')
      expect(deal.s.gifts).toEqual([
        { to: 0, card: cards('9♥')[0] },
        { to: 1, card: cards('J♠')[0] },
      ])
      // Bid 130 with the ♠ marriage: up to 160.
      expect(deal.contractOptions()).toEqual([130, 140, 150, 160])
      expect(deal.isLegal({ type: 'contract', value: 120 })).toBe(false)
      expect(deal.isLegal({ type: 'contract', value: 170 })).toBe(false)
      expect(deal.apply({ type: 'contract', value: 150 })).toEqual([
        { type: 'contract', player: 2, value: 150 },
      ])
      expect(deal.phase).toBe('play')
      expect(deal.contract).toBe(150)
      expect(deal.turn).toBe(2)
      expect(deal.s.leader).toBe(2)
      expectComplete(deal)
    })

    it('raises the contract limit with a marriage completed from the musik', () => {
      const deal = slamDeal()
      run(deal, 'pass, pass')
      // Seat 0 held K♥ Q♥ already; the musik adds nothing: 100..220.
      run(deal, 'take, g9♦>1, gJ♦>2')
      expect(deal.contractOptions()).toEqual([
        100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220,
      ])

      const fromMusik = dealWith(
        2,
        ['A♥ 10♥ K♥ A♠ 10♠ A♦ 9♣', 'J♥ 9♥ K♠ Q♠ J♠ 9♠ 10♦', 'A♣ 10♣ K♣ Q♣ J♣ K♦ Q♦'],
        'Q♥ J♦ 9♦',
      )
      run(fromMusik, 'pass, pass')
      // Bid without a marriage, Q♥ from the musik completes ♥.
      expect(fromMusik.maxBid(0)).toBe(120)
      run(fromMusik, 'take')
      expect(fromMusik.maxBid(0)).toBe(220)
      run(fromMusik, 'g9♦>1, gJ♦>2')
      expect(fromMusik.contractOptions().at(-1)).toBe(220)
    })

    it('keeps at least the bid when the marriage is given away', () => {
      const deal = threeMarriagesDeal()
      run(deal, `${THREE_MARRIAGES_AUCTION}, take`)
      run(deal, 'gK♠>0, g9♥>1')
      // No marriage left: 120 + 0 < bid 130, so only the bid itself.
      expect(deal.contractOptions()).toEqual([130])
      expect(deal.legalActions()).toEqual([{ type: 'contract', value: 130 }])
    })

    it('lets a bid-100 declarer without marriages choose 100..120', () => {
      const deal = dealWith(
        2,
        ['A♥ 10♥ J♥ A♠ 10♠ A♦ 9♣', 'K♥ 9♥ K♠ Q♠ J♠ 9♠ 10♦', 'A♣ 10♣ K♣ Q♣ J♣ K♦ Q♦'],
        'Q♥ J♦ 9♦',
      )
      run(deal, 'pass, pass, take, g9♦>1, gJ♦>2')
      expect(deal.contractOptions()).toEqual([100, 110, 120])
    })
  })

  describe('play', () => {
    it('plays a full deal: a first-trick marriage, trump changes and a failed contract', () => {
      const deal = threeMarriagesDeal()
      run(deal, THREE_MARRIAGES_SETUP)
      expect(deal.phase).toBe('play')
      expect(deal.trump).toBeNull()
      expect(deal.s.excluded).toEqual([0, 0, 0])

      // Trick 0: the declarer may declare a marriage at once (♠, 40).
      expect(deal.turn).toBe(2)
      expect(deal.isMeld(cards('K♠')[0])).toBe(true)
      expect(deal.isMeld(cards('Q♠')[0])).toBe(true)
      expect(deal.isMeld(cards('A♣')[0])).toBe(false)
      expect(deal.playableCards()).toEqual(deal.hand(2))
      expect(deal.apply({ type: 'play', card: cards('Q♠')[0] })).toEqual([
        { type: 'play', player: 2, card: cards('Q♠')[0] },
        { type: 'meld', player: 2, color: Color.Pik, points: 40 },
      ])
      expect(deal.trump).toBe(Color.Pik)
      expect(deal.s.knownHolders).toEqual({ 'K♠': 2 })
      expect(deal.meldPointsOf(2)).toBe(40)
      // Seat 0 must beat the queen; seat 1 cannot beat the ace: any spade.
      expect(deal.turn).toBe(0)
      expect(ids(deal.playableCards())).toBe('A♠')
      run(deal, 'A♠')
      expect(ids(deal.playableCards())).toBe('J♠ 9♠')
      // Following with a marriage card never declares it.
      expect(deal.isMeld(cards('J♠')[0])).toBe(false)
      expect(events(deal, { type: 'play', card: cards('9♠')[0] })).toEqual([
        'play',
        'trick',
      ])
      expect(deal.trickNumber).toBe(1)
      expect(deal.trick).toEqual([])
      expect(deal.s.lastTrick?.winner).toBe(0)
      expect(ids(deal.s.lastTrick!.plays.map(p => p.card))).toBe('Q♠ A♠ 9♠')
      // Nothing ranks above an ace: following under it reveals nothing.
      expect(deal.s.excluded).toEqual([0, 0, 0])

      // Trick 1: seat 0 declares ♦ (80); trump switches from ♠ to ♦.
      expect(deal.turn).toBe(0)
      expect(events(deal, { type: 'play', card: cards('K♦')[0] })).toEqual([
        'play',
        'meld',
      ])
      expect(deal.trump).toBe(Color.Karo)
      expect(deal.s.knownHolders).toEqual({ 'K♠': 2, 'Q♦': 0 })
      // Seat 1 cannot beat the king: any diamond, showing it has no higher one.
      expect(ids(deal.playableCards())).toBe('J♦ 9♦')
      run(deal, 'J♦')
      expect(maskIds(deal.s.excluded[1])).toBe('A♦ 10♦')
      expect(ids(deal.playableCards())).toBe('A♦')
      run(deal, 'A♦')
      expect(deal.s.lastTrick?.winner).toBe(2)

      // Trick 2: K♠ no longer declares (Q♠ is gone); seat 0 has no spade and
      // must trump, with either trump since none is in the trick yet.
      expect(deal.isMeld(cards('K♠')[0])).toBe(false)
      run(deal, 'K♠')
      expect(deal.s.knownHolders).toEqual({ 'Q♦': 0 })
      expect(ids(deal.playableCards())).toBe('10♦ Q♦')
      run(deal, 'Q♦')
      expect(deal.s.knownHolders).toEqual({})
      run(deal, 'J♠')
      // A low trump beats the king of the led suit.
      expect(deal.s.lastTrick?.winner).toBe(0)
      expect(deal.s.voids[0][Color.Pik]).toBe(true)
      expect(deal.s.voids[0][Color.Karo]).toBe(false)
      expect(maskIds(deal.s.excluded[0])).toBe('A♠ 10♠ K♠ Q♠ J♠ 9♠')

      // Trick 3: every heart of seat 1 beats 9♥; seat 2 has neither hearts nor
      // trumps (none in the trick), so it is void in both.
      run(deal, '9♥')
      expect(ids(deal.playableCards())).toBe('A♥ 10♥ K♥ Q♥')
      run(deal, '10♥')
      expect(deal.playableCards()).toEqual(deal.hand(2))
      run(deal, '9♣')
      expect(deal.s.voids[2][Color.Kier]).toBe(true)
      expect(deal.s.voids[2][Color.Karo]).toBe(true)
      expect(deal.s.lastTrick?.winner).toBe(1)

      // Trick 4: seat 1 declares ♥ (100), replacing ♦ as trump; seat 0 cannot
      // beat the queen and shows it has no higher heart.
      run(deal, 'Q♥, K♣')
      expect(deal.trump).toBe(Color.Kier)
      expect(ids(deal.playableCards())).toBe('J♥')
      run(deal, 'J♥')
      expect(maskIds(deal.s.excluded[0])).toBe('A♥ 10♥ K♥ A♠ 10♠ K♠ Q♠ J♠ 9♠')

      // Trick 5: seat 0 must beat 9♦ with its only diamond.
      run(deal, '9♦, 10♠')
      expect(ids(deal.playableCards())).toBe('10♦')
      run(deal, '10♦')
      // Trick 6: seat 1 must trump the club lead; the trick is trumped, so seat
      // 2 may play either club.
      run(deal, 'J♣')
      expect(ids(deal.playableCards())).toBe('A♥ K♥')
      run(deal, 'K♥')
      expect(ids(deal.playableCards())).toBe('A♣ 10♣')
      run(deal, `10♣, ${THREE_MARRIAGES_TRICKS[7]}`)

      expect(deal.s.melds).toEqual([
        { player: 2, color: Color.Pik, points: 40, trick: 0 },
        { player: 0, color: Color.Karo, points: 80, trick: 1 },
        { player: 1, color: Color.Kier, points: 100, trick: 4 },
      ])
      expect(deal.phase).toBe('finished')
      expect(deal.isFinished).toBe(true)
      expect(deal.legalActions()).toEqual([])
      expect(deal.playableCards()).toEqual([])
      expect(deal.trickNumber).toBe(8)
      expect(deal.s.tricksWon).toEqual([3, 4, 1])
      expect([0, 1, 2].map(p => deal.cardPointsOf(p))).toEqual([43, 60, 17])
      expect([0, 1, 2].map(p => deal.pointsOf(p))).toEqual([123, 160, 57])
      expect(deal.s.voids.map(row => row.slice(1))).toEqual([
        [true, false, false, true],
        [false, false, true, false],
        [true, true, false, false],
      ])
      // Seat 2 later led the other half of its declared ♠ marriage without a
      // meld, which also excludes the (already played) Q♠.
      expect(deal.s.excluded.map(maskIds)).toEqual([
        'A♥ 10♥ K♥ Q♥ J♥ 9♥ A♠ 10♠ K♠ Q♠ J♠ 9♠',
        'A♦ 10♦ A♣ 10♣ K♣ Q♣ J♣ 9♣',
        'A♥ 10♥ K♥ Q♥ J♥ 9♥ A♦ 10♦ K♦ Q♦ J♦ 9♦ Q♠',
      ])
      expect(deal.result()).toEqual({
        declarer: 2,
        contract: 130,
        made: false,
        cardPoints: [43, 60, 17],
        meldPoints: [80, 100, 40],
        points: [123, 160, 57],
        deltas: [120, 160, -130],
      })
      expect(deal.s.played).toHaveLength(24)
      expect(deal.s.taken.flat()).toHaveLength(24)
      expect(cardPoints(deal.s.taken.flat())).toBe(120)
    })

    it('applies the overtaking rule and records what each card reveals', () => {
      const deal = overtakingDeal()
      const playable = () => ids(deal.playableCards())
      const excluded = () => deal.s.excluded.map(maskIds)
      expect(deal.contract).toBe(150)

      // Trick 0: ♠ marriage. Seat 1 cannot beat the queen and has no higher
      // spade; seat 2 must beat it with either higher spade.
      run(deal, 'Q♠')
      expect(deal.trump).toBe(Color.Pik)
      expect(playable()).toBe('9♠')
      run(deal, '9♠')
      expect(playable()).toBe('A♠ 10♠')
      run(deal, 'A♠')
      expect(excluded()).toEqual(['', 'A♠ 10♠ K♠', ''])

      // Trick 1: seat 1 must beat the queen, the winning card, not just 9♥.
      run(deal, '9♥')
      expect(playable()).toBe('Q♥')
      run(deal, 'Q♥')
      expect(playable()).toBe('A♥ 10♥ K♥')
      run(deal, 'K♥')
      expect(excluded()).toEqual(['', 'A♠ 10♠ K♠', ''])

      // Trick 2: seat 2 has no heart and must trump, with either trump. Seat 0
      // cannot beat 10♠ with K♠ and need not under-trump: any card.
      run(deal, 'J♥')
      expect(playable()).toBe('10♠ J♠')
      run(deal, '10♠')
      expect(playable()).toBe('10♣ K♣ Q♣ 9♣ J♦ K♠')
      run(deal, '9♣')
      // Seat 0 is void in hearts and has no trump above 10♠; it may still hold K♠.
      expect(excluded()).toEqual([
        'A♥ 10♥ K♥ Q♥ J♥ 9♥ A♠',
        'A♠ 10♠ K♠',
        'A♥ 10♥ K♥ Q♥ J♥ 9♥',
      ])
      expect(deal.s.voids.map(row => row.slice(1))).toEqual([
        [true, false, false, false],
        [false, false, false, false],
        [true, false, false, false],
      ])
      expect(deal.s.lastTrick?.winner).toBe(2)

      // Trick 3: seat 0 follows below the queen; seat 1 must beat it.
      run(deal, 'Q♦')
      expect(playable()).toBe('J♦')
      run(deal, 'J♦')
      expect(maskIds(deal.s.excluded[0])).toBe('A♥ 10♥ K♥ Q♥ J♥ 9♥ A♦ 10♦ K♦ A♠')
      expect(playable()).toBe('A♦ K♦')
      run(deal, 'K♦')

      // Trick 4: seat 2 trumps with J♠; seat 0 must over-trump with K♠.
      run(deal, '10♥')
      expect(playable()).toBe('J♠')
      run(deal, 'J♠')
      expect(playable()).toBe('K♠')
      run(deal, 'K♠')
      expect(deal.s.lastTrick?.winner).toBe(0)

      // Trick 5: the ♣ marriage makes clubs trump. Seat 1 has no club, so no
      // trump either: any card. Seat 2 must beat the king.
      expect(deal.isMeld(cards('K♣')[0])).toBe(true)
      run(deal, 'K♣')
      expect(deal.trump).toBe(Color.Trefl)
      expect(playable()).toBe('A♥ A♦ 9♦')
      run(deal, 'A♥')
      expect(deal.s.voids[1][Color.Trefl]).toBe(true)
      expect(playable()).toBe('A♣')
      run(deal, 'A♣')

      // Trick 6: seat 0 trumps the diamond lead; the trick is trumped, so seat 1
      // may keep its ace and reveals nothing.
      run(deal, '10♦')
      expect(playable()).toBe('10♣ Q♣')
      run(deal, 'Q♣')
      expect(playable()).toBe('A♦ 9♦')
      run(deal, '9♦')
      expect(maskIds(deal.s.excluded[1])).toBe('A♣ 10♣ K♣ Q♣ J♣ 9♣ A♠ 10♠ K♠')

      run(deal, '10♣, A♦, J♣')
      // Seat 2 led Q♦ in trick 3 without declaring: it has no K♦.
      expect(excluded()).toEqual([
        'A♥ 10♥ K♥ Q♥ J♥ 9♥ A♦ 10♦ K♦ Q♦ J♦ 9♦ A♠',
        'A♣ 10♣ K♣ Q♣ J♣ 9♣ A♠ 10♠ K♠',
        'A♥ 10♥ K♥ Q♥ J♥ 9♥ K♦ A♣',
      ])
      expect(deal.s.voids.map(row => row.slice(1))).toEqual([
        [true, true, false, false],
        [false, false, true, false],
        [true, false, false, false],
      ])
      expect(deal.s.melds).toEqual([
        { player: 0, color: Color.Pik, points: 40, trick: 0 },
        { player: 0, color: Color.Trefl, points: 60, trick: 5 },
      ])
      expect(deal.s.tricksWon).toEqual([3, 2, 3])
      expect(deal.result()).toEqual({
        declarer: 0,
        contract: 150,
        made: true,
        cardPoints: [52, 16, 52],
        meldPoints: [100, 0, 0],
        points: [152, 16, 52],
        deltas: [150, 20, 50],
      })
    })

    it('plays a slam: the declarer makes a 220 contract with its marriage', () => {
      const deal = slamDeal()
      run(deal, 'pass, pass, take, g9♦>1, gJ♦>2, c220')
      const tricks = [
        'A♥, J♥, 9♣',
        'Q♥, 9♥, J♣',
        'K♥, 9♠, Q♣',
        '10♥, J♠, K♣',
        'A♠, Q♠, 10♣',
        '10♠, K♠, A♣',
        'A♦, 10♦, K♦',
        'Q♦, 9♦, J♦',
      ]
      const trickEvents: DealEvent[] = []
      for (const trick of tricks) {
        for (const id of trick.split(', ')) {
          trickEvents.push(...deal.apply({ type: 'play', card: cards(id)[0] }))
        }
      }
      const points = trickEvents.flatMap(event =>
        event.type === 'trick' ? [event.points] : [],
      )
      expect(points).toEqual([13, 5, 7, 16, 24, 25, 25, 5])
      expect(trickEvents.filter(event => event.type === 'meld')).toEqual([
        { type: 'meld', player: 0, color: Color.Kier, points: 100 },
      ])
      const finished = trickEvents.at(-1)
      expect(finished?.type).toBe('finished')
      const result = deal.result()!
      expect(finished).toEqual({ type: 'finished', result })
      expect(result.made).toBe(true)
      expect(result.points).toEqual([220, 0, 0])
      expect(result.deltas).toEqual([220, 0, 0])
      expect(deal.s.tricksWon).toEqual([8, 0, 0])
    })

    it('lets the trick winner lead and forbids illegal cards', () => {
      const deal = threeMarriagesDeal()
      run(deal, THREE_MARRIAGES_SETUP)
      // Seat 0 must play a club.
      run(deal, 'A♣')
      expect(deal.isLegal({ type: 'play', card: cards('A♠')[0] })).toBe(false)
      expect(() => deal.apply({ type: 'play', card: cards('A♠')[0] })).toThrow('Illegal')
      // Someone else's card.
      expect(deal.isLegal({ type: 'play', card: cards('A♥')[0] })).toBe(false)
      // The trick is not won by the leader.
      run(deal, 'J♣, 9♦, Q♠, A♠, 9♠')
      expect(deal.turn).toBe(0)
      expect(deal.s.leader).toBe(0)
    })

    it('matches cards by id and keeps the shared instances', () => {
      const deal = slamDeal()
      run(deal, 'pass, pass, take')
      const foreign = new Card(Figure.f9, Color.Karo)
      expect(deal.isLegal({ type: 'give', card: foreign, to: 1 })).toBe(true)
      deal.apply({ type: 'give', card: foreign, to: 1 })
      expect(ids(deal.hand(0))).toBe('A♥ 10♥ K♥ Q♥ A♦ Q♦ J♦ A♠ 10♠')
      expect(deal.hand(1)).toContain(cards('9♦')[0])
      expect(deal.s.gifts[0].card).toBe(cards('9♦')[0])
      run(deal, 'gJ♦>2, c100')
      deal.apply({ type: 'play', card: new Card(Figure.A, Color.Kier) })
      expect(deal.s.played[0].card).toBe(cards('A♥')[0])
      expect(deal.hand(0)).not.toContain(cards('A♥')[0])
      expect(deal.hand(0)).toHaveLength(7)
      expectComplete(deal)
    })

    it('rejects malformed actions without throwing in isLegal', () => {
      const deal = slamDeal()
      for (const action of [undefined, null, {}, { type: 'play' }, { type: 'give' }]) {
        expect(deal.isLegal(action as unknown as Action)).toBe(false)
        expect(() => deal.apply(action as unknown as Action)).toThrow('Illegal action')
      }
    })

    it('records voids for failing to trump only when a trump is declared', () => {
      const deal = slamDeal()
      run(deal, 'pass, pass, take, g9♦>1, gJ♦>2, c100')
      // Trick 0 without trump: seat 2 discards a club on hearts; seat 1 follows
      // under the ace, which reveals nothing.
      run(deal, 'A♥, J♥, 9♣')
      expect(deal.s.voids[2].slice(1)).toEqual([true, false, false, false])
      expect(deal.s.excluded.map(maskIds)).toEqual(['', '', 'A♥ 10♥ K♥ Q♥ J♥ 9♥'])
      // ♥ becomes trump; seat 1 follows under the queen (no higher heart). Then
      // spades are led: seat 2 has no ♠ and, with no trump in the trick, no ♥.
      run(deal, 'Q♥, 9♥, J♣, A♠, Q♠, 10♣')
      expect(deal.trump).toBe(Color.Kier)
      expect(deal.s.voids[2].slice(1)).toEqual([true, false, false, true])
      expect(deal.s.voids[1].every(value => !value)).toBe(true)
      expect(deal.s.excluded.map(maskIds)).toEqual([
        '',
        'A♥ 10♥ K♥',
        'A♥ 10♥ K♥ Q♥ J♥ 9♥ A♠ 10♠ K♠ Q♠ J♠ 9♠',
      ])
    })
  })

  describe('scoring', () => {
    function finishedWith(
      taken: string[],
      melds: [number, Color][],
      contract: number,
    ): Deal {
      const deal = slamDeal()
      deal.s.phase = 'finished'
      deal.s.declarer = 0
      deal.s.contract = contract
      deal.s.taken = taken.map(list => cards(list))
      deal.s.melds = melds.map(([player, color]) => ({
        player,
        color,
        points: {
          [Color.Kier]: 100,
          [Color.Karo]: 80,
          [Color.Trefl]: 60,
          [Color.Pik]: 40,
        }[color],
        trick: 1,
      }))
      return deal
    }

    it('writes +contract when made, even when the declarer scored more', () => {
      const deal = finishedWith(
        ['A♥ 10♥ K♥ A♠ 10♠ A♦ 10♦ A♣ 10♣', 'Q♥ J♥', '9♥'],
        [[0, Color.Pik]],
        120,
      )
      const result = deal.result()!
      expect(result.cardPoints).toEqual([88, 5, 0])
      expect(result.points).toEqual([128, 5, 0])
      expect(result.made).toBe(true)
      expect(result.deltas).toEqual([120, 10, 0])
    })

    it('writes −contract when one point short', () => {
      const deal = finishedWith(
        ['A♥ 10♥ A♠ 10♠ A♦ 10♦ A♣ 10♣ Q♥ J♥', 'K♥ K♠ 9♥', ''],
        [[0, Color.Pik]],
        130,
      )
      const result = deal.result()!
      expect(result.points).toEqual([129, 8, 0])
      expect(result.made).toBe(false)
      expect(result.deltas).toEqual([-130, 10, 0])
    })

    it('makes the contract with exactly the contract points', () => {
      const deal = finishedWith(['A♥ 10♥ A♠ 10♠ A♦ 10♦ A♣ 10♣ K♥ J♥', '', ''], [], 90)
      expect(deal.result()!.points[0]).toBe(90)
      expect(deal.result()!.made).toBe(true)
      expect(deal.result()!.deltas[0]).toBe(90)
      const withMeld = finishedWith(
        ['A♥ 10♥ A♠ 10♠ A♦ 10♦ A♣ 10♣ J♥ J♠ J♦', '', ''],
        [[0, Color.Trefl]],
        150,
      )
      expect(withMeld.result()!.points[0]).toBe(150)
      expect(withMeld.result()!.deltas[0]).toBe(150)
      withMeld.s.contract = 160
      expect(withMeld.result()!.deltas[0]).toBe(-160)
    })

    it('rounds defenders (5 up) and counts their own marriages', () => {
      const deal = finishedWith(
        ['A♥', 'K♥ J♥ 9♥', 'A♠ 10♠ Q♥ J♠'],
        [
          [1, Color.Karo],
          [2, Color.Pik],
        ],
        100,
      )
      const result = deal.result()!
      expect(result.cardPoints).toEqual([11, 6, 26])
      expect(result.meldPoints).toEqual([0, 80, 40])
      expect(result.points).toEqual([11, 86, 66])
      expect(result.deltas).toEqual([-100, 90, 70])
      deal.s.taken[1] = cards('K♥ Q♥ J♥ 9♥ 10♥ 9♠ 9♦')
      deal.s.melds = []
      deal.s.taken[2] = cards('J♦ Q♦ 10♦')
      expect(deal.result()!.points.slice(1)).toEqual([19, 15])
      expect(deal.result()!.deltas.slice(1)).toEqual([20, 20])
      deal.s.taken[1] = cards('K♥')
      deal.s.taken[2] = cards('A♣ 9♦')
      expect(deal.result()!.deltas.slice(1)).toEqual([0, 10])
    })
  })

  describe('views', () => {
    it('hides the other hands and the musik during the auction', () => {
      const deal = threeMarriagesDeal()
      const view = deal.viewFor(0)
      expect(view.isView).toBe(true)
      expect(view.s.viewer).toBe(0)
      expect(view.hand(0)).toEqual(deal.hand(0))
      expect(view.hand(1)).toEqual([])
      expect(view.hand(2)).toEqual([])
      expect([0, 1, 2].map(p => view.handCount(p))).toEqual([7, 7, 7])
      expect([0, 1, 2].map(p => view.isHidden(p))).toEqual([false, true, true])
      expect(view.s.musik).toEqual([])
      expect(view.s.musikCount).toBe(3)
      expect(view.isMusikRevealed).toBe(false)
      // Not seat 0's turn: nothing to do in this view.
      expect(view.legalActions()).toEqual([])
      expect(view.bidOptions()).toEqual([])
      expect(() => view.apply({ type: 'pass' })).toThrow('player view')
      // Seat 2 to bid: its own options match the full deal.
      const own = deal.viewFor(2)
      expect(own.legalActions()).toEqual(deal.legalActions())
      expect(() => own.apply({ type: 'pass' })).toThrow('player view')
    })

    it('does not share arrays with the deal', () => {
      const deal = threeMarriagesDeal()
      const view = deal.viewFor(0)
      ;(view.hand(0) as Card[]).pop()
      view.s.bids[0] = 999
      view.s.voids[0][1] = true
      view.s.excluded[0] = 1
      expect(deal.hand(0)).toHaveLength(7)
      expect(deal.s.excluded[0]).toBe(0)
      expect(deal.s.bids[0]).toBeNull()
      expect(deal.s.voids[0][1]).toBe(false)
      const clone = deal.clone()
      clone.apply({ type: 'pass' })
      expect(deal.phase).toBe('bidding')
      expect(deal.turn).toBe(2)
      expect(deal.s.bids[2]).toBeNull()
    })

    it('shows the musik to everyone once revealed, and hides gifts from the other defender', () => {
      const deal = threeMarriagesDeal()
      run(deal, THREE_MARRIAGES_AUCTION)
      for (const seat of [0, 1, 2]) {
        expect(ids(deal.viewFor(seat).s.musik)).toBe('K♣ 10♠ J♠')
        expect(deal.viewFor(seat).isMusikRevealed).toBe(true)
      }
      run(deal, 'take')
      expect(deal.viewFor(0).s.musik).toEqual([])
      expect(deal.viewFor(0).handCount(2)).toBe(10)
      expect(ids(deal.viewFor(0).s.musikCards)).toBe('K♣ 10♠ J♠')
      run(deal, 'g9♥>0, gJ♠>1')
      expect(deal.viewFor(2).s.gifts).toEqual(deal.s.gifts)
      expect(deal.viewFor(0).s.gifts).toEqual([{ to: 0, card: cards('9♥')[0] }])
      expect(deal.viewFor(1).s.gifts).toEqual([{ to: 1, card: cards('J♠')[0] }])
      expect(deal.s.gifts).toHaveLength(2)
    })

    it('keeps hand sizes when a view is viewed again', () => {
      const deal = threeMarriagesDeal()
      run(deal, `${THREE_MARRIAGES_AUCTION}, take, g9♥>0`)
      const view = deal.viewFor(1)
      expect([0, 1, 2].map(p => view.handCount(p))).toEqual([8, 7, 9])
      const again = view.viewFor(1)
      expect(again.s.hiddenCounts).toEqual([8, 7, 9])
      expect(again.s).toEqual(view.s)
    })

    it('keeps public play information in a view', () => {
      const deal = threeMarriagesDeal()
      run(
        deal,
        `${THREE_MARRIAGES_SETUP}, ${THREE_MARRIAGES_TRICKS.slice(0, 2).join(', ')}, K♠`,
      )
      const view = deal.viewFor(0)
      expect(view.s.played).toEqual(deal.s.played)
      expect(view.trick).toEqual(deal.trick)
      expect(view.s.lastTrick).toEqual(deal.s.lastTrick)
      expect(view.s.taken).toEqual(deal.s.taken)
      expect(view.s.melds).toEqual(deal.s.melds)
      expect(view.s.knownHolders).toEqual({ 'Q♦': 0 })
      expect(view.s.voids).toEqual(deal.s.voids)
      expect(view.s.excluded).toEqual(deal.s.excluded)
      expect(maskIds(view.s.excluded[1])).toBe('A♦ 10♦')
      expect(view.trump).toBe(Color.Karo)
      expect(ids(view.playableCards())).toBe('10♦ Q♦')
      expect(view.playableCards()).toEqual(deal.playableCards())
      // Following never declares a marriage.
      expect(view.isMeld(cards('Q♦')[0])).toBe(false)
      expect([0, 1, 2].map(p => view.handCount(p))).toEqual([6, 6, 5])
      // Seat 1 cannot see seat 0's options in its own view.
      expect(deal.viewFor(1).playableCards()).toEqual([])
      expect(deal.viewFor(1).legalActions()).toEqual([])
    })
  })

  describe('actions', () => {
    it('builds stable keys', () => {
      const a = cards('A♥')[0]
      expect(actionKey({ type: 'bid', value: 110 })).toBe('bid:110')
      expect(actionKey({ type: 'contract', value: 120 })).toBe('contract:120')
      expect(actionKey({ type: 'pass' })).toBe('pass')
      expect(actionKey({ type: 'take' })).toBe('take')
      expect(actionKey({ type: 'give', card: a, to: 2 })).toBe('give:A♥:2')
      expect(actionKey({ type: 'play', card: a })).toBe('play:A♥')
      expect(
        sameAction(
          { type: 'play', card: a },
          { type: 'play', card: new Card(Figure.A, Color.Kier) },
        ),
      ).toBe(true)
      expect(
        sameAction({ type: 'bid', value: 110 }, { type: 'contract', value: 110 }),
      ).toBe(false)
    })
  })
})
