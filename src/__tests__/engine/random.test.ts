import { ALL_CARDS } from '../../engine/Card'
import { Deck } from '../../engine/Deck'
import { pick, randomInt, seededRandom, shuffle } from '../../engine/random'

describe('random', () => {
  it('repeats a seeded sequence in [0, 1)', () => {
    const a = seededRandom(123)
    const b = seededRandom(123)
    const values = Array.from({ length: 1000 }, () => a())
    expect(values).toEqual(Array.from({ length: 1000 }, () => b()))
    expect(values.every(value => value >= 0 && value < 1)).toBe(true)
    expect(seededRandom(124)()).not.toBe(values[0])
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    expect(mean).toBeCloseTo(0.5, 1)
  })

  it('draws integers below the limit, even for a generator returning 1', () => {
    const random = seededRandom(1)
    const counts = [0, 0, 0]
    for (let i = 0; i < 3000; i++) counts[randomInt(random, 3)]++
    expect(counts.every(count => count > 900)).toBe(true)
    expect(randomInt(() => 1, 5)).toBe(4)
    expect(randomInt(() => 0, 5)).toBe(0)
    expect(pick(() => 0.99, ['a', 'b', 'c'])).toBe('c')
  })

  it('shuffles into a permutation without changing the input', () => {
    const deck = Deck.generate()
    const shuffled = shuffle(deck, seededRandom(2))
    expect(deck).toEqual([...ALL_CARDS])
    expect(shuffled).not.toEqual(deck)
    expect(new Set(shuffled)).toEqual(new Set(deck))
    expect(Deck.shuffle(Deck.generate(), seededRandom(2))).toEqual(shuffled)
    expect(shuffle([], seededRandom(3))).toEqual([])
  })
})
