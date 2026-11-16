import { useSyncExternalStore } from 'react'

/*
 * A tiny hash router: pages live at  #/  #/pebble-stack  #/press-the-button
 * Hash URLs work on any static host (FTP, GitHub Pages, …) without server config.
 */

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

function getPath() {
  return window.location.hash.replace(/^#/, '') || '/'
}

export function usePath() {
  return useSyncExternalStore(subscribe, getPath)
}

/** href for a page, e.g. href('/pebble-stack') -> '#/pebble-stack' */
export const href = (path: string) => '#' + path
