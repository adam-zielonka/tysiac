import { PlayerType } from './PlayerType'

export interface Strategy {
  name: string
  method: string
  /** One-line summary shown on the picker tile. */
  summary: string
  /** Exact description of the algorithm and its numbers. */
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
    summary:
      'Twój fotel przy stole. Licytujesz, rozgrywasz i podświetlone karty możesz zagrać.',
    description:
      'Twój fotel przy stole. Licytujesz, rozgrywasz i podświetlone karty możesz zagrać.',
  },
  [PlayerType.Random]: {
    name: 'Felek',
    method: 'Losowy',
    color: 'rose',
    information: 'Bez podglądania',
    summary:
      'Zdaje się na los: pasuje albo podbija o 10, gra najniższy kontrakt i zagrywa losową dozwoloną kartę.',
    description:
      'Zdaje się na los: w licytacji z równą szansą pasuje albo podbija o 10, gra najniższy kontrakt, oddaje losowe karty i zagrywa losową dozwoloną kartę. Dobry punkt odniesienia.',
  },
  [PlayerType.Simple]: {
    name: 'Bolek',
    method: 'Zachłanny',
    color: 'amber',
    information: 'Bez podglądania',
    summary:
      'Licytuje do oceny ręki bez zapasu, wychodzi najsilniejszą kartą i bierze lewy najtańszą wystarczającą kartą.',
    description:
      'Licytuje, dopóki ocena ręki (asy, dziesiątki, meldunki, długość koloru i średni musik) pokrywa kolejną stawkę, bez zapasu i bez względu na stan partii. Oddaje karty warte najmniej punktów, ale nie rozbija meldunków ani nie oddaje asów, chyba że nie ma innego wyjścia, i gra dokładnie za tyle, ile wylicytował. Melduje, gdy tylko może, wychodzi najsilniejszą kartą, a lewę bierze najtańszą wystarczającą kartą; inaczej zrzuca kartę wartą najmniej.',
  },
  [PlayerType.Tactical]: {
    name: 'Tosia',
    method: 'Taktyczna',
    color: 'mint',
    information: 'Pamięta zagrane karty',
    summary:
      'Licytuje ostrożnie, pamięta zagrane karty i braki rywali, zgrywa pewne lewy i ściąga atuty.',
    description:
      'Licytuje ostrożnie: do oceny ręki pomniejszonej o 10 punktów. O 10 punktów śmielej, gdy ma już 800 punktów (w obronie nic nie zapisze) albo gdy prowadzący w licytacji rywal mógłby dojść do 1000, a o 10 ostrożniej, gdy ma 200 punktów przewagi nad obojgiem rywali. Oddaje najmniej przydatne karty: nie rozbija meldunków, nie oddaje asów, a pojedynczego króla lub damę, które mogłyby dopełnić meldunek rywala, oddaje dopiero po dziewiątkach, waletach i gołych dziesiątkach z kolorów krótszych niż trzy karty. Kontrakt podnosi do oceny ośmiu zatrzymanych kart pomniejszonej o 30 punktów, ale nie wyżej, niż trzeba do wygrania partii. Pamięta zagrane karty i to, czego rywale nie mogą mieć (braki w kolorach, karty, którymi musieliby przebić, i drugą kartę pary, gdy ktoś wyszedł królem lub damą bez meldunku): zgrywa pewne lewy, melduje najcenniejszy meldunek (także przy pierwszym wyjściu), jako rozgrywająca ściąga atuty, a w obronie dokłada punkty do pewnej lewy partnera i nie karmi rozgrywającego.',
  },
  [PlayerType.Rollout]: {
    name: 'Bruno',
    method: 'Symulacje Monte Carlo',
    color: 'orange',
    information: 'Losuje nieznane ręce',
    summary:
      'Sprawdza każdą kartę na 100 losowych układach ukrytych kart; licytuje ze 150 symulacji, kontrakt wybiera z 200.',
    description:
      'Każdą dozwoloną kartę sprawdza na tych samych 100 losowych układach ukrytych kart, dogrywa rozdanie taktyką Tosi i wybiera najlepszy średni wynik względem rywali, liczony tak, jak zapisze go partia: obrońca z 800 punktami nic nie dostaje, a wygranie partii kontraktem jest warte 300 punktów więcej. Podbija o 10, gdy w 150 symulacjach z losowym musikiem ugrywa tę stawkę co najmniej w 60% rozdań (w tych samych sytuacjach co Tosia już przy 50% albo dopiero przy 70%). Kontrakt wybiera na podstawie 200 symulacji, a oddawane karty porównuje na 60 układach.',
  },
  [PlayerType.MCTS]: {
    name: 'Monte',
    method: 'Drzewo Monte Carlo',
    color: 'blue',
    information: 'Losuje nieznane ręce',
    summary:
      'Przeszukuje drzewo zagrań metodą ISMCTS, do 2000 iteracji na ruch; licytuje jak Bruno, ale już przy 55% szans.',
    description:
      'Buduje drzewo zagrań metodą ISMCTS, do 2000 iteracji na ruch: w każdej losuje ukryte karty, wybiera ruchy wzorem UCT, dogrywa rozdanie taktyką Tosi i liczy wynik ze stanem partii jak Bruno. Zagrywa kartę odwiedzaną najczęściej. Licytuje, oddaje karty i wybiera kontrakt jak Bruno, ale podbija już przy 55% szans na ugranie stawki (45% albo 65%, gdy Tosia byłaby śmielsza lub ostrożniejsza).',
  },
  [PlayerType.AZ]: {
    name: 'Ada',
    method: 'Przeszukiwanie alfa-beta',
    color: 'lilac',
    information: 'Zna wszystkie ręce',
    summary:
      'Zna wszystkie ręce i musik. Przeszukuje rozgrywkę alfa-betą do 150 000 pozycji na ruch.',
    description:
      'Zna wszystkie ręce i musik. Rozgrywkę przeszukuje alfa-betą (rozgrywający przeciw obu obrońcom) do 150 000 pozycji na ruch, pogłębiając lewa po lewie; od trzeciej lewy zwykle liczy dokładnie do końca rozdania. Kontrakt deklaruje według tego przeszukiwania: tyle, ile ugra nawet przy najlepszej obronie, ale nie wyżej, niż trzeba do wygrania partii. Licytuje i wybiera oddawane karty według krótszego przeszukiwania tego samego rodzaju (18 000 pozycji na każdy wariant oddania kart), w licytacji o 10 punktów śmielej lub ostrożniej w tych samych sytuacjach co Tosia. W obronie, gdy jej punkty nic nie dają (800 punktów albo rozgrywający wygrałby partię), gra tylko na obalenie kontraktu. Wariant eksperymentalny z pełną wiedzą o kartach.',
  },
}

