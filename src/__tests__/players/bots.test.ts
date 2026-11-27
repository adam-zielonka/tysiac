import { describe, expect, it } from 'vitest'
import { Deal, actionKey } from '../../engine/Deal'
import { Deck } from '../../engine/Deck'
import { createPlayer, DEFAULT_PLAYERS } from '../../engine/PlayersSelect'
import { BOT_TYPES, PlayerType } from '../../engine/PlayerType'
import { seededRandom } from '../../engine/random'
import { AZPlayer } from '../../engine/players/AZPlayer'
import { HumanPlayer } from '../../engine/players/HumanPlayer'
import { MCTSPlayer } from '../../engine/players/MCTSPlayer'
import { RandomPlayer } from '../../engine/players/RandomPlayer'
import { RolloutPlayer } from '../../engine/players/RolloutPlayer'
import { SimplePlayer } from '../../engine/players/SimplePlayer'
import { TacticalPlayer } from '../../engine/players/TacticalPlayer'
import { MARRIAGE_VALUES, TOTAL_CARD_POINTS, type MeldSystem } from '../../engine/rules'
import { sampleDeal } from '../../engine/sampling'
import { runDeal } from '../../engine/simulate'
import { bot, dealOf, decide, playOut, tournament } from './helpers'

const { Random, Simple, Tactical, Rollout, MCTS, AZ } = PlayerType
const FAIR = [Random, Simple, Tactical, Rollout, MCTS]

interface CpuUsage {
  user: number
  system: number
}
/** Node's process (tests run in Node; the app itself has no Node types). */
declare const process: { cpuUsage(previous?: CpuUsage): CpuUsage }
const ALL_PHASES = new Set(['bidding', 'musik', 'giving', 'contract', 'play'])

function freshDeal(
  seed: number,
  dealer = seed % 3,
  meldSystem: MeldSystem = 'classic',
): Deal {
  return Deal.deal(dealer, Deck.shuffle(Deck.generate(), seededRandom(seed)), {
    meldSystem,
  })
}

/** A finished deal adds up: all card points plus marriages in the deal's values. */
function expectScored(deal: Deal): void {
  const result = deal.result()!
  const melds = result.meldPoints.reduce((sum, value) => sum + value, 0)
  expect(result.points.reduce((sum, value) => sum + value, 0)).toBe(
    TOTAL_CARD_POINTS + melds,
  )
  for (const meld of deal.s.melds) {
    expect(meld.points).toBe(MARRIAGE_VALUES[deal.meldSystem][meld.color])
  }
}

describe('player factory', () => {
  it('creates the right bot for every type', () => {
    const classes = {
      [PlayerType.Human]: HumanPlayer,
      [Random]: RandomPlayer,
      [Simple]: SimplePlayer,
      [Tactical]: TacticalPlayer,
      [Rollout]: RolloutPlayer,
      [MCTS]: MCTSPlayer,
      [AZ]: AZPlayer,
    }
    for (const [type, constructor] of Object.entries(classes)) {
      const player = createPlayer(type as PlayerType, 2)
      expect(player).toBeInstanceOf(constructor)
      expect(player.type).toBe(type)
      expect(player.id).toBe(2)
    }
    expect(DEFAULT_PLAYERS).toEqual([PlayerType.Human, Tactical, Rollout])
  })

  it('lets only Ada see every hand', () => {
    for (const type of BOT_TYPES)
      expect(createPlayer(type, 0).omniscient).toBe(type === AZ)
  })
})

describe.each(BOT_TYPES)('%s', type => {
  it('chooses a legal action in every phase', () => {
    const phases = new Set<string>()
    for (let seed = 1; seed <= 2; seed++) {
      const deal = freshDeal(seed)
      while (!deal.isFinished) {
        const seat = deal.turn
        const action = decide(deal, bot(type, seat, seededRandom(seed * 31 + seat)))
        expect(deal.isLegal(action)).toBe(true)
        phases.add(deal.phase)
        deal.apply(action)
      }
      const result = deal.result()!
      const melds = result.meldPoints.reduce((sum, value) => sum + value, 0)
      expect(result.points.reduce((sum, value) => sum + value, 0)).toBe(
        TOTAL_CARD_POINTS + melds,
      )
    }
    expect(phases).toEqual(ALL_PHASES)
  }, 60_000)
})

