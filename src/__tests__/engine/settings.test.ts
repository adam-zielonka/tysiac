import { afterEach, describe, expect, it, vi } from 'vitest'
import { Game } from '../../engine/Game'
import {
  MELD_SYSTEM_STORAGE_KEY,
  browserStorage,
  chooseMeldSystem,
  loadMeldSystem,
  saveMeldSystem,
  type SettingsStorage,
} from '../../engine/settings'
import type { MeldSystem } from '../../engine/rules'

/** In-memory storage like `localStorage`. */
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  } satisfies SettingsStorage & { items: Map<string, string> }
}

/** Storage that is blocked, as in some private modes. */
const throwingStorage: SettingsStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

describe('meld system setting', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads a saved system and saves a new one under its own key', () => {
    expect(MELD_SYSTEM_STORAGE_KEY).toBe('tysiac-meld-system')
    const storage = memoryStorage({ [MELD_SYSTEM_STORAGE_KEY]: 'german' })
    expect(loadMeldSystem(storage)).toBe('german')
    saveMeldSystem('classic', storage)
    expect(storage.items.get(MELD_SYSTEM_STORAGE_KEY)).toBe('classic')
    expect(loadMeldSystem(storage)).toBe('classic')
  })

  it('uses the classic values when nothing valid is saved', () => {
    expect(loadMeldSystem(memoryStorage())).toBe('classic')
    for (const value of ['', 'German', 'french', '"german"', 'null']) {
      expect(loadMeldSystem(memoryStorage({ [MELD_SYSTEM_STORAGE_KEY]: value }))).toBe(
        'classic',
      )
    }
    expect(loadMeldSystem(null)).toBe('classic')
  })

  it('works without persistence when the storage throws', () => {
    expect(loadMeldSystem(throwingStorage)).toBe('classic')
    expect(() => saveMeldSystem('german', throwingStorage)).not.toThrow()
    const game = new Game()
    expect(chooseMeldSystem(game, 'german', throwingStorage)).toBe(true)
    expect(game.meldSystem).toBe('german')
  })

  it('finds no storage when localStorage is missing or blocked', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(browserStorage()).toBeNull()
    expect(loadMeldSystem()).toBe('classic')
    vi.unstubAllGlobals()
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      expect(browserStorage()).toBeNull()
      expect(loadMeldSystem()).toBe('classic')
      expect(() => saveMeldSystem('german')).not.toThrow()
    } finally {
      if (saved) Object.defineProperty(globalThis, 'localStorage', saved)
      else delete (globalThis as { localStorage?: Storage }).localStorage
    }
  })

  it('uses localStorage by default', () => {
    const storage = memoryStorage({ [MELD_SYSTEM_STORAGE_KEY]: 'german' })
    vi.stubGlobal('localStorage', storage)
    expect(loadMeldSystem()).toBe('german')
    saveMeldSystem('classic')
    expect(storage.items.get(MELD_SYSTEM_STORAGE_KEY)).toBe('classic')
  })

  it('applies and remembers a choice, but ignores an invalid one', () => {
    const storage = memoryStorage()
    const game = new Game({ meldSystem: loadMeldSystem(storage) })
    expect(game.meldSystem).toBe('classic')
    expect(chooseMeldSystem(game, 'german', storage)).toBe(true)
    expect(game.meldSystem).toBe('german')
    expect(storage.items.get(MELD_SYSTEM_STORAGE_KEY)).toBe('german')
    expect(chooseMeldSystem(game, 'french' as MeldSystem, storage)).toBe(false)
    expect(game.meldSystem).toBe('german')
    expect(storage.items.get(MELD_SYSTEM_STORAGE_KEY)).toBe('german')
    // The next visit starts with the saved values.
    expect(new Game({ meldSystem: loadMeldSystem(storage) }).meldSystem).toBe('german')
  })

  it('starts the app game with the saved system', async () => {
    const storage = memoryStorage({ [MELD_SYSTEM_STORAGE_KEY]: 'german' })
    vi.stubGlobal('localStorage', storage)
    try {
      vi.resetModules()
      const first = await import('../../engine/Store')
      expect(first.store.game.meldSystem).toBe('german')
      // A choice made in Settings is where the next visit starts.
      expect(chooseMeldSystem(first.store.game, 'classic')).toBe(true)
      expect(storage.items.get(MELD_SYSTEM_STORAGE_KEY)).toBe('classic')
      vi.resetModules()
      const next = await import('../../engine/Store')
      expect(next.store).not.toBe(first.store)
      expect(next.store.game.meldSystem).toBe('classic')
    } finally {
      vi.resetModules()
    }
  })
})
