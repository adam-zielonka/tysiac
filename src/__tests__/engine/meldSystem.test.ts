import { describe, expect, it } from 'vitest'
import { COLORS, Card, Color, cards } from '../../engine/Card'
import { Deal, actionKey, type Action } from '../../engine/Deal'
import { Deck } from '../../engine/Deck'
import { pick, seededRandom, type Random } from '../../engine/random'
import { MARRIAGE_VALUES, type MeldSystem } from '../../engine/rules'
import { sampleDeal } from '../../engine/sampling'
import {
  GERMAN_SUIT,
  dealWith,
  expectComplete,
  run,
  toGerman,
  toGermanMask,
} from './helpers'

/** Dealer 2: seat 0 opens at 100 with the ♣ and ♦ marriages; musik A♦ J♦ 9♦. */
function twoMarriagesDeal(meldSystem: MeldSystem): Deal {
  return dealWith(
    2,
    ['K♣ Q♣ K♦ Q♦ A♣ 10♣ A♠', 'J♥ 9♥ K♠ J♠ 9♠ 10♦ 9♣', 'A♥ 10♥ K♥ Q♥ J♣ Q♠ 10♠'],
    'A♦ J♦ 9♦',
    { meldSystem },
  )
}

const TWO_MARRIAGES_SETUP = 'pass, pass, take, gJ♦>1, g9♦>2, c100'

/** Dealer 0: seat 1 opens at 100, seat 2 bids first with only the ♣ marriage. */
const CLUBS_HANDS: [string, string, string] = [
  'A♥ 10♥ A♦ 10♦ A♠ 10♠ J♥',
  '9♥ J♦ 9♦ J♠ 9♠ K♠ Q♥',
  'K♣ Q♣ A♣ 10♣ J♣ 9♣ K♦',
]
const CLUBS_MUSIK = 'Q♦ K♥ Q♠'

