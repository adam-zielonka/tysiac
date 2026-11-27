import { TRICK_COUNT } from '../rules'
import {
  KING,
  MELD_VALUE,
  ORDER_OF,
  POINTS_OF,
  QUEEN,
  SUITS,
  SUIT_MASK,
  SUIT_OF,
  beatsIndex,
  bitCount,
  hasMarriage,
  legalMask,
  lowestBit,
  pointsOfMask,
} from './bits'
import type { PlayState } from './PlayState'

export interface SearchOptions {
  /** Nodes for the whole iterative deepening; the deepest finished depth wins. */
  nodeBudget: number
  /** Added for the declarer when the contract is made (0 searches pure points). */
  contractBonus: number
  /** Weight of marriages declared by the defenders against the declarer. */
  defenderMeldWeight: number
  /** Optional `performance.now()` safety limit, checked every 4096 nodes. */
  deadline?: number
  /**
   * A defending searcher also prefers its own points: the team value drops by
   * `selfWeight` per point (cards and marriages) of `self`.
   */
  self?: number
  selfWeight?: number
}

export interface SearchResult {
  /** Best card index for the player on turn. */
  card: number
  /** Value of the line from the declarer's side (points, bonus, defenders' melds). */
  value: number
  /** Completed tricks searched before the heuristic evaluation. */
  depth: number
  /** True when the search reached the end of the deal on every line. */
  exact: boolean
  nodes: number
}

const TABLE_BITS = 17
const TABLE_SIZE = 1 << TABLE_BITS

/**
 * Fixed-size transposition table in typed arrays (no garbage while
 * searching). A slot keeps the full position in three words, so a hash
 * collision simply misses. Shared by all searches; `generation` empties it.
 */
class Table {
  readonly words = new Int32Array(TABLE_SIZE * 3)
  readonly lower = new Float64Array(TABLE_SIZE)
  readonly upper = new Float64Array(TABLE_SIZE)
  readonly depth = new Int8Array(TABLE_SIZE)
  readonly move = new Int8Array(TABLE_SIZE)
  readonly stamp = new Int32Array(TABLE_SIZE)
  generation = 0

  /** Is this exact position stored in `slot` by the current search? */
  find(slot: number, a: number, b: number, c: number): boolean {
    const i = slot * 3
    return (
      this.stamp[slot] === this.generation &&
      this.words[i] === a &&
      this.words[i + 1] === b &&
      this.words[i + 2] === c
    )
  }

  store(
    slot: number,
    a: number,
    b: number,
    c: number,
    depth: number,
    lower: number,
    upper: number,
    move: number,
  ): void {
    const i = slot * 3
    this.words[i] = a
    this.words[i + 1] = b
    this.words[i + 2] = c
    this.stamp[slot] = this.generation
    this.depth[slot] = depth
    this.lower[slot] = lower
    this.upper[slot] = upper
    this.move[slot] = move
  }
}

let shared: Table | null = null

/** Depth stored for entries searched to the end of the deal. */
const EXACT = 99

/**
 * Perfect-information alpha-beta over the play: the declarer maximises,
 * both defenders minimise one team value (declarer points, a bonus for a
 * made contract, minus weighted defender marriages). Iterative deepening by
 * whole tricks under a node budget, a transposition table at trick
 * boundaries, heuristic move ordering and a static estimate at the horizon.
 */
export class AlphaBeta {
  private hands: number[]
  private trump: number
  private leader: number
  private trickNumber: number
  private trickLength: number
  /** Cards of every trick: `cards[trick * 3 + position]`. */
  private cards = new Int8Array(TRICK_COUNT * 3)
  private declarer: number
  private contract: number
  private declarerPoints: number
  private defenderMelds: number
  private nodes = 0
  private aborted = false
  private deadline: number
  private self: number
  private selfWeight: number
  private selfPoints: number
  private table: Table
  /** Position words of the last `hash()` call. */
  private wordA = 0
  private wordB = 0
  private wordC = 0

