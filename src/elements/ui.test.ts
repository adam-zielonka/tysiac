import { describe, expect, it } from 'vitest'
import { Color, cards } from '../engine/Card'
import { Deal } from '../engine/Deal'
import type { HistoryEntry } from '../engine/Game'
import {
  activityText,
  bidText,
  formatNumber,
  joinNames,
  meldValue,
  nearestOption,
  playHint,
  pluralForm,
  seatSide,
  signed,
  stepOption,
  type Translate,
} from './ui'

/** Polish identity translator: fills placeholders only. */
const t: Translate = (source, values = {}) =>
  source.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const names = ['Ty', 'Tosia', 'Bruno']
const name = (seat: number) => names[seat]

/**
 * Deck order: seat 0 gets cards 0–6, seat 1 cards 7–13, seat 2 cards 14–20,
 * musik 21–23. Dealer 2 makes seat 0 the opener.
 */
function dealFor(hands: string[], musik: string): Deal {
  return Deal.deal(2, cards(`${hands.join(' ')} ${musik}`))
}

/** Seat 0 wins the auction at 100, takes the musik and gives two cards away. */
function toPlay(deal: Deal, gifts: string[]): Deal {
  deal.apply({ type: 'pass' })
  deal.apply({ type: 'pass' })
  deal.apply({ type: 'take' })
  deal.apply({ type: 'give', card: cards(gifts[0])[0], to: 1 })
  deal.apply({ type: 'give', card: cards(gifts[1])[0], to: 2 })
  deal.apply({ type: 'contract', value: 100 })
  return deal
}

describe('seats and numbers', () => {
  it('places seats clockwise from the bottom', () => {
    expect([0, 1, 2].map(seatSide)).toEqual(['bottom', 'left', 'right'])
  })

  it('formats score changes with typographic signs', () => {
    expect(signed(120)).toBe('+120')
    expect(signed(-120)).toBe('−120')
    expect(signed(0)).toBe('0')
    expect(formatNumber(-30)).toBe('−30')
    expect(formatNumber(1000)).toBe('1000')
  })

  it('steps within the legal options', () => {
    const options = [110, 120, 130]
    expect(nearestOption(options, 90)).toBe(110)
    expect(nearestOption(options, 125)).toBe(120)
    expect(nearestOption(options, 400)).toBe(130)
    expect(nearestOption([], 100)).toBe(100)
    expect(stepOption(options, 110, 1)).toBe(120)
    expect(stepOption(options, 130, 1)).toBe(130)
    expect(stepOption(options, 110, -1)).toBe(110)
    expect(stepOption(options, 100, 1)).toBe(120)
    expect(stepOption([], 100, 1)).toBe(100)
  })

  it('chooses Polish plural forms', () => {
    const form = (n: number) => pluralForm(n, 'karta', 'karty', 'kart')
    expect([0, 1, 2, 4, 5, 10, 12, 14, 22, 25].map(form)).toEqual([
      'kart',
      'karta',
      'karty',
      'karty',
      'kart',
      'kart',
      'kart',
      'kart',
      'karty',
      'kart',
    ])
  })

  it('joins names with a translated conjunction', () => {
    expect(joinNames([], t)).toBe('')
    expect(joinNames(['Ada'], t)).toBe('Ada')
    expect(joinNames(['Ada', 'Bruno'], t)).toBe('Ada i Bruno')
    expect(joinNames(['Ada', 'Bruno', 'Tosia'], t)).toBe('Ada, Bruno i Tosia')
  })
})

describe('activity texts', () => {
  const base = { id: 1, deal: 1, player: 1 }
  const cases: [HistoryEntry, string][] = [
    [{ ...base, kind: 'deal' }, 'rozdaje'],
    [{ ...base, kind: 'opening', value: 100 }, 'otwiera: 100'],
    [{ ...base, kind: 'bid', value: 110 }, 'licytuje 110'],
    [{ ...base, kind: 'pass' }, 'pasuje'],
    [{ ...base, kind: 'bidWon', value: 120 }, 'wygrywa licytację: 120'],
    [{ ...base, kind: 'take', cards: ['A♥', '9♠', 'K♦'] }, 'bierze musik'],
    [{ ...base, kind: 'give', to: 2 }, 'oddaje kartę → Bruno'],
    [{ ...base, kind: 'contract', value: 120 }, 'gra za 120'],
    [{ ...base, kind: 'play', card: 'A♥' }, 'zagrywa A♥'],
    [{ ...base, kind: 'meld', color: Color.Kier, value: 100 }, 'melduje ♥ +100'],
    [{ ...base, kind: 'trick', value: 21 }, 'bierze lewę (+21)'],
    [{ ...base, kind: 'result', value: 120, made: true }, 'ugrywa 120'],
    [{ ...base, kind: 'result', value: -120, made: false }, 'nie ugrywa −120'],
  ]
  it.each(cases)('describes %o', (entry, text) => {
    expect(activityText(entry, name, t)).toBe(text)
  })

  it('shows auction bubbles', () => {
    expect(bidText(null, t)).toBeNull()
    expect(bidText(110, t)).toBe('110')
    expect(bidText('pass', t)).toBe('pas')
  })
})

describe('play hints and marriages', () => {
  // Seat 0 holds the ♥ marriage and no diamonds; seat 2 has no clubs.
  const hands = [
    'A♥ K♥ Q♥ 10♣ J♣ 9♠ K♠',
    'A♣ K♣ Q♣ J♥ 9♣ 10♦ A♠',
    'A♦ K♦ Q♦ J♦ 10♥ 9♥ 9♦',
  ]
  const musik = 'Q♠ J♠ 10♠'
  const play = (deal: Deal, id: string) =>
    deal.apply({ type: 'play', card: cards(id)[0] })
  const start = () => toPlay(dealFor(hands, musik), ['J♠', '10♠'])

  it('asks to lead, then to follow suit, then allows any card', () => {
    const deal = start()
    expect(playHint(deal, t)).toBe('Wyjdź dowolną kartą')
    play(deal, '10♣')
    expect(playHint(deal, t)).toBe('Dołóż do koloru ♣')
    play(deal, 'A♣')
    expect(playHint(deal, t)).toBe('Brak koloru i atutu — zagraj dowolną kartę')
  })

  it('shows the marriage bonus only when leading from the second trick', () => {
    const deal = start()
    const king = cards('K♥')[0]
    expect(meldValue(deal, king)).toBe(0)
    play(deal, 'A♥')
    play(deal, 'J♥')
    play(deal, '9♥')
    expect(deal.turn).toBe(0)
    expect(meldValue(deal, king)).toBe(100)
    expect(meldValue(deal, cards('10♣')[0])).toBe(0)
    play(deal, 'K♥')
    expect(deal.trump).toBe(Color.Kier)
    expect(playHint(deal, t)).toBe('Brak koloru i atutu — zagraj dowolną kartę')
    play(deal, '9♣')
    expect(playHint(deal, t)).toBe('Dołóż do koloru ♥')
  })

  it('asks for a trump when out of the led suit', () => {
    const deal = start()
    for (const id of ['A♥', 'J♥', '9♥', 'K♥', '9♣', '10♥']) play(deal, id)
    // 10♥ beats the king, so seat 2 leads diamonds; seat 0 has none but holds Q♥.
    expect(deal.turn).toBe(2)
    play(deal, 'A♦')
    expect(playHint(deal, t)).toBe('Brak koloru — przebij atutem ♥')
  })
})
