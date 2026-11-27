export enum Figure {
  f9 = 9,
  f10,
  J,
  Q,
  K,
  A,
}

export enum Color {
  Kier = 1,
  Karo,
  Trefl,
  Pik,
}

/**
 * Suits in deck order (♥ ♦ ♣ ♠), the order of `ALL_CARDS` and card indices.
 * It is not the marriage value order: that depends on the deal's meld system
 * (`MARRIAGE_VALUES` in rules).
 */
export const COLORS: readonly Color[] = [Color.Kier, Color.Karo, Color.Trefl, Color.Pik]

/** Figures from the strongest to the weakest in Tysiąc: A, 10, K, Q, J, 9. */
export const FIGURES: readonly Figure[] = [
  Figure.A,
  Figure.f10,
  Figure.K,
  Figure.Q,
  Figure.J,
  Figure.f9,
]

const RANK: Record<Figure, number> = {
  [Figure.f9]: 0,
  [Figure.J]: 1,
  [Figure.Q]: 2,
  [Figure.K]: 3,
  [Figure.f10]: 4,
  [Figure.A]: 5,
}

const POINTS: Record<Figure, number> = {
  [Figure.f9]: 0,
  [Figure.J]: 2,
  [Figure.Q]: 3,
  [Figure.K]: 4,
  [Figure.f10]: 10,
  [Figure.A]: 11,
}

/** Alternating red and black suits keep a sorted hand easy to read. */
const HAND_ORDER: Record<Color, number> = {
  [Color.Kier]: 0,
  [Color.Trefl]: 1,
  [Color.Karo]: 2,
  [Color.Pik]: 3,
}

export class Card {
  static figureToString(figure: Figure): string {
    switch (figure) {
      case Figure.f9:
        return '9'
      case Figure.f10:
        return '10'
      case Figure.J:
        return 'J'
      case Figure.Q:
        return 'Q'
      case Figure.K:
        return 'K'
      case Figure.A:
        return 'A'
    }
  }

  static colorToString(color: Color): string {
    switch (color) {
      case Color.Karo:
        return '♦'
      case Color.Kier:
        return '♥'
      case Color.Trefl:
        return '♣'
      case Color.Pik:
        return '♠'
    }
  }

  /** Sorts by suit (♥ ♣ ♦ ♠), then from the strongest card. */
  static compareInHand(a: Card, b: Card): number {
    return HAND_ORDER[a.color] - HAND_ORDER[b.color] || b.rank - a.rank
  }

  static sortHand(cards: Card[]): Card[] {
    return cards.sort(Card.compareInHand)
  }

  readonly id: string

  constructor(
    readonly figure: Figure,
    readonly color: Color,
  ) {
    this.id = `${Card.figureToString(figure)}${Card.colorToString(color)}`
  }

  /** Trick-taking strength: 9 < J < Q < K < 10 < A. */
  get rank(): number {
    return RANK[this.figure]
  }

  get points(): number {
    return POINTS[this.figure]
  }

  get colorStyle(): 'red' | 'black' {
    return this.color === Color.Karo || this.color === Color.Kier ? 'red' : 'black'
  }

  get text(): string {
    return this.id
  }

  get colorText(): string {
    return Card.colorToString(this.color)
  }

  get figureText(): string {
    return Card.figureToString(this.figure)
  }

  get isMarriageCard(): boolean {
    return this.figure === Figure.K || this.figure === Figure.Q
  }

  /** The other half of a king–queen marriage. */
  get marriagePartner(): Card | undefined {
    if (this.figure === Figure.K) return card(Figure.Q, this.color)
    if (this.figure === Figure.Q) return card(Figure.K, this.color)
    return undefined
  }

  toString(): string {
    return this.text
  }

  isEqual(other: Card): boolean {
    return this.figure === other.figure && this.color === other.color
  }
}

const ALL: Card[] = []
const BY_ID = new Map<string, Card>()
for (const color of COLORS) {
  for (const figure of FIGURES) {
    const value = new Card(figure, color)
    ALL.push(value)
    BY_ID.set(value.id, value)
  }
}

/** Shared immutable instances; every deal uses the same 24 card objects. */
export const ALL_CARDS: readonly Card[] = ALL

/**
 * Position in `ALL_CARDS` (♥ ♦ ♣ ♠, each from the ace down); bit index in
 * card masks such as `DealState.excluded`. Equal card objects share it.
 */
export function cardIndex(value: Card): number {
  return (value.color - Color.Kier) * FIGURES.length + FIGURES.length - 1 - value.rank
}

/** Mask of the cards of `color` ranked above `rank` (the whole suit by default). */
export function suitMask(color: Color, rank = -1): number {
  const ace = (color - Color.Kier) * FIGURES.length
  return ((1 << (FIGURES.length - 1 - rank)) - 1) << ace
}

export function card(figure: Figure, color: Color): Card {
  return BY_ID.get(`${Card.figureToString(figure)}${Card.colorToString(color)}`)!
}

export function cardById(id: string): Card | undefined {
  return BY_ID.get(id)
}

/** Test and debugging helper: `cards('A♥ 10♥ K♠')`. */
export function cards(text: string): Card[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(id => {
      const value = BY_ID.get(id)
      if (!value) throw new Error(`Unknown card: ${id}`)
      return value
    })
}