/** Polish → English for every text above; merged into the i18n dictionary. */
export const strategyTranslations: Record<string, string> = {
  Ty: 'You',
  Gracz: 'Player',
  'Twoje karty': 'Your cards',
  Losowy: 'Random',
  'Bez podglądania': 'No peeking',
  Zachłanny: 'Greedy',
  Taktyczna: 'Tactical',
  'Pamięta zagrane karty': 'Remembers played cards',
  'Symulacje Monte Carlo': 'Monte Carlo simulations',
  'Losuje nieznane ręce': 'Samples unknown hands',
  'Drzewo Monte Carlo': 'Monte Carlo tree',
  'Przeszukiwanie alfa-beta': 'Alpha-beta search',
  'Zna wszystkie ręce': 'Knows all hands',
  'Twój fotel przy stole. Licytujesz, rozgrywasz i podświetlone karty możesz zagrać.':
    'Your seat at the table. You bid, play and can choose any highlighted card.',
  'Zdaje się na los: pasuje albo podbija o 10, gra najniższy kontrakt i zagrywa losową dozwoloną kartę.':
    'Leaves it to chance: passes or raises by 10, plays the lowest contract and a random legal card.',
  'Zdaje się na los: w licytacji z równą szansą pasuje albo podbija o 10, gra najniższy kontrakt, oddaje losowe karty i zagrywa losową dozwoloną kartę. Dobry punkt odniesienia.':
    'Leaves it to chance: in the auction passes or raises by 10 with equal odds, plays the lowest contract, gives away random cards and plays a random legal card. A useful baseline.',
  'Licytuje do oceny ręki bez zapasu, wychodzi najsilniejszą kartą i bierze lewy najtańszą wystarczającą kartą.':
    'Bids up to the hand estimate with no margin, leads the strongest card and takes tricks with the cheapest winning card.',
  'Licytuje, dopóki ocena ręki (asy, dziesiątki, meldunki, długość koloru i średni musik) pokrywa kolejną stawkę, bez zapasu i bez względu na stan partii. Oddaje karty warte najmniej punktów, ale nie rozbija meldunków ani nie oddaje asów, chyba że nie ma innego wyjścia, i gra dokładnie za tyle, ile wylicytował. Melduje, gdy tylko może, wychodzi najsilniejszą kartą, a lewę bierze najtańszą wystarczającą kartą; inaczej zrzuca kartę wartą najmniej.':
    'Bids while the hand estimate (aces, tens, marriages, suit length and the average musik) covers the next bid, with no margin and regardless of the match score. Gives away the cards worth the fewest points, but does not break a marriage or give an ace unless nothing else is left, and plays exactly the bid. Declares a marriage whenever possible, leads the strongest card and takes a trick with the cheapest winning card; otherwise throws the card worth the least.',
  'Licytuje ostrożnie, pamięta zagrane karty i braki rywali, zgrywa pewne lewy i ściąga atuty.':
    'Bids cautiously, remembers played cards and the rivals’ missing suits, cashes sure tricks and draws trumps.',
  'Licytuje ostrożnie: do oceny ręki pomniejszonej o 10 punktów. O 10 punktów śmielej, gdy ma już 800 punktów (w obronie nic nie zapisze) albo gdy prowadzący w licytacji rywal mógłby dojść do 1000, a o 10 ostrożniej, gdy ma 200 punktów przewagi nad obojgiem rywali. Oddaje najmniej przydatne karty: nie rozbija meldunków, nie oddaje asów, a pojedynczego króla lub damę, które mogłyby dopełnić meldunek rywala, oddaje dopiero po dziewiątkach, waletach i gołych dziesiątkach z kolorów krótszych niż trzy karty. Kontrakt podnosi do oceny ośmiu zatrzymanych kart pomniejszonej o 30 punktów, ale nie wyżej, niż trzeba do wygrania partii. Pamięta zagrane karty i to, czego rywale nie mogą mieć (braki w kolorach, karty, którymi musieliby przebić, i drugą kartę pary, gdy ktoś wyszedł królem lub damą bez meldunku): zgrywa pewne lewy, melduje najcenniejszy meldunek (także przy pierwszym wyjściu), jako rozgrywająca ściąga atuty, a w obronie dokłada punkty do pewnej lewy partnera i nie karmi rozgrywającego.':
    'Bids cautiously: up to the hand estimate minus 10 points; 10 points more boldly from 800 points on (defending no longer scores) or when the rival leading the auction could reach 1000, and 10 points more carefully when 200 points ahead of both rivals. Gives away the least useful cards: never breaks a marriage or gives an ace, and gives a lone king or queen, which could complete a rival’s marriage, only after nines, jacks and unguarded tens of suits shorter than three cards. Raises the contract up to the estimate of the eight kept cards minus 30 points, but no higher than needed to win the match. Remembers played cards and what the rivals cannot hold (missing suits, cards they would have had to beat with, and the other card of a pair when someone led a king or queen without a marriage): cashes sure tricks, declares the most valuable marriage (on the first lead too), draws trumps as declarer and, when defending, adds points to a partner’s safe trick without feeding the declarer.',
  'Sprawdza każdą kartę na 100 losowych układach ukrytych kart; licytuje ze 150 symulacji, kontrakt wybiera z 200.':
    'Tries every card on 100 random layouts of the hidden cards; bids from 150 simulations and chooses the contract from 200.',
  'Każdą dozwoloną kartę sprawdza na tych samych 100 losowych układach ukrytych kart, dogrywa rozdanie taktyką Tosi i wybiera najlepszy średni wynik względem rywali, liczony tak, jak zapisze go partia: obrońca z 800 punktami nic nie dostaje, a wygranie partii kontraktem jest warte 300 punktów więcej. Podbija o 10, gdy w 150 symulacjach z losowym musikiem ugrywa tę stawkę co najmniej w 60% rozdań (w tych samych sytuacjach co Tosia już przy 50% albo dopiero przy 70%). Kontrakt wybiera na podstawie 200 symulacji, a oddawane karty porównuje na 60 układach.':
    'Tries every legal card on the same 100 random layouts of the hidden cards, plays each deal out with Tosia’s tactics and picks the best average result against the rivals, counted as on the score sheet: a defender with 800 points gets nothing, and winning the match with the contract is worth 300 points more. Raises by 10 when that value is made in at least 60% of 150 simulations with a random musik (in the same situations as Tosia already at 50% or only at 70%). Chooses the contract from 200 simulations and compares gifts on 60 layouts.',
  'Przeszukuje drzewo zagrań metodą ISMCTS, do 2000 iteracji na ruch; licytuje jak Bruno, ale już przy 55% szans.':
    'Searches a move tree with ISMCTS, up to 2000 iterations per move; bids like Bruno, but already at a 55% chance.',
  'Buduje drzewo zagrań metodą ISMCTS, do 2000 iteracji na ruch: w każdej losuje ukryte karty, wybiera ruchy wzorem UCT, dogrywa rozdanie taktyką Tosi i liczy wynik ze stanem partii jak Bruno. Zagrywa kartę odwiedzaną najczęściej. Licytuje, oddaje karty i wybiera kontrakt jak Bruno, ale podbija już przy 55% szans na ugranie stawki (45% albo 65%, gdy Tosia byłaby śmielsza lub ostrożniejsza).':
    'Builds a move tree with ISMCTS, up to 2000 iterations per move: each one deals the hidden cards anew, picks moves by UCT, plays the deal out with Tosia’s tactics and counts the result with the match score like Bruno. Plays the most visited card. Bids, gives cards and chooses the contract like Bruno, but raises already at a 55% chance of making the value (45% or 65% when Tosia would be bolder or more careful).',
  'Zna wszystkie ręce i musik. Przeszukuje rozgrywkę alfa-betą do 150 000 pozycji na ruch.':
    'Knows every hand and the musik. Searches the play with alpha-beta over up to 150,000 positions per move.',
  'Zna wszystkie ręce i musik. Rozgrywkę przeszukuje alfa-betą (rozgrywający przeciw obu obrońcom) do 150 000 pozycji na ruch, pogłębiając lewa po lewie; od trzeciej lewy zwykle liczy dokładnie do końca rozdania. Kontrakt deklaruje według tego przeszukiwania: tyle, ile ugra nawet przy najlepszej obronie, ale nie wyżej, niż trzeba do wygrania partii. Licytuje i wybiera oddawane karty według krótszego przeszukiwania tego samego rodzaju (18 000 pozycji na każdy wariant oddania kart), w licytacji o 10 punktów śmielej lub ostrożniej w tych samych sytuacjach co Tosia. W obronie, gdy jej punkty nic nie dają (800 punktów albo rozgrywający wygrałby partię), gra tylko na obalenie kontraktu. Wariant eksperymentalny z pełną wiedzą o kartach.':
    'Knows every hand and the musik. Searches the play with alpha-beta (declarer against both defenders) over up to 150,000 positions per move, deepening trick by trick; from the third trick on the search usually reaches the end of the deal. Declares the contract from that search: what can be made even against the best defence, but no higher than needed to win the match. Bids and chooses gifts from a shorter search of the same kind (18,000 positions per gift option), in the auction 10 points more boldly or more carefully in the same situations as Tosia. When defending with nothing to gain from own points (800 points, or the declarer would win the match), plays only to defeat the contract. An experimental variant with full knowledge of the cards.',
}
