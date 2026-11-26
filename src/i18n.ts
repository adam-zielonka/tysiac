import { readable, derived } from 'svelte/store'
import { strategyTranslations } from './engine/strategies'

export const PAGE_TITLE = 'Tysiąc — gra karciana'
export const PAGE_DESCRIPTION =
  'Tysiąc — klasyczna polska gra karciana dla trzech osób. Licytuj, melduj i ugraj kontrakt przeciwko botom z charakterem.'

/** Polish source text → English. Strategy texts come from the engine. */
const uiTranslations: Record<string, string> = {
  [PAGE_TITLE]: 'Tysiąc (Thousand) — card game',
  [PAGE_DESCRIPTION]:
    'Tysiąc (Thousand) — a classic Polish card game for three. Bid, declare marriages and make your contract against bots with character.',
  // Header and dialogs
  TYSIĄC: 'TYSIĄC',
  'Rozdaj karty': 'Deal cards',
  'Nowa partia': 'New match',
  'Ustawienia i pomoc': 'Settings and help',
  Ustawienia: 'Settings',
  'Zasady gry': 'Game rules',
  'Zamknij ustawienia': 'Close settings',
  'Zamknij zasady': 'Close rules',
  'Tempo gry': 'Game pace',
  Spokojne: 'Relaxed',
  Normalne: 'Normal',
  Szybkie: 'Fast',
  'Pokaż karty rywali': 'Show opponents’ cards',
  'Zacząć nową partię?': 'Start a new match?',
  'Bieżąca partia i jej wyniki zostaną porzucone. Wrócisz do wyboru graczy.':
    'The current match and its scores will be discarded. You will return to choosing players.',
  'Graj dalej': 'Keep playing',
  // Player picker
  'Wybierz gracza · fotel {seat}': 'Choose a player · seat {seat}',
  'Wybierz gracza: {name} · fotel {seat}': 'Choose player: {name} · seat {seat}',
  'Zamknij wybór gracza': 'Close player selection',
  'Kliknij kafelek, aby wybrać gracza.': 'Click a tile to choose a player.',
  'Kliknij kafelek, aby wybrać gracza. Wybierz bota, aby obserwować grę.':
    'Click a tile to choose a player. Choose a bot to watch the game.',
  Wybrany: 'Selected',
  'Znam wszystkie ręce': 'I know all hands',
  // Table
  'Stół do gry': 'Game table',
  PRZYGOTOWANIE: 'SETUP',
  ROZDANIE: 'DEAL',
  'GRA DO {target}': 'PLAYING TO {target}',
  'TYSIĄC · GRA KARCIANA': 'THOUSAND · CARD GAME',
  'Kliknij miejsce przy stole, aby wybrać gracza.':
    'Click a seat at the table to choose a player.',
  'Zakryta karta': 'Face-down card',
  '{count} karta': '{count} card',
  '{count} karty': '{count} cards',
  '{count} kart': '{count} cards',
  'Karty: {name}': 'Cards: {name}',
  'Twoja ręka': 'Your hand',
  'Twoje miejsce': 'Your seat',
  'Tu pojawią się Twoje karty.': 'Your cards will appear here.',
  'Rozdanie zakończone.': 'The deal is over.',
  'Obserwujesz grę': 'Watching the game',
  // Seat badges
  R: 'D',
  rozdaje: 'deals',
  '{score} pkt': '{score} pts',
  'rozgrywa za {value}': 'declarer, contract {value}',
  'lewy: {count}, punkty: {points}': 'tricks: {count}, points: {points}',
  'myśli…': 'thinking…',
  pas: 'pass',
  // Centre
  'Musik: 3 zakryte karty': 'Musik: 3 face-down cards',
  'Musik: {cards}': 'Musik: {cards}',
  Musik: 'Musik',
  'Najwyższa oferta': 'Highest bid',
  '{name} wygrywa licytację · {value}': '{name} wins the auction · {value}',
  '{name} oddaje po karcie rywalom': '{name} gives each opponent a card',
  '{name} ustala kontrakt': '{name} sets the contract',
  'Oddajesz po karcie rywalom': 'You give each opponent a card',
  'Ustalasz kontrakt': 'You set the contract',
  'Lewa: {cards}': 'Trick: {cards}',
  'Lewa jest pusta': 'The trick is empty',
  'Wychodzi: {name}': 'Lead: {name}',
  '{name} bierze lewę · +{points}': '{name} takes the trick · +{points}',
  'Bierzesz lewę · +{points}': 'You take the trick · +{points}',
  'Lewa {number} z 8': 'Trick {number} of 8',
  'Meldunek {suit} +{value} · nowy atut': 'Marriage {suit} +{value} · new trump',
  'Rozdaje: {name}': 'Dealer: {name}',
  'Otwiera: {name} · 100': 'Opens: {name} · 100',
  'Bez atutu': 'No trump',
  'Atut {suit}': 'Trump {suit}',
  'Kontrakt: {name} · {value}': 'Contract: {name} · {value}',
  'Ugrane: {points} pkt': 'Scored: {points} pts',
  // Deal summary
  'Koniec partii': 'Match over',
  'Koniec rozdania {number}': 'End of deal {number}',
  '{name} gra za {value}': '{name} plays for {value}',
  'Twój kontrakt: {value}': 'Your contract: {value}',
  '✓ Kontrakt ugrany ({points} pkt)': '✓ Contract made ({points} pts)',
  '✗ Kontrakt nieugrany ({points} pkt)': '✗ Contract failed ({points} pts)',
  'Wynik rozdania': 'Deal result',
  Gracz: 'Player',
  Karty: 'Cards',
  Meldunki: 'Marriages',
  Zapis: 'Score',
  Razem: 'Total',
  rozgrywający: 'declarer',
  'Wygrywasz partię!': 'You win the match!',
  'Remis: {names}': 'Tie: {names}',
  'Partię wygrywa {name}': '{name} wins the match',
  'Następne rozdanie': 'Next deal',
  i: 'and',
  // Status line
  'Wybierz graczy i rozdaj karty.': 'Choose players and deal the cards.',
  'Kliknij fotel, aby zmienić gracza.': 'Click a seat to change the player.',
  'Koniec partii · wygrywasz!': 'Match over · you win!',
  'Koniec partii · wygrywa {name}': 'Match over · {name} wins',
  '{name}: kontrakt {value} ugrany': '{name}: contract {value} made',
  'Twój kontrakt {value} ugrany!': 'Your contract {value} is made!',
  'Twój kontrakt {value} nieugrany': 'Your contract {value} failed',
  '{name}: kontrakt {value} nieugrany': '{name}: contract {value} failed',
  'Kliknij „Nowa partia”, aby zagrać ponownie.': 'Click “New match” to play again.',
  'Kliknij „Następne rozdanie”, aby grać dalej.': 'Click “Next deal” to continue.',
  'Twoja licytacja': 'Your bid',
  '{name} licytuje…': '{name} is bidding…',
  'Wygrywasz licytację · {value}': 'You win the auction · {value}',
  'Oddaj kartę: {name}': 'Give a card to: {name}',
  '{name} oddaje po karcie rywalom…': '{name} is giving each opponent a card…',
  'Ustal kontrakt': 'Set your contract',
  '{name} ustala kontrakt…': '{name} is setting the contract…',
  'Twój ruch': 'Your turn',
  '{name} wybiera kartę…': '{name} is choosing a card…',
  'Najwyższa: {value} · {name}': 'Highest: {value} · {name}',
  'Twój limit z meldunkiem: {value}': 'Your limit with marriages: {value}',
  'Powyżej 120 tylko z meldunkiem': 'Above 120 only with a marriage',
  'Trzy karty z musiku trafią do Twojej ręki.': 'The three musik cards go to your hand.',
  'Kliknij kartę, aby ją oddać.': 'Click a card to give it away.',
  'Możesz podnieść kontrakt do {value}.': 'You can raise the contract up to {value}.',
  'Bez meldunku kontrakt zostaje przy {value}.':
    'Without a marriage the contract stays at {value}.',
  'Wyjdź dowolną kartą': 'Lead any card',
  'Dołóż do koloru {suit}': 'Follow suit {suit}',
  'Brak koloru — przebij atutem {suit}': 'Out of suit — play a trump {suit}',
  'Brak koloru i atutu — zagraj dowolną kartę': 'No suit or trump — play any card',
  Wynik: 'Result',
  Licytacja: 'Auction',
  'Lewa {number}/8': 'Trick {number}/8',
  // Hand
  nowa: 'new',
  musik: 'musik',
  otrzymana: 'received',
  'z musiku': 'from the musik',
  'oddaj: {name}': 'give to: {name}',
  zagraj: 'play',
  'meldunek {suit} +{value}': 'marriage {suit} +{value}',
  // Actions
  Pas: 'Pass',
  'Wysokość licytacji': 'Bid amount',
  'Wysokość kontraktu': 'Contract amount',
  'Mniej o 10': '10 less',
  'Więcej o 10': '10 more',
  'Licytuj {value}': 'Bid {value}',
  Licytuj: 'Bid',
  'Weź musik': 'Take the musik',
  'Komu oddać kartę': 'Who gets the card',
  'Oddaj kartę:': 'Give a card to:',
  'Graj za {value}': 'Play for {value}',
  // Score table
  'Tabela wyników': 'Score sheet',
  'Gra do {target} punktów': 'Playing to {target} points',
  Nr: 'No.',
  Rozgrywka: 'Contract',
  ugrany: 'made',
  nieugrany: 'failed',
  'Jeszcze nie ma zapisanych rozdań.': 'No deals recorded yet.',
  // Activity
  'Ostatnie ruchy': 'Recent moves',
  'Historia ruchów': 'Move history',
  'Ruchy pojawią się po rozdaniu kart.': 'Moves will appear once the cards are dealt.',
  'otwiera: {value}': 'opens: {value}',
  'licytuje {value}': 'bids {value}',
  pasuje: 'passes',
  'wygrywa licytację: {value}': 'wins the auction: {value}',
  'bierze musik': 'takes the musik',
  'oddaje kartę → {name}': 'gives a card → {name}',
  'gra za {value}': 'plays for {value}',
  'zagrywa {card}': 'plays {card}',
  'melduje {suit} +{value}': 'declares {suit} +{value}',
  'bierze lewę (+{value})': 'takes the trick (+{value})',
  'ugrywa {value}': 'makes {value}',
  'nie ugrywa {value}': 'fails {value}',
  // Rules
  'Jak grać w Tysiąca?': 'How do you play Tysiąc?',
  '01 · Talia i rozdanie': '01 · Deck and deal',
  'Trzech graczy, 24 karty od 9 do asa. Każdy dostaje 7 kart, a 3 zakryte tworzą musik. Rozdający zmienia się co rozdanie.':
    'Three players, 24 cards from nine to ace. Everyone gets 7 cards and 3 face-down cards form the musik (talon). The dealer moves on every deal.',
  '02 · Licytacja': '02 · Auction',
  'Gracz po rozdającym musi otworzyć 100. Dalej każdy podbija o 10 albo pasuje — pas jest ostateczny. Powyżej 120 można licytować tylko z meldunkiem w ręce (limit: 120 + wartość meldunków). Wygrywa ostatni, który nie spasował.':
    'The player after the dealer must open at 100. Then everyone raises by 10 or passes — a pass is final. Above 120 you may bid only with a marriage in hand (limit: 120 + the value of your marriages). The last player who has not passed wins.',
  '03 · Musik i kontrakt': '03 · Musik and contract',
  'Musik zostaje odkryty. Rozgrywający bierze go, oddaje każdemu rywalowi po jednej zakrytej karcie i ustala kontrakt: co najmniej wylicytowaną wartość.':
    'The musik is turned face up. The declarer takes it, gives each opponent one card face down and sets the contract: at least the winning bid.',
  '04 · Lewy': '04 · Tricks',
  'Osiem lew, pierwszą zaczyna rozgrywający. Trzeba dołożyć do koloru; bez koloru trzeba dać atut, jeśli jest; nie trzeba przebijać wyżej. Lewę bierze najwyższy atut, a bez niego najwyższa karta koloru wyjścia. Starszeństwo: A, 10, K, Q, J, 9.':
    'Eight tricks; the declarer leads the first. You must follow suit; if you cannot, you must play a trump when one is declared and you hold it; you never have to play higher. The highest trump wins the trick, otherwise the highest card of the suit led. Order: A, 10, K, Q, J, 9.',
  '05 · Meldunki': '05 · Marriages',
  'Od drugiej lewy wyjście królem lub damą, gdy masz parę, to meldunek: ♥ 100, ♦ 80, ♣ 60, ♠ 40. Kolor meldunku staje się atutem.':
    'From the second trick on, leading a king or queen while holding the pair declares a marriage: ♥ 100, ♦ 80, ♣ 60, ♠ 40. That suit becomes trump.',
  '06 · Punkty': '06 · Points',
  'Karty: A 11, 10 10, K 4, Q 3, J 2, 9 0 — razem 120. Rozgrywający dostaje +kontrakt, gdy karty i meldunki dadzą co najmniej tyle, inaczej −kontrakt. Obrońcy zapisują swoje punkty zaokrąglone do 10.':
    'Cards: A 11, 10 10, K 4, Q 3, J 2, 9 0 — 120 in total. The declarer scores +contract when cards and marriages reach at least that much, otherwise −contract. Defenders score their own points rounded to the nearest 10.',
  '07 · Koniec partii': '07 · End of the match',
  'Po rozdaniu, w którym ktoś ma co najmniej 1000 punktów, wygrywa najwyższy wynik. Remis dzieli zwycięstwo.':
    'After a deal in which someone reaches at least 1000 points, the highest total wins. A tie shares the victory.',
  'Ta wersja pomija beczkę, bombę, ponowne rozdanie za cztery dziewiątki i grę we czterech.':
    'This version leaves out the barrel, the bomb, redeals for four nines and the four-player game.',
}

