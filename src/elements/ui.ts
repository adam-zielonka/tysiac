import { Card, type Color } from '../engine/Card'
import type { Bid, Deal } from '../engine/Deal'
import type { DealRecord, HistoryEntry } from '../engine/Game'
import { MARRIAGE_POINTS, beats, legalPlays, trickWinnerIndex } from '../engine/rules'

export type Translate = (
  source: string,
  values?: Record<string, string | number>,
) => string

export type Side = 'bottom' | 'left' | 'right'

/** Label above a card: a marriage bonus, or a note such as "from the musik". */
export type CardTag = { text: string; kind: 'meld' | 'note' } | null

/** Seat 0 sits at the bottom; play goes clockwise to the left and then the right seat. */
export function seatSide(seat: number): Side {
  return seat === 0 ? 'bottom' : seat === 1 ? 'left' : 'right'
}

/** Formats a number with a typographic minus sign. */
export function formatNumber(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : String(value)
}

/** Score change with an explicit sign: +120, −120, 0. */
export function signed(value: number): string {
  return value > 0 ? `+${value}` : formatNumber(value)
}

/** The option closest to `value` (options are sorted ascending). */
export function nearestOption(options: readonly number[], value: number): number {
  if (!options.length) return value
  return options.reduce((best, option) =>
    Math.abs(option - value) < Math.abs(best - value) ? option : best,
  )
}

/** Moves a stepper one option up or down, staying within the options. */
export function stepOption(
  options: readonly number[],
  value: number,
  direction: -1 | 1,
): number {
  if (!options.length) return value
  const index = options.indexOf(nearestOption(options, value))
  return options[Math.min(options.length - 1, Math.max(0, index + direction))]
}

/** Polish plural form; English keys map the "few" and "many" forms to the same text. */
export function pluralForm(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  if (count === 1) return one
  const tens = count % 100
  const units = count % 10
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many
}

export function suitText(color: Color): string {
  return Card.colorToString(color)
}

/** Text of an auction speech bubble: "110" or "pas". */
export function bidText(bid: Bid, t: Translate): string | null {
  if (bid === null) return null
  return bid === 'pass' ? t('pas') : String(bid)
}

/** Marriage points declared by playing this card now, or 0. */
export function meldValue(deal: Deal, card: Card): number {
  return deal.isMeld(card) ? MARRIAGE_POINTS[card.color] : 0
}

/** Translated activity text for a history entry (without the player's name). */
export function activityText(
  entry: HistoryEntry,
  name: (seat: number) => string,
  t: Translate,
): string {
  switch (entry.kind) {
    case 'deal':
      return t('rozdaje')
    case 'opening':
      return t('otwiera: {value}', { value: entry.value })
    case 'bid':
      return t('licytuje {value}', { value: entry.value })
    case 'pass':
      return t('pasuje')
    case 'bidWon':
      return t('wygrywa licytację: {value}', { value: entry.value })
    case 'take':
      return t('bierze musik')
    case 'give':
      return t('oddaje kartę → {name}', { name: name(entry.to) })
    case 'contract':
      return t('gra za {value}', { value: entry.value })
    case 'play':
      return t('zagrywa {card}', { card: entry.card })
    case 'meld':
      return t('melduje {suit} +{value}', {
        suit: suitText(entry.color),
        value: entry.value,
      })
    case 'trick':
      return t('bierze lewę (+{value})', { value: entry.value })
    case 'result':
      return entry.made
        ? t('ugrywa {value}', { value: formatNumber(entry.value) })
        : t('nie ugrywa {value}', { value: formatNumber(entry.value) })
  }
}

/**
 * What the Polish overtaking rule asks of the player to move:
 * - `lead`: an empty trick, any card;
 * - `overtake`: follow suit and beat `beat` (the card winning so far);
 * - `follow`: follow suit with any card, because the trick is already
 *   trumped or nothing in the suit beats `beat`;
 * - `trump`: void in the led suit, win with a trump (higher than `beat`
 *   when the trick is already trumped);
 * - `any`: void and unable to win with a trump; under-trumping is never forced.
 */
export type PlayRule =
  | { kind: 'lead' }
  | { kind: 'overtake'; suit: Color; beat: Card }
  | { kind: 'follow'; suit: Color; beat: Card; reason: 'trumped' | 'lower' }
  | { kind: 'trump'; suit: Color; trump: Color; beat: Card | null }
  | {
      kind: 'any'
      suit: Color
      beat: Card
      reason: 'noTrump' | 'noTrumpCards' | 'lowTrumps'
    }

