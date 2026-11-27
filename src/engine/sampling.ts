import { ALL_CARDS, COLORS, Card, cardById, cardIndex, suitMask } from './Card'
import { Deal } from './Deal'
import { HAND_SIZE, MUSIK_SIZE, PLAYER_COUNT, nextSeat } from './rules'
import { randomInt, shuffle, type Random } from './random'

/** Holder index used for the face-down musik during the auction. */
const MUSIK = PLAYER_COUNT
const ALL_MASK = (1 << ALL_CARDS.length) - 1
/** Every card in sorted hand order, so hands are built from masks already sorted. */
const SORTED = Card.sortHand([...ALL_CARDS])
const SORTED_BITS = SORTED.map(card => 1 << cardIndex(card))
const NO_BANS: readonly number[] = [0, 0, 0, 0]

interface Choice {
  /** The card the other defender got from the declarer, when it is a musik card. */
  gift: Card | undefined
  weight: number
}

interface Assignment {
  /** Card masks per holder index (seats, then `MUSIK`). */
  hands: number[]
  gift: Card | undefined
}

/**
 * Builds a complete deal consistent with what the viewer knows: its own hand,
 * played cards, the revealed musik, gifts it gave or received, publicly known
 * marriage partners and the public inference of the play, `s.excluded` (cards
 * a player provably does not hold under the overtaking rule, void suits
 * included) and `s.voids`.
 *
 * Hidden cards are distributed uniformly among the consistent deals. Once the
 * auction is over there are two hidden holders: a card one of them provably
 * lacks goes to the other and the rest are split at random, which is exact.
 * During the auction the face-down musik is a third holder, but nothing has
 * been played, so nothing is constrained. (Should a hand-made view constrain
 * more holders, the most constrained cards are placed first, weighted by the
 * room left: an approximation.) Constraints are dropped only if no consistent
 * deal exists, which cannot happen for a view of a real deal; so sampling
 * never throws for one.
 *
 * A defender does not see which card the declarer handed to the other
 * defender. It is modelled as a random one of the nine cards the viewer did
 * not receive (ten while the viewer still waits for its own): each musik card
 * has prior 1/9 (none for one the declarer has played since), and a hidden
 * one surely went over when the declarer provably lacks it (a void or a card
 * excluded by the overtaking rule) or has no room left. Each choice is
 * weighted by the exact number of consistent ways to split the remaining
 * cards. The unseen gift is recorded as one of the other defender's cards, so
 * the sampled deal continues exactly like the real one (also while giving).
 *
 * Card sets are 24-bit masks (bit `cardIndex`), so a sample costs a few
 * microseconds plus the clone of the view.
 */
