import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { type Card, cards } from '../../engine/Card'
import { Deal, type Action } from '../../engine/Deal'
import { Deck } from '../../engine/Deck'
import { Game, type HistoryEntry } from '../../engine/Game'
import type { Player } from '../../engine/Player'
import { DEFAULT_PLAYERS, createPlayer } from '../../engine/PlayersSelect'
import { PlayerType } from '../../engine/PlayerType'
import { seededRandom } from '../../engine/random'
import { roundScore } from '../../engine/rules'
import { ChaosPlayer, GreedyTestPlayer } from './helpers'

const BOTS = [PlayerType.Random, PlayerType.Random, PlayerType.Random]
const WITH_HUMAN = [PlayerType.Human, PlayerType.Random, PlayerType.Random]

const HANDS: Record<string, string> = {
  /** Aces and the ♥ marriage: wins almost everything. */
  A: 'A♥ 10♥ K♥ Q♥ A♠ 10♠ A♦',
  B: 'J♥ 9♥ K♠ Q♠ J♠ 9♠ 10♦',
  C: 'A♣ 10♣ K♣ Q♣ J♣ 9♣ K♦',
}

/**
 * A stacked deck: `deckOf('CAB')` deals hand C to seat 0, A to seat 1 and B to
 * seat 2. The greedy test players never raise, so the opener (after the
 * dealer) always plays for 100; as [dealer] declarer, result, deltas:
 * - ABC: [0] seat 1 fails, 200 / −100 / 0; [1] seat 2 makes, 220 / 0 / 100;
 *   [2] seat 0 makes, 100 / 20 / 0.
 * - CAB: [0] seat 1 makes, 0 / 100 / 20; [1] seat 2 fails, 0 / 200 / −100;
 *   [2] seat 0 makes, 100 / 220 / 0.
 */
function deckOf(order: string): Card[] {
  return cards(`${[...order].map(hand => HANDS[hand]).join(' ')} Q♦ J♦ 9♦`)
}

/** Seat 0 holds K♥ Q♥ and the aces; the musik is Q♦ J♦ 9♦. */
const SLAM_DECK = deckOf('ABC')

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function newGame(
  players = BOTS,
  options: Partial<ConstructorParameters<typeof Game>[0]> = {},
) {
  return new Game({
    players,
    random: seededRandom(42),
    thinkDelay: 100,
    trickDelay: 500,
    ...options,
  })
}

/** Replaces the bots (created by `startMatch`) with deterministic test players. */
function useGreedyBots(game: Game): void {
  game.players = game.players.map((player, seat) =>
    player.isHuman ? player : new GreedyTestPlayer(seat, seededRandom(seat)),
  )
}

/** Deals the given decks in turn, then the last one again and again. */
function stackDeck(...decks: readonly Card[][]): void {
  const shuffle = vi.spyOn(Deck, 'shuffle').mockImplementation(() => [...decks.at(-1)!])
  decks.slice(0, -1).forEach(deck => shuffle.mockImplementationOnce(() => [...deck]))
}

/** Runs bot timers until the deal ends or the human is to act. */
function runBots(game: Game, limit = 500): void {
  for (let i = 0; i < limit && game.status === 'playing'; i++) {
    if (game.players[game.turn].isHuman) return
    vi.advanceTimersToNextTimer()
  }
}

function playMatch(game: Game): void {
  for (let i = 0; i < 1000 && game.status !== 'gameOver'; i++) {
    if (game.status === 'dealEnd') game.nextDeal()
    runBots(game)
  }
}

function kinds(history: HistoryEntry[]): string[] {
  return history.map(entry => entry.kind)
}

