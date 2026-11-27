import type { Color } from './Card'
import { Deal, type Action, type DealEvent, type DealResult } from './Deal'
import { Deck } from './Deck'
import type { Player } from './Player'
import { createPlayer, DEFAULT_PLAYERS } from './PlayersSelect'
import { PlayerType } from './PlayerType'
import { LOCK_SCORE, PLAYER_COUNT, TARGET_SCORE, nextSeat } from './rules'
import type { Random } from './random'
import { SubscribableStore } from './utils'

export type MatchStatus = 'setup' | 'playing' | 'dealEnd' | 'gameOver'

type EntryBase = { id: number; deal: number; player: number }
export type HistoryEntry = EntryBase &
  (
    | { kind: 'deal' }
    | { kind: 'opening'; value: number }
    | { kind: 'bid'; value: number }
    | { kind: 'pass' }
    | { kind: 'bidWon'; value: number }
    | { kind: 'take'; cards: string[] }
    | { kind: 'give'; to: number }
    | { kind: 'contract'; value: number }
    | { kind: 'play'; card: string }
    | { kind: 'meld'; color: Color; value: number }
    | { kind: 'trick'; value: number }
    | { kind: 'result'; value: number; contract: number; made: boolean }
  )

export interface DealRecord {
  number: number
  dealer: number
  declarer: number
  contract: number
  made: boolean
  points: number[]
  /** Score changes actually written (0 for a locked defender). */
  deltas: number[]
  /** Defenders at 800+ before the deal: their points were not counted. */
  locked: boolean[]
  totals: number[]
}

export interface GameOptions {
  autoStart?: boolean
  random?: Random
  players?: readonly PlayerType[]
  firstDealer?: number
  thinkDelay?: number
  trickDelay?: number
}

const HISTORY_LIMIT = 80

/**
 * A match to 1000 points: seats, scores and the current deal. Bot moves are
 * scheduled with timers; the deal itself stays a pure state machine.
 */
export class Game extends SubscribableStore {
  playersSelect: PlayerType[]
  players: Player[]
  deal: Deal | null = null
  status: MatchStatus = 'setup'
  scores: number[] = [0, 0, 0]
  records: DealRecord[] = []
  history: HistoryEntry[] = []
  dealNumber = 0
  firstDealer: number
  winners: number[] = []
  /** Delay before a bot move, in milliseconds. */
  thinkDelay = 650
  /** How long a completed trick stays on the table. */
  trickDelay = 1100
  /** True while the last completed trick is still shown in the centre. */
  showLastTrick = false
  readonly target = TARGET_SCORE
  readonly lockScore = LOCK_SCORE

  private random: Random
  private timeout: ReturnType<typeof setTimeout> | undefined
  private entryId = 0

  constructor(options: GameOptions = {}) {
    super()
    this.random = options.random ?? Math.random
    this.firstDealer = options.firstDealer ?? 0
    if (options.thinkDelay !== undefined) this.thinkDelay = options.thinkDelay
    if (options.trickDelay !== undefined) this.trickDelay = options.trickDelay
    this.playersSelect = [...(options.players ?? DEFAULT_PLAYERS)]
    this.players = this.createPlayers()
    if (options.autoStart) this.startMatch()
  }

  get isSetup(): boolean {
    return this.status === 'setup'
  }

  /** Seat currently expected to act, or -1. */
  get turn(): number {
    return this.status === 'playing' && this.deal ? this.deal.turn : -1
  }

  get leader(): number {
    const best = Math.max(...this.scores)
    return this.scores.indexOf(best)
  }

  /** Seats at 800+ that currently score only as the declarer. */
  get lockedSeats(): boolean[] {
    return this.scores.map(score => score >= this.lockScore)
  }

