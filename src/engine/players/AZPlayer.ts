import type { Action, Deal } from '../Deal'
import { PlayerType } from '../PlayerType'
import { BID_STEP, nextSeat } from '../rules'
import { AlphaBeta, type SearchOptions } from './alphabeta'
import { cardAt, maskOf } from './bits'
import { BotPlayer } from './BotPlayer'
import { bidUpTo, contractUpTo, giftOrder, playAction } from './heuristics'
import { MOOD_POINTS, moodOf, onlyDefeatCounts, safeContractLimit } from './match'
import { PlayState } from './PlayState'

interface Plan {
  /** Gift cards in the order of the waiting defenders. */
  gifts: number[]
  value: number
}

/**
 * Ada sees every hand and the musik. She plays by perfect-information
 * alpha-beta (declarer against both defenders) and bids and declares what
 * the same search says she can secure on the true layout.
 */
export class AZPlayer extends BotPlayer {
  readonly type = PlayerType.AZ
  readonly omniscient = true
  /** Node budget of one card decision. */
  nodeBudget = 150000
  /** Node budget per gift option when valuing a layout. */
  planBudget = 18000
  /** Least useful cards considered for the two gifts. */
  giftCandidates = 3
  contractBonus = 1000
  defenderMeldWeight = 0.5
  /** As a defender, how much her own points count against the team value. */
  selfWeight = 0.5
  /** Safety net in milliseconds per decision; node budgets normally end first. */
  timeLimit = 250

  private plans = new Map<string, Plan>()
  private deadline = Infinity

  choose(deal: Deal, actions: Action[]): Action {
    this.deadline = performance.now() + this.timeLimit
    return super.choose(deal, actions)
  }

  protected bid(deal: Deal, actions: Action[]): Action {
    const mood = moodOf(deal, this.matchScores)
    const plan = this.plan(deal, deal.turn)
    return bidUpTo(deal, actions, plan.value + mood * MOOD_POINTS)
  }

  protected give(deal: Deal, actions: Action[]): Action {
    const plan = this.plan(deal, deal.declarer)
    const card = cardAt(plan.gifts[0])
    const to = deal.pendingRecipients()[0]
    return (
      actions.find(a => a.type === 'give' && a.card === card && a.to === to) ?? actions[0]
    )
  }

  protected declare(deal: Deal, actions: Action[]): Action {
    const value = this.search(PlayState.fromDeal(deal), this.nodeBudget, false).value
    const limit = Math.floor(value / BID_STEP) * BID_STEP
    return contractUpTo(actions, safeContractLimit(this.matchScores, deal.turn, limit))
  }

  protected play(deal: Deal, actions: Action[]): Action {
    const result = this.search(PlayState.fromDeal(deal), this.nodeBudget, true)
    return playAction(actions, result.card)
  }

  private search(st: PlayState, nodeBudget: number, forContract: boolean) {
    // Her own points do not count at 800+ or when the declarer would win the
    // match by making the contract: then she only defends.
    const selfWeight = onlyDefeatCounts(
      this.matchScores,
      this.id,
      st.declarer,
      st.contract,
    )
      ? 0
      : this.selfWeight
    const options: SearchOptions = {
      nodeBudget,
      contractBonus: forContract ? this.contractBonus : 0,
      defenderMeldWeight: forContract ? this.defenderMeldWeight : 0,
      deadline: this.deadline,
      self: forContract ? this.id : -1,
      selfWeight,
    }
    return new AlphaBeta(st, options).run()
  }

  /**
   * Best gifts for `seat` as declarer on the true layout (the musik joins its
   * hand during the auction) and the points the search can then secure.
   */
  private plan(deal: Deal, seat: number): Plan {
    const s = deal.s
    const hands = s.hands.map(hand => maskOf(hand))
    if (s.phase === 'bidding') hands[seat] |= maskOf(s.musik)
    const key = `${seat}:${hands.join(',')}:${s.gifts.length}`
    const cached = this.plans.get(key)
    if (cached) return cached
    const recipients =
      s.phase === 'giving'
        ? deal.pendingRecipients()
        : [nextSeat(seat), nextSeat(seat, 2)]
    const order = giftOrder(hands[seat]).slice(0, this.giftCandidates)
    const options: number[][] = []
    for (const first of order) {
      if (recipients.length < 2) options.push([first])
      else for (const second of order) if (second !== first) options.push([first, second])
    }
    let best: Plan = { gifts: options[0], value: -Infinity }
    for (const gifts of options) {
      const layout = hands.slice()
      gifts.forEach((card, i) => {
        layout[seat] &= ~(1 << card)
        layout[recipients[i]] |= 1 << card
      })
      const st = new PlayState(layout, seat, 0, seat)
      const value = this.search(st, this.planBudget, false).value
      if (value > best.value) best = { gifts, value }
    }
    if (this.plans.size > 16) this.plans.clear()
    this.plans.set(key, best)
    return best
  }
}
