import { PlayerType } from './PlayerType'

export interface Strategy {
  name: string
  method: string
  description: string
  /** CSS colour class shared with the avatar and activity list. */
  color: string
  information: string
}

/** Polish source texts; English versions live in `strategyTranslations`. */
export const strategies: Record<PlayerType, Strategy> = {
  [PlayerType.Human]: {
    name: 'Ty',
    method: 'Gracz',
    color: 'mint',
    information: 'Twoje karty',
    description: 'Twój fotel przy stole. Licytujesz, rozgrywasz i podświetlone karty możesz zagrać.',
  },
  [PlayerType.Random]: {
    name: 'Felek',
    method: 'Losowy',
    color: 'rose',
    information: 'Bez podglądania',
    description: 'Zagrywa losową dozwoloną kartę. Dobry punkt odniesienia.',
  },
  [PlayerType.Simple]: {
    name: 'Bolek',
    method: 'Zachłanny',
    color: 'amber',
    information: 'Bez podglądania',
    description: 'Bierze lewę najtańszą kartą, która wystarczy. Inaczej oddaje najsłabszą.',
  },
  [PlayerType.Tactical]: {
    name: 'Tosia',
    method: 'Taktyczna',
    color: 'mint',
    information: 'Pamięta zagrane karty',
    description: 'Melduje, zgrywa pewne lewy i pomaga partnerowi w obronie.',
  },
  [PlayerType.Rollout]: {
    name: 'Bruno',
    method: 'Symulacje Monte Carlo',
    color: 'orange',
    information: 'Losuje nieznane ręce',
    description: 'Porównuje ruchy w symulacjach z losowanymi kartami rywali.',
  },
  [PlayerType.MCTS]: {
    name: 'Monte',
    method: 'Drzewo Monte Carlo',
    color: 'blue',
    information: 'Losuje nieznane ręce',
    description: 'Rozbudowuje drzewo ruchów metodą UCT na losowanych układach kart.',
  },
  [PlayerType.AZ]: {
    name: 'Ada',
    method: 'Przeszukiwanie alfa-beta',
    color: 'lilac',
    information: 'Zna wszystkie ręce',
    description: 'Przeszukuje rozgrywkę naprzód. Wariant eksperymentalny z pełną wiedzą o kartach.',
  },
}

/** Polish → English for every text above; merged into the i18n dictionary. */
export const strategyTranslations: Record<string, string> = {
  Ty: 'You',
  Gracz: 'Player',
  'Twoje karty': 'Your cards',
  'Twój fotel przy stole. Licytujesz, rozgrywasz i podświetlone karty możesz zagrać.':
    'Your seat at the table. You bid, play and can choose any highlighted card.',
  Losowy: 'Random',
  'Bez podglądania': 'No peeking',
  'Zagrywa losową dozwoloną kartę. Dobry punkt odniesienia.':
    'Plays a random legal card. A useful baseline.',
  Zachłanny: 'Greedy',
  'Bierze lewę najtańszą kartą, która wystarczy. Inaczej oddaje najsłabszą.':
    'Wins a trick with the cheapest card that does it; otherwise throws the weakest.',
  Taktyczna: 'Tactical',
  'Pamięta zagrane karty': 'Remembers played cards',
  'Melduje, zgrywa pewne lewy i pomaga partnerowi w obronie.':
    'Declares marriages, cashes sure tricks and helps a fellow defender.',
  'Symulacje Monte Carlo': 'Monte Carlo simulations',
  'Losuje nieznane ręce': 'Samples unknown hands',
  'Porównuje ruchy w symulacjach z losowanymi kartami rywali.':
    'Compares moves in simulations with sampled opponent cards.',
  'Drzewo Monte Carlo': 'Monte Carlo tree',
  'Rozbudowuje drzewo ruchów metodą UCT na losowanych układach kart.':
    'Grows a UCT move tree over sampled card layouts.',
  'Przeszukiwanie alfa-beta': 'Alpha-beta search',
  'Zna wszystkie ręce': 'Knows all hands',
  'Przeszukuje rozgrywkę naprzód. Wariant eksperymentalny z pełną wiedzą o kartach.':
    'Searches the play ahead. An experimental variant with full knowledge of all cards.',
}
