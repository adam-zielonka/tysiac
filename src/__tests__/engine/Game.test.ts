import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cards } from '../../engine/Card'
import { Deal, type Action } from '../../engine/Deal'
import { Deck } from '../../engine/Deck'
import { Game, type HistoryEntry } from '../../engine/Game'
import type { Player } from '../../engine/Player'
import { DEFAULT_PLAYERS, createPlayer } from '../../engine/PlayersSelect'
import { PlayerType } from '../../engine/PlayerType'
import { seededRandom } from '../../engine/random'
import { GreedyTestPlayer } from './helpers'

const BOTS = [PlayerType.Random, PlayerType.Random, PlayerType.Random]
const WITH_HUMAN = [PlayerType.Human, PlayerType.Random, PlayerType.Random]

/** Seat 0 holds K♥ Q♥ and the aces; the musik is Q♦ J♦ 9♦. */
const SLAM_DECK = cards(
  'A♥ 10♥ K♥ Q♥ A♠ 10♠ A♦ J♥ 9♥ K♠ Q♠ J♠ 9♠ 10♦ A♣ 10♣ K♣ Q♣ J♣ 9♣ K♦ Q♦ J♦ 9♦',
)

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

function stackDeck(deck: readonly ReturnType<typeof cards>[number][]): void {
  vi.spyOn(Deck, 'shuffle').mockImplementation(() => [...deck])
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
  expect(vi.getTimerCount()).toBe(0)
  expect(game.turn).toBe(-1)
  expect(game.showLastTrick).toBe(false)
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

it('plays a whole match to 1000 and declares the winners', () => {
  const game = newGame(BOTS, { firstDealer: 1 })
  game.startMatch()
  useGreedyBots(game)
  playMatch(game)
  expect(game.status).toBe('gameOver')
  expect(vi.getTimerCount()).toBe(0)
  const best = Math.max(...game.scores)
  expect(best).toBeGreaterThanOrEqual(1000)
  expect(game.winners).toEqual([0, 1, 2].filter(seat => game.scores[seat] === best))
  expect(game.leader).toBe(game.scores.indexOf(best))
  expect(game.records).toHaveLength(game.dealNumber)
  const totals = [0, 0, 0]
  game.records.forEach((record, index) => {
    expect(record.number).toBe(index + 1)
    expect(record.dealer).toBe((1 + index) % 3)
    record.deltas.forEach((delta, seat) => (totals[seat] += delta))
    expect(record.totals).toEqual(totals)
    // Only the last deal reaches the target.
    if (index < game.records.length - 1)
      expect(Math.max(...record.totals)).toBeLessThan(1000)
  })
  expect(game.scores).toEqual(totals)
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

it('shares the win between players tied on the highest total', () => {
  stackDeck(SLAM_DECK)
  // Replay the deal with the same deterministic players to learn the deltas.
  const replay = Deal.deal(0, [...SLAM_DECK])
  const players = [0, 1, 2].map(seat => new GreedyTestPlayer(seat, seededRandom(seat)))
  while (!replay.isFinished) {
    replay.apply(
      players[replay.turn].choose(replay.viewFor(replay.turn), replay.legalActions()),
    )
  }
  const deltas = replay.result()!.deltas

  const game = newGame(BOTS, { firstDealer: 0 })
  game.startMatch()
  useGreedyBots(game)
  const final = [1000, 700, 1000]
  game.scores = final.map((score, seat) => score - deltas[seat])
  runBots(game)
  expect(game.scores).toEqual(final)
  expect(game.status).toBe('gameOver')
  expect(game.winners).toEqual([0, 2])
})

it('ends the match with the highest total even if another player passed 1000', () => {
  stackDeck(SLAM_DECK)
  const game = newGame(BOTS, { firstDealer: 0 })
  game.startMatch()
  useGreedyBots(game)
  game.scores = [1500, 990, 990]
  runBots(game)
  expect(game.status).toBe('gameOver')
  expect(game.winners).toEqual([0])
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
