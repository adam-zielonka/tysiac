import {
  ALL_CARDS,
  COLORS,
  Color,
  type Card,
  cardById,
  cardIndex,
  cards,
} from '../../engine/Card'
import { Deal, actionKey } from '../../engine/Deal'
import { Deck } from '../../engine/Deck'
import { pick, seededRandom, type Random } from '../../engine/random'
import { sampleDeal, thirdSeat } from '../../engine/sampling'
import { collectCards, dealWith, expectComplete, maskIds, run } from './helpers'

/** Cards `seat` may legitimately know in the real deal. */
function knownTo(deal: Deal, seat: number): Set<Card> {
  const s = deal.s
  const known = new Set<Card>(s.hands[seat])
  s.played.forEach(play => known.add(play.card))
  s.musikCards.forEach(card => known.add(card))
  s.gifts
    .filter(gift => seat === s.declarer || gift.to === seat)
    .forEach(gift => known.add(gift.card))
  Object.keys(s.knownHolders).forEach(id => known.add(cardById(id)!))
  return known
}

function holds(deal: Deal, player: number, card: Card): boolean {
  return (
    deal.s.hands[player].includes(card) ||
    deal.s.played.some(play => play.player === player && play.card === card)
  )
}

/** Cheap assertion for hot loops (thousands of states). */
function check(condition: boolean, message: () => string): void {
  if (!condition) throw new Error(message())
}

const key = (list: readonly { id: string }[]) => list.map(card => card.id).join(' ')

/** Does the public inference say that `player` does not hold `card`? */
function lacks(deal: Deal, player: number, card: Card): boolean {
  return (deal.s.excluded[player] & (1 << cardIndex(card))) !== 0
}

/** Public inference in `deal` (voids and excluded cards) against its hands. */
function checkInference(deal: Deal, where: () => string): void {
  deal.s.hands.forEach((hand, player) => {
    for (const card of hand) {
      check(
        !lacks(deal, player, card) && !deal.s.voids[player][card.color],
        () => `Seat ${player} holds ${card.id} it was shown to lack (${where()})`,
      )
    }
    // Voids are exactly the suits excluded as a whole.
    for (const color of COLORS) {
      const whole = ALL_CARDS.filter(c => c.color === color).every(c =>
        lacks(deal, player, c),
      )
      check(whole === deal.s.voids[player][color], () => `void flags (${where()})`)
    }
  })
}

function checkView(deal: Deal, seat: number): Deal {
  const view = deal.viewFor(seat)
  const known = knownTo(deal, seat)
  for (const card of collectCards(view.s)) {
    check(known.has(card), () => `View of ${seat} leaks ${card.id} in ${deal.phase}`)
  }
  check(
    view.s.hiddenCounts!.join() === deal.s.hands.map(hand => hand.length).join(),
    () => 'hidden counts',
  )
  check(deal.isMusikRevealed || view.s.musik.length === 0, () => 'musik shown early')
  // The inference from the play is public: every view has all of it.
  check(view.s.excluded.join() === deal.s.excluded.join(), () => 'excluded cards')
  check(JSON.stringify(view.s.voids) === JSON.stringify(deal.s.voids), () => 'voids')
  return view
}

