import { ALL_CARDS, Figure, type Card, type Color } from '../../engine/Card'
import { Deal, actionKey, type Action } from '../../engine/Deal'
import { Deck } from '../../engine/Deck'
import { Player } from '../../engine/Player'
import { PlayerType } from '../../engine/PlayerType'
import { pick, seededRandom, type Random } from '../../engine/random'
import { runDeal } from '../../engine/simulate'
import {
  ChaosPlayer,
  chaosPlayers,
  expectComplete,
  greedyPlayers,
  maskIds,
} from './helpers'

/*
 * An independent referee: the rules of this version written again from the
 * specification, compared with the engine at every step of random deals.
 */
const VALUE: Record<number, number> = { 1: 100, 2: 80, 3: 60, 4: 40 }
const POINTS: Record<number, number> = { 14: 11, 10: 10, 13: 4, 12: 3, 11: 2, 9: 0 }
const STRENGTH = [Figure.f9, Figure.J, Figure.Q, Figure.K, Figure.f10, Figure.A]

const points = (list: readonly Card[]) =>
  list.reduce((sum, c) => sum + POINTS[c.figure], 0)
const has = (hand: readonly Card[], figure: Figure, color: Color) =>
  hand.some(c => c.figure === figure && c.color === color)
const limitFor = (hand: readonly Card[]) =>
  120 +
  [1, 2, 3, 4]
    .filter(color => has(hand, Figure.K, color) && has(hand, Figure.Q, color))
    .reduce((sum, color) => sum + VALUE[color], 0)
const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, (to - from) / 10 + 1) }, (_, i) => from + i * 10)

type RefPlay = { player: number; card: Card }

/** The play holding the trick: the highest trump, else the highest card of the led suit. */
function holding(trick: readonly RefPlay[], trump: Color | null): RefPlay {
  const led = trick[0].card.color
  const contenders = trick.some(p => p.card.color === trump)
    ? trick.filter(p => p.card.color === trump)
    : trick.filter(p => p.card.color === led)
  return contenders.reduce((best, p) =>
    STRENGTH.indexOf(p.card.figure) > STRENGTH.indexOf(best.card.figure) ? p : best,
  )
}

/**
 * Polish rules stated as "win the trick if you can within what you must play":
 * the led suit when held (else any card), restricted to the cards that would
 * take the trick whenever there is one. That covers beating the winner in the
 * led suit, any led card once the trick is trumped, trumping with a winning
 * trump when void, and a free choice when no card can win.
 */
function refereeLegal(
  hand: readonly Card[],
  trick: readonly RefPlay[],
  trump: Color | null,
): Card[] {
  if (!trick.length) return [...hand]
  const led = trick[0].card.color
  const follow = hand.filter(c => c.color === led)
  const pool = follow.length ? follow : [...hand]
  const takes = pool.filter(
    c => holding([...trick, { player: -1, card: c }], trump).player === -1,
  )
  return takes.length ? takes : pool
}

class Referee {
  turn: number
  passed = [false, false, false]
  highest = 100
  declarer = -1
  phase = 'bidding'
  gifts: number[] = []
  trump: Color | null = null
  trick: RefPlay[] = []
  trickNumber = 0
  taken = [0, 0, 0]
  melds = [0, 0, 0]
  contract = 0
  /** Card ids each player provably lacks: cards that would have made one of its plays illegal. */
  excluded: Set<string>[] = [new Set(), new Set(), new Set()]
  /** How often the overtaking rule narrowed or widened a choice (coverage). */
  stats = { mustBeat: 0, trumpedFollow: 0, mustOvertrump: 0, freeWithTrumps: 0 }

  constructor(readonly dealer: number) {
    this.turn = (dealer + 2) % 3
  }

