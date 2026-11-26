import { ALL_CARDS, Card, cardById } from './Card'
import { Deal } from './Deal'
import { HAND_SIZE, MUSIK_SIZE, PLAYER_COUNT, nextSeat } from './rules'
import { randomInt, shuffle, type Random } from './random'

/** Holder index used for the face-down musik during the auction. */
const MUSIK = PLAYER_COUNT

/**
 * Builds a complete deal consistent with what the viewer knows: its own hand,
 * played cards, the revealed musik, gifts it gave or received, publicly known
 * marriage partners and inferred voids. Hidden cards are distributed
 * uniformly among the consistent deals. Void constraints are relaxed only if
 * no consistent deal exists (which cannot happen for a view of a real deal).
 *
 * A defender does not see which card the declarer handed to the other
 * defender. It is modelled as a random one of the nine cards the viewer did
 * not receive (ten while the viewer still waits for its own): each musik card
 * has prior 1/9 (none for one the declarer has played since), and a hidden
 * one surely went over when the declarer has shown a void in its suit or has
 * no room left. Each choice is weighted by how many consistent deals it
 * leaves. The unseen gift is recorded as one of the other defender's cards,
 * so the sampled deal continues exactly like the real one (also while giving).
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
  const other = defenderView ? thirdSeat(viewer, declarer) : -1
  // The other defender got a card this viewer has not seen (it is never in a view).
  const otherGiftUnknown =
    defenderView &&
    !s.gifts.some(gift => gift.to === other) &&
    (s.phase !== 'giving' || counts[other] > HAND_SIZE)
  // A musik card played or known to be held by the other defender was its gift.
  const otherMusik = defenderView
    ? s.musikCards.find(
        card =>
          fixed.get(card) === other ||
          s.played.some(play => play.player === other && play.card === card),
      )
    : undefined
  const hiddenMusik = defenderView
    ? s.musikCards.filter(card => !seen.has(card) && !fixed.has(card))
    : []
  // The other gift was one of the declarer's ten cards, or nine once the
  // viewer's own gift is known; musik cards the declarer has played (or is
  // known to hold) cannot have been it.
  const ownGift = s.gifts.find(gift => gift.to === viewer)?.card
  const giftPool = HAND_SIZE + MUSIK_SIZE - (ownGift ? 1 : 0)
  const musikInPool = s.musikCards.filter(card => card !== ownGift).length

  const holders = [0, 1, 2].filter(player => player !== viewer)
  if (s.phase === 'bidding') holders.push(MUSIK)
  const capacity = (holder: number) => (holder === MUSIK ? s.musikCount : counts[holder])
  const rest = ALL_CARDS.filter(
    card => !seen.has(card) && !fixed.has(card) && !hiddenMusik.includes(card),
  )
  const fits = (card: Card, holder: number, respectVoids: boolean) =>
    !respectVoids || holder === MUSIK || !s.voids[holder][card.color]

  /** Cards per holder index (seats, then `MUSIK`) before dealing `rest`. */
  const startHands = (otherGift: Card | undefined): Card[][] => {
    const hands: Card[][] = [[], [], [], []]
    fixed.forEach((holder, card) => hands[holder].push(card))
    for (const card of hiddenMusik)
      hands[card === otherGift ? other : declarer].push(card)
    return hands
  }

  /**
   * Where the hidden musik cards are, with weights: the prior of each gift
   * times the chance that the remaining cards dealt at random respect the
   * voids (an exact count with the two holders left after the auction).
   */
  const musikChoices = (respectVoids: boolean) => {
    if (!hiddenMusik.length) return [{ gift: otherMusik, weight: 1 }]
    const canGive = otherGiftUnknown && !otherMusik
    // A musik card in a suit the declarer has shown void in was given away.
    const forced = respectVoids
      ? hiddenMusik.filter(card => !fits(card, declarer, true))
      : []
    if (forced.length > 1) return []
    const candidates = (forced.length ? forced : hiddenMusik).filter(card =>
      fits(card, other, respectVoids),
    )
    const choices: { gift: Card | undefined; weight: number }[] = []
    if (!forced.length) {
      choices.push({
        gift: otherMusik,
        weight: canGive ? 1 - musikInPool / giftPool : 1,
      })
    }
    if (canGive) candidates.forEach(gift => choices.push({ gift, weight: 1 / giftPool }))
    let onlyDeclarer = 0
    let onlyOther = 0
    let both = 0
    for (const card of rest) {
      const toDeclarer = fits(card, declarer, respectVoids)
      const toOther = fits(card, other, respectVoids)
      if (toDeclarer && toOther) both++
      else if (toDeclarer) onlyDeclarer++
      else if (toOther) onlyOther++
      else return []
    }
    for (const choice of choices) {
      const hands = startHands(choice.gift)
      const declarerRoom = capacity(declarer) - hands[declarer].length
      const otherRoom = capacity(other) - hands[other].length
      choice.weight *=
        declarerRoom < 0 ||
        otherRoom < 0 ||
        declarerRoom + otherRoom !== rest.length ||
        onlyDeclarer > declarerRoom ||
        onlyOther > otherRoom
          ? 0
          : binomial(both, declarerRoom - onlyDeclarer) /
            binomial(rest.length, declarerRoom)
    }
    return choices.filter(choice => choice.weight > 0)
  }

  interface Assignment {
    hands: Card[][]
    otherGift: Card | undefined
  }

  const attempt = (respectVoids: boolean): Assignment | null => {
    const choices = musikChoices(respectVoids)
    if (!choices.length) return null
    let otherGift = choices[0].gift
    if (choices.length > 1) {
      let ticket = random() * choices.reduce((sum, choice) => sum + choice.weight, 0)
      otherGift = choices[choices.length - 1].gift
      for (const choice of choices) {
        ticket -= choice.weight
        if (ticket < 0) {
          otherGift = choice.gift
          break
        }
      }
    }
    const hands = startHands(otherGift)
    const room = [0, 0, 0, 0]
    for (const holder of holders) {
      room[holder] = capacity(holder) - hands[holder].length
      if (room[holder] < 0) return null
    }

    // Cards that fit every holder are dealt uniformly at the end; the others
    // (void suits) are placed first, the most constrained one first.
    const free: Card[] = []
    const constrained: { card: Card; options: number[] }[] = []
    for (const card of rest) {
      const options = holders.filter(holder => fits(card, holder, respectVoids))
      if (options.length === holders.length) free.push(card)
      else constrained.push({ card, options })
    }
    while (constrained.length) {
      let index = 0
      let fewest = Infinity
      constrained.forEach((entry, i) => {
        let count = 0
        for (const holder of entry.options) if (room[holder] > 0) count++
        if (count < fewest) {
          fewest = count
          index = i
        }
      })
      const { card, options } = constrained.splice(index, 1)[0]
      const choices = options.filter(holder => room[holder] > 0)
      if (!choices.length) return null
      // Weight by remaining room to approximate a uniform deal.
      let chosen = choices[0]
      if (choices.length > 1) {
        const total = choices.reduce((sum, holder) => sum + room[holder], 0)
        let ticket = random() * total
        chosen = choices[choices.length - 1]
        for (const holder of choices) {
          ticket -= room[holder]
          if (ticket < 0) {
            chosen = holder
            break
          }
        }
      }
      hands[chosen].push(card)
      room[chosen]--
    }
    const deck = shuffle(free, random)
    let next = 0
    for (const holder of holders) {
      for (let i = 0; i < room[holder]; i++) {
        if (next >= deck.length) return null
        hands[holder].push(deck[next++])
      }
    }
    if (next !== deck.length) return null
    return { hands, otherGift }
  }

  let assignment: Assignment | null = null
  for (let i = 0; i < 30 && !assignment; i++) assignment = attempt(true)
  for (let i = 0; i < 10 && !assignment; i++) assignment = attempt(false)
  if (!assignment) throw new Error('Could not sample a deal consistent with the view')

  const deal = view.clone()
  const d = deal.s
  for (const holder of holders) {
    const cards = assignment.hands[holder]
    if (holder === MUSIK) d.musik = cards
    else d.hands[holder] = Card.sortHand(cards)
  }
  if (otherGiftUnknown) {
    // Any card the other defender holds or has played may have been its gift.
    const pool = [
      ...d.hands[other],
      ...s.played.filter(play => play.player === other).map(play => play.card),
    ]
    const card = assignment.otherGift ?? pool[randomInt(random, pool.length)]
    if (card) d.gifts.push({ to: other, card })
  }
  d.viewer = null
  d.hiddenCounts = null
  return deal
}

/** Number of ways to choose `k` of `n` items (as a float; small `n` only). */
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i
  return result
}

/** Seat that is neither `a` nor `b`. */
export function thirdSeat(a: number, b: number): number {
  return [0, 1, 2].find(seat => seat !== a && seat !== b) ?? nextSeat(a)
}