  constructor(
    st: PlayState,
    private options: SearchOptions,
  ) {
    this.hands = st.hands.slice()
    this.trump = st.trump
    this.leader = st.leader
    this.trickNumber = st.trickNumber
    this.trickLength = st.trick.length
    st.trick.forEach((card, i) => (this.cards[st.trickNumber * 3 + i] = card))
    this.declarer = st.declarer
    this.contract = st.contract
    this.declarerPoints = st.points(st.declarer)
    this.defenderMelds = st.meldPoints.reduce(
      (sum, value, player) => (player === st.declarer ? sum : sum + value),
      0,
    )
    this.deadline = options.deadline ?? Infinity
    this.self = options.self ?? -1
    this.selfWeight =
      this.self >= 0 && this.self !== st.declarer ? (options.selfWeight ?? 0) : 0
    this.selfPoints = this.self >= 0 ? st.points(this.self) : 0
    this.table = shared ??= new Table()
    this.table.generation++
  }

  run(): SearchResult {
    const remaining = TRICK_COUNT - this.trickNumber
    const moves = this.orderedMoves(-1)
    let result: SearchResult = {
      card: moves[0],
      value: this.evaluate(),
      depth: 0,
      exact: false,
      nodes: 0,
    }
    let first = moves[0]
    for (let depth = 1; depth <= remaining; depth++) {
      const [value, card] = this.root(depth, first)
      if (this.aborted) break
      first = card
      result = { card, value, depth, exact: depth === remaining, nodes: this.nodes }
    }
    result.nodes = this.nodes
    return result
  }

  private root(depth: number, first: number): [number, number] {
    const maximizing = this.turn() === this.declarer
    const moves = this.orderedMoves(first)
    let best = maximizing ? -Infinity : Infinity
    let bestCard = moves[0]
    let alpha = -Infinity
    let beta = Infinity
    for (const card of moves) {
      const value = this.child(card, depth, alpha, beta)
      if (this.aborted) return [best, bestCard]
      if (maximizing ? value > best : value < best) {
        best = value
        bestCard = card
      }
      if (maximizing) alpha = Math.max(alpha, best)
      else beta = Math.min(beta, best)
    }
    return [best, bestCard]
  }

  private turn(): number {
    return (this.leader + this.trickLength) % 3
  }

  /** Cards of the trick in progress; the winner so far. */
  private winning(): number {
    const base = this.trickNumber * 3
    let best = this.cards[base]
    if (this.trickLength > 1 && beatsIndex(this.cards[base + 1], best, this.trump)) {
      best = this.cards[base + 1]
    }
    return best
  }

  private legal(player: number): number {
    const hand = this.hands[player]
    if (!this.trickLength) return hand
    const led = SUIT_OF[this.cards[this.trickNumber * 3]]
    return legalMask(hand, led, this.winning(), this.trump)
  }

  /** Plays `card`, searches the position and takes the card back. */
  private child(card: number, depth: number, alpha: number, beta: number): number {
    const player = this.turn()
    const hand = this.hands[player]
    const trump = this.trump
    const leader = this.leader
    const declarerPoints = this.declarerPoints
    const defenderMelds = this.defenderMelds
    const selfPoints = this.selfPoints
    const trickLength = this.trickLength
    const base = this.trickNumber * 3
    if (!trickLength) {
      const order = ORDER_OF[card]
      const suit = SUIT_OF[card]
      if ((order === KING || order === QUEEN) && hasMarriage(hand, suit)) {
        this.trump = suit
        if (player === this.declarer) this.declarerPoints += MELD_VALUE[suit]
        else this.defenderMelds += MELD_VALUE[suit]
        if (player === this.self) this.selfPoints += MELD_VALUE[suit]
      }
    }
    this.hands[player] = hand & ~(1 << card)
    this.cards[base + trickLength] = card
    let value: number
    if (trickLength < 2) {
      this.trickLength = trickLength + 1
      value = this.search(depth, alpha, beta)
    } else {
      const a = this.cards[base]
      const b = this.cards[base + 1]
      let winner = 0
      let top = a
      if (beatsIndex(b, top, this.trump)) {
        winner = 1
        top = b
      }
      if (beatsIndex(card, top, this.trump)) winner = 2
      const taker = (leader + winner) % 3
      const points = POINTS_OF[a] + POINTS_OF[b] + POINTS_OF[card]
      if (taker === this.declarer) this.declarerPoints += points
      if (taker === this.self) this.selfPoints += points
      this.leader = taker
      this.trickLength = 0
      this.trickNumber++
      value = this.search(depth - 1, alpha, beta)
      this.trickNumber--
    }
    this.hands[player] = hand
    this.trump = trump
    this.leader = leader
    this.declarerPoints = declarerPoints
    this.defenderMelds = defenderMelds
    this.selfPoints = selfPoints
    this.trickLength = trickLength
    return value
  }

