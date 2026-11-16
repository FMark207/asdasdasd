import type { ComponentType } from 'react'
import PebbleStack from './pebble-stack/PebbleStack'
import PressTheButton from './press-the-button/PressTheButton'

/*
 * Every project in the toolbox. Add a new one here and it gets a page
 * at #/<path> and a card on the hub (the card itself lives in pages/Hub.tsx).
 */
export interface GameInfo {
  path: string
  title: string
  component: ComponentType
}

export const GAMES: GameInfo[] = [
  { path: '/pebble-stack', title: 'Pebble Stack', component: PebbleStack },
  { path: '/press-the-button', title: 'Would You Press The Button?', component: PressTheButton },
]
