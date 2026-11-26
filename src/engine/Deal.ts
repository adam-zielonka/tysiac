import { ALL_CARDS, Card, Color, cardById } from './Card'
import { Deck } from './Deck'
import {
  HAND_SIZE,
  MARRIAGE_POINTS,
  MUSIK_SIZE,
  OPENING_BID,
  PLAYER_COUNT,
  TRICK_COUNT,
  bidRange,
  BID_STEP,
  cardPoints,
  isMeldLead,
  legalPlays,
  maxBidFor,
  nextSeat,
  roundScore,
  trickWinnerIndex,
} from './rules'

export type Phase = 'bidding' | 'musik' | 'giving' | 'contract' | 'play' | 'finished'

export interface Play {
  player: number
  card: Card
}

export interface Meld {
  player: number
  color: Color
  points: number
  /** Zero-based trick in which the marriage was declared. */
  trick: number
}

export interface Gift {
  to: number
  card: Card
}

export type Bid = number | 'pass' | null

export type Action =
  | { type: 'bid'; value: number }
  | { type: 'pass' }
  | { type: 'take' }
  | { type: 'give'; card: Card; to: number }
  | { type: 'contract'; value: number }
  | { type: 'play'; card: Card }

export type DealEvent =
  | { type: 'bid'; player: number; value: number }
  | { type: 'pass'; player: number }
  | { type: 'bidWon'; player: number; value: number }
  | { type: 'take'; player: number; cards: Card[] }
  | { type: 'give'; player: number; to: number; card: Card }
  | { type: 'contract'; player: number; value: number }
  | { type: 'play'; player: number; card: Card }
  | { type: 'meld'; player: number; color: Color; points: number }
  | { type: 'trick'; player: number; points: number; plays: Play[] }
  | { type: 'finished'; result: DealResult }

export interface DealResult {
  declarer: number
  contract: number
  made: boolean
  cardPoints: number[]
  meldPoints: number[]
  /** Card points plus declared marriages. */
  points: number[]
  /** Score change written for each player. */
  deltas: number[]
}

export interface DealState {
  dealer: number
  phase: Phase
  turn: number
  hands: Card[][]
  /** Remaining talon cards (empty after the declarer takes them). */
  musik: Card[]
  /** Musik as revealed to everyone after the auction (empty before). */
  musikCards: Card[]
  bids: Bid[]
  passed: boolean[]
  highestBid: number
  highestBidder: number
  declarer: number
  contract: number
  gifts: Gift[]
  trump: Color | null
  trick: Play[]
  lastTrick: { plays: Play[]; winner: number } | null
  trickNumber: number
  leader: number
  taken: Card[][]
  tricksWon: number[]
  melds: Meld[]
  /** Every card played this deal, in order, including the current trick. */
  played: Play[]
  /** Public inference: `voids[player][color]` after failing to follow or trump. */
  voids: boolean[][]
  /** Publicly known holders, e.g. the partner of a declared marriage. */
  knownHolders: Record<string, number>
  /** `null` for the full deal, otherwise the seat this view belongs to. */
  viewer: number | null
  /** Hand sizes of hidden hands in a view; `null` in the full deal. */
  hiddenCounts: number[] | null
  musikCount: number
}

export function actionKey(action: Action): string {
  switch (action.type) {
    case 'bid':
    case 'contract':
      return `${action.type}:${action.value}`
    case 'give':
      return `give:${action.card?.id}:${action.to}`
    case 'play':
      return `play:${action.card?.id}`
    default:
      return action.type
  }
}

export function sameAction(a: Action, b: Action): boolean {
  return actionKey(a) === actionKey(b)
}

function emptyVoids(): boolean[][] {
  return Array.from({ length: PLAYER_COUNT }, () => [false, false, false, false, false])
}

/**
 * One deal of Tysiąc from the auction to scoring. Pure state machine without
 * timers, so bots can clone and simulate it freely.
 */
export class Deal {
  constructor(public s: DealState) {}

