import { describe, expect, it } from 'vitest'
import type { Color } from '../../engine/Card'
import { Deck } from '../../engine/Deck'
import { seededRandom } from '../../engine/random'
import { MELD_SYSTEMS, type MeldSystem } from '../../engine/rules'
import { AlphaBeta, type SearchOptions } from '../../engine/players/alphabeta'
import {
  MELD_VALUES,
  cardAt,
  cardIndex,
  lowestBit,
  marriageTotal,
  maskOf,
} from '../../engine/players/bits'
import { giftOrder, tacticalCard } from '../../engine/players/heuristics'
import { PlayState } from '../../engine/players/PlayState'
import { GERMAN_SUIT, toGerman, toGermanMask } from '../engine/helpers'

const CLASSIC = MELD_VALUES.classic

/** Plain minimax with the same team value, for comparison. */
function minimax(st: PlayState, options: SearchOptions): number {
  if (st.isFinished) {
    const declarer = st.points(st.declarer)
    const defenderMelds = st.meldPoints.reduce(
      (sum, value, player) => (player === st.declarer ? sum : sum + value),
      0,
    )
    const self = options.self ?? -1
    const selfTerm =
      self >= 0 && self !== st.declarer ? (options.selfWeight ?? 0) * st.points(self) : 0
    return (
      declarer +
      (declarer >= st.contract ? options.contractBonus : 0) -
      options.defenderMeldWeight * defenderMelds -
      selfTerm
    )
  }
  const maximizing = st.turn === st.declarer
  let best = maximizing ? -Infinity : Infinity
  for (let bits = st.legal(); bits; bits &= bits - 1) {
    const child = st.clone()
    child.play(lowestBit(bits))
    const value = minimax(child, options)
    best = maximizing ? Math.max(best, value) : Math.min(best, value)
  }
  return best
}

function position(
  seed: number,
  cardsPlayed: number,
  contract: number,
  meldSystem: MeldSystem = 'classic',
): PlayState {
  const random = seededRandom(seed)
  const values = MELD_VALUES[meldSystem]
  const deck = Deck.shuffle(Deck.generate(), random)
  const hands = [0, 1, 2].map(seat => maskOf(deck.slice(seat * 7, seat * 7 + 7)))
  const full = hands[0] | maskOf(deck.slice(21))
  const [a, b] = giftOrder(full, values)
  hands[0] = full & ~(1 << a) & ~(1 << b)
  hands[1] |= 1 << a
  hands[2] |= 1 << b
  const st = new PlayState(hands, 0, contract, 0, values)
  for (let i = 0; i < cardsPlayed; i++) st.play(tacticalCard(st))
  return st
}

/** The same position with German values and the suits relabelled. */
function germanTwin(st: PlayState): PlayState {
  const suit = (index: number) => GERMAN_SUIT[(index + 1) as Color] - 1
  const suits = (bits: number) =>
    [0, 1, 2, 3].reduce((sum, i) => (bits & (1 << i) ? sum | (1 << suit(i)) : sum), 0)
  return new PlayState(
    st.hands.map(toGermanMask),
    st.declarer,
    st.contract,
    st.leader,
    MELD_VALUES.german,
    st.trump < 0 ? -1 : suit(st.trump),
    st.trickNumber,
    st.trick.map(index => cardIndex(toGerman(cardAt(index)))),
    st.cardPoints.slice(),
    st.meldPoints.slice(),
    toGermanMask(st.played),
    st.voids.map(suits),
    st.excluded.map(toGermanMask),
  )
}

describe('alpha-beta', () => {
  const variants: SearchOptions[] = [
    { nodeBudget: 1e7, contractBonus: 0, defenderMeldWeight: 0 },
    { nodeBudget: 1e7, contractBonus: 1000, defenderMeldWeight: 0.5 },
    {
      nodeBudget: 1e7,
      contractBonus: 1000,
      defenderMeldWeight: 0.5,
      self: 1,
      selfWeight: 0.5,
    },
  ]

  it.each(MELD_SYSTEMS)(
    'matches plain minimax on endgames in %s values, at and inside trick boundaries',
    meldSystem => {
      for (let seed = 1; seed <= 24; seed++) {
        const played = 12 + (seed % 4)
        const contract = 60 + (seed % 5) * 20
        const st = position(seed, played, contract, meldSystem)
        for (const options of variants) {
          const result = new AlphaBeta(st, options).run()
          expect(result.exact).toBe(true)
          expect(result.value).toBeCloseTo(minimax(st, options), 9)
          expect(st.legal() & (1 << result.card)).not.toBe(0)
          const child = st.clone()
          child.play(result.card)
          expect(minimax(child, options)).toBeCloseTo(result.value, 9)
        }
      }
    },
  )

  it('gives a position and its relabelled German twin the same exact value', () => {
    let melds = 0
    for (let seed = 1; seed <= 12; seed++) {
      const st = position(seed, 6 + (seed % 4), 80 + (seed % 4) * 20)
      const twin = germanTwin(st)
      expect(twin.meldPoints).toEqual(st.meldPoints)
      // Marriages declared already or still to come.
      if (
        st.meldPoints.some(Boolean) ||
        st.hands.some(hand => marriageTotal(hand, CLASSIC))
      )
        melds++
      for (const options of variants) {
        const a = new AlphaBeta(st, options).run()
        const b = new AlphaBeta(twin, options).run()
        expect(a.exact && b.exact).toBe(true)
        expect(b.value).toBeCloseTo(a.value, 9)
      }
    }
    expect(melds).toBeGreaterThan(2)
  })

  it('evaluates a cut-off position and its German twin alike', () => {
    // With no nodes to spend, the search returns the heuristic evaluation of
    // the position itself, which counts the marriages still in the hands.
    const options: SearchOptions = {
      nodeBudget: 0,
      contractBonus: 1000,
      defenderMeldWeight: 0.5,
    }
    let marriages = 0
    for (let seed = 1; seed <= 16; seed++) {
      const st = position(seed, 3 * (seed % 4), 100 + (seed % 3) * 20)
      if (st.hands.some(hand => marriageTotal(hand, CLASSIC))) marriages++
      const a = new AlphaBeta(st, options).run()
      const b = new AlphaBeta(germanTwin(st), options).run()
      expect([a.depth, b.depth]).toEqual([0, 0])
      expect(b.value).toBeCloseTo(a.value, 9)
    }
    expect(marriages).toBeGreaterThan(4)
  })

  it('solves whole deals exactly once enough nodes are allowed', () => {
    const st = position(3, 6, 120)
    const result = new AlphaBeta(st, {
      nodeBudget: 2e6,
      contractBonus: 0,
      defenderMeldWeight: 0,
    }).run()
    expect(result.exact).toBe(true)
    expect(result.depth).toBe(6)
  })

  it('returns a legal card from the deepest finished depth under a tiny budget', () => {
    const st = position(5, 0, 120)
    const result = new AlphaBeta(st, {
      nodeBudget: 2000,
      contractBonus: 1000,
      defenderMeldWeight: 0.5,
    }).run()
    expect(result.exact).toBe(false)
    expect(result.nodes).toBeLessThanOrEqual(2001)
    expect(st.legal() & (1 << result.card)).not.toBe(0)
  })
})