  /**
   * Sets the bot thinking delay and how long a completed trick stays on the
   * table (milliseconds; invalid values are ignored). A pending move or pause
   * keeps its delay; the new pace applies from the next one.
   */
  setPace(thinkDelay: number, trickDelay: number): void {
    if (Number.isFinite(thinkDelay) && thinkDelay >= 0) this.thinkDelay = thinkDelay
    if (Number.isFinite(trickDelay) && trickDelay >= 0) this.trickDelay = trickDelay
    this.notify()
  }

  /** Only seat 0 may be a human; it may also be a bot to watch the game. */
  setPlayer(seat: number, type: PlayerType): boolean {
    if (this.status !== 'setup' || seat < 0 || seat >= PLAYER_COUNT) return false
    if (seat !== 0 && type === PlayerType.Human) return false
    this.playersSelect[seat] = type
    this.players = this.createPlayers()
    this.notify()
    return true
  }

  startMatch(): void {
    this.clearTimer()
    this.scores = [0, 0, 0]
    this.records = []
    this.history = []
    this.winners = []
    this.dealNumber = 0
    this.players = this.createPlayers()
    this.startDeal(this.firstDealer)
  }

  /** Abandons the match and returns to choosing players. */
  prepare(): void {
    this.clearTimer()
    this.status = 'setup'
    this.deal = null
    this.scores = [0, 0, 0]
    this.records = []
    this.history = []
    this.winners = []
    this.dealNumber = 0
    this.showLastTrick = false
    this.notify()
  }

  nextDeal(): void {
    if (this.status !== 'dealEnd' || !this.deal) return
    this.startDeal(nextSeat(this.deal.dealer))
  }

  /** Legal actions for `seat`, empty when it is not that seat's turn. */
  actionsFor(seat: number): Action[] {
    if (this.status !== 'playing' || !this.deal || this.deal.turn !== seat) return []
    return this.deal.legalActions()
  }

  /** Interface entry point for the human seat. */
  act(seat: number, action: Action): boolean {
    if (this.status !== 'playing' || !this.deal || this.deal.turn !== seat) return false
    if (!this.players[seat].isHuman) return false
    return this.perform(action)
  }

  /**
   * Stops pending bot moves (used by tests and when leaving the page). The
   * pause that shows the final trick of a deal ends at once: nothing else
   * would end it.
   */
  stopTimer(): void {
    this.clearTimer()
    if (this.showLastTrick && this.status !== 'playing') {
      this.showLastTrick = false
      this.notify()
    }
  }

  private clearTimer(): void {
    if (this.timeout !== undefined) clearTimeout(this.timeout)
    this.timeout = undefined
  }

  private createPlayers(): Player[] {
    return this.playersSelect.map((type, seat) => createPlayer(type, seat, this.random))
  }

  private startDeal(dealer: number): void {
    this.clearTimer()
    this.dealNumber++
    this.deal = Deal.deal(dealer, Deck.shuffle(Deck.generate(), this.random))
    this.status = 'playing'
    this.showLastTrick = false
    this.log({ kind: 'deal', player: dealer })
    this.log({ kind: 'opening', player: this.deal.opener, value: this.deal.s.highestBid })
    this.notify()
    this.schedule()
  }

  private perform(action: Action): boolean {
    const deal = this.deal
    if (!deal || !deal.isLegal(action)) return false
    this.clearTimer()
    this.showLastTrick = false
    const events = deal.apply(action)
    events.forEach(event => this.record(event))
    const result = deal.result()
    if (result) {
      // finishDeal starts the only timer left: the pause that hides the final
      // trick. Nothing else is scheduled until the next deal.
      this.finishDeal(result)
      this.notify()
      return true
    }
    if (events.some(event => event.type === 'trick')) this.showLastTrick = true
    this.notify()
    this.schedule()
    return true
  }