export function sampleDeal(view: Deal, random: Random = Math.random): Deal {
  const s = view.s
  const viewer = s.viewer
  if (viewer === null) return view.clone()
  const counts = s.hiddenCounts ?? s.hands.map(hand => hand.length)

  const playedBy = [0, 0, 0]
  for (const play of s.played) playedBy[play.player] |= bit(play.card)
  let seen = maskOf(s.hands[viewer]) | playedBy[0] | playedBy[1] | playedBy[2]
  if (s.phase === 'musik') seen |= maskOf(s.musik)

  // Cards whose holder the viewer knows: marriage partners and known gifts.
  const fixed = [0, 0, 0, 0]
  const fix = (card: Card, holder: number) => {
    const b = bit(card)
    if (seen & b || holder === viewer || !(holder >= 0 && holder < PLAYER_COUNT)) return
    for (let h = 0; h < fixed.length; h++) fixed[h] &= ~b
    fixed[holder] |= b
  }
  for (const [id, holder] of Object.entries(s.knownHolders)) {
    const known = cardById(id)
    if (known) fix(known, holder)
  }
  s.gifts.forEach(gift => fix(gift.card, gift.to))
  const fixedAll = fixed[0] | fixed[1] | fixed[2]

  const declarer = s.declarer
  const musikTaken = declarer >= 0 && s.phase !== 'bidding' && s.phase !== 'musik'
  const defenderView = musikTaken && viewer !== declarer
  const other = defenderView ? thirdSeat(viewer, declarer) : -1
  // The other defender got a card this viewer has not seen (it is never in a view).
  const otherGiftUnknown =
    defenderView &&
    !s.gifts.some(gift => gift.to === other) &&
    (s.phase !== 'giving' || counts[other] > HAND_SIZE)
  // A musik card played or known to be held by the other defender was its
  // gift; musik cards the viewer has not seen anywhere are `hidden`.
  let otherMusik: Card | undefined
  let hidden = 0
  if (defenderView) {
    for (const card of s.musikCards) {
      const b = bit(card)
      if (!otherMusik && (fixed[other] | playedBy[other]) & b) otherMusik = card
      if (!((seen | fixedAll) & b)) hidden |= b
    }
  }
  // The other gift was one of the declarer's ten cards, or nine once the
  // viewer's own gift is known; musik cards the declarer has played (or is
  // known to hold) cannot have been it.
  const ownGift = s.gifts.find(gift => gift.to === viewer)?.card
  const giftPool = HAND_SIZE + MUSIK_SIZE - (ownGift ? 1 : 0)
  const musikInPool = s.musikCards.filter(card => card !== ownGift).length

  const holders = [0, 1, 2].filter(player => player !== viewer)
  if (s.phase === 'bidding') holders.push(MUSIK)
  const capacity = (holder: number) => (holder === MUSIK ? s.musikCount : counts[holder])
  const rest = ALL_MASK & ~(seen | fixedAll | hidden)

  // Cards each hidden player provably does not hold; the musik has no constraints.
  const banned = [0, 0, 0, 0]
  for (const player of holders) {
    if (player === MUSIK) continue
    let mask = s.excluded?.[player] ?? 0
    for (const color of COLORS) if (s.voids[player][color]) mask |= suitMask(color)
    banned[player] = mask
  }

  /**
   * Where the hidden musik cards are, with weights: the prior of each gift
   * times the chance that the remaining cards dealt at random respect the
   * constraints, counted exactly (hidden musik cards exist only after the
   * auction, with two hidden holders).
   */
  const musikChoices = (ban: readonly number[]): Choice[] => {
    if (!hidden) return [{ gift: otherMusik, weight: 1 }]
    const canGive = otherGiftUnknown && !otherMusik
    // A musik card the declarer provably lacks was given away.
    const forced = hidden & ban[declarer]
    if (forced & (forced - 1)) return []
    const choices: Choice[] = []
    if (!forced) {
      choices.push({
        gift: otherMusik,
        weight: canGive ? 1 - musikInPool / giftPool : 1,
      })
    }
    if (canGive) {
      for (const index of indicesOf((forced || hidden) & ~ban[other])) {
        choices.push({ gift: ALL_CARDS[index], weight: 1 / giftPool })
      }
    }
    if (rest & ban[declarer] & ban[other]) return []
    const onlyDeclarer = bitCount(rest & ban[other])
    const onlyOther = bitCount(rest & ban[declarer])
    const both = bitCount(rest & ~ban[declarer] & ~ban[other])
    const total = bitCount(rest)
    for (const choice of choices) {
      const given = choice.gift ? bit(choice.gift) & hidden : 0
      const declarerRoom =
        capacity(declarer) - bitCount(fixed[declarer] | (hidden & ~given))
      const otherRoom = capacity(other) - bitCount(fixed[other] | given)
      choice.weight *=
        declarerRoom < 0 ||
        otherRoom < 0 ||
        declarerRoom + otherRoom !== total ||
        onlyDeclarer > declarerRoom ||
        onlyOther > otherRoom
          ? 0
          : binomial(both, declarerRoom - onlyDeclarer) / binomial(total, declarerRoom)
    }
    return choices.filter(choice => choice.weight > 0)
  }

  const attempt = (ban: readonly number[]): Assignment | null => {
    const choices = musikChoices(ban)
    if (!choices.length) return null
    let gift = choices[0].gift
    if (choices.length > 1) {
      let ticket = random() * choices.reduce((sum, choice) => sum + choice.weight, 0)
      gift = choices[choices.length - 1].gift
      for (const choice of choices) {
        ticket -= choice.weight
        if (ticket < 0) {
          gift = choice.gift
          break
        }
      }
    }
    const hands = fixed.slice()
    if (hidden) {
      const given = gift ? bit(gift) & hidden : 0
      hands[declarer] |= hidden & ~given
      hands[other] |= given
    }
    const room = [0, 0, 0, 0]
    let free = 0
    for (const holder of holders) {
      room[holder] = capacity(holder) - bitCount(hands[holder])
      if (room[holder] < 0) return null
      free += room[holder]
    }

    // Cards some holder cannot take are placed first, the most constrained
    // one first (with two holders each of them has a single place).
    let anyBan = 0
    for (const holder of holders) anyBan |= ban[holder]
    const constrained = indicesOf(rest & anyBan)
    while (constrained.length) {
      let at = 0
      let fewest = Infinity
      for (let i = 0; i < constrained.length; i++) {
        const b = 1 << constrained[i]
        let options = 0
        for (const holder of holders)
          if (room[holder] > 0 && !(ban[holder] & b)) options++
        if (options < fewest) {
          fewest = options
          at = i
        }
      }
      const b = 1 << constrained[at]
      constrained.splice(at, 1)
      const options = holders.filter(holder => room[holder] > 0 && !(ban[holder] & b))
      if (!options.length) return null
      // Weight by remaining room to approximate a uniform deal.
      let chosen = options[0]
      if (options.length > 1) {
        let ticket = random() * options.reduce((sum, holder) => sum + room[holder], 0)
        chosen = options[options.length - 1]
        for (const holder of options) {
          ticket -= room[holder]
          if (ticket < 0) {
            chosen = holder
            break
          }
        }
      }
      hands[chosen] |= b
      room[chosen]--
      free--
    }
    // The other cards fit every holder: split them uniformly.
    const deck = shuffle(indicesOf(rest & ~anyBan), random)
    if (deck.length !== free) return null
    let next = 0
    for (const holder of holders) {
      for (let i = 0; i < room[holder]; i++) hands[holder] |= 1 << deck[next++]
    }
    return { hands, gift }
  }

  let assignment: Assignment | null = null
  for (let i = 0; i < 30 && !assignment; i++) assignment = attempt(banned)
  for (let i = 0; i < 10 && !assignment; i++) assignment = attempt(NO_BANS)
  if (!assignment) throw new Error('Could not sample a deal consistent with the view')

  const deal = view.clone()
  const d = deal.s
  for (const holder of holders) {
    const cards = cardsOf(assignment.hands[holder])
    if (holder === MUSIK) d.musik = cards
    else d.hands[holder] = cards
  }
  if (otherGiftUnknown) {
    // Any card the other defender holds or has played may have been its gift.
    const pool = [
      ...d.hands[other],
      ...s.played.filter(play => play.player === other).map(play => play.card),
    ]
    const card = assignment.gift ?? pool[randomInt(random, pool.length)]
    if (card) d.gifts.push({ to: other, card })
  }
  d.viewer = null
  d.hiddenCounts = null
  return deal
}

function bit(card: Card): number {
  return 1 << cardIndex(card)
}

function maskOf(list: readonly Card[]): number {
  let mask = 0
  for (const card of list) mask |= bit(card)
  return mask
}

/** Cards of a mask in sorted hand order. */
function cardsOf(mask: number): Card[] {
  const result: Card[] = []
  for (let i = 0; i < SORTED.length; i++)
    if (mask & SORTED_BITS[i]) result.push(SORTED[i])
  return result
}

/** Card indices (`cardIndex`) of a mask, from the lowest. */
function indicesOf(mask: number): number[] {
  const result: number[] = []
  for (let bits = mask; bits; bits &= bits - 1) result.push(31 - Math.clz32(bits & -bits))
  return result
}

function bitCount(mask: number): number {
  let count = 0
  for (let bits = mask; bits; bits &= bits - 1) count++
  return count
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
