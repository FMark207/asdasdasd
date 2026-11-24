/*
 * The scenarios. Add more to the list and they appear one after another.
 *
 *   text        – shown in the card on top
 *   lang        – language of `text` (e.g. 'zh'), so the right font is used
 *   translation – optional translation, revealed under the text by `reveal`
 *   chance      – 0..1, the chance of `hit` (1 = always happens)
 *   hidePercent – don't write the percentage on the button
 *   hit         – what happens when the chance hits
 *   miss        – what happens otherwise
 *   leaveMsg    – optional message when the player leaves it (else a random one)
 *
 * An outcome can:
 *   theme   – 'light' | 'dark' | 'rich'  (page colours + background shapes colour)
 *   flicker – flash the lights before switching theme
 *   money   – make money rain down the sides
 *   burst   – spin & scatter the background shapes
 *   speed   – temporary speed-up of the background shapes
 *   reveal  – cross out the text and show the translation under it
 *   nukes   – launch two nuke rockets up the sides of the screen
 *   shake   – rumble the whole page for a few seconds
 *   msg     – the message under the button
 *
 * A scenario can also set `danger: true` to put hazard tape around the button.
 */
export type Theme = 'light' | 'dark' | 'rich'

export interface Outcome {
  msg: string
  theme?: Theme
  flicker?: boolean
  money?: boolean
  burst?: boolean
  speed?: number
  reveal?: boolean
  nukes?: boolean
  shake?: boolean
}

export interface Scenario {
  text: string
  lang?: string
  translation?: string
  chance: number
  hidePercent?: boolean
  danger?: boolean
  hit: Outcome
  miss: Outcome
  leaveMsg?: string
}

export const SCENARIOS: Scenario[] = [
  {
    text: 'Get $1,000,000… or cut the electricity off on the whole planet.',
    chance: 0.5,
    hit: { msg: 'You cut the power. The whole planet is dark.', theme: 'dark', flicker: true, burst: true },
    miss: { msg: '+$1,000,000. Spend it wisely.', theme: 'rich', money: true, speed: 3 },
  },
  {
    // "You can understand any language, spoken or written, but you cannot speak or write yourself."
    text: '你能听懂和读懂任何语言，但你自己不能说话，也不能写字。',
    lang: 'zh',
    translation: 'You can understand any language, spoken or written, but you cannot speak or write yourself.',
    chance: 1,
    hidePercent: true,
    hit: { msg: 'Now you understand everything… but you can’t say a word.', reveal: true, burst: true },
    miss: { msg: '', reveal: true },
    leaveMsg: 'You will never know what it said.',
  },
  {
    text: 'You find a button in your room with a label reading ‘launch nukes’. You don’t know if it actually does anything. Do you press it?',
    chance: 1,
    hidePercent: true,
    danger: true,
    hit: { msg: 'Oh no. It definitely does something.', nukes: true, shake: true, burst: true, speed: 4 },
    miss: { msg: '' },
    leaveMsg: 'Probably for the best.',
  },
]

export const LEAVE_MESSAGES = [
  'You walked away. Smart… or boring?',
  'You will never know what would have happened.',
  'Playing it safe, huh?',
]