  static deal(dealer: number, cards: Card[] = Deck.shuffle(Deck.generate())): Deal {
    if (!Number.isInteger(dealer) || dealer < 0 || dealer >= PLAYER_COUNT) {
      throw new Error(`Invalid dealer seat: ${dealer}`)
    }
    if (cards.length !== PLAYER_COUNT * HAND_SIZE + MUSIK_SIZE) {
      throw new Error('A Tysiąc deck has 24 cards')
    }
    // Engine code compares cards by identity, so map to the shared instances.
    const deck: Card[] = []
    for (const value of cards) {
      const shared = value && cardById(value.id)
      if (shared) deck.push(shared)
    }
    if (new Set(deck).size !== ALL_CARDS.length) {
      throw new Error('A Tysiąc deck has each of the 24 cards exactly once')
    }
    const hands = Array.from({ length: PLAYER_COUNT }, (_, i) =>
      Card.sortHand(deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE)),
    )
    const opener = nextSeat(dealer)
    const bids: Bid[] = [null, null, null]
    bids[opener] = OPENING_BID
    return new Deal({
      dealer,
      phase: 'bidding',
      turn: nextSeat(opener),
      hands,
      musik: deck.slice(PLAYER_COUNT * HAND_SIZE),
      musikCards: [],
      bids,
      passed: [false, false, false],
      highestBid: OPENING_BID,
      highestBidder: opener,
      declarer: -1,
      contract: 0,
      gifts: [],
      trump: null,
      trick: [],
      lastTrick: null,
      trickNumber: 0,
      leader: -1,
      taken: [[], [], []],
      tricksWon: [0, 0, 0],
      melds: [],
      played: [],
      voids: emptyVoids(),
      knownHolders: {},
      viewer: null,
      hiddenCounts: null,
      musikCount: MUSIK_SIZE,
    })
  }

  clone(): Deal {
    const s = this.s
    return new Deal({
      ...s,
      hands: s.hands.map(hand => hand.slice()),
      musik: s.musik.slice(),
      musikCards: s.musikCards.slice(),
      bids: s.bids.slice(),
      passed: s.passed.slice(),
      gifts: s.gifts.slice(),
      trick: s.trick.slice(),
      lastTrick: s.lastTrick,
      taken: s.taken.map(cards => cards.slice()),
      tricksWon: s.tricksWon.slice(),
      melds: s.melds.slice(),
      played: s.played.slice(),
      voids: s.voids.map(row => row.slice()),
      knownHolders: { ...s.knownHolders },
      hiddenCounts: s.hiddenCounts ? s.hiddenCounts.slice() : null,
    })
  }

  get phase(): Phase {
    return this.s.phase
  }

  get turn(): number {
    return this.s.turn
  }

  get dealer(): number {
    return this.s.dealer
  }

  get opener(): number {
    return nextSeat(this.s.dealer)
  }

  get declarer(): number {
    return this.s.declarer
  }

  get contract(): number {
    return this.s.contract
  }

  get trump(): Color | null {
    return this.s.trump
  }

  get trick(): readonly Play[] {
    return this.s.trick
  }

  get trickNumber(): number {
    return this.s.trickNumber
  }

  get isFinished(): boolean {
    return this.s.phase === 'finished'
  }

  get isView(): boolean {
    return this.s.viewer !== null
  }

  /** Cards of a player, or an empty array when hidden in this view. */
  hand(player: number): readonly Card[] {
    return this.s.hands[player]
  }

  isHidden(player: number): boolean {
    return this.s.viewer !== null && player !== this.s.viewer
  }

  handCount(player: number): number {
    if (this.isHidden(player) && this.s.hiddenCounts) return this.s.hiddenCounts[player]
    return this.s.hands[player].length
  }

  /** True once the musik is face up for everyone. */
  get isMusikRevealed(): boolean {
    return this.s.musikCards.length > 0
  }

  cardPointsOf(player: number): number {
    return cardPoints(this.s.taken[player])
  }

  meldPointsOf(player: number): number {
    return this.s.melds
      .filter(meld => meld.player === player)
      .reduce((sum, meld) => sum + meld.points, 0)
  }

  pointsOf(player: number): number {
    return this.cardPointsOf(player) + this.meldPointsOf(player)
  }

  /** Bid limit for a visible hand during the auction or contract choice. */
  maxBid(player: number): number {
    return maxBidFor(this.s.hands[player])
  }

  /** Cards the current player may play now. */
  playableCards(): Card[] {
    if (this.s.phase !== 'play' || this.isHidden(this.s.turn)) return []
    return legalPlays(
      this.s.hands[this.s.turn],
      this.s.trick.map(play => play.card),
      this.s.trump,
    )
  }

  /** Does playing this card now declare a marriage? */
  isMeld(card: Card): boolean {
    const s = this.s
    return (
      s.phase === 'play' &&
      !this.isHidden(s.turn) &&
      isMeldLead(s.hands[s.turn], card, s.trickNumber, s.trick.length === 0)
    )
  }

  /** Recipients still waiting for a card from the declarer, in seat order. */
  pendingRecipients(): number[] {
    if (this.s.phase !== 'giving') return []
    const given = new Set(this.s.gifts.map(gift => gift.to))
    return [nextSeat(this.s.declarer), nextSeat(this.s.declarer, 2)].filter(
      seat => !given.has(seat),
    )
  }

  contractOptions(): number[] {
    if (this.s.phase !== 'contract' || this.isHidden(this.s.declarer)) return []
    const limit = Math.max(this.s.highestBid, this.maxBid(this.s.declarer))
    return bidRange(this.s.highestBid, limit)
  }

  bidOptions(): number[] {
    if (this.s.phase !== 'bidding' || this.isHidden(this.s.turn)) return []
    return bidRange(this.s.highestBid + BID_STEP, this.maxBid(this.s.turn))
  }

  /** Legal actions of the player whose turn it is (empty for a hidden hand). */
  legalActions(): Action[] {
    const s = this.s
    if (this.isHidden(s.turn)) return []
    switch (s.phase) {
      case 'bidding':
        return [
          { type: 'pass' },
          ...this.bidOptions().map(value => ({ type: 'bid' as const, value })),
        ]
      case 'musik':
        return [{ type: 'take' }]
      case 'giving': {
        const recipients = this.pendingRecipients()
        return s.hands[s.declarer].flatMap(card =>
          recipients.map(to => ({ type: 'give' as const, card, to })),
        )
      }
      case 'contract':
        return this.contractOptions().map(value => ({ type: 'contract' as const, value }))
      case 'play':
        return this.playableCards().map(card => ({ type: 'play' as const, card }))
      default:
        return []
    }
  }

  isLegal(action: Action): boolean {
    return this.findLegal(action) !== undefined
  }

  /** The matching legal action (with the shared card instance), if any. */
  private findLegal(action: Action): Action | undefined {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      return undefined
    }
    const key = actionKey(action)
    return this.legalActions().find(legal => actionKey(legal) === key)
  }

  /** Applies a legal action for the current player and returns what happened. */
  apply(requested: Action): DealEvent[] {
    if (this.isView) throw new Error('Cannot apply actions to a player view')
    // Cards are matched by id; continue with the engine's own card instance.
    const action = this.findLegal(requested)
    if (!action) {
      const key =
        requested && typeof requested === 'object' ? actionKey(requested) : requested
      throw new Error(`Illegal action ${String(key)} in phase ${this.s.phase}`)
    }
    const s = this.s
    const player = s.turn
    switch (action.type) {
      case 'bid':
        s.bids[player] = action.value
        s.highestBid = action.value
        s.highestBidder = player
        return [
          { type: 'bid', player, value: action.value },
          ...this.advanceAuction(player),
        ]
      case 'pass':
        s.bids[player] = 'pass'
        s.passed[player] = true
        return [{ type: 'pass', player }, ...this.advanceAuction(player)]
      case 'take': {
        const taken = s.musik
        s.hands[player] = Card.sortHand([...s.hands[player], ...taken])
        s.musik = []
        s.musikCount = 0
        if (s.hiddenCounts) s.hiddenCounts[player] += taken.length
        s.phase = 'giving'
        return [{ type: 'take', player, cards: taken }]
      }
      case 'give': {
        const hand = s.hands[player]
        hand.splice(hand.indexOf(action.card), 1)
        s.hands[action.to] = Card.sortHand([...s.hands[action.to], action.card])
        s.gifts.push({ to: action.to, card: action.card })
        if (s.gifts.length === PLAYER_COUNT - 1) s.phase = 'contract'
        return [{ type: 'give', player, to: action.to, card: action.card }]
      }
      case 'contract':
        s.contract = action.value
        s.phase = 'play'
        s.leader = player
        return [{ type: 'contract', player, value: action.value }]
      case 'play':
        return this.playCard(player, action.card)
    }
  }

  private advanceAuction(player: number): DealEvent[] {
    const s = this.s
    const active = [0, 1, 2].filter(seat => !s.passed[seat])
    if (active.length === 1) {
      s.declarer = active[0]
      s.contract = s.highestBid
      s.phase = 'musik'
      s.musikCards = s.musik.slice()
      s.turn = s.declarer
      return [{ type: 'bidWon', player: s.declarer, value: s.highestBid }]
    }
    let next = nextSeat(player)
    while (s.passed[next]) next = nextSeat(next)
    s.turn = next
    return []
  }

  private playCard(player: number, card: Card): DealEvent[] {
    const s = this.s
    const events: DealEvent[] = []
    const hand = s.hands[player]
    if (isMeldLead(hand, card, s.trickNumber, s.trick.length === 0)) {
      const points = MARRIAGE_POINTS[card.color]
      s.trump = card.color
      s.melds.push({ player, color: card.color, points, trick: s.trickNumber })
      s.knownHolders[card.marriagePartner!.id] = player
      events.push({ type: 'meld', player, color: card.color, points })
    }
    if (s.trick.length) {
      const led = s.trick[0].card.color
      if (card.color !== led) {
        s.voids[player][led] = true
        if (s.trump !== null && s.trump !== led && card.color !== s.trump) {
          s.voids[player][s.trump] = true
        }
      }
    }
    hand.splice(hand.indexOf(card), 1)
    delete s.knownHolders[card.id]
    const play = { player, card }
    s.trick.push(play)
    s.played.push(play)
    events.unshift({ type: 'play', player, card })

    if (s.trick.length < PLAYER_COUNT) {
      s.turn = nextSeat(player)
      return events
    }

    const plays = s.trick
    const cards = plays.map(p => p.card)
    const winner = plays[trickWinnerIndex(cards, s.trump)].player
    s.taken[winner].push(...cards)
    s.tricksWon[winner]++
    s.lastTrick = { plays, winner }
    s.trick = []
    s.trickNumber++
    s.leader = winner
    s.turn = winner
    events.push({
      type: 'trick',
      player: winner,
      points: cardPoints(cards),
      plays,
    })

    if (s.trickNumber === TRICK_COUNT) {
      s.phase = 'finished'
      events.push({ type: 'finished', result: this.result()! })
    }
    return events
  }

  result(): DealResult | null {
    if (this.s.phase !== 'finished') return null
    const declarer = this.s.declarer
    const contract = this.s.contract
    const cardPointsList = [0, 1, 2].map(p => this.cardPointsOf(p))
    const meldPoints = [0, 1, 2].map(p => this.meldPointsOf(p))
    const points = cardPointsList.map((value, p) => value + meldPoints[p])
    const made = points[declarer] >= contract
    const deltas = points.map((value, p) =>
      p === declarer ? (made ? contract : -contract) : roundScore(value),
    )
    return {
      declarer,
      contract,
      made,
      cardPoints: cardPointsList,
      meldPoints,
      points,
      deltas,
    }
  }

  /**
   * What `seat` legitimately knows: its own hand and public information.
   * Hidden hands are emptied and replaced by their sizes; the musik stays
   * hidden until it is revealed after the auction.
   */
  viewFor(seat: number): Deal {
    const view = this.clone()
    const s = view.s
    s.hiddenCounts = s.hands.map((_, player) => this.handCount(player))
    s.hands = s.hands.map((hand, player) => (player === seat ? hand : []))
    s.musikCount = s.musik.length
    if (!this.isMusikRevealed) s.musik = []
    if (seat !== s.declarer) s.gifts = s.gifts.filter(gift => gift.to === seat)
    s.viewer = seat
    return view
  }
}
