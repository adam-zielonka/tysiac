import { ALL_CARDS, Card, cardById } from './Card'
import { Deal } from './Deal'
import { HAND_SIZE, PLAYER_COUNT, nextSeat } from './rules'
import { randomInt, shuffle, type Random } from './random'

/** Holder index used for the face-down musik during the auction. */
const MUSIK = PLAYER_COUNT

/**
 * Builds a complete deal consistent with what the viewer knows: its own hand,
 * played cards, the revealed musik, gifts it gave or received, publicly known
 * marriage partners and inferred voids. Hidden cards are distributed at
 * random. Void constraints are relaxed only if no consistent deal is found.
 *
 * A defender does not see which cards the declarer handed out. Revealed
 * musik cards are kept with the declarer, except that the other defender
 * holds one of them with the chance of a random gift (one of nine cards).
 */
export function sampleDeal(view: Deal, random: Random = Math.random): Deal {
  const viewer = view.s.viewer
  if (viewer === null) return view.clone()
  const s = view.s
  const counts = s.hiddenCounts ?? s.hands.map(hand => hand.length)

  const seen = new Set<Card>(s.hands[viewer])
  s.played.forEach(play => seen.add(play.card))
  if (s.phase === 'musik') s.musik.forEach(card => seen.add(card))

  const fixed = new Map<Card, number>()
  const fix = (card: Card, holder: number) => {
    if (!seen.has(card) && holder !== viewer) fixed.set(card, holder)
  }
  for (const [id, holder] of Object.entries(s.knownHolders)) {
    const known = cardById(id)
    if (known) fix(known, holder)
  }
  s.gifts.forEach(gift => fix(gift.card, gift.to))

  const declarer = s.declarer
  const musikTaken = declarer >= 0 && s.phase !== 'bidding' && s.phase !== 'musik'
  const defenderView = musikTaken && viewer !== declarer
  const other = defenderView
    ? [0, 1, 2].find(seat => seat !== viewer && seat !== declarer)!
    : -1
  const otherReceived =
    defenderView && (s.phase !== 'giving' || counts[other] > HAND_SIZE)
  const otherPlayedMusik =
    defenderView &&
    s.played.some(play => play.player === other && s.musikCards.includes(play.card))
  const hiddenMusik = defenderView
    ? s.musikCards.filter(card => !seen.has(card) && !fixed.has(card))
    : []
  const fixedFor = (holder: number) =>
    [...fixed.values()].filter(value => value === holder).length

  const holders = [0, 1, 2].filter(player => player !== viewer)
  if (s.phase === 'bidding') holders.push(MUSIK)
  const capacity = (holder: number) => (holder === MUSIK ? s.musikCount : counts[holder])

  const attempt = (respectVoids: boolean): Map<number, Card[]> | null => {
    const assigned = new Map<Card, number>(fixed)
    if (hiddenMusik.length) {
      const declarerRoom = capacity(declarer) - fixedFor(declarer)
      const candidates = hiddenMusik.filter(
        card => !respectVoids || !s.voids[other][card.color],
      )
      const mustGive = hiddenMusik.length > declarerRoom
      let giftToOther: Card | undefined
      if (
        otherReceived &&
        !otherPlayedMusik &&
        candidates.length &&
        (mustGive || random() < candidates.length / 9)
      ) {
        giftToOther = candidates[randomInt(random, candidates.length)]
      }
      hiddenMusik.forEach(card =>
        assigned.set(card, card === giftToOther ? other : declarer),
      )
    }

    const result = new Map<number, Card[]>(holders.map(holder => [holder, []]))
    for (const [card, holder] of assigned) result.get(holder)?.push(card)
    const room = new Map<number, number>(
      holders.map(holder => [holder, capacity(holder) - result.get(holder)!.length]),
    )
    if ([...room.values()].some(value => value < 0)) return null

    const allowed = (card: Card, holder: number) =>
      room.get(holder)! > 0 &&
      (!respectVoids || holder === MUSIK || !s.voids[holder][card.color])
    const options = (card: Card) => holders.filter(holder => allowed(card, holder))
    const unknown = shuffle(
      ALL_CARDS.filter(card => !seen.has(card) && !assigned.has(card)),
      random,
    )
    while (unknown.length) {
      // Place the most constrained card first.
      let index = 0
      let fewest = Infinity
      unknown.forEach((card, i) => {
        const count = options(card).length
        if (count < fewest) {
          fewest = count
          index = i
        }
      })
      const card = unknown.splice(index, 1)[0]
      const choices = options(card)
      if (!choices.length) return null
      // Weight by remaining room to approximate a uniform deal.
      const total = choices.reduce((sum, holder) => sum + room.get(holder)!, 0)
      let ticket = random() * total
      let chosen = choices[choices.length - 1]
      for (const holder of choices) {
        ticket -= room.get(holder)!
        if (ticket < 0) {
          chosen = holder
          break
        }
      }
      result.get(chosen)!.push(card)
      room.set(chosen, room.get(chosen)! - 1)
    }
    return [...room.values()].every(value => value === 0) ? result : null
  }

  let assignment: Map<number, Card[]> | null = null
  for (let i = 0; i < 30 && !assignment; i++) assignment = attempt(true)
  for (let i = 0; i < 10 && !assignment; i++) assignment = attempt(false)
  if (!assignment) throw new Error('Could not sample a deal consistent with the view')

  const deal = view.clone()
  const d = deal.s
  for (const holder of holders) {
    const cards = assignment.get(holder)!
    if (holder === MUSIK) d.musik = cards
    else d.hands[holder] = Card.sortHand(cards)
  }
  d.viewer = null
  d.hiddenCounts = null
  return deal
}

/** Seat that is neither `a` nor `b`. */
export function thirdSeat(a: number, b: number): number {
  return [0, 1, 2].find(seat => seat !== a && seat !== b) ?? nextSeat(a)
}