function checkSample(deal: Deal, seat: number, random: Random): Deal {
  const view = checkView(deal, seat)
  const sample = sampleDeal(view, random)
  const s = sample.s
  const where = `seat ${seat} in ${deal.phase}`
  check(!sample.isView && s.hiddenCounts === null, () => `view returned for ${where}`)
  expectComplete(sample)
  // Sampling only fills in what the viewer cannot see.
  check(
    JSON.stringify(sample.viewFor(seat).s) === JSON.stringify(view.s),
    () => `sample does not match the view of ${where}`,
  )
  check(
    s.hands.map(hand => hand.length).join() ===
      deal.s.hands.map(hand => hand.length).join() &&
      s.musik.length === deal.s.musik.length,
    () => `hand sizes for ${where}`,
  )
  check(deal.phase !== 'musik' || key(s.musik) === key(deal.s.musik), () => 'musik')
  check(key(s.hands[seat]) === key(deal.s.hands[seat]), () => `own hand for ${where}`)
  // Voids, excluded cards, known marriage partners and gifts are respected.
  checkInference(sample, () => `sample for ${where}`)
  for (const [id, holder] of Object.entries(s.knownHolders)) {
    check(s.hands[holder].includes(cardById(id)!), () => `known holder of ${id}`)
  }
  check(
    s.gifts
      .map(gift => gift.to)
      .sort()
      .join() ===
      deal.s.gifts
        .map(gift => gift.to)
        .sort()
        .join(),
    () => `gift recipients for ${where}`,
  )
  for (const gift of s.gifts) {
    check(holds(sample, gift.to, gift.card), () => `gift ${gift.card.id} for ${where}`)
  }
  // Musik cards that left the declarer are only in the hands of defenders as gifts.
  if (deal.declarer >= 0 && deal.phase !== 'bidding' && deal.phase !== 'musik') {
    for (const card of deal.s.musikCards) {
      const holder = [0, 1, 2].find(p => holds(sample, p, card))!
      check(
        holder === deal.declarer ||
          s.gifts.some(gift => gift.card === card && gift.to === holder),
        () => `musik card ${card.id} with seat ${holder} without a gift (${where})`,
      )
    }
  }
  check(
    sample.pendingRecipients().join() === deal.pendingRecipients().join(),
    () => `pending recipients for ${where}`,
  )
  if (deal.turn === seat) {
    check(
      sample.legalActions().map(actionKey).join() ===
        deal.legalActions().map(actionKey).join(),
      () => `legal actions for ${where}`,
    )
  }
  return sample
}

const nextOf = (seat: number) => (seat + 1) % 3

/**
 * P(card is with the declarer) for every unknown card of a defender view in
 * play, by enumerating all splits that respect the public inference (cards a
 * player was shown to lack, voids included): the other defender's gift is uniform over
 * the nine cards the viewer did not get (so each musik card has prior 1/9,
 * and a musik card the declarer played was not it), and the remaining unknown
 * cards are split uniformly. `null` when the view does not
 * have hidden musik cards.
 */
function exactPosterior(view: Deal): Map<Card, number> | null {
  const s = view.s
  const viewer = s.viewer!
  const declarer = s.declarer
  const other = thirdSeat(viewer, declarer)
  const known = new Set<Card>([...s.hands[viewer], ...s.played.map(play => play.card)])
  Object.keys(s.knownHolders).forEach(id => known.add(cardById(id)!))
  const unknown = ALL_CARDS.filter(card => !known.has(card))
  const hidden = s.musikCards.filter(card => unknown.includes(card))
  const otherShowedMusik = s.played.some(
    play => play.player === other && s.musikCards.includes(play.card),
  )
  if (!hidden.length || otherShowedMusik || Object.keys(s.knownHolders).length)
    return null
  const room = s.hiddenCounts![declarer]
  const rest = unknown.filter(card => !hidden.includes(card))
  const binomial = (a: number, b: number): number =>
    b < 0 || b > a ? 0 : b === 0 ? 1 : (binomial(a - 1, b - 1) * a) / b
  const totals = new Map<Card, number>(unknown.map(card => [card, 0]))
  let sum = 0
  for (let mask = 0; mask < 1 << unknown.length; mask++) {
    const mine = unknown.filter((_, i) => mask & (1 << i))
    if (mine.length !== room) continue
    const theirs = unknown.filter(card => !mine.includes(card))
    if (mine.some(card => lacks(view, declarer, card))) continue
    if (theirs.some(card => lacks(view, other, card))) continue
    const given = hidden.filter(card => theirs.includes(card))
    if (given.length > 1) continue
    // The gift is uniform over the declarer's ten cards minus the viewer's own.
    const pool = s.musikCards.filter(
      card => !s.gifts.some(gift => gift.to === viewer && gift.card === card),
    ).length
    const prior = given.length ? 1 / 9 : (9 - pool) / 9
    const restToDeclarer = mine.filter(card => rest.includes(card)).length
    const weight = prior / binomial(rest.length, restToDeclarer)
    sum += weight
    mine.forEach(card => totals.set(card, totals.get(card)! + weight))
  }
  if (!sum) return null
  return new Map([...totals].map(([card, total]) => [card, total / sum]))
}