  expected(deal: Deal): string[] {
    const hand = deal.hand(this.turn)
    switch (this.phase) {
      case 'bidding':
        return ['pass', ...range(this.highest + 10, limitFor(hand)).map(v => `bid:${v}`)]
      case 'musik':
        return ['take']
      case 'giving': {
        const to = [(this.declarer + 1) % 3, (this.declarer + 2) % 3].filter(
          seat => !this.gifts.includes(seat),
        )
        return hand.flatMap(c => to.map(seat => `give:${c.id}:${seat}`))
      }
      case 'contract':
        return range(this.highest, Math.max(this.highest, limitFor(hand))).map(
          v => `contract:${v}`,
        )
      case 'play': {
        const legal = refereeLegal(hand, this.trick, this.trump)
        this.count(hand, legal)
        return legal.map(c => `play:${c.id}`)
      }
    }
    return []
  }

  private count(hand: readonly Card[], legal: readonly Card[]): void {
    if (!this.trick.length) return
    const led = this.trick[0].card.color
    const top = holding(this.trick, this.trump).card
    const follow = hand.filter(c => c.color === led)
    const trumps = hand.filter(c => c.color === this.trump)
    if (follow.length) {
      if (legal.length < follow.length) this.stats.mustBeat++
      else if (top.color !== led && follow.length > 1) this.stats.trumpedFollow++
    } else if (trumps.length && top.color === this.trump) {
      // Void with trumps after someone trumped: over-trump if possible, else free.
      if (legal.every(c => c.color === this.trump)) this.stats.mustOvertrump++
      else this.stats.freeWithTrumps++
    }
  }

  /** Mirrors the action on the referee state (called before the engine applies it). */
  apply(deal: Deal, action: Action): void {
    const player = this.turn
    const next = (from: number) => {
      let seat = (from + 1) % 3
      while (this.passed[seat]) seat = (seat + 1) % 3
      return seat
    }
    switch (action.type) {
      case 'bid':
        this.highest = action.value
        this.turn = next(player)
        return
      case 'pass':
        this.passed[player] = true
        if (this.passed.filter(Boolean).length === 2) {
          this.declarer = this.passed.indexOf(false)
          this.turn = this.declarer
          this.phase = 'musik'
        } else {
          this.turn = next(player)
        }
        return
      case 'take':
        this.phase = 'giving'
        return
      case 'give':
        this.gifts.push(action.to)
        if (this.gifts.length === 2) this.phase = 'contract'
        return
      case 'contract':
        this.contract = action.value
        this.phase = 'play'
        return
      case 'play': {
        const hand = deal.hand(player)
        const card = action.card
        if (this.isMeld(hand, card)) {
          this.melds[player] += VALUE[card.color]
          this.trump = card.color
        }
        // Any card that, added to the hand, would forbid this play is not held.
        if (this.trick.length) {
          for (const other of ALL_CARDS) {
            if (hand.some(c => c.id === other.id)) continue
            const legal = refereeLegal([...hand, other], this.trick, this.trump)
            if (!legal.some(c => c.id === card.id)) this.excluded[player].add(other.id)
          }
        }
        this.trick.push({ player, card })
        if (this.trick.length < 3) {
          this.turn = (player + 1) % 3
          return
        }
        const winner = holding(this.trick, this.trump).player
        this.taken[winner] += points(this.trick.map(p => p.card))
        this.trick = []
        this.trickNumber++
        this.turn = winner
        if (this.trickNumber === 8) this.phase = 'finished'
      }
    }
  }

  /** Leading K or Q with the partner in hand declares, in any trick. */
  isMeld(hand: readonly Card[], card: Card): boolean {
    return (
      !this.trick.length &&
      (card.figure === Figure.K || card.figure === Figure.Q) &&
      has(hand, card.figure === Figure.K ? Figure.Q : Figure.K, card.color)
    )
  }

  /** The excluded cards in deck order, and the suits they cover completely. */
  inference(player: number): { excluded: string; voids: boolean[] } {
    const set = this.excluded[player]
    return {
      excluded: ALL_CARDS.filter(c => set.has(c.id))
        .map(c => c.id)
        .join(' '),
      voids: [1, 2, 3, 4].map(color =>
        ALL_CARDS.filter(c => c.color === color).every(c => set.has(c.id)),
      ),
    }
  }

  deltas(): number[] {
    return [0, 1, 2].map(p => {
      const total = this.taken[p] + this.melds[p]
      if (p !== this.declarer) return Math.floor((total + 5) / 10) * 10
      return total >= this.contract ? this.contract : -this.contract
    })
  }
}

