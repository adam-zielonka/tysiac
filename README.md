# Tysiąc

Polska gra karciana dla trzech osób przy jednym wirtualnym stole: licytacja,
musik, meldunki i partia do 1000 punktów. Grasz z komputerowymi przeciwnikami
albo obserwujesz ich grę. Interfejs działa na telefonie i komputerze, po polsku
i po angielsku, z tabelą wyników i historią ruchów.

Zagraj: https://adam-zielonka.github.io/tysiac/

Projekt wyrósł ze stołu i przeciwników gry [PAN](https://github.com/adam-zielonka/pan).

## Wybór graczy

Kliknij fotel przy stole, aby otworzyć kafelki przeciwników z krótkim opisem;
„Szczegóły” rozwijają dokładny opis strategii. Skład wybierasz przed partią;
„Rozdaj karty” ją rozpoczyna i blokuje zmiany. Własny fotel może też zająć
bot — wtedy obserwujesz grę. Domyślnie grają Tosia i Bruno. Ten sam bot może siedzieć w kilku fotelach; wtedy jego
imię uzupełnia strona stołu, np. „Tosia (z lewej)”. „Nowa partia” w trakcie gry
prosi o potwierdzenie, bo porzuca bieżący wynik.

## Przeciwnicy

- **Felek — losowy:** pasuje albo podbija o 10 z równą szansą, gra najniższy
  kontrakt, oddaje losowe karty i zagrywa losową dozwoloną kartę.
- **Bolek — zachłanny:** licytuje do oceny ręki bez zapasu, oddaje karty warte
  najmniej punktów (asy i karty meldunków tylko w ostateczności), wychodzi
  najsilniejszą kartą i bierze lewę najtańszą wystarczającą kartą.
- **Tosia — taktyczna:** licytuje do oceny ręki pomniejszonej o 10 punktów,
  podnosi kontrakt do oceny ośmiu kart minus 30. Pamięta zagrane karty i to,
  czego rywale nie mogą mieć, zgrywa pewne lewy, melduje, ściąga atuty, a w
  obronie dokłada punkty partnerowi. Jej taktyka dogrywa też symulacje Bruna
  i Montego.
- **Bruno — płaskie Monte Carlo:** każdą dozwoloną kartę sprawdza na tych samych
  100 losowych układach ukrytych kart. Licytuje na podstawie 150 symulacji
  (podbija przy co najmniej 60% szans), kontrakt wybiera z 200 symulacji,
  oddawane karty porównuje na 60 układach.
- **Monte — ISMCTS:** do 2000 iteracji przeszukiwania drzewa zbiorów informacji
  z UCT; w każdej losuje ukryte karty. Licytuje jak Bruno, ale już przy 55%.
- **Ada — alfa-beta:** **zna wszystkie ręce i musik** — to celowo jawny wariant
  eksperymentalny. Przeszukuje rozgrywkę (rozgrywający przeciw obu obrońcom)
  do 150 000 pozycji na ruch; od trzeciej lewy zwykle liczy dokładnie do końca.
  Licytuje i wybiera oddawane karty według krótszego przeszukiwania (18 000
  pozycji na każdy wariant oddania kart).

Tosia, Bruno, Monte i Ada znają stan partii. Licytują śmielej, gdy mają już
800 punktów (w obronie nic nie zapiszą) albo gdy prowadzący w licytacji rywal
mógłby dojść do 1000, a ostrożniej, gdy mają co najmniej 200 punktów przewagi
nad obojgiem rywali. Kontraktu nie podnoszą ponad to, co wygrywa partię. Felek
i Bolek grają bez względu na wynik.

Uczciwe boty dostają wyłącznie własny widok rozdania: swoją rękę, licytację,
zagrane karty, odkryty musik, zgłoszone meldunki i karty, których ktoś nie może
mieć (bo nie dołożył do koloru, nie przebił albo wyszedł królem lub damą bez
meldunku, więc nie ma drugiej karty pary). Losowane układy są z tym widokiem
zgodne, także z licytacją: kto licytował albo podniósł kontrakt powyżej 120,
miał meldunki warte co najmniej nadwyżkę. Ocena ręki w licytacji to model
liniowy dopasowany do 40 000 symulowanych rozdań.

Orientacyjne wyniki z serii 150 rozdań × 3 obroty foteli (średni zapis na
rozdanie, każdy bot przeciw dwóm Tosiom): Felek −28, Bolek +28, Bruno +48,
Monte +47, Ada +64. Bruno i Monte mieszczą się w granicach szumu. To pomiary
na ustalonych ziarnach losowania, nie skalibrowany ranking siły gry.
Najdłuższe decyzje (Ady) zajmowały w pomiarach na komputerze stacjonarnym
około 120–150 ms czasu procesora. Każda decyzja Bruna, Montego i Ady ma limit
250 ms: na wolniejszym urządzeniu przeszukiwanie może się skończyć wcześniej
(głównie u Ady), więc podane liczby symulacji, iteracji i pozycji to górne
granice.

## Zasady tej wersji

- **Talia:** 24 karty od 9 do asa. Starszeństwo: A, 10, K, D (Q), W (J), 9;
  punkty 11, 10, 4, 3, 2, 0 — razem 120.
- **Rozdanie:** po 7 kart, 3 do musiku. Rozdaje kolejno każdy gracz.
- **Licytacja:** gracz po rozdającym musi zacząć od 100. Licytuje się
  wielokrotności 10 (można przeskakiwać), pas jest ostateczny. Powyżej 120 tylko
  z meldunkiem w ręce, najwyżej do 120 plus wartość posiadanych meldunków.
- **Musik:** jest pokazywany wszystkim. Rozgrywający (zwycięzca licytacji)
  bierze go, oddaje po jednej karcie rywalom i może podnieść kontrakt.
- **Lewy:** trzeba dołożyć do koloru i przebić, jeśli się da. Bez koloru trzeba
  przebić atutem, jeśli któryś atut wygrywa lewę; nikt nie musi podbijać
  niższym atutem. Rozgrywający wychodzi do pierwszej lewy.
- **Meldunki:** wyjście królem lub damą z pary w ręce — w dowolnej lewie, także
  pierwszej — zgłasza meldunek automatycznie. Jego kolor staje się atutem.
  Wartości wybiera się w Ustawieniach („Wartości meldunków”): domyślnie
  „Kier, karo, trefl, pik” — ♥ 100, ♦ 80, ♣ 60, ♠ 40 — albo alternatywna
  punktacja „Żołądź, wino, serce, dzwonek”, nazwana od kolorów talii
  niemieckiej: żołądź (♣) 100, wino (♠) 80, serce (♥) 60, dzwonek (♦) 40.
  Karty zachowują francuskie symbole, a zmiana w trakcie partii obowiązuje od
  następnego rozdania. Wybór zapamiętuje przeglądarka.
- **Zapis:** rozgrywający dostaje kontrakt, jeśli zdobył co najmniej tyle punktów
  (karty i meldunki), w przeciwnym razie go traci. Obrońcy zapisują swoje
  punkty zaokrąglone do 10 (5 w górę).
- **Od 800 punktów** punkty zdobywa się tylko jako rozgrywający.
- **Koniec:** gdy ktoś ma co najmniej 1000. Jeśli dotarł do tego rozgrywający,
  wygrywa on; w przeciwnym razie wygrywa wyższy wynik (remis dzieli wygraną).

Ta wersja pomija bombę, ponowne rozdanie za cztery dziewiątki, grę we czterech,
rezygnację z meldunku i ukrywanie musiku.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup, structure and validation.
The bundled DM Sans font uses the [SIL Open Font License](src/assets/fonts/OFL.txt).

## Language / Język

The browser version supports Polish and English. On the first visit it uses the
first supported language from the browser’s preferences, falling back to English.
The Polski / English buttons in Settings save an explicit choice in this
application’s local storage. Switching language preserves the current game.
The marriage values chosen in Settings are saved the same way.
