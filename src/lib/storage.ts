// localStorage that never throws, plus a hook that reads it without hydration mismatches.

import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // private mode / storage full: the game still works, it just won't remember
  }
  listeners.forEach(l => l())
}

export function useStored(key: string): string | null {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => readStored(key),
    () => null,
  )
}

export const KEYS = {
  game: 'farkle-donkey:game:v2',
  table: 'farkle-donkey:table:v2',
  muted: 'farkle-donkey:muted',
}