function refereedDeal(
  dealer: number,
  random: Random,
  pickAction: (deal: Deal) => Action,
  referee = new Referee(dealer),
) {
  const deal = Deal.deal(dealer, Deck.shuffle(Deck.generate(), random))
  while (!deal.isFinished) {
    if (deal.turn !== referee.turn || deal.phase !== referee.phase) {
      throw new Error(`Turn or phase differs: ${deal.turn} ${deal.phase}`)
    }
    const legal = deal.legalActions().map(actionKey)
    const expected = referee.expected(deal)
    if (legal.join() !== expected.join()) {
      throw new Error(`Legal actions differ: ${legal.join()} vs ${expected.join()}`)
    }
    if (deal.phase === 'play') {
      const hand = deal.hand(deal.turn)
      for (const card of deal.playableCards()) {
        if (deal.isMeld(card) !== referee.isMeld(hand, card)) {
          throw new Error(`Marriage of ${card.id} differs in trick ${deal.trickNumber}`)
        }
      }
    }
    const action = pickAction(deal)
    const player = deal.turn
    referee.apply(deal, action)
    deal.apply(action)
    if (deal.trump !== referee.trump) throw new Error('Trump differs')
    // Only the player who followed can have revealed something.
    if (action.type === 'play') {
      // Sound: a player never holds a card it was shown to lack.
      if (deal.hand(player).some(c => referee.excluded[player].has(c.id))) {
        throw new Error(`Seat ${player} holds a card it was shown to lack`)
      }
      const inferred = referee.inference(player)
      const excluded = maskIds(deal.s.excluded[player])
      const voids = deal.s.voids[player].slice(1)
      if (excluded !== inferred.excluded || voids.join() !== inferred.voids.join()) {
        throw new Error(
          `Inference for seat ${player} differs: ${excluded} (${voids}) vs ` +
            `${inferred.excluded} (${inferred.voids})`,
        )
      }
    }
  }
  for (const player of [0, 1, 2]) {
    expect(maskIds(deal.s.excluded[player])).toBe(referee.inference(player).excluded)
  }
  expect(referee.phase).toBe('finished')
  const result = deal.result()!
  expect(result.declarer).toBe(referee.declarer)
  expect(result.contract).toBe(referee.contract)
  expect(result.cardPoints).toEqual(referee.taken)
  expect(result.meldPoints).toEqual(referee.melds)
  expect(result.deltas).toEqual(referee.deltas())
  expect(result.cardPoints.reduce((a, b) => a + b, 0)).toBe(120)
  expect(deal.s.played).toHaveLength(24)
  expectComplete(deal)
  return deal
}

class SpyPlayer extends Player {
  readonly type = PlayerType.Random
  views: Deal[] = []

  constructor(
    id: number,
    random: Random,
    readonly omniscient: boolean,
  ) {
    super(id, random)
  }

  choose(deal: Deal, actions: Action[]): Action {
    this.views.push(deal)
    expect(deal.legalActions().map(actionKey)).toEqual(actions.map(actionKey))
    return pick(this.random, actions)
  }
}

