import { Game } from './Game'
import { loadMeldSystem } from './settings'

class Store {
  game: Game

  constructor() {
    // The match rules chosen in Settings: marriage values from the last visit.
    this.game = new Game({ meldSystem: loadMeldSystem() })
  }
}

export const store = new Store()

declare global {
  interface Window {
    store: Store
    game: Game
  }
}
if (typeof window !== 'undefined') {
  window.store = store
  window.game = store.game
}
