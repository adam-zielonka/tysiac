import { cards } from '../../engine/Card'
import { Deal, actionKey, type Action, type DealOptions } from '../../engine/Deal'
import { Deck } from '../../engine/Deck'
import type { Player } from '../../engine/Player'
import { createPlayer } from '../../engine/PlayersSelect'
import type { PlayerType } from '../../engine/PlayerType'
import { seededRandom, type Random } from '../../engine/random'
import { AZPlayer } from '../../engine/players/AZPlayer'
import { MCTSPlayer } from '../../engine/players/MCTSPlayer'
import { RolloutPlayer } from '../../engine/players/RolloutPlayer'

/** A deal with the given hands (seats 0, 1, 2) and musik. */
export function dealOf(
  hands: [string, string, string],
  musik: string,
  dealer = 0,
  options: DealOptions = {},
): Deal {
  return Deal.deal(dealer, cards([...hands, musik].join(' ')), options)
}

/** Everybody passes, so the opener plays 100 after giving `gifts` (left first). */
export function toPlay(deal: Deal, gifts: [string, string]): Deal {
  while (deal.phase === 'bidding') deal.apply({ type: 'pass' })
  deal.apply({ type: 'take' })
  const recipients = deal.pendingRecipients()
  gifts.forEach((id, i) =>
    deal.apply({ type: 'give', card: cards(id)[0], to: recipients[i] }),
  )
  deal.apply({ type: 'contract', value: deal.contractOptions()[0] })
  return deal
}

export function play(deal: Deal, ids: string): Deal {
  for (const card of cards(ids)) deal.apply({ type: 'play', card })
  return deal
}

/** Bots with the time safety switched off, so seeded runs repeat exactly. */
export function bot(
  type: PlayerType,
  id: number,
  random: Random = seededRandom(id + 1),
): Player {
  const player = createPlayer(type, id, random)
  if (
    player instanceof RolloutPlayer ||
    player instanceof MCTSPlayer ||
    player instanceof AZPlayer
  ) {
    player.timeLimit = Infinity
  }
  return player
}

export function viewOf(deal: Deal, player: Player): Deal {
  return player.omniscient ? deal.clone() : deal.viewFor(deal.turn)
}

export function decide(deal: Deal, player: Player): Action {
  return player.choose(viewOf(deal, player), deal.legalActions())
}

/** Plays a deal to the end and returns every action key in order. */
export function playOut(deal: Deal, players: readonly Player[]): string[] {
  const keys: string[] = []
  while (!deal.isFinished) {
    const player = players[deal.turn]
    const action = decide(deal, player)
    if (!deal.isLegal(action))
      throw new Error(`Illegal ${actionKey(action)} by ${player.type}`)
    keys.push(actionKey(action))
    deal.apply(action)
  }
  return keys
}

/** Average deal score per bot type over seeded decks, every bot in every seat. */
export function tournament(types: PlayerType[], decks: number, seed: number) {
  const random = seededRandom(seed)
  const totals = new Map<PlayerType, number>(types.map(type => [type, 0]))
  let deals = 0
  for (let k = 0; k < decks; k++) {
    const deck = Deck.shuffle(Deck.generate(), random)
    for (let rotation = 0; rotation < 3; rotation++) {
      const seats = [0, 1, 2].map(seat => types[(seat + rotation) % 3])
      const players = seats.map((type, seat) =>
        bot(type, seat, seededRandom(seed * 1000 + k * 10 + rotation * 3 + seat)),
      )
      const deal = Deal.deal(k % 3, deck)
      playOut(deal, players)
      const result = deal.result()!
      seats.forEach((type, seat) =>
        totals.set(type, totals.get(type)! + result.deltas[seat]),
      )
      deals++
    }
  }
  return new Map([...totals].map(([type, total]) => [type, total / deals]))
}
