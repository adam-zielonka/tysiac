import type { Action, Deal } from '../Deal'
import { PlayerType } from '../PlayerType'
import { sampleDeal } from '../sampling'
import { cardIndex, lowestBit } from './bits'
import { BotPlayer } from './BotPlayer'
import {
  monteCarloBid,
  monteCarloContract,
  monteCarloGift,
  pastDeadline,
  rollout,
  utility,
} from './montecarlo'
import { PlayState } from './PlayState'

/** Utilities are divided by this before entering UCT. */
const REWARD_SCALE = 200

class Node {
  visits = 0
  /** Iterations in which this move was legal at its parent. */
  available = 1
  /** Sum of scaled utilities of the player who made the move. */
  reward = 0
  children: (Node | undefined)[] | null = null

  constructor(readonly player: number) {}
}

/**
 * Monte, single-observer information-set MCTS: each iteration deals the
 * hidden cards anew with `sampleDeal`, walks one shared tree of card moves
 * (UCT with availability counts, every seat maximising its own utility),
 * expands one move, plays out with the tactical policy and backs up the
 * utility of every seat. The most visited first card is played.
 */
export class MCTSPlayer extends BotPlayer {
  readonly type = PlayerType.MCTS
  iterations = 2000
  exploration = 0.7
  auctionSamples = 150
  contractSamples = 200
  giftSamples = 60
  giftCandidates = 4
  bidThreshold = 0.55
  timeLimit = 250

  private deadline(): number {
    return performance.now() + this.timeLimit
  }

  protected bid(deal: Deal, actions: Action[]): Action {
    return monteCarloBid(
      deal,
      actions,
      this.random,
      this.auctionSamples,
      this.bidThreshold,
      this.deadline(),
    )
  }

  protected give(deal: Deal, actions: Action[]): Action {
    return monteCarloGift(
      deal,
      actions,
      this.random,
      this.giftSamples,
      this.giftCandidates,
      this.deadline(),
    )
  }

  protected declare(deal: Deal, actions: Action[]): Action {
    return monteCarloContract(
      deal,
      actions,
      this.random,
      this.contractSamples,
      this.deadline(),
    )
  }

  protected play(deal: Deal, actions: Action[]): Action {
    const root = this.search(deal)
    let best = actions[0]
    let most = -1
    for (const action of actions) {
      if (action.type !== 'play') continue
      const visits = root.children?.[cardIndex(action.card)]?.visits ?? 0
      if (visits > most) {
        most = visits
        best = action
      }
    }
    return best
  }

  /** Runs the iterations and returns the root of the tree. */
  private search(view: Deal): Node {
    const root = new Node(-1)
    const deadline = this.deadline()
    const c = this.exploration
    for (let i = 0; i < this.iterations && !(i && pastDeadline(deadline)); i++) {
      const st = PlayState.fromDeal(sampleDeal(view, this.random))
      const path: Node[] = [root]
      let node = root
      while (!st.isFinished) {
        const legal = st.legal()
        const children = (node.children ??= new Array<Node | undefined>(24))
        let untried = 0
        let untriedCount = 0
        for (let bits = legal; bits; bits &= bits - 1) {
          const card = lowestBit(bits)
          const child = children[card]
          if (child) child.available++
          else {
            untried |= 1 << card
            untriedCount++
          }
        }
        if (untried) {
          let pick = Math.min(untriedCount - 1, Math.floor(this.random() * untriedCount))
          let bits = untried
          while (pick--) bits &= bits - 1
          const card = lowestBit(bits)
          const child = new Node(st.turn)
          children[card] = child
          st.play(card)
          path.push(child)
          break
        }
        let chosen = -1
        let top = -Infinity
        for (let bits = legal; bits; bits &= bits - 1) {
          const card = lowestBit(bits)
          const child = children[card]!
          const score =
            child.reward / child.visits +
            c * Math.sqrt(Math.log(child.available) / child.visits)
          if (score > top) {
            top = score
            chosen = card
          }
        }
        node = children[chosen]!
        st.play(chosen)
        path.push(node)
      }
      const deltas = rollout(st).deltas()
      const rewards = [0, 1, 2].map(player => utility(deltas, player) / REWARD_SCALE)
      for (const visited of path) {
        visited.visits++
        if (visited.player >= 0) visited.reward += rewards[visited.player]
      }
    }
    return root
  }
}
