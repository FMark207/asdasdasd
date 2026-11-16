/*
 * The scenarios. Add more to the list and they appear one after another.
 *
 *   text    – shown in the card on top
 *   chance  – 0..1, the percentage written on the button (the chance of `hit`)
 *   hit     – what happens when the chance hits
 *   miss    – what happens otherwise
 *
 * An outcome can:
 *   theme   – 'light' | 'dark' | 'rich'  (page colours + background shapes colour)
 *   flicker – flash the lights before switching theme
 *   money   – make money rain down the sides
 *   burst   – spin & scatter the background shapes
 *   speed   – temporary speed-up of the background shapes
 *   msg     – the message under the button
 */
export type Theme = 'light' | 'dark' | 'rich'

export interface Outcome {
  msg: string
  theme?: Theme
  flicker?: boolean
  money?: boolean
  burst?: boolean
  speed?: number
}

export interface Scenario {
  text: string
  chance: number
  hit: Outcome
  miss: Outcome
}

export const SCENARIOS: Scenario[] = [
  {
    text: 'Get $1,000,000… or cut the electricity off on the whole planet.',
    chance: 0.5,
    hit: { msg: 'You cut the power. The whole planet is dark.', theme: 'dark', flicker: true, burst: true },
    miss: { msg: '+$1,000,000. Spend it wisely.', theme: 'rich', money: true, speed: 3 },
  },
]

export const LEAVE_MESSAGES = [
  'You walked away. Smart… or boring?',
  'You will never know what would have happened.',
  'Playing it safe, huh?',
]
