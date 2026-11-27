import { DEFAULT_MELD_SYSTEM, isMeldSystem, type MeldSystem } from './rules'

/** Browser storage key of the chosen marriage values. */
export const MELD_SYSTEM_STORAGE_KEY = 'tysiac-meld-system'

/** The part of `localStorage` the settings use. */
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

/** `localStorage`, or null where it is missing or blocked (reading it can throw). */
export function browserStorage(): SettingsStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** The saved marriage values; the default when nothing valid is saved. */
export function loadMeldSystem(storage = browserStorage()): MeldSystem {
  try {
    const saved = storage?.getItem(MELD_SYSTEM_STORAGE_KEY)
    return isMeldSystem(saved) ? saved : DEFAULT_MELD_SYSTEM
  } catch {
    return DEFAULT_MELD_SYSTEM
  }
}

export function saveMeldSystem(system: MeldSystem, storage = browserStorage()): void {
  try {
    storage?.setItem(MELD_SYSTEM_STORAGE_KEY, system)
  } catch {
    /* The choice still applies, it is only not remembered. */
  }
}

/**
 * Chooses the marriage values of the next deals and remembers a valid choice.
 * Returns whether the game accepted it.
 */
export function chooseMeldSystem(
  game: { setMeldSystem(system: MeldSystem): boolean },
  system: MeldSystem,
  storage = browserStorage(),
): boolean {
  if (!game.setMeldSystem(system)) return false
  saveMeldSystem(system, storage)
  return true
}