it('starts in setup with the default players and no timers', () => {
  const game = new Game()
  expect(game.status).toBe('setup')
  expect(game.isSetup).toBe(true)
  expect(game.deal).toBeNull()
  expect(game.playersSelect).toEqual([...DEFAULT_PLAYERS])
  // Whatever the factory builds for each selected type.
  expect(game.players.map(player => player.type)).toEqual(
    DEFAULT_PLAYERS.map((type, seat) => createPlayer(type, seat).type),
  )
  expect(game.players[0].isHuman).toBe(true)
  expect(game.players.map(player => player.id)).toEqual([0, 1, 2])
  expect(game.scores).toEqual([0, 0, 0])
  expect(game.records).toEqual([])
  expect(game.history).toEqual([])
  expect(game.winners).toEqual([])
  expect(game.dealNumber).toBe(0)
  expect(game.turn).toBe(-1)
  expect(game.target).toBe(1000)
  expect(game.lockScore).toBe(800)
  expect(game.lockedSeats).toEqual([false, false, false])
  expect(game.players.map(player => player.matchScores)).toEqual([
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ])
  expect(game.thinkDelay).toBe(650)
  expect(game.trickDelay).toBe(1100)
  expect(game.showLastTrick).toBe(false)
  expect(game.actionsFor(0)).toEqual([])
  expect(game.act(0, { type: 'pass' })).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

it('accepts options and can start right away', () => {
  const game = newGame(BOTS, { autoStart: true, firstDealer: 2 })
  expect(game.thinkDelay).toBe(100)
  expect(game.trickDelay).toBe(500)
  expect(game.status).toBe('playing')
  expect(game.deal?.dealer).toBe(2)
  expect(game.dealNumber).toBe(1)
  expect(game.turn).toBe(1)
  expect(vi.getTimerCount()).toBe(1)
})

it('changes players only during setup, with a human only on seat 0', () => {
  const game = newGame(WITH_HUMAN)
  const notify = vi.fn()
  game.subscribe(notify)
  expect(notify).toHaveBeenCalledTimes(1)
  expect(game.setPlayer(1, PlayerType.Human)).toBe(false)
  expect(game.setPlayer(3, PlayerType.Random)).toBe(false)
  expect(game.setPlayer(-1, PlayerType.Random)).toBe(false)
  expect(notify).toHaveBeenCalledTimes(1)
  expect(game.setPlayer(2, PlayerType.Tactical)).toBe(true)
  expect(game.playersSelect[2]).toBe(PlayerType.Tactical)
  expect(game.players[2].type).toBe(createPlayer(PlayerType.Tactical, 2).type)
  expect(notify).toHaveBeenCalledTimes(2)
  // Seat 0 may be a bot to watch the game, and a human again.
  expect(game.setPlayer(0, PlayerType.Random)).toBe(true)
  expect(game.players[0].isHuman).toBe(false)
  expect(game.setPlayer(0, PlayerType.Human)).toBe(true)
  game.startMatch()
  expect(game.setPlayer(1, PlayerType.Simple)).toBe(false)
  expect(game.playersSelect[1]).toBe(PlayerType.Random)
})

it('stops notifying after unsubscribing', () => {
  const game = newGame()
  const notify = vi.fn()
  const unsubscribe = game.subscribe(notify)
  expect(notify).toHaveBeenCalledWith(game)
  unsubscribe()
  game.startMatch()
  expect(notify).toHaveBeenCalledTimes(1)
})

it('deals, schedules bot moves and logs the opening', () => {
  const game = newGame(BOTS, { firstDealer: 1 })
  const notify = vi.fn()
  game.subscribe(notify)
  game.startMatch()
  expect(game.status).toBe('playing')
  expect(game.dealNumber).toBe(1)
  expect(game.deal?.dealer).toBe(1)
  expect(game.deal?.opener).toBe(2)
  expect(game.turn).toBe(0)
  expect(game.history.map(({ kind, player, deal }) => ({ kind, player, deal }))).toEqual([
    { kind: 'deal', player: 1, deal: 1 },
    { kind: 'opening', player: 2, deal: 1 },
  ])
  expect(game.history[1]).toMatchObject({ value: 100 })
  expect(notify).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(1)
  // Nothing happens before the thinking delay.
  vi.advanceTimersByTime(99)
  expect(game.history).toHaveLength(2)
  vi.advanceTimersByTime(1)
  expect(game.history).toHaveLength(3)
  expect(['bid', 'pass']).toContain(game.history[2].kind)
  expect(game.history[2].player).toBe(0)
  expect(vi.getTimerCount()).toBe(1)
})

it('restarts cleanly when startMatch is called twice', () => {
  const game = newGame()
  game.startMatch()
  vi.advanceTimersByTime(250)
  game.scores = [50, 60, 70]
  game.startMatch()
  expect(game.dealNumber).toBe(1)
  expect(game.scores).toEqual([0, 0, 0])
  expect(game.records).toEqual([])
  expect(kinds(game.history)).toEqual(['deal', 'opening'])
  expect(game.deal?.phase).toBe('bidding')
  expect(vi.getTimerCount()).toBe(1)
  const ids = game.history.map(entry => entry.id)
  expect(new Set(ids).size).toBe(ids.length)
})

it('lets only the human act on its own turn with a legal action', () => {
  // Dealer 1: seat 2 opens, seat 0 (human) speaks first.
  const game = newGame(WITH_HUMAN, { firstDealer: 1 })
  game.startMatch()
  expect(game.turn).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  expect(game.actionsFor(0)).toEqual(game.deal!.legalActions())
  expect(game.actionsFor(1)).toEqual([])
  expect(game.act(1, { type: 'pass' })).toBe(false)
  expect(game.act(0, { type: 'bid', value: 105 })).toBe(false)
  expect(game.act(0, { type: 'take' })).toBe(false)
  expect(game.act(0, undefined as unknown as Action)).toBe(false)
  expect(game.history).toHaveLength(2)

  expect(game.act(0, { type: 'pass' })).toBe(true)
  expect(game.history.at(-1)).toMatchObject({ kind: 'pass', player: 0 })
  expect(game.turn).toBe(1)
  expect(vi.getTimerCount()).toBe(1)
  // Bots cannot be driven through the human entry point.
  expect(game.actionsFor(1)).toEqual(game.deal!.legalActions())
  expect(game.act(1, game.actionsFor(1)[0])).toBe(false)
  expect(game.act(0, { type: 'pass' })).toBe(false)
  expect(game.turn).toBe(1)
})

it('does not let anyone act for a watching seat 0 bot', () => {
  const game = newGame(BOTS, { firstDealer: 1 })
  game.startMatch()
  expect(game.turn).toBe(0)
  expect(game.act(0, { type: 'pass' })).toBe(false)
  expect(game.history).toHaveLength(2)
})

it('plays a deal to the end and records the result', () => {
  const game = newGame(BOTS)
  game.startMatch()
  useGreedyBots(game)
  runBots(game)
  expect(game.status).toBe('dealEnd')
  expect(game.turn).toBe(-1)
  // The final trick stays on the table for the trick delay.
  expect(game.showLastTrick).toBe(true)
  expect(vi.getTimerCount()).toBe(1)
  vi.advanceTimersByTime(500)
  expect(game.showLastTrick).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  const result = game.deal!.result()!
  expect(game.scores).toEqual(result.deltas)
  expect(game.records).toEqual([
    {
      number: 1,
      dealer: 0,
      declarer: result.declarer,
      contract: result.contract,
      made: result.made,
      points: result.points,
      deltas: result.deltas,
      locked: [false, false, false],
      totals: result.deltas,
    },
  ])
  const history = kinds(game.history)
  expect(history.slice(0, 2)).toEqual(['deal', 'opening'])
  expect(history.at(-1)).toBe('result')
  expect(game.history.at(-1)).toMatchObject({
    player: result.declarer,
    value: result.deltas[result.declarer],
    made: result.made,
  })
  expect(history.filter(kind => kind === 'bidWon')).toHaveLength(1)
  expect(history.filter(kind => kind === 'take')).toHaveLength(1)
  expect(history.filter(kind => kind === 'give')).toHaveLength(2)
  expect(history.filter(kind => kind === 'contract')).toHaveLength(1)
  expect(history.filter(kind => kind === 'play')).toHaveLength(24)
  expect(history.filter(kind => kind === 'trick')).toHaveLength(8)
  expect(history.filter(kind => kind === 'meld')).toHaveLength(game.deal!.s.melds.length)
  const order = ['bidWon', 'take', 'give', 'contract', 'play', 'result']
  const firstIndex = order.map(kind => history.indexOf(kind))
  expect(firstIndex).toEqual([...firstIndex].sort((a, b) => a - b))
  // Gifts are hidden from the log: only the recipient is named.
  for (const entry of game.history) {
    if (entry.kind === 'give')
      expect(Object.keys(entry).sort()).toEqual(['deal', 'id', 'kind', 'player', 'to'])
  }
  const take = game.history.find(entry => entry.kind === 'take')
  expect(take).toMatchObject({ cards: game.deal!.s.musikCards.map(card => card.id) })
  const trickPoints = game.history.flatMap(entry =>
    entry.kind === 'trick' ? [entry.value] : [],
  )
  expect(trickPoints.reduce((a, b) => a + b, 0)).toBe(120)
})

it('starts the next deal only from the deal end, rotating the dealer', () => {
  const game = newGame(BOTS, { firstDealer: 2 })
  game.nextDeal()
  expect(game.status).toBe('setup')
  game.startMatch()
  useGreedyBots(game)
  game.nextDeal()
  expect(game.dealNumber).toBe(1)
  expect(game.deal?.dealer).toBe(2)
  runBots(game)
  expect(game.status).toBe('dealEnd')
  const scores = game.scores.slice()
  game.nextDeal()
  expect(game.status).toBe('playing')
  expect(game.dealNumber).toBe(2)
  expect(game.deal?.dealer).toBe(0)
  expect(game.scores).toEqual(scores)
  expect(game.history.at(-2)).toMatchObject({ kind: 'deal', player: 0, deal: 2 })
  expect(vi.getTimerCount()).toBe(1)
  // Calling it again while playing changes nothing.
  const deal = game.deal
  game.nextDeal()
  expect(game.deal).toBe(deal)
  runBots(game)
  game.nextDeal()
  expect(game.deal?.dealer).toBe(1)
  expect(game.dealNumber).toBe(3)
})

/** Checks every record of a match against the scoring rules of this version. */
function expectRecordsFollowTheRules(game: Game): void {
  let before = [0, 0, 0]
  game.records.forEach((record, index) => {
    expect(record.number).toBe(index + 1)
    record.points.forEach((points, seat) => {
      const declarer = seat === record.declarer
      const locked = !declarer && before[seat] >= 800
      expect(record.locked[seat]).toBe(locked)
      const delta = declarer
        ? record.made
          ? record.contract
          : -record.contract
        : roundScore(points)
      expect(record.deltas[seat]).toBe(locked ? 0 : delta)
      expect(record.totals[seat]).toBe(before[seat] + record.deltas[seat])
    })
    expect(record.made).toBe(record.points[record.declarer] >= record.contract)
    // Only the last deal reaches the target.
    if (index < game.records.length - 1)
      expect(Math.max(...record.totals)).toBeLessThan(1000)
    before = record.totals
  })
  expect(game.scores).toEqual(before)
  const last = game.records.at(-1)!
  const best = Math.max(...game.scores)
  expect(best).toBeGreaterThanOrEqual(1000)
  // The declarer who reaches 1000 wins alone; otherwise the highest total.
  expect(game.winners).toEqual(
    game.scores[last.declarer] >= 1000
      ? [last.declarer]
      : [0, 1, 2].filter(seat => game.scores[seat] === best),
  )
}

it('plays a whole match to 1000 and declares the winners', () => {
  const game = newGame(BOTS, { firstDealer: 1 })
  game.startMatch()
  useGreedyBots(game)
  playMatch(game)
  expect(game.status).toBe('gameOver')
  // The final trick of the match is shown before the summary too.
  expect(game.showLastTrick).toBe(true)
  expect(vi.getTimerCount()).toBe(1)
  vi.advanceTimersByTime(500)
  expect(game.showLastTrick).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  expect(game.records).toHaveLength(game.dealNumber)
  game.records.forEach((record, index) => expect(record.dealer).toBe((1 + index) % 3))
  expectRecordsFollowTheRules(game)
  expect(game.leader).toBe(game.scores.indexOf(Math.max(...game.scores)))
  expect(game.history.length).toBeLessThanOrEqual(80)
  expect(game.history.at(-1)?.kind).toBe('result')
  // A finished match ignores further moves until it is prepared again.
  const records = game.records
  game.nextDeal()
  expect(game.status).toBe('gameOver')
  expect(game.records).toBe(records)
  expect(game.turn).toBe(-1)
  expect(game.actionsFor(game.deal!.turn)).toEqual([])
})

it('plays many seeded matches to 1000 under the 800 lock', () => {
  let deals = 0
  let locked = 0
  let lockedDeclarers = 0
  for (let match = 0; match < 24; match++) {
    const game = newGame(BOTS, {
      firstDealer: match % 3,
      random: seededRandom(500 + match),
    })
    game.startMatch()
    // Mostly greedy players; a random one in every other match makes contracts vary.
    game.players = game.players.map((_, seat) =>
      match % 2 && seat === match % 3
        ? new ChaosPlayer(seat, seededRandom(900 + match))
        : new GreedyTestPlayer(seat, seededRandom(seat)),
    )
    playMatch(game)
    expect(game.status).toBe('gameOver')
    expectRecordsFollowTheRules(game)
    deals += game.records.length
    let before = [0, 0, 0]
    for (const record of game.records) {
      locked += record.locked.filter(Boolean).length
      if (before[record.declarer] >= 800) lockedDeclarers++
      before = record.totals
    }
  }
  expect(deals).toBeGreaterThan(300)
  expect(locked).toBeGreaterThan(50)
  expect(lockedDeclarers).toBeGreaterThan(20)
}, 60_000)

it('locks defenders at 800 or more while the declarer still plays for the contract', () => {
  stackDeck(deckOf('ABC'), deckOf('CAB'))
  const game = newGame(BOTS, { firstDealer: 0 })
  game.startMatch()
  useGreedyBots(game)
  game.scores = [800, 850, 790]
  expect(game.lockedSeats).toEqual([true, true, false])
  runBots(game)
  // Seat 1 declares at 850 and fails; seat 0 would have written 200.
  expect(game.status).toBe('dealEnd')
  expect(game.records[0]).toMatchObject({
    declarer: 1,
    contract: 100,
    made: false,
    points: [199, 61, 0],
    deltas: [0, -100, 0],
    locked: [true, false, false],
    totals: [800, 750, 790],
  })
  expect(game.history.at(-1)).toMatchObject({ kind: 'result', player: 1, value: -100 })
  expect(game.lockedSeats).toEqual([true, false, false])
  // Back below 800, seat 1 scores as a defender again.
  game.nextDeal()
  runBots(game)
  expect(game.records[1]).toMatchObject({
    dealer: 1,
    declarer: 2,
    made: false,
    points: [0, 199, 61],
    deltas: [0, 200, -100],
    locked: [true, false, false],
    totals: [800, 950, 690],
  })
  expect(game.lockedSeats).toEqual([true, true, false])
})

it('lets the declarer who reaches 1000 win even when a defender has more', () => {
  stackDeck(deckOf('CAB'))
  const game = newGame(BOTS, { firstDealer: 2 })
  game.startMatch()
  useGreedyBots(game)
  game.scores = [900, 790, 0]
  runBots(game)
  expect(game.records[0]).toMatchObject({
    declarer: 0,
    made: true,
    deltas: [100, 220, 0],
    totals: [1000, 1010, 0],
  })
  expect(game.status).toBe('gameOver')
  expect(game.winners).toEqual([0])
})

it('gives the win to the highest total when the declarer stays below 1000', () => {
  stackDeck(deckOf('CAB'))
  const game = newGame(BOTS, { firstDealer: 2 })
  game.startMatch()
  useGreedyBots(game)
  game.scores = [500, 790, 0]
  runBots(game)
  expect(game.scores).toEqual([600, 1010, 0])
  expect(game.status).toBe('gameOver')
  expect(game.winners).toEqual([1])
  expect(game.leader).toBe(1)
})

it('shares the win between players tied on the highest total', () => {
  stackDeck(deckOf('CAB'))
  const game = newGame(BOTS, { firstDealer: 2 })
  game.startMatch()
  useGreedyBots(game)
  // Set by hand: seat 2 is already at 1000 and locked; seat 1 catches up.
  game.scores = [800, 780, 1000]
  runBots(game)
  expect(game.records[0]).toMatchObject({
    declarer: 0,
    deltas: [100, 220, 0],
    locked: [false, false, true],
  })
  expect(game.scores).toEqual([900, 1000, 1000])
  expect(game.status).toBe('gameOver')
  expect(game.winners).toEqual([1, 2])
})

it('keeps playing below the target', () => {
  const game = newGame(BOTS)
  game.startMatch()
  useGreedyBots(game)
  game.scores = [-500, 0, 300]
  runBots(game)
  expect(game.status).toBe('dealEnd')
  expect(game.winners).toEqual([])
})

it('prepare() cancels a pending bot move and resets the match', () => {
  const game = newGame()
  game.startMatch()
  vi.advanceTimersByTime(100)
  expect(vi.getTimerCount()).toBe(1)
  const notify = vi.fn()
  game.subscribe(notify)
  notify.mockClear()
  game.prepare()
  expect(notify).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
  expect(game.status).toBe('setup')
  expect(game.deal).toBeNull()
  expect(game.scores).toEqual([0, 0, 0])
  expect(game.records).toEqual([])
  expect(game.history).toEqual([])
  expect(game.winners).toEqual([])
  expect(game.dealNumber).toBe(0)
  expect(game.showLastTrick).toBe(false)
  vi.advanceTimersByTime(10_000)
  expect(game.status).toBe('setup')
  expect(game.history).toEqual([])
  expect(notify).toHaveBeenCalledTimes(1)
  // And a new match can start.
  game.startMatch()
  expect(game.status).toBe('playing')
  expect(game.dealNumber).toBe(1)
})

it('prepare() after a finished match allows choosing players again', () => {
  const game = newGame(BOTS)
  game.startMatch()
  useGreedyBots(game)
  playMatch(game)
  game.prepare()
  expect(game.status).toBe('setup')
  expect(game.setPlayer(0, PlayerType.Human)).toBe(true)
})

it('stopTimer() pauses the bots', () => {
  const game = newGame()
  game.startMatch()
  game.stopTimer()
  vi.advanceTimersByTime(10_000)
  expect(game.history).toHaveLength(2)
})

it('falls back to the first legal action when a bot throws or answers nonsense', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const game = newGame(BOTS, { firstDealer: 0 })
  game.startMatch()
  // Seat 2 speaks first (dealer 0, opener 1).
  game.players[2].choose = () => {
    throw new Error('boom')
  }
  vi.advanceTimersByTime(100)
  expect(error).toHaveBeenCalledTimes(1)
  expect(game.history.at(-1)).toMatchObject({ kind: 'pass', player: 2 })
  game.players[0].choose = () => undefined as unknown as Action
  vi.advanceTimersByTime(100)
  expect(game.history.at(-2)).toMatchObject({ kind: 'pass', player: 0 })
  expect(game.history.at(-1)).toMatchObject({ kind: 'bidWon', player: 1, value: 100 })
  expect(game.deal?.phase).toBe('musik')
  game.players[1].choose = () => ({ type: 'bid', value: 990 })
  vi.advanceTimersByTime(500)
  expect(game.history.at(-1)).toMatchObject({ kind: 'take', player: 1 })
  // The broken bots keep the deal going until it ends.
  const broken: Player['choose'] = () => {
    throw new Error('still broken')
  }
  game.players.forEach(player => (player.choose = broken))
  runBots(game)
  expect(game.status).toBe('dealEnd')
})

it('gives bots their own view, or the full deal when omniscient', () => {
  const game = newGame(BOTS, { firstDealer: 0 })
  game.startMatch()
  const seen: Deal[] = []
  const spy = (deal: Deal, actions: Action[]) => {
    seen.push(deal)
    return actions[0]
  }
  game.players[2].choose = spy
  vi.advanceTimersByTime(100)
  expect(seen[0].isView).toBe(true)
  expect(seen[0].s.viewer).toBe(2)
  expect(seen[0].hand(0)).toEqual([])
  expect(seen[0]).not.toBe(game.deal)
  Object.defineProperty(game.players[0], 'omniscient', { value: true })
  game.players[0].choose = spy
  vi.advanceTimersByTime(100)
  expect(seen[1].isView).toBe(false)
  expect(seen[1]).not.toBe(game.deal)
  expect(seen[1].hand(1)).toEqual(game.deal!.hand(1))
})

it('pauses on a completed trick before the next bot move', () => {
  const game = newGame(BOTS)
  game.startMatch()
  useGreedyBots(game)
  while (game.deal!.trickNumber === 0) vi.advanceTimersToNextTimer()
  expect(game.showLastTrick).toBe(true)
  expect(game.deal!.s.lastTrick).not.toBeNull()
  expect(vi.getTimerCount()).toBe(1)
  const played = game.deal!.s.played.length
  vi.advanceTimersByTime(100)
  expect(game.deal!.s.played.length).toBe(played)
  expect(game.showLastTrick).toBe(true)
  vi.advanceTimersByTime(400)
  expect(game.deal!.s.played.length).toBe(played + 1)
  expect(game.showLastTrick).toBe(false)
})

it('pauses on the revealed musik before a bot declarer takes it', () => {
  stackDeck(SLAM_DECK)
  // Dealer 0: seat 1 opens, seat 2 and seat 0 (human) pass, seat 1 declares.
  const game = newGame(WITH_HUMAN, { firstDealer: 0 })
  game.startMatch()
  useGreedyBots(game)
  vi.advanceTimersByTime(100)
  expect(game.act(0, { type: 'pass' })).toBe(true)
  expect(game.deal?.phase).toBe('musik')
  expect(game.turn).toBe(1)
  vi.advanceTimersByTime(499)
  expect(game.deal?.phase).toBe('musik')
  vi.advanceTimersByTime(1)
  expect(game.deal?.phase).toBe('giving')
})

it('shows the last trick to the human, who may continue at once', () => {
  stackDeck(SLAM_DECK)
  // Dealer 2: the human opens at 100 and both bots pass.
  const game = newGame(WITH_HUMAN, { firstDealer: 2 })
  game.startMatch()
  useGreedyBots(game)
  runBots(game)
  expect(game.deal?.phase).toBe('musik')
  expect(game.turn).toBe(0)
  for (const action of [
    { type: 'take' },
    { type: 'give', card: cards('9♦')[0], to: 1 },
    { type: 'give', card: cards('J♦')[0], to: 2 },
    { type: 'contract', value: 220 },
    { type: 'play', card: cards('A♥')[0] },
  ] as Action[]) {
    expect(game.act(0, action)).toBe(true)
  }
  runBots(game)
  // The human won the trick: it stays visible for the trick delay.
  expect(game.turn).toBe(0)
  expect(game.showLastTrick).toBe(true)
  expect(vi.getTimerCount()).toBe(1)
  const notify = vi.fn()
  game.subscribe(notify)
  notify.mockClear()
  vi.advanceTimersByTime(500)
  expect(game.showLastTrick).toBe(false)
  expect(notify).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)

  // Leading Q♥ declares the marriage.
  expect(game.deal!.isMeld(cards('Q♥')[0])).toBe(true)
  expect(game.act(0, { type: 'play', card: cards('Q♥')[0] })).toBe(true)
  expect(game.history.at(-1)).toMatchObject({ kind: 'meld', player: 0, value: 100 })
  runBots(game)
  expect(game.showLastTrick).toBe(true)
  // Playing on clears the last trick at once.
  expect(game.act(0, { type: 'play', card: cards('K♥')[0] })).toBe(true)
  expect(game.showLastTrick).toBe(false)
  expect(vi.getTimerCount()).toBe(1)
})

