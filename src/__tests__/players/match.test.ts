import { describe, expect, it } from 'vitest'
import type { Deal } from '../../engine/Deal'
import { PlayerType } from '../../engine/PlayerType'
import {
  MATCH_WIN_BONUS,
  MOOD_POINTS,
  SAFE_LEAD,
  auctionMood,
  matchDeltas,
  onlyDefeatCounts,
  safeContractLimit,
} from '../../engine/players/match'
import { MELD_VALUES, maskOf } from '../../engine/players/bits'
import { auctionEstimate } from '../../engine/players/heuristics'
import { bestContract, contractValue } from '../../engine/players/montecarlo'
import { TACTICAL_MARGIN } from '../../engine/players/TacticalPlayer'
import { bot, dealOf, decide } from './helpers'

describe('match awareness', () => {
  it('is neutral at the start of a match', () => {
    expect(auctionMood([0, 0, 0], 1, 100, 0)).toBe(0)
    expect(matchDeltas([120, 30, -10], 0, [0, 0, 0])).toEqual([120, 30, -10])
    expect(safeContractLimit([0, 0, 0], 0, 140)).toBe(140)
    expect(onlyDefeatCounts([0, 0, 0], 1, 0, 120)).toBe(false)
  })

  it('bids more boldly when defending scores nothing or 1000 is in reach', () => {
    // Locked at 800+: only declaring can score.
    expect(auctionMood([0, 800, 300], 1, 100, 0)).toBe(1)
    expect(auctionMood([0, 790, 700], 1, 100, 0)).toBe(0)
    // The leading bidder could reach 1000 with a contract of 120.
    expect(auctionMood([880, 300, 300], 1, 100, 0)).toBe(1)
    expect(auctionMood([870, 300, 300], 1, 100, 0)).toBe(0)
    // ... or with the bid itself.
    expect(auctionMood([300, 300, 850], 1, 150, 2)).toBe(1)
    // Its own leading bid is no threat.
    expect(auctionMood([600, 750, 600], 1, 250, 1)).toBe(0)
  })

  it('takes less risk well ahead of both rivals', () => {
    expect(auctionMood([100, 300 + SAFE_LEAD, 300], 1, 100, 0)).toBe(-1)
    expect(auctionMood([100, 300 + SAFE_LEAD, 310], 1, 100, 0)).toBe(0)
  })

  it('writes what the match writes and rewards winning it', () => {
    // Seat 1 is locked at 820 and writes nothing as a defender.
    expect(matchDeltas([110, 40, 20], 0, [300, 820, 0])).toEqual([110, 0, 20])
    // The declarer reaches 1000 by making the contract.
    expect(matchDeltas([120, 40, 0], 0, [880, 0, 0])).toEqual([
      120 + MATCH_WIN_BONUS,
      40,
      0,
    ])
    // A locked declarer still scores.
    expect(matchDeltas([-120, 40, 0], 0, [850, 0, 0])).toEqual([-120, 40, 0])
    expect(onlyDefeatCounts([0, 800, 0], 1, 0, 100)).toBe(true)
    expect(onlyDefeatCounts([900, 0, 0], 1, 0, 100)).toBe(true)
  })

  it('does not raise the contract beyond what wins the match', () => {
    expect(safeContractLimit([0, 890, 0], 1, 150)).toBe(110)
    expect(safeContractLimit([0, 850, 0], 1, 140)).toBe(140)
    // Monte Carlo contract: 110 already wins, 130 only adds risk.
    const outcomes = [90, 125, 125, 125, 125, 125, 125, 125, 125, 125]
    expect(bestContract(outcomes, [100, 110, 120, 130])).toBe(120)
    expect(contractValue(outcomes, 120)).toBeCloseTo(120 * (2 * 0.9 - 1))
    expect(bestContract(outcomes, [100, 110, 120, 130], 110)).toBe(110)
    expect(contractValue(outcomes, 110, 110)).toBeCloseTo(
      0.9 * (110 + MATCH_WIN_BONUS) - 0.1 * 110,
    )
  })

  it('moves Tosia’s bid limit by 10 points with the match score', () => {
    const hands: [string, string, string, string][] = [
      [
        '10♥ J♥ 9♥ A♦ 10♠ J♣ 10♣',
        'Q♠ K♣ K♠ A♥ K♥ Q♦ 9♣',
        'Q♥ 9♠ J♠ 10♦ Q♣ J♦ 9♦',
        'K♦ A♠ A♣',
      ],
      [
        '9♦ Q♦ K♦ A♦ J♥ 10♥ 9♥',
        'K♠ A♥ 9♠ K♣ 10♣ J♠ Q♣',
        'Q♠ Q♥ A♣ J♣ 10♠ J♦ 10♦',
        '9♣ K♥ A♠',
      ],
    ]
    const differences = new Set<string>()
    for (const [a, b, c, musik] of hands) {
      // Dealer 2: seat 0 opens at 100, seat 1 decides on 110 first.
      const deal = dealOf([a, b, c], musik, 2)
      const estimate = auctionEstimate(maskOf(deal.hand(1)), MELD_VALUES.classic)
      const choice = (scores: number[]) => {
        const tosia = bot(PlayerType.Tactical, 1)
        tosia.matchScores = scores
        return decide(deal, tosia).type
      }
      const expected = (limit: number) => (limit >= 110 ? 'bid' : 'pass')
      const neutral = choice([0, 0, 0])
      expect(neutral).toBe(expected(estimate - TACTICAL_MARGIN))
      const bold = choice([0, 820, 0])
      expect(bold).toBe(expected(estimate - TACTICAL_MARGIN + MOOD_POINTS))
      const careful = choice([0, 500, 100])
      expect(careful).toBe(expected(estimate - TACTICAL_MARGIN - MOOD_POINTS))
      if (bold !== neutral) differences.add('bold')
      if (careful !== neutral) differences.add('careful')
    }
    expect([...differences].sort()).toEqual(['bold', 'careful'])
  })

  it('makes Tosia play the smallest contract that wins the match', () => {
    const deal = dealOf(
      ['A♥ 10♥ K♥ Q♥ A♦ 10♦ A♣', '9♥ J♦ 9♦ J♣ 9♣ J♠ 9♠', 'J♥ K♦ Q♦ 10♣ K♣ Q♣ Q♠'],
      'A♠ 10♠ K♠',
      2,
    )
    // Seat 0 opens at 100; both others pass.
    deal.apply({ type: 'pass' })
    deal.apply({ type: 'pass' })
    deal.apply({ type: 'take' })
    const tosia = bot(PlayerType.Tactical, 0)
    while (deal.phase === 'giving') deal.apply(decide(deal, tosia))
    const free = decide(deal, tosia)
    expect(free.type === 'contract' && free.value).toBeGreaterThan(120)
    tosia.matchScores = [890, 0, 0]
    expect(decide(deal, tosia)).toEqual({ type: 'contract', value: 110 })
  })

  it('moves the Monte Carlo bid threshold by the match score', () => {
    // Dealer 2: seat 0 opens at 100 and seat 1 decides on 110 first. The
    // samples are the same for every score; only the threshold moves.
    const choice = (type: PlayerType, deal: Deal, scores: number[]) => {
      const player = bot(type, 1)
      player.matchScores = scores
      return decide(deal, player).type
    }
    const bruno = dealOf(
      ['K♥ J♥ 10♣ K♣ 9♣ J♦ J♠', 'A♥ A♣ Q♣ K♦ A♠ 10♠ Q♠', '10♥ Q♥ 9♥ J♣ 10♦ 9♦ 9♠'],
      'K♠ A♦ Q♦',
      2,
    )
    expect(choice(PlayerType.Rollout, bruno, [0, 0, 0])).toBe('bid')
    expect(choice(PlayerType.Rollout, bruno, [0, 500, 100])).toBe('pass')
    const monte = dealOf(
      ['10♥ A♣ K♣ 10♦ Q♦ J♦ 9♦', 'K♥ J♣ 9♣ A♠ K♠ Q♠ 9♠', 'Q♥ J♥ 9♥ Q♣ A♦ K♦ J♠'],
      '10♠ 10♣ A♥',
      2,
    )
    expect(choice(PlayerType.MCTS, monte, [0, 0, 0])).toBe('pass')
    expect(choice(PlayerType.MCTS, monte, [0, 820, 0])).toBe('bid')
  })
})