  private schedule(): void {
    this.clearTimer()
    const deal = this.deal
    if (this.status !== 'playing' || !deal) return
    const seat = deal.turn
    const player = this.players[seat]
    const pause = this.showLastTrick || deal.phase === 'musik'
    if (player.isHuman) {
      if (this.showLastTrick) {
        this.timeout = setTimeout(() => {
          this.timeout = undefined
          this.showLastTrick = false
          this.notify()
        }, this.trickDelay)
      }
      return
    }
    const delay = pause ? Math.max(this.thinkDelay, this.trickDelay) : this.thinkDelay
    this.timeout = setTimeout(() => this.botMove(seat), delay)
  }

  private botMove(seat: number): void {
    const deal = this.deal
    if (!deal || this.status !== 'playing' || deal.turn !== seat) return
    const player = this.players[seat]
    const actions = deal.legalActions()
    let action: Action = actions[0]
    player.matchScores = this.scores.slice()
    try {
      const view = player.omniscient ? deal.clone() : deal.viewFor(seat)
      action = player.choose(view, actions)
    } catch (error) {
      console.error(error)
    }
    if (!deal.isLegal(action)) action = actions[0]
    this.perform(action)
  }

  /**
   * Writes the deal. Defenders who had 800+ before it score nothing; the
   * declarer always scores ± the contract. If anyone reaches 1000, the match
   * ends: the declarer wins if they reached it, otherwise the highest total
   * (equal totals share the win).
   */
  private finishDeal(result: DealResult): void {
    const deal = this.deal!
    const locked = this.scores.map(
      (score, seat) => seat !== result.declarer && score >= this.lockScore,
    )
    const deltas = result.deltas.map((delta, seat) => (locked[seat] ? 0 : delta))
    this.scores = this.scores.map((score, seat) => score + deltas[seat])
    this.records = [
      ...this.records,
      {
        number: this.dealNumber,
        dealer: deal.dealer,
        declarer: result.declarer,
        contract: result.contract,
        made: result.made,
        points: result.points,
        deltas,
        locked,
        totals: this.scores.slice(),
      },
    ]
    this.log({
      kind: 'result',
      player: result.declarer,
      value: deltas[result.declarer],
      contract: result.contract,
      made: result.made,
    })
    if (this.scores.some(score => score >= this.target)) {
      if (this.scores[result.declarer] >= this.target) {
        this.winners = [result.declarer]
      } else {
        const best = Math.max(...this.scores)
        this.winners = [0, 1, 2].filter(seat => this.scores[seat] === best)
      }
      this.status = 'gameOver'
    } else {
      this.status = 'dealEnd'
    }
    // Keep the final trick on the table for a moment before the summary
    // (status is already final, so nextDeal or prepare may cut it short).
    this.showLastTrick = true
    this.timeout = setTimeout(() => {
      this.timeout = undefined
      this.showLastTrick = false
      this.notify()
    }, this.trickDelay)
  }

  private record(event: DealEvent): void {
    switch (event.type) {
      case 'bid':
      case 'bidWon':
      case 'contract':
        this.log({ kind: event.type, player: event.player, value: event.value })
        break
      case 'pass':
        this.log({ kind: 'pass', player: event.player })
        break
      case 'take':
        this.log({
          kind: 'take',
          player: event.player,
          cards: event.cards.map(c => c.id),
        })
        break
      case 'give':
        this.log({ kind: 'give', player: event.player, to: event.to })
        break
      case 'play':
        this.log({ kind: 'play', player: event.player, card: event.card.id })
        break
      case 'meld':
        this.log({
          kind: 'meld',
          player: event.player,
          color: event.color,
          value: event.points,
        })
        break
      case 'trick':
        this.log({ kind: 'trick', player: event.player, value: event.points })
        break
    }
  }

  private log(entry: DistributiveOmit<HistoryEntry, 'id' | 'deal'>): void {
    const full = { ...entry, id: ++this.entryId, deal: this.dealNumber } as HistoryEntry
    this.history = [...this.history.slice(-(HISTORY_LIMIT - 1)), full]
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
