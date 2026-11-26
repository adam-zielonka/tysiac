import { ALL_CARDS, Card, cards } from '../../engine/Card'
import { Deal, type Action } from '../../engine/Deal'
import { Player } from '../../engine/Player'
import { PlayerType } from '../../engine/PlayerType'
import { pick, type Random } from '../../engine/random'
import { trickWinnerIndex } from '../../engine/rules'

/**
 * A deal with fixed hands: `hands[i]` goes to seat `i`, then the musik.
 * Each argument is a space separated list such as `'A♥ 10♥ K♥'`.
 */
export function dealWith(
  dealer: number,
  hands: [string, string, string],
  musik: string,
): Deal {
  const deck = [...hands.flatMap(hand => cards(hand)), ...cards(musik)]
  return Deal.deal(dealer, deck)
}

export function ids(list: readonly Card[]): string {
  return list.map(card => card.id).join(' ')
}

export function sortedIds(list: readonly Card[]): string {
  return list
    .map(card => card.id)
    .sort()
    .join(' ')
}

/** Applies a sequence of actions given in a compact text form. */
export function run(deal: Deal, script: string): void {
  for (const step of script.split(',').map(part => part.trim())) {
    if (!step) continue
    deal.apply(parseAction(deal, step))
  }
}

/**
 * `pass`, `take`, `110` (bid), `c120` (contract), `g9♦>1` (give to seat 1),
 * or a card id to play it.
 */
export function parseAction(deal: Deal, step: string): Action {
  if (step === 'pass') return { type: 'pass' }
  if (step === 'take') return { type: 'take' }
  if (/^\d+$/.test(step)) return { type: 'bid', value: Number(step) }
  if (/^c\d+$/.test(step)) return { type: 'contract', value: Number(step.slice(1)) }
  const give = /^g(\S+)>(\d)$/.exec(step)
  if (give) return { type: 'give', card: cards(give[1])[0], to: Number(give[2]) }
  if (deal.phase === 'play') return { type: 'play', card: cards(step)[0] }
  throw new Error(`Cannot parse ${step} in phase ${deal.phase}`)
}

/**
 * Uniformly random legal moves with a bias towards short auctions, used to
 * explore the state space without depending on the real bots.
 */
export class ChaosPlayer extends Player {
  readonly type = PlayerType.Random

  choose(deal: Deal, actions: Action[]): Action {
    if (deal.phase === 'bidding' && this.random() < 0.55) {
      return actions.find(action => action.type === 'pass')!
    }
    return pick(this.random, actions)
  }
}

export function chaosPlayers(random: Random): Player[] {
  return [0, 1, 2].map(seat => new ChaosPlayer(seat, random))
}

/**
 * A small greedy test policy that scores well enough for matches to reach
 * 1000 quickly: never raises, gives away low cards, declares marriages, leads
 * high and wins tricks as cheaply as possible.
 */
export class GreedyTestPlayer extends Player {
  readonly type = PlayerType.Simple

  choose(deal: Deal, actions: Action[]): Action {
    if (deal.phase === 'giving') {
      const gifts = actions.flatMap(action => (action.type === 'give' ? [action] : []))
      return gifts.reduce((best, gift) =>
        gift.card.points < best.card.points ||
        (gift.card.points === best.card.points && gift.card.rank < best.card.rank)
          ? gift
          : best,
      )
    }
    if (deal.phase !== 'play') return actions[0]
    const playable = actions.flatMap(action =>
      action.type === 'play' ? [action.card] : [],
    )
    const choose = (card: Card): Action => ({ type: 'play', card })
    if (!deal.trick.length) {
      const meld = playable.find(card => deal.isMeld(card))
      return choose(meld ?? playable.reduce((a, b) => (b.rank > a.rank ? b : a)))
    }
    const trick = deal.trick.map(play => play.card)
    const winning = playable.filter(
      card => trickWinnerIndex([...trick, card], deal.trump) === trick.length,
    )
    if (winning.length) return choose(winning.reduce((a, b) => (b.rank < a.rank ? b : a)))
    return choose(playable.reduce((a, b) => (b.points < a.points ? b : a)))
  }
}

export function greedyPlayers(random: Random): Player[] {
  return [0, 1, 2].map(seat => new GreedyTestPlayer(seat, random))
}

/** Every Card instance reachable from a value (deep, through arrays and objects). */
export function collectCards(value: unknown, found = new Set<Card>()): Set<Card> {
  if (value instanceof Card) {
    found.add(value)
  } else if (Array.isArray(value)) {
    value.forEach(item => collectCards(item, found))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => collectCards(item, found))
  }
  return found
}

/** All 24 cards of a full deal: hands, musik and every played card. */
export function cardLocations(deal: Deal): Map<Card, string> {
  const where = new Map<Card, string>()
  const put = (card: Card, place: string) => {
    if (where.has(card))
      throw new Error(`${card.id} is both in ${where.get(card)} and ${place}`)
    where.set(card, place)
  }
  deal.s.hands.forEach((hand, seat) => hand.forEach(card => put(card, `hand ${seat}`)))
  deal.s.musik.forEach(card => put(card, 'musik'))
  deal.s.played.forEach(play => put(play.card, `played by ${play.player}`))
  return where
}

/** Checks that a full deal holds each card exactly once. */
export function expectComplete(deal: Deal): void {
  const where = cardLocations(deal)
  if (where.size !== ALL_CARDS.length) {
    throw new Error(`Deal holds ${where.size} of ${ALL_CARDS.length} cards`)
  }
}
