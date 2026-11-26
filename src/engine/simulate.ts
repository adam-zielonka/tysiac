import type { Deal } from './Deal'
import type { Player } from './Player'

/**
 * Plays a deal to the end with the given players, each deciding from its own
 * view (or the full deal when omniscient). Throws on an illegal choice.
 */
export function runDeal(deal: Deal, players: readonly Player[], maxSteps = 200): Deal {
  for (let step = 0; !deal.isFinished; step++) {
    if (step >= maxSteps) throw new Error('Deal did not finish')
    const seat = deal.turn
    const player = players[seat]
    const actions = deal.legalActions()
    const view = player.omniscient ? deal.clone() : deal.viewFor(seat)
    const action = player.choose(view, actions)
    deal.apply(action)
  }
  return deal
}
