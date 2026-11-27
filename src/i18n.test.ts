import { afterEach, describe, expect, it } from 'vitest'
import {
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  detectLanguage,
  hasTranslation,
  setLanguage,
  t,
} from './i18n'
import { strategies } from './engine/strategies'
import { PACES } from './elements/ui'

const sources = import.meta.glob(
  ['./elements/*.svelte', './elements/*.ts', '!./elements/*.test.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

/** String literals passed to `$tr(...)`, `$tx(...)` or `t(...)` in the interface code. */
function literalKeys(source: string): string[] {
  const pattern = /(?:\$tr|\$tx|\bt)\(\s*'((?:[^'\\]|\\.)*)'/g
  return [...source.matchAll(pattern)].map(match => match[1])
}

describe('language preference resolution', () => {
  it('gives a valid saved choice priority over browser preferences', () => {
    expect(detectLanguage('pl', ['en-US'])).toBe('pl')
    expect(detectLanguage('en', ['pl-PL'])).toBe('en')
  })
  it('uses the first supported preference, including regional variants', () => {
    expect(detectLanguage(null, ['de-DE', 'pl-PL', 'en-GB'])).toBe('pl')
    expect(detectLanguage(null, ['en-US', 'pl'])).toBe('en')
    expect(detectLanguage(null, ['PL_pl'])).toBe('pl')
  })
  it('ignores invalid saved values and falls back to English', () => {
    expect(detectLanguage('invalid', ['pl-PL'])).toBe('pl')
    expect(detectLanguage(null, ['fr-FR'])).toBe('en')
    expect(detectLanguage(null, [])).toBe('en')
  })
})

describe('translations', () => {
  afterEach(() => setLanguage('pl'))

  it('finds the interface sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(10)
    expect(literalKeys(sources['./elements/BoardElement.svelte']).length).toBeGreaterThan(
      20,
    )
  })

  it('has an English text for every literal string in the interface', () => {
    const missing = Object.entries(sources).flatMap(([file, source]) =>
      literalKeys(source)
        .filter(key => !hasTranslation(key))
        .map(key => `${file}: ${key}`),
    )
    expect(missing).toEqual([])
  })

  it('translates texts chosen at runtime', () => {
    const dynamic = [
      PAGE_TITLE,
      PAGE_DESCRIPTION,
      '{count} karta',
      '{count} karty',
      '{count} kart',
      ...PACES.map(pace => pace.label),
      // Persona names are proper nouns; only "Ty" (you) is translated.
      strategies.Human.name,
      ...Object.values(strategies).flatMap(strategy => [
        strategy.method,
        strategy.information,
        strategy.summary,
        strategy.description,
      ]),
    ]
    expect(dynamic.filter(key => !hasTranslation(key))).toEqual([])
  })

  it('switches language and fills placeholders', () => {
    expect(t('Licytuj {value}', { value: 110 })).toBe('Licytuj 110')
    setLanguage('en')
    expect(t('Licytuj {value}', { value: 110 })).toBe('Bid 110')
    expect(t('Felek')).toBe('Felek')
    expect(t('Ty')).toBe('You')
    expect(t('Nieznany tekst {x}')).toBe('Nieznany tekst {x}')
  })
})