describe('meld systems in a deal', () => {
  it('deals classic values by default and rejects unknown systems', () => {
    const deal = Deal.deal(0, Deck.generate())
    expect(deal.meldSystem).toBe('classic')
    expect(deal.s.meldSystem).toBe('classic')
    expect(deal.meldValues).toBe(MARRIAGE_VALUES.classic)
    expect(COLORS.map(color => deal.meldValue(color))).toEqual([100, 80, 60, 40])
    expect(Deal.deal(0, Deck.generate(), {}).meldSystem).toBe('classic')

    const german = Deal.deal(0, Deck.generate(), { meldSystem: 'german' })
    expect(german.meldSystem).toBe('german')
    expect(german.meldValues).toBe(MARRIAGE_VALUES.german)
    // ♥ ♦ ♣ ♠: serce 60, dzwonek 40, żołądź 100, wino 80.
    expect(COLORS.map(color => german.meldValue(color))).toEqual([60, 40, 100, 80])

    for (const meldSystem of ['french', '', 'German', 'pik']) {
      expect(() =>
        Deal.deal(0, Deck.generate(), { meldSystem: meldSystem as MeldSystem }),
      ).toThrow('Unknown meld system')
    }
  })

  it('scores German marriages: ♣ +100 and ♦ +40, each the new trump', () => {
    const deal = twoMarriagesDeal('german')
    run(deal, TWO_MARRIAGES_SETUP)
    const [kingClubs, queenDiamonds] = cards('K♣ Q♦')
    expect(deal.isMeld(kingClubs)).toBe(true)
    expect(deal.apply({ type: 'play', card: kingClubs })).toContainEqual({
      type: 'meld',
      player: 0,
      color: Color.Trefl,
      points: 100,
    })
    expect(deal.trump).toBe(Color.Trefl)
    run(deal, '9♣, J♣')
    expect(deal.turn).toBe(0)
    expect(deal.apply({ type: 'play', card: queenDiamonds })).toContainEqual({
      type: 'meld',
      player: 0,
      color: Color.Karo,
      points: 40,
    })
    expect(deal.trump).toBe(Color.Karo)
    expect(deal.s.melds.map(meld => [meld.color, meld.points, meld.trick])).toEqual([
      [Color.Trefl, 100, 0],
      [Color.Karo, 40, 1],
    ])
    expect(deal.meldPointsOf(0)).toBe(140)
    while (!deal.isFinished) deal.apply(deal.legalActions()[0])
    const result = deal.result()!
    expect(result.meldPoints[0]).toBe(140)
    expect(result.points[0]).toBe(result.cardPoints[0] + 140)
    for (const meld of deal.s.melds) {
      expect(meld.points).toBe(MARRIAGE_VALUES.german[meld.color])
    }

    // The same cards in classic values: ♣ 60 and ♦ 80.
    const classic = twoMarriagesDeal('classic')
    run(classic, `${TWO_MARRIAGES_SETUP}, K♣, 9♣, J♣, Q♦`)
    expect(classic.s.melds.map(meld => meld.points)).toEqual([60, 80])
  })

  it('limits bids and contracts by the German values', () => {
    const german = dealWith(0, CLUBS_HANDS, CLUBS_MUSIK, { meldSystem: 'german' })
    const classic = dealWith(0, CLUBS_HANDS, CLUBS_MUSIK)
    expect(german.turn).toBe(2)
    expect(german.maxBid(2)).toBe(220)
    expect(classic.maxBid(2)).toBe(180)
    expect(german.bidOptions().at(-1)).toBe(220)
    expect(german.isLegal({ type: 'bid', value: 220 })).toBe(true)
    expect(classic.isLegal({ type: 'bid', value: 220 })).toBe(false)
    expect(german.isLegal({ type: 'bid', value: 230 })).toBe(false)

    run(german, '220, pass, pass, take')
    expect(german.declarer).toBe(2)
    // K♥ from the musik completes nothing, Q♦ completes dzwonek (♦ 40).
    expect(german.maxBid(2)).toBe(260)
    const keepBoth = german.clone()
    run(keepBoth, 'gK♥>0, gQ♠>1')
    expect(keepBoth.contractOptions()).toEqual([220, 230, 240, 250, 260])
    run(german, 'gK♦>0, gQ♠>1')
    expect(german.contractOptions()).toEqual([220])
  })

  it('keeps the meld system in clones, views and samples', () => {
    const deal = dealWith(0, CLUBS_HANDS, CLUBS_MUSIK, { meldSystem: 'german' })
    const random = seededRandom(5)
    for (const script of ['', '220, pass', 'pass, take, gK♦>0, gQ♠>1, c220, K♣']) {
      run(deal, script)
      expect(deal.clone().meldSystem).toBe('german')
      for (const seat of [0, 1, 2]) {
        const view = deal.viewFor(seat)
        expect(view.meldSystem).toBe('german')
        expect(view.viewFor(seat).meldSystem).toBe('german')
        const sample = sampleDeal(view, random)
        expectComplete(sample)
        expect(sample.meldSystem).toBe('german')
        expect(sample.meldValues).toBe(MARRIAGE_VALUES.german)
      }
    }
    expect(deal.s.melds).toEqual([
      { player: 2, color: Color.Trefl, points: 100, trick: 0 },
    ])
    // The engine's state is plain data: the system survives a JSON copy.
    expect(JSON.parse(JSON.stringify(deal.viewFor(1).s)).meldSystem).toBe('german')
  })
})

/** JSON with cards as ids. */
function json(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) =>
    item instanceof Card ? item.id : item,
  )
}

/** JSON of the German twin: relabelled cards, meld colours and trump. */
function twinJson(value: unknown): string {
  return JSON.stringify(value, (key, item: unknown) => {
    if (item instanceof Card) return toGerman(item).id
    if ((key === 'color' || key === 'trump') && typeof item === 'number') {
      return GERMAN_SUIT[item as Color]
    }
    return item
  })
}

function toGermanAction(action: Action): Action {
  return action.type === 'give' || action.type === 'play'
    ? { ...action, card: toGerman(action.card) }
    : action
}

function sortedIds(list: readonly Card[]): string {
  return list
    .map(card => card.id)
    .sort()
    .join(' ')
}

