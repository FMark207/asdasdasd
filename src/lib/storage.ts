/** Tiny localStorage helpers that never throw (private mode, blocked storage, …) */

export function loadJSON<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...fallback, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return { ...fallback }
}

export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export const KEYS = {
  pebbleStack: 'toolbox.pebbleStack.v1',
  pressTheButton: 'toolbox.pressTheButton.v1',
}

export interface PebbleStats { best: number; games: number; total: number }
export interface ButtonStats { pressed: number; left: number }