/** Mostly short auctions, random legal moves otherwise. */
function randomAction(deal: Deal, random: Random) {
  const actions = deal.legalActions()
  if (deal.phase === 'bidding' && random() < 0.55) return actions[0]
  return pick(random, actions)
}

function playOut(deal: Deal, random: Random): Deal {
  while (!deal.isFinished) deal.apply(randomAction(deal, random))
  return deal
}

describe('sampleDeal', () => {
  it('returns a copy of a full deal', () => {
    const deal = Deal.deal(0, Deck.shuffle(Deck.generate(), seededRandom(1)))
    const sample = sampleDeal(deal, seededRandom(2))
    expect(sample).not.toBe(deal)
    expect(sample.s).toEqual(deal.s)
  })

  it('is deterministic for a seed', () => {
    const deal = Deal.deal(0, Deck.shuffle(Deck.generate(), seededRandom(3)))
    const view = deal.viewFor(1)
    expect(sampleDeal(view, seededRandom(9)).s).toEqual(
      sampleDeal(view, seededRandom(9)).s,
    )
  })

  it('stays consistent with every view in every phase of many random deals', () => {
    const random = seededRandom(20241126)
    let samples = 0
    for (let n = 0; n < 200; n++) {
      const deal = Deal.deal(n % 3, Deck.shuffle(Deck.generate(), random))
      for (;;) {
        checkInference(deal, () => `real deal in ${deal.phase}`)
        for (const seat of [0, 1, 2]) {
          const sample = checkSample(deal, seat, random)
          samples++
          // A sample is a real deal: it can be played to the end.
          if (n % 10 === 0 && seat === deal.turn) playOut(sample, random)
        }
        if (deal.isFinished) break
        deal.apply(randomAction(deal, random))
      }
    }
    expect(samples).toBeGreaterThan(200 * 40)
  }, 60_000)

  it('distributes unseen cards evenly during the auction', () => {
    const deal = Deal.deal(0, Deck.shuffle(Deck.generate(), seededRandom(4)))
    const view = deal.viewFor(0)
    const random = seededRandom(5)
    const unseen = ALL_CARDS.find(card => !deal.hand(0).includes(card))!
    const counts = [0, 0, 0, 0]
    const runs = 3000
    for (let i = 0; i < runs; i++) {
      const sample = sampleDeal(view, random)
      const holder = [0, 1, 2].find(p => sample.hand(p).includes(unseen)) ?? 3
      counts[holder]++
    }
    expect(counts[0]).toBe(0)
    expect(counts[1] / runs).toBeCloseTo(7 / 17, 1)
    expect(counts[2] / runs).toBeCloseTo(7 / 17, 1)
    expect(counts[3] / runs).toBeCloseTo(3 / 17, 1)
  })

  describe('musik heuristic for a defender', () => {
    /**
     * Dealer 2, seat 0 declares at 100 and takes K♣ 10♠ J♠; seat 1 gets 9♦
     * (not from the musik) and seat 2 gets `gift`.
     */
    function afterGifts(gift: string): Deal {
      const deal = dealWith(
        2,
        ['A♥ 10♥ K♥ Q♥ A♠ 10♦ 9♦', 'J♥ 9♥ K♠ Q♠ 9♠ A♦ J♦', 'A♣ 10♣ Q♣ J♣ 9♣ K♦ Q♦'],
        'K♣ 10♠ J♠',
      )
      run(deal, `pass, pass, take, g9♦>1, g${gift}>2`)
      return deal
    }

    function musikWithOther(deal: Deal, viewer: number, runs: number, seed: number) {
      const view = deal.viewFor(viewer)
      const other = thirdSeat(viewer, deal.declarer)
      const random = seededRandom(seed)
      let withOther = 0
      for (let i = 0; i < runs; i++) {
        const sample = sampleDeal(view, random)
        const held = sample.s.musikCards.filter(card => holds(sample, other, card))
        expect(held.length).toBeLessThanOrEqual(1)
        if (held.length) {
          withOther++
          expect(sample.s.gifts).toContainEqual({ to: other, card: held[0] })
        }
        // Everything else from the musik stays with the declarer.
        for (const card of sample.s.musikCards) {
          if (!held.includes(card) && !holds(sample, viewer, card)) {
            expect(holds(sample, deal.declarer, card)).toBe(true)
          }
        }
      }
      return withOther / runs
    }

    it('gives the other defender one of three musik cards with chance 3/9', () => {
      const deal = afterGifts('A♥')
      expect(musikWithOther(deal, 1, 3000, 11)).toBeCloseTo(3 / 9, 1)
    })

    it('uses 2/9 when the viewer itself got a musik card', () => {
      // Seat 2 got J♠ from the musik: K♣ or 10♠ may be with seat 1.
      expect(musikWithOther(afterGifts('J♠'), 2, 3000, 12)).toBeCloseTo(2 / 9, 1)
      // Seat 1 got 9♦: any of the three musik cards may be with seat 2.
      expect(musikWithOther(afterGifts('J♠'), 1, 3000, 13)).toBeCloseTo(3 / 9, 1)
    })

    it('drops a musik card the declarer played from the possible gifts', () => {
      // The declarer leads 10♠ from the musik: the gift to seat 2 was one of the
      // other eight cards, so K♣ and J♠ are with seat 2 with chance 2/8.
      const deal = afterGifts('A♥')
      run(deal, 'c100, 10♠')
      const view = deal.viewFor(1)
      const random = seededRandom(26)
      let withOther = 0
      const runs = 6000
      for (let i = 0; i < runs; i++) {
        const sample = sampleDeal(view, random)
        if (cards('K♣ J♠').some(card => sample.hand(2).includes(card))) withOther++
      }
      expect(Math.abs(withOther / runs - 2 / 8)).toBeLessThan(0.015)
    })

    it('records an unseen gift for the other defender so the deal continues', () => {
      const deal = afterGifts('A♥')
      run(deal, 'c100')
      const sample = sampleDeal(deal.viewFor(1), seededRandom(15))
      expect(sample.s.gifts.map(gift => gift.to).sort()).toEqual([1, 2])
      const toTwo = sample.s.gifts.find(gift => gift.to === 2)!
      expect(sample.hand(2)).toContain(toTwo.card)
      expect(sample.hand(2)).toHaveLength(8)
    })

    it('knows a gift is still missing while the declarer is giving', () => {
      const deal = dealWith(
        2,
        ['A♥ 10♥ K♥ Q♥ A♠ 10♦ 9♦', 'J♥ 9♥ K♠ Q♠ 9♠ A♦ J♦', 'A♣ 10♣ Q♣ J♣ 9♣ K♦ Q♦'],
        'K♣ 10♠ J♠',
      )
      run(deal, 'pass, pass, take, g9♦>2')
      for (const seat of [1, 2]) {
        const random = seededRandom(seat)
        for (let i = 0; i < 200; i++) {
          const sample = sampleDeal(deal.viewFor(seat), random)
          expect(sample.pendingRecipients()).toEqual([1])
          expect(sample.hand(2)).toHaveLength(8)
          expect(sample.hand(0)).toHaveLength(9)
          const musik = cards('K♣ 10♠ J♠')
          if (seat === 2) {
            // Seat 1 has not received anything: the musik is still with seat 0.
            for (const card of musik) expect(sample.hand(0)).toContain(card)
          } else {
            expect(
              musik.filter(card => sample.hand(2).includes(card)).length,
            ).toBeLessThan(2)
          }
          playOut(sample, random)
          expect(sample.s.gifts).toHaveLength(2)
          expect(sample.s.played.filter(play => play.player === 1)).toHaveLength(8)
        }
      }
    })

    it('moves a musik card to the other defender when the declarer is void in it', () => {
      // Seat 0 (declarer) gives K♣ from the musik to seat 2 and keeps no clubs.
      const deal = dealWith(
        2,
        ['A♥ 10♥ K♥ Q♥ A♠ 10♦ 9♦', 'J♥ 9♥ K♠ Q♠ 9♠ A♦ J♦', 'A♣ 10♣ Q♣ J♣ 9♣ K♦ Q♦'],
        'K♣ 10♠ J♠',
      )
      run(deal, 'pass, pass, take, g10♦>1, gK♣>2, c100')
      // ♥ becomes trump in trick 1; seat 2 wins trick 3 with K♦.
      run(deal, 'A♥, J♥, 9♣, Q♥, 9♥, J♣, K♥, 9♠, Q♣, 9♦, J♦, K♦')
      expect(deal.turn).toBe(2)
      // Seat 2 leads a club: seat 0 has none and must trump.
      run(deal, 'A♣, 10♥')
      expect(deal.s.voids[0][Color.Trefl]).toBe(true)
      const view = deal.viewFor(1)
      const random = seededRandom(16)
      for (let i = 0; i < 500; i++) {
        const sample = sampleDeal(view, random)
        // K♣ cannot be with the declarer any more: seat 2 must hold it.
        expect(sample.hand(2)).toContain(cards('K♣')[0])
        expect(sample.s.gifts).toContainEqual({ to: 2, card: cards('K♣')[0] })
        expect(sample.hand(0).some(card => card.color === Color.Trefl)).toBe(false)
      }
    })

    it('keeps the musik with the declarer once the other defender showed its musik gift', () => {
      const deal = afterGifts('J♠')
      run(deal, 'c100, A♥, J♥, 9♣, Q♥, 9♥, J♠')
      // Seat 2 played J♠ (a musik card): its gift is known to seat 1.
      const view = deal.viewFor(1)
      const random = seededRandom(17)
      for (let i = 0; i < 500; i++) {
        const sample = sampleDeal(view, random)
        for (const card of cards('K♣ 10♠')) expect(sample.hand(0)).toContain(card)
        expect(sample.s.gifts).toContainEqual({ to: 2, card: cards('J♠')[0] })
      }
    })

    it('keeps the musik with the declarer when its view is the declarer one', () => {
      const deal = afterGifts('A♥')
      run(deal, 'c100')
      const random = seededRandom(18)
      for (let i = 0; i < 100; i++) {
        const sample = sampleDeal(deal.viewFor(0), random)
        expect(sample.s.gifts).toEqual(deal.s.gifts)
        expect(sample.hand(0)).toEqual(deal.hand(0))
        expect(sample.hand(1)).toContain(cards('9♦')[0])
        expect(sample.hand(2)).toContain(cards('A♥')[0])
      }
    })
  })

  it('finds the only consistent place of a musik card at the end of a deal', () => {
    // Seat 2 declares and gives K♥ (musik) to seat 0, Q♠ to seat 1. Before the last
    // trick seat 1 sees K♥ and 9♠ unknown; seat 0 showed a void in ♠, so it holds
    // K♥ and the declarer 9♠. (An earlier version dropped the voids here.)
    const deal = dealWith(
      1,
      ['J♥ A♣ 10♦ K♦ J♦ 10♣ 9♥', 'A♠ J♣ 9♦ Q♦ A♦ 9♣ Q♥', 'K♣ 10♥ 10♠ J♠ A♥ 9♠ Q♠'],
      'K♥ Q♣ K♠',
    )
    run(deal, 'pass, pass, take, gQ♠>1, gK♥>0, c100')
    run(deal, 'K♠, J♥, A♠, J♣, K♣, A♣, 10♦, A♦, 10♥, Q♦, 10♠, K♦')
    run(deal, 'J♦, 9♦, J♠, 10♣, 9♣, Q♣, 9♥, Q♥, A♥')
    expect(deal.trickNumber).toBe(7)
    expect(deal.s.voids[0][Color.Pik]).toBe(true)
    const view = deal.viewFor(1)
    const random = seededRandom(24)
    for (let i = 0; i < 1000; i++) {
      const sample = sampleDeal(view, random)
      expect(key(sample.hand(0))).toBe('K♥')
      expect(key(sample.hand(2))).toBe('9♠')
      expect(sample.s.gifts).toContainEqual({ to: 0, card: cards('K♥')[0] })
    }
  })

  describe('cards excluded by the overtaking rule', () => {
    /**
     * Dealer 2: seat 0 declares, takes 10♣ 9♦ 10♦, gives 9♦ to seat 1 and 10♦
     * to seat 2, then leads Q♠ (♠ marriage).
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

    it('keeps a higher card of the suit away from a player who followed below the winner', () => {
      const deal = overtakingDeal()
      // Seat 1 follows Q♠ with 9♠: it has no A♠, 10♠ or K♠, so the unseen 10♠
      // is with seat 2 (which beat the queen with A♠).
      run(deal, 'Q♠, 9♠, A♠')
      expect(maskIds(deal.s.excluded[1])).toBe('A♠ 10♠ K♠')
      const view = deal.viewFor(0)
      const random = seededRandom(27)
      let jackWithOne = 0
      const runs = 2000
      for (let i = 0; i < runs; i++) {
        const sample = sampleDeal(view, random)
        expect(sample.hand(2)).toContain(cards('10♠')[0])
        if (sample.hand(1).includes(cards('J♠')[0])) jackWithOne++
      }
      // J♠ is unconstrained: seat 1 has six of the eleven places left for the
      // free cards (it holds the known 9♦; seat 2 the known 10♦ and 10♠).
      expect(Math.abs(jackWithOne / runs - 6 / 11)).toBeLessThan(0.04)
    })

    it('moves a musik card to the other defender when the declarer provably lacks it', () => {
      const deal = overtakingDeal()
      run(deal, 'Q♠, 9♠, A♠, 9♥, Q♥, K♥, J♥, 10♠, 9♣, Q♦, J♦')
      // The declarer followed Q♦ with J♦: it has no A♦, 10♦ or K♦. Seat 1 got 9♦,
      // so the musik 10♦ must have gone to seat 2, and 10♣ stayed with seat 0.
      expect(maskIds(deal.s.excluded[0])).toBe('A♥ 10♥ K♥ Q♥ J♥ 9♥ A♦ 10♦ K♦ A♠')
      expect(deal.s.voids[0][Color.Karo]).toBe(false)
      const view = deal.viewFor(1)
      const random = seededRandom(28)
      const withDeclarer = new Map<string, number>()
      const runs = 3000
      for (let i = 0; i < runs; i++) {
        const sample = sampleDeal(view, random)
        expect(sample.hand(2)).toContain(cards('10♦')[0])
        expect(sample.s.gifts).toContainEqual({ to: 2, card: cards('10♦')[0] })
        for (const card of cards('10♣ K♠')) expect(sample.hand(0)).toContain(card)
        for (const card of sample.hand(0)) {
          withDeclarer.set(card.id, (withDeclarer.get(card.id) ?? 0) + 1)
        }
      }
      // The declarer's two other cards are a uniform pick of the five free ones.
      for (const id of ['A♣', 'K♣', 'Q♣', 'J♣', 'J♠']) {
        expect(Math.abs((withDeclarer.get(id) ?? 0) / runs - 2 / 5)).toBeLessThan(0.04)
      }
    })
  })

  it('matches the exact posterior of the gift model in tight endgames', () => {
    const random = seededRandom(25)
    let checked = 0
    let partial = 0
    for (let n = 0; checked < 8 && n < 600; n++) {
      const deal = Deal.deal(n % 3, Deck.shuffle(Deck.generate(), random))
      while (!deal.isFinished && (deal.phase !== 'play' || deal.trickNumber < 5)) {
        deal.apply(randomAction(deal, random))
      }
      if (deal.isFinished) continue
      const viewer = deal.turn === deal.declarer ? nextOf(deal.declarer) : deal.turn
      const view = deal.viewFor(viewer)
      const exact = exactPosterior(view)
      const hidden = [0, 1, 2].filter(p => p !== viewer)
      if (!exact || hidden.every(p => !deal.s.excluded[p])) continue
      // Count views where some exclusion is not a whole suit (overtaking rule).
      if (
        hidden.some(p =>
          COLORS.some(color => {
            const lacked = ALL_CARDS.filter(
              c => c.color === color && lacks(deal, p, c),
            ).length
            return lacked > 0 && lacked < 6
          }),
        )
      ) {
        partial++
      }
      const runs = 4000
      const withDeclarer = new Map<Card, number>()
      for (let i = 0; i < runs; i++) {
        const sample = sampleDeal(view, random)
        for (const card of sample.hand(view.declarer)) {
          withDeclarer.set(card, (withDeclarer.get(card) ?? 0) + 1)
        }
      }
      for (const [card, probability] of exact) {
        expect(Math.abs((withDeclarer.get(card) ?? 0) / runs - probability)).toBeLessThan(
          0.04,
        )
      }
      checked++
    }
    expect(checked).toBe(8)
    expect(partial).toBeGreaterThanOrEqual(3)
  }, 60_000)

  it('places known marriage partners with their holder', () => {
    const deal = dealWith(
      2,
      ['A♥ 10♥ K♥ Q♥ A♠ 10♦ 9♦', 'J♥ 9♥ K♠ Q♠ 9♠ A♦ J♦', 'A♣ 10♣ Q♣ J♣ 9♣ K♦ Q♦'],
      'K♣ 10♠ J♠',
    )
    run(deal, 'pass, pass, take, g9♦>1, gJ♠>2, c100, A♥, J♥, 9♣, Q♥')
    expect(deal.s.knownHolders).toEqual({ 'K♥': 0 })
    const random = seededRandom(19)
    for (const seat of [1, 2]) {
      for (let i = 0; i < 100; i++) {
        expect(sampleDeal(deal.viewFor(seat), random).hand(0)).toContain(cards('K♥')[0])
      }
    }
  })

  it('handles finished deals', () => {
    const random = seededRandom(21)
    const deal = playOut(Deal.deal(1, Deck.shuffle(Deck.generate(), random)), random)
    for (const seat of [0, 1, 2]) {
      const sample = checkSample(deal, seat, random)
      expect(sample.result()).toEqual(deal.result())
    }
  })

  it('relaxes impossible constraints instead of throwing', () => {
    const deal = Deal.deal(0, Deck.shuffle(Deck.generate(), seededRandom(22)))
    run(deal, 'pass, pass, take')
    const declarer = deal.declarer
    deal.s.phase = 'play'
    const view = deal.viewFor(0)
    // Pretend every hidden player is void in every suit.
    view.s.voids = view.s.voids.map(() => [false, true, true, true, true])
    const sample = sampleDeal(view, seededRandom(23))
    expectComplete(sample)
    expect(sample.hand(declarer).length).toBe(deal.hand(declarer).length)
    // The same with every card excluded instead.
    const excluded = deal.viewFor(0)
    excluded.s.excluded = [0xffffff, 0xffffff, 0xffffff]
    expectComplete(sampleDeal(excluded, seededRandom(23)))
  })
})