  private baseValue(): number {
    return (
      this.declarerPoints -
      this.options.defenderMeldWeight * this.defenderMelds -
      this.selfWeight * this.selfPoints
    )
  }

  private terminal(): number {
    const bonus = this.declarerPoints >= this.contract ? this.options.contractBonus : 0
    return this.baseValue() + bonus
  }

  /** Packs the position at a trick boundary into three words and returns its slot. */
  private hash(): number {
    const h = this.hands
    const need = this.options.contractBonus
      ? Math.max(0, this.contract - this.declarerPoints)
      : 0
    const a = h[0] | (this.leader << 24) | ((this.trump + 1) << 26)
    const b = h[1] | ((need & 0xff) << 24)
    const c = h[2] | ((need >> 8) << 24)
    this.wordA = a
    this.wordB = b
    this.wordC = c
    let x = Math.imul(a, 0x9e3779b1) ^ Math.imul(b ^ (b >>> 15), 0x85ebca6b)
    x ^= Math.imul(c ^ (c >>> 13), 0xc2b2ae35)
    x ^= x >>> 16
    return x & (TABLE_SIZE - 1)
  }

  private search(depth: number, alpha: number, beta: number): number {
    if (this.trickNumber === TRICK_COUNT) return this.terminal()
    if (++this.nodes > this.options.nodeBudget) {
      this.aborted = true
      return 0
    }
    if (!(this.nodes & 4095) && performance.now() > this.deadline) {
      this.aborted = true
      return 0
    }
    const boundary = this.trickLength === 0
    let slot = -1
    let a = 0
    let b = 0
    let c = 0
    let ttMove = -1
    const remaining = TRICK_COUNT - this.trickNumber
    if (boundary) {
      if (depth <= 0) return this.evaluate()
      slot = this.hash()
      a = this.wordA
      b = this.wordB
      c = this.wordC
      const table = this.table
      if (table.find(slot, a, b, c)) {
        ttMove = table.move[slot]
        if (table.depth[slot] >= Math.min(depth, remaining)) {
          const base = this.baseValue()
          const lower = table.lower[slot] + base
          const upper = table.upper[slot] + base
          if (lower >= beta) return lower
          if (upper <= alpha) return upper
          if (lower === upper) return lower
          if (lower > alpha) alpha = lower
          if (upper < beta) beta = upper
        }
      }
    }
    const alpha0 = alpha
    const beta0 = beta
    const maximizing = this.turn() === this.declarer
    const moves = this.orderedMoves(ttMove)
    let best = maximizing ? -Infinity : Infinity
    let bestCard = moves[0]
    for (const card of moves) {
      const value = this.child(card, depth, alpha, beta)
      if (this.aborted) return 0
      if (maximizing) {
        if (value > best) {
          best = value
          bestCard = card
        }
        if (best > alpha) alpha = best
      } else {
        if (value < best) {
          best = value
          bestCard = card
        }
        if (best < beta) beta = best
      }
      if (alpha >= beta) break
    }
    if (boundary) {
      const base = this.baseValue()
      let lower = -Infinity
      let upper = Infinity
      if (best <= alpha0) upper = best - base
      else if (best >= beta0) lower = best - base
      else lower = upper = best - base
      const stored = depth >= remaining ? EXACT : depth
      this.table.store(slot, a, b, c, stored, lower, upper, bestCard)
    }
    return best
  }

