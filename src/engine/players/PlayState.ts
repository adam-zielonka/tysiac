import type { Deal } from '../Deal'
import { PLAYER_COUNT, TRICK_COUNT, roundScore } from '../rules'
import {
  KING,
  MELD_VALUE,
  ORDER_OF,
  POINTS_OF,
  QUEEN,
  SUIT_MASK,
  SUIT_OF,
  beatsIndex,
  cardIndex,
  hasMarriage,
  inferred,
  legalMask,
  maskOf,
  suitOfColor,
} from './bits'

/**
 * The play phase of a deal on card bitmasks: the same rules as `Deal`
 * (follow suit and overtake, a winning trump when void, marriages in any
 * trick, trump changes) and the same public inference, but cheap to copy,
 * so searches can play thousands of deals. Hidden hands of a view are simply
 * empty masks.
 */
export class PlayState {
  constructor(
    public hands: number[],
    public declarer: number,
    public contract: number,
    public leader: number,
    public trump = -1,
    public trickNumber = 0,
    /** Card indices of the current trick in play order. */
    public trick: number[] = [],
    public cardPoints: number[] = [0, 0, 0],
    public meldPoints: number[] = [0, 0, 0],
    /** Every card already played, including the current trick. */
    public played = 0,
    /** Suits a player is known to lack, one bit per suit. */
    public voids: number[] = [0, 0, 0],
    /** Cards a player provably lacks, like `DealState.excluded`. */
    public excluded: number[] = [0, 0, 0],
  ) {}

  /** Play phase of a full deal or a view (hidden hands become empty). */
  static fromDeal(deal: Deal): PlayState {
    const s = deal.s
    const inPlay = s.phase === 'play' || s.phase === 'finished'
    return new PlayState(
      s.hands.map(hand => maskOf(hand)),
      s.declarer,
      s.contract,
      inPlay ? s.leader : s.declarer,
      s.trump === null ? -1 : suitOfColor(s.trump),
      s.trickNumber,
      s.trick.map(play => cardIndex(play.card)),
      [0, 1, 2].map(player => deal.cardPointsOf(player)),
      [0, 1, 2].map(player => deal.meldPointsOf(player)),
      maskOf(s.played.map(play => play.card)),
      s.voids.map(row =>
        row.reduce(
          (bits, isVoid, color) => (isVoid ? bits | (1 << (color - 1)) : bits),
          0,
        ),
      ),
      s.excluded.slice(),
    )
  }

  clone(): PlayState {
    return new PlayState(
      this.hands.slice(),
      this.declarer,
      this.contract,
      this.leader,
      this.trump,
      this.trickNumber,
      this.trick.slice(),
      this.cardPoints.slice(),
      this.meldPoints.slice(),
      this.played,
      this.voids.slice(),
      this.excluded.slice(),
    )
  }

  get turn(): number {
    return (this.leader + this.trick.length) % PLAYER_COUNT
  }

  get isFinished(): boolean {
    return this.trickNumber >= TRICK_COUNT
  }

  points(player: number): number {
    return this.cardPoints[player] + this.meldPoints[player]
  }

  /** Card index currently winning the trick (the trick must not be empty). */
  winning(): number {
    const trick = this.trick
    let best = trick[0]
    for (let i = 1; i < trick.length; i++) {
      if (beatsIndex(trick[i], best, this.trump)) best = trick[i]
    }
    return best
  }

  /**
   * Legal cards of the player on turn as a mask: the led suit, and a card of
   * it that beats the trick when there is one; when void, a trump that wins
   * the trick if held; otherwise anything.
   */
  legal(): number {
    const hand = this.hands[this.turn]
    if (!this.trick.length) return hand
    return legalMask(hand, SUIT_OF[this.trick[0]], this.winning(), this.trump)
  }

  /** Would leading `card` now declare a marriage? */
  isMeld(card: number): boolean {
    const order = ORDER_OF[card]
    return (
      !this.trick.length &&
      (order === KING || order === QUEEN) &&
      hasMarriage(this.hands[this.turn], SUIT_OF[card])
    )
  }

  /** Plays a card of the player on turn; the caller guarantees legality. */
  play(card: number): void {
    const player = this.turn
    const hand = this.hands[player]
    const suit = SUIT_OF[card]
    if (!this.trick.length) {
      const order = ORDER_OF[card]
      if (this.isMeld(card)) {
        this.trump = suit
        this.meldPoints[player] += MELD_VALUE[suit]
      } else if (order === KING || order === QUEEN) {
        // Declaring is automatic: the leader does not hold the partner.
        this.excluded[player] |= 1 << (card - order + (order === KING ? QUEEN : KING))
      }
    } else {
      const led = SUIT_OF[this.trick[0]]
      const winning = this.winning()
      this.excluded[player] |= inferred(card, led, winning, this.trump)
      if (suit !== led) {
        this.voids[player] |= 1 << led
        const trump = this.trump
        if (trump >= 0 && trump !== led && suit !== trump && SUIT_OF[winning] !== trump) {
          this.voids[player] |= 1 << trump
        }
      }
    }
    this.hands[player] = hand & ~(1 << card)
    this.played |= 1 << card
    this.trick.push(card)
    if (this.trick.length < PLAYER_COUNT) return

    const trick = this.trick
    let best = 0
    if (beatsIndex(trick[1], trick[best], this.trump)) best = 1
    if (beatsIndex(trick[2], trick[best], this.trump)) best = 2
    const winner = (this.leader + best) % PLAYER_COUNT
    this.cardPoints[winner] +=
      POINTS_OF[trick[0]] + POINTS_OF[trick[1]] + POINTS_OF[trick[2]]
    this.leader = winner
    this.trick = []
    this.trickNumber++
  }

  /** Score changes once the deal is over, exactly like `Deal.result()`. */
  deltas(): number[] {
    const made = this.points(this.declarer) >= this.contract
    return [0, 1, 2].map(player =>
      player === this.declarer
        ? made
          ? this.contract
          : -this.contract
        : roundScore(this.points(player)),
    )
  }
}