const translations: Record<string, string> = {
  ...strategyTranslations,
  ...uiTranslations,
}

/** True when `source` has an English translation (used by tests). */
export function hasTranslation(source: string): boolean {
  return source.replace(/\s+/g, ' ').trim() in translations
}

export type Language = 'pl' | 'en'
const storageKey = 'tysiac-language'
export function detectLanguage(
  saved: string | null,
  languages: readonly string[],
): Language {
  if (saved === 'pl' || saved === 'en') return saved
  for (const language of languages) {
    const code = language.toLowerCase().split(/[-_]/)[0]
    if (code === 'pl' || code === 'en') return code
  }
  return 'en'
}
function initialLanguage(): Language {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(storageKey)
  } catch {
    /* Storage may be blocked. */
  }
  return detectLanguage(
    saved,
    typeof navigator === 'undefined'
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language],
  )
}
export let language = initialLanguage()
const listeners = new Set<() => void>()
export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function setLanguage(value: Language) {
  language = value
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    /* Switching still works without persistence. */
  }
  updateDocument()
  listeners.forEach(listener => listener())
}
export function t(source: string, values: Record<string, string | number> = {}): string {
  const key = source.replace(/\s+/g, ' ').trim()
  const translated = language === 'en' ? (translations[key] ?? source) : source
  return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
    String(values[key] ?? match),
  )
}
function updateDocument() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language
  document.title = t(PAGE_TITLE)
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', t(PAGE_DESCRIPTION))
}
updateDocument()

export const locale = readable(language, set => subscribe(() => set(language)))
export const tr = derived(
  locale,
  () => (source: string, values?: Record<string, string | number>) => t(source, values),
)
