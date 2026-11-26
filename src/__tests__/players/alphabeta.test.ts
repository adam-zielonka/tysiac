import { describe, expect, it } from 'vitest'
import { Deck } from '../../engine/Deck'
import { seededRandom } from '../../engine/random'
import { AlphaBeta, type SearchOptions } from '../../engine/players/alphabeta'
import { lowestBit, maskOf } from '../../engine/players/bits'
import { giftOrder, tacticalCard } from '../../engine/players/heuristics'
import { PlayState } from '../../engine/players/PlayState'

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

function position(seed: number, cardsPlayed: number, contract: number): PlayState {
  const random = seededRandom(seed)
  const deck = Deck.shuffle(Deck.generate(), random)
  const hands = [0, 1, 2].map(seat => maskOf(deck.slice(seat * 7, seat * 7 + 7)))
  const full = hands[0] | maskOf(deck.slice(21))
  const [a, b] = giftOrder(full)
  hands[0] = full & ~(1 << a) & ~(1 << b)
  hands[1] |= 1 << a
  hands[2] |= 1 << b
  const st = new PlayState(hands, 0, contract, 0)
  for (let i = 0; i < cardsPlayed; i++) st.play(tacticalCard(st))
  return st
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

  it('matches plain minimax on endgames, at and inside trick boundaries', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const played = 12 + (seed % 4)
      const contract = 60 + (seed % 5) * 20
      const st = position(seed, played, contract)
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
