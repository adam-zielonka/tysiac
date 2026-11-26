import type { Action, Deal } from './Deal'
import { PlayerType } from './PlayerType'
import type { Random } from './random'

export abstract class Player {
  abstract readonly type: PlayerType
  /** Omniscient players receive the full deal instead of their own view. */
  readonly omniscient: boolean = false
  /**
   * Match totals before the current deal, set by the game before each
   * decision (all zero in simulations). Public information: at 800+ a
   * player scores only as the declarer.
   */
  matchScores: number[] = [0, 0, 0]

  constructor(
    readonly id: number,
    public random: Random = Math.random,
  ) {}

  get isHuman(): boolean {
    return this.type === PlayerType.Human
  }

  /**
   * Chooses one of `actions` (never empty). `deal` is the player's own view:
   * hidden hands are empty and only public information is available, unless
   * the player is omniscient.
   */
  abstract choose(deal: Deal, actions: Action[]): Action
}