/** Classifies the legal plays (`legalPlays`) of `hand` for the current trick. */
export function playRule(
  hand: readonly Card[],
  trick: readonly Card[],
  trump: Color | null,
): PlayRule {
  if (!trick.length) return { kind: 'lead' }
  const suit = trick[0].color
  const beat = trick[trickWinnerIndex(trick, trump)]
  const playable = legalPlays(hand, trick, trump)
  const wins = playable.some(card => beats(card, beat, trump))
  if (hand.some(card => card.color === suit)) {
    if (wins) return { kind: 'overtake', suit, beat }
    const trumped = trump !== null && beat.color === trump && suit !== trump
    return { kind: 'follow', suit, beat, reason: trumped ? 'trumped' : 'lower' }
  }
  if (trump !== null && wins)
    return { kind: 'trump', suit, trump, beat: beat.color === trump ? beat : null }
  const reason =
    trump === null
      ? 'noTrump'
      : hand.some(card => card.color === trump)
        ? 'lowTrumps'
        : 'noTrumpCards'
  return { kind: 'any', suit, beat, reason }
}

/** Hint for the player to move, derived from the engine's legal plays. */
export function playHint(deal: Deal, t: Translate): string {
  const hand = deal.hand(deal.turn)
  const rule = playRule(
    hand,
    deal.trick.map(play => play.card),
    deal.trump,
  )
  switch (rule.kind) {
    case 'lead':
      return hand.some(card => deal.isMeld(card))
        ? t('Wyjdź dowolną kartą · K lub Q z pary to meldunek')
        : t('Wyjdź dowolną kartą')
    case 'overtake':
      return t('Dołóż do koloru {suit} i przebij {card}', {
        suit: suitText(rule.suit),
        card: rule.beat.text,
      })
    case 'follow':
      return rule.reason === 'trumped'
        ? t('Dołóż do koloru {suit} · lewa jest już przebita atutem', {
            suit: suitText(rule.suit),
          })
        : t('Dołóż do koloru {suit} · nie przebijesz {card}', {
            suit: suitText(rule.suit),
            card: rule.beat.text,
          })
    case 'trump':
      return rule.beat
        ? t('Przebij atutem wyższym niż {card} · nie masz koloru {suit}', {
            card: rule.beat.text,
            suit: suitText(rule.suit),
          })
        : t('Przebij atutem {trump} · nie masz koloru {suit}', {
            trump: suitText(rule.trump),
            suit: suitText(rule.suit),
          })
    case 'any':
      switch (rule.reason) {
        case 'noTrump':
          return t('Dowolna karta · nie masz koloru {suit}, a atutu jeszcze nie ma', {
            suit: suitText(rule.suit),
          })
        case 'noTrumpCards':
          return t('Dowolna karta · nie masz koloru {suit} ani atutu', {
            suit: suitText(rule.suit),
          })
        case 'lowTrumps':
          return t('Dowolna karta · nie masz atutu wyższego niż {card}', {
            card: rule.beat.text,
          })
      }
  }
}

/**
 * Why the match ended with these winners: the declarer who reaches the
 * target wins alone (`rivals` had as many points or more), otherwise the
 * highest total wins.
 */
export type MatchEnd = { kind: 'declarer'; rivals: number[] } | { kind: 'highest' }

export function matchEnd(
  record: DealRecord,
  winners: readonly number[],
  target: number,
): MatchEnd {
  const { declarer, totals } = record
  if (winners.length === 1 && winners[0] === declarer && totals[declarer] >= target) {
    const rivals = [0, 1, 2].filter(
      seat => seat !== declarer && totals[seat] >= totals[declarer],
    )
    return { kind: 'declarer', rivals }
  }
  return { kind: 'highest' }
}

/** Joins names as "A", "A i B", "A, B i C" (translated conjunction). */
export function joinNames(names: readonly string[], t: Translate): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} ${t('i')} ${names.at(-1)}`
}

/** Game pace presets: bot thinking time and how long a finished trick stays visible. */
export const PACES = [
  { label: 'Spokojne', think: 1200, trick: 1600 },
  { label: 'Normalne', think: 650, trick: 1100 },
  { label: 'Szybkie', think: 200, trick: 600 },
] as const