describe('bot matches', () => {
  it('plays complete deals with all six bots mixed', () => {
    const lineups = [
      [Random, Rollout, AZ],
      [Simple, MCTS, Tactical],
      [MCTS, AZ, Random],
      [Tactical, Simple, Rollout],
    ]
    lineups.forEach((lineup, i) => {
      for (let dealer = 0; dealer < 3; dealer += 2) {
        const players = lineup.map((type, seat) => bot(type, seat))
        const deal = runDeal(freshDeal(100 + i, dealer), players)
        expect(deal.result()).not.toBeNull()
      }
    })
  }, 120_000)

  it('plays hundreds of quick deals without an illegal move', () => {
    const players = [Random, Simple, Tactical].map((type, seat) =>
      createPlayer(type, seat, seededRandom(seat + 5)),
    )
    for (let seed = 0; seed < 300; seed++) {
      const deal = runDeal(freshDeal(1000 + seed), players)
      expect(deal.isFinished).toBe(true)
    }
  }, 60_000)

  it('plays legal deals late in a match, with locked seats and 1000 in reach', () => {
    for (const lineup of [
      [Rollout, MCTS, AZ],
      [Tactical, Simple, Random],
    ]) {
      for (const scores of [
        [820, 890, 400],
        [990, 100, 850],
      ]) {
        const players = lineup.map((type, seat) => bot(type, seat))
        for (const player of players) player.matchScores = scores
        const deal = freshDeal(300 + scores[0], 1)
        playOut(deal, players)
        expect(deal.result()).not.toBeNull()
      }
    }
  }, 120_000)

  it('repeats a seeded deal exactly', () => {
    for (const lineup of [
      [Rollout, MCTS, AZ],
      [Random, Simple, Tactical],
    ]) {
      const run = () =>
        playOut(
          freshDeal(77, 1),
          lineup.map((type, seat) => bot(type, seat, seededRandom(40 + seat))),
        )
      expect(run()).toEqual(run())
    }
  }, 60_000)
})

describe('German marriage values', () => {
  it('lets every bot play complete legal deals', () => {
    const lineups = [
      [Random, Rollout, AZ],
      [Simple, MCTS, Tactical],
      [AZ, Tactical, Rollout],
      [Tactical, Simple, MCTS],
    ]
    let melds = 0
    lineups.forEach((lineup, i) => {
      const players = lineup.map((type, seat) => bot(type, seat))
      const deal = freshDeal(200 + i, i % 3, 'german')
      // `playOut` throws on an illegal action.
      playOut(deal, players)
      expect(deal.meldSystem).toBe('german')
      expectScored(deal)
      melds += deal.s.melds.length
    })
    expect(melds).toBeGreaterThan(2)
  }, 120_000)

  it('plays hundreds of quick German deals without an illegal move', () => {
    const players = [Random, Simple, Tactical].map((type, seat) =>
      createPlayer(type, seat, seededRandom(seat + 5)),
    )
    let melds = 0
    for (let seed = 0; seed < 200; seed++) {
      const deal = runDeal(freshDeal(2000 + seed, seed % 3, 'german'), players)
      expectScored(deal)
      melds += deal.s.melds.length
    }
    expect(melds).toBeGreaterThan(100)
  }, 60_000)
})

describe('German marriage values in bot decisions', () => {
  /**
   * Dealer 0, so seat 1 opens at 100. Seat 1 holds K♣ Q♣: żołądź, worth 100
   * in German values, but only trefl (60) in classic ones. Seat 2 holds the
   * ♥ and ♦ marriages and may bid up to 220 in either system.
   */
  function clubsDeal(meldSystem: MeldSystem): Deal {
    return dealOf(
      ['9♦ J♦ 10♦ J♥ 10♥ 9♠ J♠', 'K♣ Q♣ A♣ 10♣ A♠ A♦ 9♥', 'K♥ Q♥ K♦ Q♦ J♣ 9♣ Q♠'],
      'A♥ 10♠ K♠',
      0,
      { meldSystem },
    )
  }

  /** Seat 2 bids `value` and seat 0 passes: seat 1 answers. */
  function facing(meldSystem: MeldSystem, value: number): Deal {
    const deal = clubsDeal(meldSystem)
    deal.apply({ type: 'bid', value })
    deal.apply({ type: 'pass' })
    expect(deal.turn).toBe(1)
    return deal
  }

  it.each([Simple, Tactical])(
    '%s raises to 180 on żołądź only in German values',
    type => {
      // 180 is legal in both systems (limit 220 or 180), but valued as trefl
      // the hand is worth about 170 and the bot passes.
      expect(decide(facing('german', 170), bot(type, 1))).toEqual({
        type: 'bid',
        value: 180,
      })
      expect(decide(facing('classic', 170), bot(type, 1))).toEqual({ type: 'pass' })
    },
  )

  it.each([Rollout, MCTS, AZ])(
    '%s bids past the classic limit on żołądź worth 100',
    type => {
      // Valued as trefl (60), the same cards are not worth 200 and the bot passes.
      const deal = facing('german', 190)
      expect(deal.bidOptions()).toEqual([200, 210, 220])
      expect(decide(deal, bot(type, 1))).toEqual({ type: 'bid', value: 200 })
    },
    60_000,
  )

  it('lets Tosia declare a higher contract on żołądź worth 100', () => {
    const contract = (meldSystem: MeldSystem): number => {
      const deal = clubsDeal(meldSystem)
      const tosia = bot(Tactical, 1)
      for (const action of ['pass', 'pass', 'take'] as const) deal.apply({ type: action })
      while (deal.phase === 'giving') deal.apply(decide(deal, tosia))
      const action = decide(deal, tosia)
      expect(deal.isLegal(action)).toBe(true)
      return action.type === 'contract' ? action.value : NaN
    }
    // About 40 points more: the value of the ♣ marriage changes from 60 to 100.
    expect(contract('german')).toBeGreaterThanOrEqual(contract('classic') + 30)
  })

  it.each([Tactical, Rollout, MCTS, AZ])(
    '%s gives away dzwonek (♦ 40), the least valuable German marriage',
    type => {
      /** The declarer (seat 1) holds all four marriages after taking the musik. */
      const gifts = (meldSystem: MeldSystem): string[] => {
        const deal = dealOf(
          ['9♦ J♦ 10♦ J♥ 10♥ 9♠ J♠', 'K♥ Q♥ K♦ Q♦ K♣ Q♣ K♠', 'A♦ A♣ 10♣ J♣ 9♣ 9♥ 10♠'],
          'Q♠ A♥ A♠',
          0,
          { meldSystem },
        )
        for (const action of ['pass', 'pass', 'take'] as const)
          deal.apply({ type: action })
        const player = bot(type, 1)
        const given: string[] = []
        while (deal.phase === 'giving') {
          const action = decide(deal, player)
          if (action.type === 'give') given.push(action.card.id)
          deal.apply(action)
        }
        return given.sort()
      }
      expect(gifts('german')).toEqual(['K♦', 'Q♦'])
      // In classic values ♦ is karo, worth 80: the bots keep it.
      expect(gifts('classic').filter(id => id.endsWith('♦'))).toEqual([])
    },
    60_000,
  )
})

