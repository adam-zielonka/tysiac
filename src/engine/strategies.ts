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
    description:
      'Twój fotel przy stole. Licytujesz, rozgrywasz i podświetlone karty możesz zagrać.',
  },
  [PlayerType.Random]: {
    name: 'Felek',
    method: 'Losowy',
    color: 'rose',
    information: 'Bez podglądania',
    description:
      'Zdaje się na los: w licytacji z równą szansą pasuje albo podbija o 10, gra najniższy kontrakt, oddaje losowe karty i zagrywa losową dozwoloną kartę. Dobry punkt odniesienia.',
  },
  [PlayerType.Simple]: {
    name: 'Bolek',
    method: 'Zachłanny',
    color: 'amber',
    information: 'Bez podglądania',
    description:
      'Licytuje, dopóki ocena ręki (asy, dziesiątki, meldunki, długość koloru i średni musik) pokrywa kolejną stawkę, bez zapasu. Oddaje karty warte najmniej punktów i gra dokładnie za tyle, ile wylicytował. Melduje, gdy tylko może, wychodzi najsilniejszą kartą, a lewę bierze najtańszą wystarczającą kartą; inaczej zrzuca kartę wartą najmniej.',
  },
  [PlayerType.Tactical]: {
    name: 'Tosia',
    method: 'Taktyczna',
    color: 'mint',
    information: 'Pamięta zagrane karty',
    description:
      'Licytuje ostrożnie: do oceny ręki pomniejszonej o 10 punktów. Oddaje najmniej przydatne karty: nie rozbija meldunków, nie oddaje asów, a pojedynczego króla lub damę, które mogłyby dopełnić meldunek rywala, oddaje dopiero po dziewiątkach, waletach i gołych dziesiątkach. Kontrakt podnosi, gdy pozwala na to osiem zatrzymanych kart. Pamięta zagrane karty i braki w kolorach: zgrywa pewne lewy, melduje najcenniejszy meldunek, jako rozgrywająca ściąga atuty, a w obronie dokłada punkty do pewnej lewy partnera i nie karmi rozgrywającego.',
  },
  [PlayerType.Rollout]: {
    name: 'Bruno',
    method: 'Symulacje Monte Carlo',
    color: 'orange',
    information: 'Losuje nieznane ręce',
    description:
      'Każdą dozwoloną kartę sprawdza na tych samych 100 losowych układach ukrytych kart, dogrywa rozdanie taktyką Tosi i wybiera najlepszy średni wynik względem rywali. Podbija o 10, gdy w 150 symulacjach z losowym musikiem ugrywa tę stawkę co najmniej w 60% rozdań. Kontrakt wybiera na podstawie 200 symulacji, a oddawane karty porównuje na 60 układach.',
  },
  [PlayerType.MCTS]: {
    name: 'Monte',
    method: 'Drzewo Monte Carlo',
    color: 'blue',
    information: 'Losuje nieznane ręce',
    description:
      'Buduje drzewo zagrań metodą ISMCTS: w każdej z 2000 iteracji losuje ukryte karty, wybiera ruchy wzorem UCT i dogrywa rozdanie taktyką Tosi. Zagrywa kartę odwiedzaną najczęściej. Licytuje, oddaje karty i wybiera kontrakt jak Bruno, ale podbija już przy 55% szans na ugranie stawki.',
  },
  [PlayerType.AZ]: {
    name: 'Ada',
    method: 'Przeszukiwanie alfa-beta',
    color: 'lilac',
    information: 'Zna wszystkie ręce',
    description:
      'Zna wszystkie ręce i musik. Rozgrywkę przeszukuje alfa-betą (rozgrywający przeciw obu obrońcom) do 150 000 pozycji na ruch, pogłębiając lewa po lewie; od trzeciej lewy zwykle liczy dokładnie do końca rozdania. Licytuje i deklaruje tyle, ile według tego przeszukiwania ugra nawet przy najlepszej obronie. Wariant eksperymentalny z pełną wiedzą o kartach.',
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
  'Zdaje się na los: w licytacji z równą szansą pasuje albo podbija o 10, gra najniższy kontrakt, oddaje losowe karty i zagrywa losową dozwoloną kartę. Dobry punkt odniesienia.':
    'Leaves it to chance: in the auction it passes or raises by 10 with equal odds, plays the lowest contract, gives away random cards and plays a random legal card. A useful baseline.',
  Zachłanny: 'Greedy',
  'Licytuje, dopóki ocena ręki (asy, dziesiątki, meldunki, długość koloru i średni musik) pokrywa kolejną stawkę, bez zapasu. Oddaje karty warte najmniej punktów i gra dokładnie za tyle, ile wylicytował. Melduje, gdy tylko może, wychodzi najsilniejszą kartą, a lewę bierze najtańszą wystarczającą kartą; inaczej zrzuca kartę wartą najmniej.':
    'Bids while its hand estimate (aces, tens, marriages, suit length and the average musik) covers the next bid, with no margin. Gives away the cards worth the fewest points and plays exactly its bid. Declares a marriage whenever it can, leads its strongest card and takes a trick with the cheapest card that does it; otherwise it throws the card worth the least.',
  Taktyczna: 'Tactical',
  'Pamięta zagrane karty': 'Remembers played cards',
  'Licytuje ostrożnie: do oceny ręki pomniejszonej o 10 punktów. Oddaje najmniej przydatne karty: nie rozbija meldunków, nie oddaje asów, a pojedynczego króla lub damę, które mogłyby dopełnić meldunek rywala, oddaje dopiero po dziewiątkach, waletach i gołych dziesiątkach. Kontrakt podnosi, gdy pozwala na to osiem zatrzymanych kart. Pamięta zagrane karty i braki w kolorach: zgrywa pewne lewy, melduje najcenniejszy meldunek, jako rozgrywająca ściąga atuty, a w obronie dokłada punkty do pewnej lewy partnera i nie karmi rozgrywającego.':
    'Bids cautiously: up to its hand estimate minus 10 points. Gives away the least useful cards: never breaks a marriage or gives an ace, and gives a lone king or queen, which could complete a rival’s marriage, only after nines, jacks and unguarded tens. It raises the contract when its eight kept cards allow it. Remembers played cards and missing suits: cashes sure tricks, declares the most valuable marriage, draws trumps as declarer and, when defending, adds points to a partner’s safe trick without feeding the declarer.',
  'Symulacje Monte Carlo': 'Monte Carlo simulations',
  'Losuje nieznane ręce': 'Samples unknown hands',
  'Każdą dozwoloną kartę sprawdza na tych samych 100 losowych układach ukrytych kart, dogrywa rozdanie taktyką Tosi i wybiera najlepszy średni wynik względem rywali. Podbija o 10, gdy w 150 symulacjach z losowym musikiem ugrywa tę stawkę co najmniej w 60% rozdań. Kontrakt wybiera na podstawie 200 symulacji, a oddawane karty porównuje na 60 układach.':
    'Tries every legal card on the same 100 random layouts of the hidden cards, plays each deal out with Tosia’s tactics and picks the best average result against its rivals. Raises by 10 when it makes that value in at least 60% of 150 simulations with a random musik. It chooses the contract from 200 simulations and compares gifts on 60 layouts.',
  'Drzewo Monte Carlo': 'Monte Carlo tree',
  'Buduje drzewo zagrań metodą ISMCTS: w każdej z 2000 iteracji losuje ukryte karty, wybiera ruchy wzorem UCT i dogrywa rozdanie taktyką Tosi. Zagrywa kartę odwiedzaną najczęściej. Licytuje, oddaje karty i wybiera kontrakt jak Bruno, ale podbija już przy 55% szans na ugranie stawki.':
    'Builds a move tree with ISMCTS: each of 2000 iterations deals the hidden cards anew, picks moves by UCT and plays the deal out with Tosia’s tactics. It plays the most visited card. Bids, gives cards and chooses the contract like Bruno, but raises already at a 55% chance of making the value.',
  'Przeszukiwanie alfa-beta': 'Alpha-beta search',
  'Zna wszystkie ręce': 'Knows all hands',
  'Zna wszystkie ręce i musik. Rozgrywkę przeszukuje alfa-betą (rozgrywający przeciw obu obrońcom) do 150 000 pozycji na ruch, pogłębiając lewa po lewie; od trzeciej lewy zwykle liczy dokładnie do końca rozdania. Licytuje i deklaruje tyle, ile według tego przeszukiwania ugra nawet przy najlepszej obronie. Wariant eksperymentalny z pełną wiedzą o kartach.':
    'Knows every hand and the musik. Searches the play with alpha-beta (declarer against both defenders) over up to 150,000 positions per move, deepening trick by trick; from the third trick it usually calculates exactly to the end of the deal. Bids and declares what that search says it makes even against the best defence. An experimental variant with full knowledge of the cards.',
}
