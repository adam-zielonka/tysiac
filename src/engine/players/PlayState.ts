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
  maskOf,
  suitOfColor,
} from './bits'

/**
 * The play phase of a deal on card bitmasks: the same rules as `Deal`
 * (follow suit, forced trump, marriages from the second trick, trump
 * changes), but cheap to copy, so searches can play thousands of deals.
 * Hidden hands of a view are simply empty masks.
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

  /** Legal cards of the player on turn as a mask. */
  legal(): number {
    const hand = this.hands[this.turn]
    if (!this.trick.length) return hand
    const follow = hand & SUIT_MASK[SUIT_OF[this.trick[0]]]
    if (follow) return follow
    if (this.trump >= 0) {
      const trumps = hand & SUIT_MASK[this.trump]
      if (trumps) return trumps
    }
    return hand
  }

  /** Would leading `card` now declare a marriage? */
  isMeld(card: number): boolean {
    const order = ORDER_OF[card]
    return (
      !this.trick.length &&
      this.trickNumber > 0 &&
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
      if (this.isMeld(card)) {
        this.trump = suit
        this.meldPoints[player] += MELD_VALUE[suit]
      }
    } else {
      const led = SUIT_OF[this.trick[0]]
      if (suit !== led) {
        this.voids[player] |= 1 << led
        if (this.trump >= 0 && this.trump !== led && suit !== this.trump) {
          this.voids[player] |= 1 << this.trump
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
