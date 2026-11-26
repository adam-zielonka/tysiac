import { ALL_CARDS, type Card } from './Card'
import { shuffle, type Random } from './random'

export class Deck {
  static generate(): Card[] {
    return [...ALL_CARDS]
  }

  static shuffle(deck: Card[], random: Random = Math.random): Card[] {
    return shuffle(deck, random)
  }
}