  /**
   * Static estimate at a trick boundary. Future declarer points come from a
   * least-squares fit to 1500 exactly solved positions (2 to 5 tricks played):
   * remaining points, the declarer's and defenders' unbeatable top cards,
   * trump lengths, a marriage the declarer can declare at once, who leads.
   * Re-checked under the Polish rules (overtaking, first-trick marriages):
   * RMSE 14.5 points on 1500 new positions, and a refit gains nothing.
   * The contract bonus enters as a smooth chance around the contract.
   */
  private evaluate(): number {
    const h = this.hands
    const trump = this.trump
    const declarer = this.declarer
    const all = h[0] | h[1] | h[2]
    let declarerTops = 0
    let declarerTopCount = 0
    let defenderTops = 0
    for (let suit = 0; suit < SUITS; suit++) {
      let rest = all & SUIT_MASK[suit]
      if (!rest) continue
      const top = 1 << lowestBit(rest)
      const owner = h[0] & top ? 0 : h[1] & top ? 1 : 2
      // Cards the owner can cash one after another from the top.
      while (rest && h[owner] & (rest & -rest)) {
        const card = lowestBit(rest)
        if (owner === declarer) {
          declarerTops += POINTS_OF[card]
          declarerTopCount++
        } else defenderTops += POINTS_OF[card]
        rest &= rest - 1
      }
    }
    let declarerTrumps = 0
    let defenderTrumps = 0
    if (trump >= 0) {
      declarerTrumps = bitCount(h[declarer] & SUIT_MASK[trump])
      defenderTrumps = bitCount(all & ~h[declarer] & SUIT_MASK[trump])
    }
    const leads = this.leader === declarer
    let declarerMelds = 0
    let defenderMelds = 0
    for (let player = 0; player < 3; player++) {
      let melds = 0
      for (let suit = 0; suit < SUITS; suit++) {
        if (hasMarriage(h[player], suit)) melds += MELD_VALUE[suit]
      }
      if (player === declarer) declarerMelds = melds
      else defenderMelds += melds * (player === this.leader ? 0.8 : 0.4)
    }
    const remaining = pointsOfMask(all)
    const future = Math.max(
      0,
      -9.28 +
        0.233 * remaining +
        0.843 * declarerTops -
        0.122 * defenderTops +
        4.15 * declarerTopCount +
        7.23 * declarerTrumps -
        1.05 * defenderTrumps +
        (leads ? 1.03 * declarerMelds + 14.6 : 0) -
        2.47 * (TRICK_COUNT - this.trickNumber),
    )
    const expected = this.declarerPoints + future
    let value =
      expected - this.options.defenderMeldWeight * (this.defenderMelds + defenderMelds)
    if (this.selfWeight) {
      const share = Math.max(0, remaining - future) / 2
      value -= this.selfWeight * (this.selfPoints + share)
    }
    if (this.options.contractBonus) {
      const chance =
        this.declarerPoints >= this.contract
          ? 1
          : Math.min(1, Math.max(0, 0.5 + (expected - this.contract) / 40))
      value += this.options.contractBonus * chance
    }
    return value
  }

  /** Legal cards of the player on turn, the most promising first. */
  private orderedMoves(first: number): number[] {
    const player = this.turn()
    const legal = this.legal(player)
    const moves: number[] = []
    const scores: number[] = []
    const others = (this.hands[0] | this.hands[1] | this.hands[2]) & ~this.hands[player]
    const isDeclarer = player === this.declarer
    const trump = this.trump
    let winning = -1
    let winnerIsPartner = false
    if (this.trickLength) {
      const base = this.trickNumber * 3
      let index = 0
      for (let i = 1; i < this.trickLength; i++) {
        if (beatsIndex(this.cards[base + i], this.cards[base + index], trump)) index = i
      }
      winning = this.cards[base + index]
      const winner = (this.leader + index) % 3
      winnerIsPartner = !isDeclarer && winner !== this.declarer
    }
    for (let bits = legal; bits; bits &= bits - 1) {
      const card = lowestBit(bits)
      const points = POINTS_OF[card]
      let score: number
      if (card === first) score = 10000
      else if (winning < 0) {
        const order = ORDER_OF[card]
        const suit = SUIT_OF[card]
        const top = !(others & SUIT_MASK[suit] & ((1 << card) - 1))
        if (
          (order === KING || order === QUEEN) &&
          hasMarriage(this.hands[player], suit)
        ) {
          score = 1000 + MELD_VALUE[suit]
        } else if (top) score = 500 + points + (suit === trump ? 30 : 0)
        else score = 100 - points * 2 - (suit === trump ? 20 : 0)
      } else if (beatsIndex(card, winning, trump)) {
        score = (winnerIsPartner ? 300 : 600) + points - (SUIT_OF[card] === trump ? 5 : 0)
      } else if (winnerIsPartner) score = 400 + points
      else score = 100 - points * 2
      let i = moves.length
      moves.push(card)
      scores.push(score)
      while (i > 0 && scores[i - 1] < score) {
        moves[i] = moves[i - 1]
        scores[i] = scores[i - 1]
        i--
      }
      moves[i] = card
      scores[i] = score
    }
    return moves
  }
}