describe('fair bots', () => {
  it.each(FAIR)(
    '%s decides only from its own view',
    type => {
      let compared = 0
      let hiddenDiffer = false
      for (let seed = 1; seed <= 2; seed++) {
        const deal = freshDeal(seed * 13)
        const driver = [0, 1, 2].map(seat => bot(Tactical, seat))
        for (let step = 0; !deal.isFinished; step++) {
          const seat = deal.turn
          const actions = deal.legalActions()
          if (actions.length > 1 && step % 3 === 0) {
            const view = deal.viewFor(seat)
            // Another full deal that this seat cannot tell apart from the real one.
            const other = sampleDeal(view, seededRandom(seed + step))
            expect(JSON.stringify(other.viewFor(seat).s)).toBe(JSON.stringify(view.s))
            hiddenDiffer ||=
              JSON.stringify(other.s.hands) !== JSON.stringify(deal.s.hands)
            const a = bot(type, seat, seededRandom(7)).choose(deal.viewFor(seat), actions)
            const b = bot(type, seat, seededRandom(7)).choose(
              other.viewFor(seat),
              other.legalActions(),
            )
            expect(actionKey(a)).toBe(actionKey(b))
            compared++
          }
          deal.apply(driver[seat].choose(deal.viewFor(seat), actions))
        }
      }
      expect(compared).toBeGreaterThan(10)
      expect(hiddenDiffer).toBe(true)
    },
    60_000,
  )
})

describe('decision time', () => {
  /** Process CPU time, so other programs on the machine do not count. */
  function cpuMs(work: () => void): number {
    const start = process.cpuUsage()
    work()
    const used = process.cpuUsage(start)
    return (used.user + used.system) / 1000
  }

  it.each([Tactical, Rollout, MCTS, AZ])(
    '%s stays within the budget',
    type => {
      const times: number[] = []
      for (let seed = 1; seed <= 2; seed++) {
        const deal = freshDeal(500 + seed)
        const players = [0, 1, 2].map(seat =>
          createPlayer(type, seat, seededRandom(seed + seat)),
        )
        while (!deal.isFinished) {
          const player = players[deal.turn]
          const actions = deal.legalActions()
          let action = actions[0]
          const view = player.omniscient ? deal.clone() : deal.viewFor(deal.turn)
          const ms = cpuMs(() => (action = player.choose(view, actions)))
          if (actions.length > 1) times.push(ms)
          deal.apply(action)
        }
      }
      times.sort((a, b) => a - b)
      const median = times[times.length >> 1]
      expect(median).toBeLessThan(150)
      expect(times[times.length - 1]).toBeLessThan(400)
    },
    60_000,
  )
})

describe('strength', () => {
  it('search bots outscore Felek over a seeded series with rotating seats', () => {
    const first = tournament([Random, Rollout, MCTS], 4, 2026)
    expect(first.get(Rollout)!).toBeGreaterThan(first.get(Random)! + 20)
    expect(first.get(MCTS)!).toBeGreaterThan(first.get(Random)! + 20)
    const second = tournament([Random, AZ, Tactical], 4, 2027)
    expect(second.get(AZ)!).toBeGreaterThan(second.get(Random)! + 20)
    expect(second.get(Tactical)!).toBeGreaterThan(second.get(Random)!)
  }, 180_000)
})
