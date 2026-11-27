import { describe, expect, it } from 'vitest'
import { Color, cards } from '../engine/Card'
import { Deal } from '../engine/Deal'
import type { DealRecord, HistoryEntry, MatchStatus } from '../engine/Game'
import { PlayerType } from '../engine/PlayerType'
import type { MeldSystem } from '../engine/rules'
import { setLanguage, t as translate } from '../i18n'
import {
  MELD_SYSTEM_NAMES,
  activityText,
  bidText,
  contractHint,
  liveText,
  seatNames,
  formatNumber,
  joinNames,
  matchEnd,
  meldRulesText,
  meldSystemInPlay,
  meldSystemPending,
  meldValue,
  meldValuesLabel,
  meldValuesText,
  nearestOption,
  playHint,
  playRule,
  pluralForm,
  seatSide,
  signed,
  stepOption,
  suitName,
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
function dealFor(hands: string[], musik: string, meldSystem?: MeldSystem): Deal {
  return Deal.deal(2, cards(`${hands.join(' ')} ${musik}`), { meldSystem })
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

  it('tells seats with the same bot apart by their side', () => {
    const { Human, Tactical, Rollout } = PlayerType
    expect(seatNames([Human, Tactical, Rollout], t)).toEqual(['Ty', 'Tosia', 'Bruno'])
    expect(seatNames([Human, Tactical, Tactical], t)).toEqual([
      'Ty',
      'Tosia (z lewej)',
      'Tosia (z prawej)',
    ])
    expect(seatNames([Rollout, Tactical, Rollout], t)).toEqual([
      'Bruno (na dole)',
      'Tosia',
      'Bruno (z prawej)',
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
    [
      { ...base, kind: 'result', value: 120, contract: 120, made: true },
      'ugrywa 120 (+120)',
    ],
    [
      { ...base, kind: 'result', value: -120, contract: 120, made: false },
      'nie ugrywa 120 (−120)',
    ],
  ]
  it.each(cases)('describes %o', (entry, text) => {
    expect(activityText(entry, name, t)).toBe(text)
  })

  const yourCases: [HistoryEntry, string][] = [
    [{ ...base, kind: 'deal' }, 'rozdajesz'],
    [{ ...base, kind: 'opening', value: 100 }, 'otwierasz: 100'],
    [{ ...base, kind: 'bid', value: 110 }, 'licytujesz 110'],
    [{ ...base, kind: 'pass' }, 'pasujesz'],
    [{ ...base, kind: 'bidWon', value: 120 }, 'wygrywasz licytację: 120'],
    [{ ...base, kind: 'take', cards: ['A♥', '9♠', 'K♦'] }, 'bierzesz musik'],
    [{ ...base, kind: 'give', to: 2 }, 'oddajesz kartę → Bruno'],
    [{ ...base, kind: 'contract', value: 120 }, 'grasz za 120'],
    [{ ...base, kind: 'play', card: 'A♥' }, 'zagrywasz A♥'],
    [{ ...base, kind: 'meld', color: Color.Kier, value: 100 }, 'meldujesz ♥ +100'],
    [{ ...base, kind: 'trick', value: 21 }, 'bierzesz lewę (+21)'],
    [
      { ...base, kind: 'result', value: 120, contract: 120, made: true },
      'ugrywasz 120 (+120)',
    ],
    [
      { ...base, kind: 'result', value: -120, contract: 120, made: false },
      'nie ugrywasz 120 (−120)',
    ],
  ]
  it.each(yourCases)('speaks to the human seat: %o', (entry, text) => {
    expect(activityText(entry, name, t, true)).toBe(text)
  })

  it('announces the rivals’ moves, but not what the status line says', () => {
    const live = (entry: HistoryEntry, you = false, received?: string) =>
      liveText(entry, name, t, you, received)
    expect(live({ ...base, kind: 'pass' })).toBe('Tosia pasuje')
    expect(live({ ...base, kind: 'contract', value: 130 })).toBe('Tosia gra za 130')
    expect(live({ ...base, kind: 'play', card: 'K♠' })).toBe('Tosia zagrywa K♠')
    expect(live({ ...base, kind: 'meld', color: Color.Kier, value: 100 })).toBe(
      'Tosia melduje ♥ +100 · nowy atut',
    )
    // Only a card given to the human is named.
    expect(live({ ...base, kind: 'give', to: 0 }, false, 'K♦')).toBe('Tosia oddaje Ci K♦')
    expect(live({ ...base, kind: 'give', to: 2 })).toBe('Tosia oddaje kartę: Bruno')
    expect(live({ ...base, kind: 'trick', value: 21 })).toBe('')
    expect(live({ ...base, kind: 'bidWon', value: 120 })).toBe('')
    expect(live({ ...base, kind: 'result', value: 120, contract: 120, made: true })).toBe(
      '',
    )
    // The human's own moves are not repeated; an automatic marriage is.
    expect(live({ ...base, kind: 'play', card: 'K♠' }, true)).toBe('')
    expect(live({ ...base, kind: 'bid', value: 110 }, true)).toBe('')
    expect(live({ ...base, kind: 'meld', color: Color.Pik, value: 40 }, true)).toBe(
      'Meldujesz ♠ +40 · nowy atut',
    )
  })

  it('shows auction bubbles', () => {
    expect(bidText(null, t)).toBeNull()
    expect(bidText(110, t)).toBe('110')
    expect(bidText('pass', t)).toBe('pas')
  })
})

describe('play rules', () => {
  const rule = (hand: string, trick: string, trump: Color | null = null) =>
    playRule(cards(hand), cards(trick), trump)
  const card = (id: string) => cards(id)[0]

  it('lets the leader play anything', () => {
    expect(rule('A♥ 9♠', '')).toEqual({ kind: 'lead' })
  })

  it('forces beating the winning card of the led suit', () => {
    expect(rule('A♣ K♣ 9♥', '10♣')).toEqual({
      kind: 'overtake',
      suit: Color.Trefl,
      beat: card('10♣'),
    })
    // The second card already beats the lead: beat the king, not the jack.
    expect(rule('A♣ Q♣', 'J♣ K♣')).toMatchObject({ kind: 'overtake', beat: card('K♣') })
  })

  it('only asks to follow when the suit cannot win', () => {
    expect(rule('Q♣ 9♣ A♥', 'K♣')).toEqual({
      kind: 'follow',
      suit: Color.Trefl,
      beat: card('K♣'),
      reason: 'lower',
    })
    // A trumped trick cannot be won with the led suit: any card of it.
    expect(rule('A♣ 9♣', 'K♣ 9♥', Color.Kier)).toEqual({
      kind: 'follow',
      suit: Color.Trefl,
      beat: card('9♥'),
      reason: 'trumped',
    })
  })

  it('forces a winning trump when void in the led suit', () => {
    expect(rule('9♥ A♠', 'A♦', Color.Kier)).toEqual({
      kind: 'trump',
      suit: Color.Karo,
      trump: Color.Kier,
      beat: null,
    })
    expect(rule('A♥ 9♥ A♠', 'A♦ Q♥', Color.Kier)).toEqual({
      kind: 'trump',
      suit: Color.Karo,
      trump: Color.Kier,
      beat: card('Q♥'),
    })
  })

  it('allows any card when neither the suit nor a trump can win', () => {
    expect(rule('A♠ 9♥', 'A♦')).toMatchObject({ kind: 'any', reason: 'noTrump' })
    expect(rule('A♠ 9♣', 'A♦', Color.Kier)).toMatchObject({
      kind: 'any',
      reason: 'noTrumpCards',
    })
    // No forced under-trumping: 9♥ cannot beat Q♥.
    expect(rule('9♥ A♠', 'A♦ Q♥', Color.Kier)).toEqual({
      kind: 'any',
      suit: Color.Karo,
      beat: card('Q♥'),
      reason: 'lowTrumps',
    })
  })
})

describe('contract hints', () => {
  const RIVALS = ['9♥ J♦ 9♦ J♣ 9♣ J♠ 9♠', 'A♦ 10♦ A♣ 10♣ 10♥ A♥ Q♣']
  /** Seat 0 outbids seat 1 with `bid`, takes the musik and gives two cards. */
  function contractDeal(hands: string[], musik: string, bid: number, gifts: string[]) {
    const deal = dealFor(hands, musik)
    deal.apply({ type: 'bid', value: 110 })
    deal.apply({ type: 'pass' })
    deal.apply({ type: 'bid', value: bid })
    deal.apply({ type: 'pass' })
    deal.apply({ type: 'take' })
    deal.apply({ type: 'give', card: cards(gifts[0])[0], to: 1 })
    deal.apply({ type: 'give', card: cards(gifts[1])[0], to: 2 })
    return deal
  }

  it('explains why the contract cannot be raised', () => {
    // Bid up to the ♠ limit of 160; the musik marriages were given away.
    const atLimit = contractDeal(['K♠ Q♠ A♠ 10♠ K♥ K♦ K♣', ...RIVALS], 'Q♥ J♥ Q♦', 160, [
      'Q♥',
      'Q♦',
    ])
    expect(atLimit.contractOptions()).toEqual([160])
    expect(contractHint(atLimit, t)).toBe(
      'Kontrakt zostaje przy 160 — to Twój limit z meldunkiem.',
    )
    // The ♦ marriage given away after bidding 200: ♠ alone allows only 160.
    const above = contractDeal(['K♠ Q♠ A♠ 10♠ K♦ Q♦ J♥', ...RIVALS], 'K♥ Q♥ K♣', 200, [
      'Q♦',
      'Q♥',
    ])
    expect(above.contractOptions()).toEqual([200])
    expect(contractHint(above, t)).toBe('Kontrakt zostaje przy wylicytowanych 200.')
    // No marriage at all.
    const none = contractDeal(
      ['A♠ 10♠ J♥ 9♥ J♦ 9♦ K♠', 'K♥ Q♥ K♦ Q♦ 9♣ J♠ 9♠', RIVALS[1]],
      'J♣ K♣ Q♠',
      120,
      ['Q♠', 'J♣'],
    )
    expect(none.contractOptions()).toEqual([120])
    expect(contractHint(none, t)).toBe('Bez meldunku kontrakt zostaje przy 120.')
    // Room to raise.
    const raise = contractDeal(['K♠ Q♠ A♠ 10♠ K♥ J♥ Q♦', ...RIVALS], 'Q♥ K♦ K♣', 120, [
      'J♥',
      'K♣',
    ])
    expect(contractHint(raise, t)).toBe('Możesz podnieść kontrakt do 340.')
  })
})

describe('play hints and marriages', () => {
  // Seat 0 holds the ♥ and ♠ marriages and no diamonds; seat 2 has no clubs.
  const hands = [
    'A♥ K♥ Q♥ 10♣ J♣ 9♠ K♠',
    'A♣ K♣ Q♣ J♥ 9♣ 10♦ A♠',
    'A♦ K♦ Q♦ J♦ 10♥ 9♥ 9♦',
  ]
  const musik = 'Q♠ J♠ 10♠'
  const play = (deal: Deal, id: string) =>
    deal.apply({ type: 'play', card: cards(id)[0] })
  const playable = (deal: Deal) => deal.playableCards().map(card => card.id)
  const start = () => toPlay(dealFor(hands, musik), ['J♠', '10♠'])

  it('asks to lead, then to overtake, then allows any card', () => {
    const deal = start()
    expect(playHint(deal, t)).toBe('Wyjdź dowolną kartą · K lub Q z pary to meldunek')
    play(deal, '10♣')
    expect(playable(deal)).toEqual(['A♣'])
    expect(playHint(deal, t)).toBe('Dołóż do koloru ♣ i przebij 10♣')
    play(deal, 'A♣')
    expect(playHint(deal, t)).toBe(
      'Dowolna karta · nie masz koloru ♣, a atutu jeszcze nie ma',
    )
    play(deal, '9♦')
    // Seat 1 leads K♣; seat 0 keeps only J♣, which cannot beat it.
    expect(deal.turn).toBe(1)
    play(deal, 'K♣')
    play(deal, '9♥')
    expect(playHint(deal, t)).toBe('Dołóż do koloru ♣ · nie przebijesz K♣')
  })

  it('shows the marriage bonus when leading, from the first trick on', () => {
    const deal = start()
    const king = cards('K♥')[0]
    expect(deal.trickNumber).toBe(0)
    expect(meldValue(deal, king)).toBe(100)
    expect(meldValue(deal, cards('Q♠')[0])).toBe(40)
    expect(meldValue(deal, cards('10♣')[0])).toBe(0)
    play(deal, 'K♥')
    expect(deal.trump).toBe(Color.Kier)
    expect(deal.meldPointsOf(0)).toBe(100)
    // Following does not declare: seat 1 has J♥ only, seat 2 must beat with 10♥.
    expect(playHint(deal, t)).toBe('Dołóż do koloru ♥ · nie przebijesz K♥')
    play(deal, 'J♥')
    expect(meldValue(deal, cards('10♥')[0])).toBe(0)
    expect(playable(deal)).toEqual(['10♥'])
    expect(playHint(deal, t)).toBe('Dołóż do koloru ♥ i przebij K♥')
  })

  it('shows the marriage bonus in the values of the deal', () => {
    const deal = toPlay(dealFor(hands, musik, 'german'), ['J♠', '10♠'])
    expect(meldValue(deal, cards('K♥')[0])).toBe(60)
    expect(meldValue(deal, cards('Q♠')[0])).toBe(80)
    play(deal, 'K♥')
    expect(deal.meldPointsOf(0)).toBe(60)
  })

  it('asks for a winning trump when out of the led suit', () => {
    const deal = start()
    for (const id of ['K♥', 'J♥', '10♥']) play(deal, id)
    // 10♥ beats the king, so seat 2 leads diamonds; seat 0 has none.
    expect(deal.turn).toBe(2)
    play(deal, 'A♦')
    expect(playable(deal)).toEqual(['A♥', 'Q♥'])
    expect(playHint(deal, t)).toBe('Przebij atutem ♥ · nie masz koloru ♦')
    play(deal, 'Q♥')
    expect(playHint(deal, t)).toBe('Dołóż do koloru ♦ · lewa jest już przebita atutem')
  })
})

describe('marriage values', () => {
  /** English test translator for the suit names. */
  const english: Translate = source =>
    ({ kier: 'hearts', karo: 'diamonds', trefl: 'clubs', pik: 'spades' })[source] ??
    source

  const hands = [
    'A♥ K♥ Q♥ 10♣ J♣ 9♠ K♠',
    'A♣ K♣ Q♣ J♥ 9♣ 10♦ A♠',
    'A♦ K♦ Q♦ J♦ 10♥ 9♥ 9♦',
  ]

  it('lists the values of each system, the most valuable first', () => {
    // Each symbol stays with its value on a no-break space.
    const text = (system: MeldSystem, separator?: string) =>
      meldValuesText(system, separator).replaceAll('\u00a0', '_')
    expect(text('classic')).toBe('♥_100 · ♦_80 · ♣_60 · ♠_40')
    expect(text('german')).toBe('♣_100 · ♠_80 · ♥_60 · ♦_40')
    expect(text('german', ', ')).toBe('♣_100, ♠_80, ♥_60, ♦_40')
  })

  it('names the suits for screen readers', () => {
    expect(suitName(Color.Kier, t)).toBe('kier')
    expect(suitName(Color.Pik, english)).toBe('spades')
    expect(meldValuesLabel('classic', t)).toBe('kier 100, karo 80, trefl 60, pik 40')
    expect(meldValuesLabel('german', t)).toBe('trefl 100, pik 80, kier 60, karo 40')
    expect(meldValuesLabel('german', english)).toBe(
      'clubs 100, spades 80, hearts 60, diamonds 40',
    )
  })

  it('names both systems after their suits in value order', () => {
    expect(MELD_SYSTEM_NAMES).toEqual({
      classic: 'Kier, karo, trefl, pik',
      german: 'Żołądź, wino, serce, dzwonek',
    })
  })

  it('tells when a new system waits for the next deal', () => {
    const deal = dealFor(hands, 'Q♠ J♠ 10♠', 'german')
    const pending = (
      status: MatchStatus,
      meldSystem: MeldSystem,
      current: Deal | null = deal,
    ) => meldSystemPending({ status, meldSystem, deal: current })
    expect(pending('playing', 'german')).toBe(false)
    expect(pending('playing', 'classic')).toBe(true)
    expect(pending('dealEnd', 'classic')).toBe(true)
    // No deal in progress: the choice applies to the first deal.
    expect(pending('setup', 'classic', null)).toBe(false)
    expect(pending('gameOver', 'classic')).toBe(false)
  })

  it('keeps the values of the deal in progress until the next deal', () => {
    const deal = dealFor(hands, 'Q♠ J♠ 10♠', 'german')
    const inPlay = (
      status: MatchStatus,
      meldSystem: MeldSystem,
      current: Deal | null = deal,
    ) => meldSystemInPlay({ status, meldSystem, deal: current })
    expect(inPlay('playing', 'classic')).toBe('german')
    expect(inPlay('dealEnd', 'classic')).toBe('german')
    expect(inPlay('playing', 'german')).toBe('german')
    expect(inPlay('setup', 'classic', null)).toBe('classic')
    expect(inPlay('gameOver', 'classic')).toBe('classic')
  })

  describe('rule 06 on marriages', () => {
    const classicDeal = dealFor(hands, 'Q♠ J♠ 10♠')
    const germanDeal = dealFor(hands, 'Q♠ J♠ 10♠', 'german')
    const rule = (
      status: MatchStatus,
      meldSystem: MeldSystem,
      current: Deal | null,
      translate: Translate = t,
    ) =>
      meldRulesText({ status, meldSystem, deal: current }, translate).replaceAll(' ', ' ')
    const lead =
      'Gdy wychodzisz do dowolnej lewy — także pierwszej — królem lub damą i masz drugą kartę pary, meldunek zgłasza się sam:'
    const trump = 'Kolor meldunku staje się atutem i zastępuje poprzedni.'
    const suits = 'Żołądź to ♣, wino ♠, serce ♥, dzwonek ♦.'
    const classicValues = '♥ 100, ♦ 80, ♣ 60, ♠ 40'
    const germanValues = '♣ 100, ♠ 80, ♥ 60, ♦ 40'

    it('gives the chosen values and offers the other system', () => {
      expect(rule('setup', 'classic', null)).toBe(
        `${lead} ${classicValues}. ${trump} To wartości „Kier, karo, trefl, pik”; w Ustawieniach możesz wybrać „Żołądź, wino, serce, dzwonek”: ${germanValues}. ${suits}`,
      )
      expect(rule('playing', 'german', germanDeal)).toBe(
        `${lead} ${germanValues}. ${trump} To wartości „Żołądź, wino, serce, dzwonek”; w Ustawieniach możesz wybrać „Kier, karo, trefl, pik”: ${classicValues}. ${suits}`,
      )
    })

    it('gives the values of the deal in progress while a new choice waits', () => {
      // A classic deal is under way; German values were chosen for the next one.
      expect(rule('playing', 'german', classicDeal)).toBe(
        `${lead} ${classicValues}. ${trump} W tym rozdaniu obowiązują wartości „Kier, karo, trefl, pik”. Od następnego rozdania: „Żołądź, wino, serce, dzwonek” — ${germanValues}. ${suits}`,
      )
      expect(rule('dealEnd', 'classic', germanDeal)).toContain(`sam: ${germanValues}.`)
      // The match is over: the next match starts with the chosen values.
      expect(rule('gameOver', 'german', classicDeal)).toContain(`sam: ${germanValues}.`)
    })

    it('translates the waiting choice', () => {
      setLanguage('en')
      try {
        const text = rule('playing', 'german', classicDeal, translate)
        expect(text).toContain(`declared automatically: ${classicValues}.`)
        expect(text).toContain(
          `This deal keeps the “Hearts, diamonds, clubs, spades” values. From the next deal: “Acorns, leaves, hearts, bells” — ${germanValues}.`,
        )
      } finally {
        setLanguage('pl')
      }
    })
  })
})

describe('match end', () => {
  const record = (declarer: number, totals: number[]): DealRecord => ({
    number: 9,
    dealer: 0,
    declarer,
    contract: 120,
    made: true,
    points: [0, 0, 0],
    deltas: [0, 0, 0],
    locked: [false, false, false],
    totals,
  })

  it('names the declarer who reached the target', () => {
    expect(matchEnd(record(1, [500, 1010, 640]), [1], 1000)).toEqual({
      kind: 'declarer',
      rivals: [],
    })
    // A defender with more points does not win against the declarer at 1000.
    expect(matchEnd(record(1, [1020, 1000, 640]), [1], 1000)).toEqual({
      kind: 'declarer',
      rivals: [0],
    })
  })

  it('falls back to the highest total', () => {
    expect(matchEnd(record(1, [1010, 870, 640]), [0], 1000)).toEqual({
      kind: 'highest',
    })
  })
})
