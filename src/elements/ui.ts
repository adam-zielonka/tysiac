import { Card, type Color } from '../engine/Card'
import type { Bid, Deal } from '../engine/Deal'
import type { HistoryEntry } from '../engine/Game'
import { MARRIAGE_POINTS } from '../engine/rules'

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

/** What the player to move must do with the current trick. */
export function playHint(deal: Deal, t: Translate): string {
  const lead = deal.trick[0]?.card
  if (!lead) return t('Wyjdź dowolną kartą')
  const hand = deal.hand(deal.turn)
  if (hand.some(card => card.color === lead.color))
    return t('Dołóż do koloru {suit}', { suit: lead.colorText })
  const trump = deal.trump
  if (trump !== null && hand.some(card => card.color === trump))
    return t('Brak koloru — przebij atutem {suit}', { suit: suitText(trump) })
  return t('Brak koloru i atutu — zagraj dowolną kartę')
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