describe('simulate', () => {
  it('agrees with an independent referee over thousands of random deals', () => {
    const random = seededRandom(1000)
    const declarers = [0, 0, 0]
    const stats = { mustBeat: 0, trumpedFollow: 0, mustOvertrump: 0, freeWithTrumps: 0 }
    let melds = 0
    let firstTrickMelds = 0
    let partial = 0
    let made = 0
    let maxContract = 0
    for (let n = 0; n < 2400; n++) {
      const bidHappy = n % 2 === 0
      // Half of the deals declare every marriage they can, so trumps are common.
      const melder = n % 4 < 2
      const referee = new Referee(n % 3)
      const deal = refereedDeal(
        n % 3,
        random,
        current => {
          const actions = current.legalActions()
          if (current.phase === 'bidding' && random() < (bidHappy ? 0.3 : 0.7)) {
            return actions[0]
          }
          const meld = actions.find(a => a.type === 'play' && current.isMeld(a.card))
          if (melder && meld && random() < 0.8) return meld
          return pick(random, actions)
        },
        referee,
      )
      const result = deal.result()!
      declarers[result.declarer]++
      melds += deal.s.melds.length
      firstTrickMelds += deal.s.melds.filter(meld => meld.trick === 0).length
      // Exclusions that are not whole suits come from the overtaking rule.
      for (const set of referee.excluded) {
        for (const color of [1, 2, 3, 4]) {
          const count = ALL_CARDS.filter(c => c.color === color && set.has(c.id)).length
          if (count > 0 && count < 6) partial++
        }
      }
      ;(Object.keys(stats) as (keyof typeof stats)[]).forEach(
        key => (stats[key] += referee.stats[key]),
      )
      if (result.made) made++
      maxContract = Math.max(maxContract, result.contract)
    }
    // The random series covers the interesting cases.
    expect(Math.min(...declarers)).toBeGreaterThan(500)
    expect(melds).toBeGreaterThan(500)
    expect(firstTrickMelds).toBeGreaterThan(100)
    expect(partial).toBeGreaterThan(1000)
    expect(stats.mustBeat).toBeGreaterThan(2000)
    expect(stats.trumpedFollow).toBeGreaterThan(100)
    expect(stats.mustOvertrump).toBeGreaterThan(10)
    expect(stats.freeWithTrumps).toBeGreaterThan(10)
    expect(made).toBeGreaterThan(50)
    expect(maxContract).toBeGreaterThan(200)
  }, 60_000)

  it('plays deals to the end with views for fair players and full deals for omniscient ones', () => {
    const random = seededRandom(7)
    const players = [
      new SpyPlayer(0, random, false),
      new SpyPlayer(1, random, true),
      new SpyPlayer(2, random, false),
    ]
    for (let n = 0; n < 30; n++) {
      const deal = Deal.deal(n % 3, Deck.shuffle(Deck.generate(), random))
      const finished = runDeal(deal, players)
      expect(finished).toBe(deal)
      expect(deal.isFinished).toBe(true)
    }
    for (const seat of [0, 2]) {
      expect(players[seat].views.every(view => view.s.viewer === seat)).toBe(true)
    }
    expect(players[1].views.every(view => !view.isView)).toBe(true)
    expect(players[1].views.every(view => view.s.hands.flat().length > 0)).toBe(true)
  })

  it('throws on an illegal choice and on a deal that does not finish', () => {
    class Cheater extends ChaosPlayer {
      choose(): Action {
        return { type: 'bid', value: 5 }
      }
    }
    const random = seededRandom(8)
    const deal = Deal.deal(0, Deck.shuffle(Deck.generate(), random))
    expect(() =>
      runDeal(
        deal,
        [0, 1, 2].map(seat => new Cheater(seat, random)),
      ),
    ).toThrow('Illegal action bid:5')
    const other = Deal.deal(0, Deck.shuffle(Deck.generate(), random))
    expect(() => runDeal(other, chaosPlayers(random), 3)).toThrow('Deal did not finish')
  })

  it('plays complete matches to 1000 with rotating dealers', () => {
    const random = seededRandom(2026)
    let totalDeals = 0
    for (let match = 0; match < 12; match++) {
      const players = greedyPlayers(random)
      const scores = [0, 0, 0]
      let dealer = match % 3
      let deals = 0
      while (scores.every(score => score < 1000)) {
        const deal = runDeal(
          Deal.deal(dealer, Deck.shuffle(Deck.generate(), random)),
          players,
        )
        const result = deal.result()!
        expect(result.cardPoints.reduce((a, b) => a + b, 0)).toBe(120)
        result.deltas.forEach((delta, seat) => {
          expect(Math.abs(delta) % 10).toBe(0)
          // The 800 lock of the match: defenders at 800+ score nothing.
          if (seat === result.declarer || scores[seat] < 800) scores[seat] += delta
        })
        dealer = (dealer + 1) % 3
        deals++
        if (deals > 1000) throw new Error('Match did not end')
      }
      totalDeals += deals
      const best = Math.max(...scores)
      expect(best).toBeGreaterThanOrEqual(1000)
    }
    expect(totalDeals).toBeGreaterThan(100)
  }, 60_000)
})