/** Everything public and private about a classic deal and its German twin. */
function expectTwins(classic: Deal, german: Deal): void {
  const a = classic.s
  const b = german.s
  expect([
    b.phase,
    b.turn,
    b.declarer,
    b.contract,
    b.highestBid,
    b.highestBidder,
  ]).toEqual([a.phase, a.turn, a.declarer, a.contract, a.highestBid, a.highestBidder])
  expect([b.bids, b.maxBids, b.passed, b.trickNumber, b.leader]).toEqual([
    a.bids,
    a.maxBids,
    a.passed,
    a.trickNumber,
    a.leader,
  ])
  expect(b.trump).toBe(a.trump === null ? null : GERMAN_SUIT[a.trump])
  for (const seat of [0, 1, 2]) {
    expect(sortedIds(b.hands[seat])).toBe(sortedIds(a.hands[seat].map(toGerman)))
    expect(german.maxBid(seat)).toBe(classic.maxBid(seat))
    expect(german.pointsOf(seat)).toBe(classic.pointsOf(seat))
    for (const color of COLORS) {
      expect(b.voids[seat][GERMAN_SUIT[color]]).toBe(a.voids[seat][color])
    }
  }
  expect(sortedIds(b.musik)).toBe(sortedIds(a.musik.map(toGerman)))
  expect(json(b.musikCards)).toBe(twinJson(a.musikCards))
  expect(b.excluded).toEqual(a.excluded.map(toGermanMask))
  expect(json(b.melds)).toBe(twinJson(a.melds))
  expect(json(b.played)).toBe(twinJson(a.played))
  expect(json(b.gifts)).toBe(twinJson(a.gifts))
  expect(Object.entries(b.knownHolders).sort(([x], [y]) => x.localeCompare(y))).toEqual(
    Object.entries(a.knownHolders)
      .map(([id, holder]) => [toGerman(cards(id)[0]).id, holder])
      .sort(([x], [y]) => String(x).localeCompare(String(y))),
  )
}

/** High auctions and contracts half of the time, marriages often declared. */
function chooseAction(deal: Deal, actions: Action[], random: Random): Action {
  const phase = deal.phase
  if ((phase === 'bidding' || phase === 'contract') && random() < 0.5) {
    return actions.at(-1)!
  }
  if (phase === 'bidding' && random() < 0.5) return actions[0]
  if (phase === 'play' && random() < 0.5) {
    const meld = actions.find(
      action => action.type === 'play' && deal.isMeld(action.card),
    )
    if (meld) return meld
  }
  return pick(random, actions)
}

describe('the German system', () => {
  it('plays exactly like the classic deal with the suits relabelled', () => {
    const random = seededRandom(2026)
    const melds = new Map<number, number>()
    let highBids = 0
    let highContracts = 0
    let steps = 0
    for (let n = 0; n < 300; n++) {
      const deck = Deck.shuffle(Deck.generate(), random)
      const classic = Deal.deal(n % 3, deck)
      const german = Deal.deal(n % 3, deck.map(toGerman), { meldSystem: 'german' })
      for (;;) {
        expectTwins(classic, german)
        if (classic.isFinished) break
        const actions = classic.legalActions()
        const twins = german.legalActions()
        expect(twins.length).toBe(actions.length)
        expect(twins.map(actionKey).sort()).toEqual(
          actions.map(toGermanAction).map(actionKey).sort(),
        )
        const action = chooseAction(classic, actions, random)
        const events = classic.apply(action)
        expect(json(german.apply(toGermanAction(action)))).toBe(twinJson(events))
        steps++
      }
      const result = classic.result()!
      expect(german.result()).toEqual(result)
      for (const meld of classic.s.melds) {
        melds.set(meld.points, (melds.get(meld.points) ?? 0) + 1)
      }
      if (Math.max(...classic.s.maxBids) > 120) highBids++
      if (classic.contract > Math.max(classic.s.highestBid, 120)) highContracts++
    }
    // Every marriage value, bids and contracts that need marriages.
    expect([...melds.keys()].sort((x, y) => y - x)).toEqual([100, 80, 60, 40])
    for (const count of melds.values()) expect(count).toBeGreaterThan(20)
    expect(highBids).toBeGreaterThan(30)
    expect(highContracts).toBeGreaterThan(20)
    expect(steps).toBeGreaterThan(300 * 30)
  }, 60_000)
})