it('keeps the history short', () => {
  const game = newGame(BOTS)
  game.startMatch()
  useGreedyBots(game)
  for (let deal = 0; deal < 3; deal++) {
    runBots(game)
    game.nextDeal()
  }
  expect(game.history.length).toBe(80)
  const ids = game.history.map(entry => entry.id)
  expect(ids).toEqual([...ids].sort((a, b) => a - b))
  expect(game.history.at(-1)?.deal).toBe(game.dealNumber)
})

describe('the pause after the last trick of a deal', () => {
  /** Plays the slam deal (seat 0 declares) up to its end. */
  function finishedDeal(players = BOTS): Game {
    stackDeck(SLAM_DECK)
    const game = newGame(players, { firstDealer: 2 })
    game.startMatch()
    useGreedyBots(game)
    runBots(game)
    expect(game.status).toBe('dealEnd')
    return game
  }

  it('shows the final trick for the trick delay while the summary is ready', () => {
    stackDeck(SLAM_DECK)
    const game = newGame(BOTS, { firstDealer: 2 })
    game.startMatch()
    useGreedyBots(game)
    while (game.deal!.s.played.length < 23) vi.advanceTimersToNextTimer()
    const notify = vi.fn()
    game.subscribe(notify)
    notify.mockClear()
    vi.advanceTimersToNextTimer()
    // Scored at once: status, records and the result are final.
    expect(game.deal!.isFinished).toBe(true)
    expect(game.status).toBe('dealEnd')
    expect(game.records).toHaveLength(1)
    expect(game.turn).toBe(-1)
    expect(game.showLastTrick).toBe(true)
    expect(game.deal!.s.lastTrick!.plays).toHaveLength(3)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(499)
    expect(game.showLastTrick).toBe(true)
    vi.advanceTimersByTime(1)
    expect(game.showLastTrick).toBe(false)
    expect(notify).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    expect(game.status).toBe('dealEnd')
  })

  it('never blocks the next deal, and leaves no timer behind', () => {
    const game = finishedDeal()
    vi.advanceTimersByTime(200)
    expect(game.showLastTrick).toBe(true)
    game.nextDeal()
    expect(game.status).toBe('playing')
    expect(game.dealNumber).toBe(2)
    expect(game.showLastTrick).toBe(false)
    // Only the first bot move of the new deal is pending.
    expect(vi.getTimerCount()).toBe(1)
    const notify = vi.fn()
    game.subscribe(notify)
    notify.mockClear()
    vi.advanceTimersByTime(99)
    expect(notify).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(game.history.at(-1)?.deal).toBe(2)
  })

  it('lets a human act at once in the next deal', () => {
    stackDeck(SLAM_DECK)
    const game = newGame(WITH_HUMAN, { firstDealer: 0 })
    game.startMatch()
    useGreedyBots(game)
    const human = new GreedyTestPlayer(0, seededRandom(0))
    while (game.status === 'playing') {
      if (game.turn === 0) {
        expect(game.act(0, human.choose(game.deal!.viewFor(0), game.actionsFor(0)))).toBe(
          true,
        )
      } else {
        vi.advanceTimersToNextTimer()
      }
    }
    expect(game.status).toBe('dealEnd')
    expect(game.showLastTrick).toBe(true)
    expect(game.act(0, { type: 'pass' })).toBe(false)
    game.nextDeal()
    // Dealer 1: seat 2 opens and the human speaks first.
    expect(game.turn).toBe(0)
    expect(game.showLastTrick).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    expect(game.act(0, { type: 'pass' })).toBe(true)
  })

  it('is cut short by prepare, startMatch and stopTimer', () => {
    const prepared = finishedDeal()
    prepared.prepare()
    expect(prepared.showLastTrick).toBe(false)
    expect(vi.getTimerCount()).toBe(0)

    vi.restoreAllMocks()
    const restarted = finishedDeal()
    restarted.startMatch()
    expect(restarted.showLastTrick).toBe(false)
    expect(restarted.dealNumber).toBe(1)
    expect(vi.getTimerCount()).toBe(1)
    vi.clearAllTimers()

    vi.restoreAllMocks()
    const stopped = finishedDeal()
    const notify = vi.fn()
    stopped.subscribe(notify)
    notify.mockClear()
    stopped.stopTimer()
    expect(stopped.showLastTrick).toBe(false)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    // Nothing left to stop: no further notification.
    stopped.stopTimer()
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('keeps its delay when the pace changes meanwhile', () => {
    const game = finishedDeal()
    game.setPace(50, 2000)
    vi.advanceTimersByTime(500)
    expect(game.showLastTrick).toBe(false)
  })
})

it('changes the pace from the next timer on and ignores invalid values', () => {
  const game = newGame(BOTS)
  const notify = vi.fn()
  game.subscribe(notify)
  game.startMatch()
  notify.mockClear()
  game.setPace(300, 900)
  expect(notify).toHaveBeenCalledTimes(1)
  expect([game.thinkDelay, game.trickDelay]).toEqual([300, 900])
  // The pending move keeps its delay of 100 ms; the next one waits 300 ms.
  const before = game.history.length
  vi.advanceTimersByTime(100)
  const after = game.history.length
  expect(after).toBeGreaterThan(before)
  vi.advanceTimersByTime(299)
  expect(game.history.length).toBe(after)
  vi.advanceTimersByTime(1)
  expect(game.history.length).toBeGreaterThan(after)
  game.setPace(-1, Number.NaN)
  expect([game.thinkDelay, game.trickDelay]).toEqual([300, 900])
  game.setPace(Infinity, 0)
  expect([game.thinkDelay, game.trickDelay]).toEqual([300, 0])
  expect(notify).toHaveBeenCalledTimes(5)
})

it('tells each bot the match totals before the deal when it decides', () => {
  const game = newGame(BOTS, { firstDealer: 0 })
  game.startMatch()
  useGreedyBots(game)
  const seen: string[] = []
  for (const player of game.players) {
    const choose = player.choose.bind(player)
    player.choose = (deal, actions) => {
      seen.push(player.matchScores.join())
      return choose(deal, actions)
    }
  }
  game.scores = [100, 200, 300]
  runBots(game)
  expect(seen.length).toBeGreaterThan(24)
  expect(new Set(seen)).toEqual(new Set(['100,200,300']))
  const totals = game.scores.slice()
  expect(totals).not.toEqual([100, 200, 300])
  seen.length = 0
  game.nextDeal()
  runBots(game)
  expect(new Set(seen)).toEqual(new Set([totals.join()]))
  // Each bot gets its own copy.
  game.players[1].matchScores[1] = 9999
  expect(game.scores[1]).not.toBe(9999)
  expect(game.players[2].matchScores[1]).not.toBe(9999)
})
