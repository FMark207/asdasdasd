import { useEffect, useRef, useState } from 'react'
import ShapesBackground, { type Rgba, type ShapesHandle } from '../../components/ShapesBackground'
import { href } from '../../lib/router'
import { KEYS, loadJSON, saveJSON, type ButtonStats } from '../../lib/storage'
import MoneyRain from './MoneyRain'
import NukeLaunch from './NukeLaunch'
import { LEAVE_MESSAGES, SCENARIOS, type Outcome, type Theme } from './scenarios'
import './PressTheButton.css'

// colour of the drifting background shapes for each theme
const SHAPE_COLORS: Record<Theme, Rgba> = {
  light: [150, 155, 165, 0.18],
  dark: [247, 207, 107, 0.22], // same soft yellow as the dark-mode text
  rich: [70, 170, 100, 0.22],
}

type Choice = 'none' | 'pressed' | 'left'

export default function PressTheButton() {
  const shapes = useRef<ShapesHandle>(null)
  const timers = useRef<number[]>([])

  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<Choice>('none')
  const [pressing, setPressing] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const [flicker, setFlicker] = useState(false)
  const [money, setMoney] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [nukes, setNukes] = useState(false)
  const [shake, setShake] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [showNext, setShowNext] = useState(false)
  const [stats, setStats] = useState<ButtonStats>(() => loadJSON<ButtonStats>(KEYS.pressTheButton, { pressed: 0, left: 0 }))

  const scenario = SCENARIOS[index % SCENARIOS.length]

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  function bumpStat(key: keyof ButtonStats) {
    setStats(s => {
      const next = { ...s, [key]: s[key] + 1 }
      saveJSON(KEYS.pressTheButton, next)
      return next
    })
  }

  function showResult(msg: string, delay = 0) {
    later(() => setResult(msg), delay)
    later(() => setShowNext(true), 3000)
  }

  function play(o: Outcome) {
    if (o.money) setMoney(true)
    if (o.reveal) setRevealed(true)
    if (o.nukes) setNukes(true)
    if (o.shake) { setShake(true); later(() => setShake(false), 3200) }
    if (o.speed) shapes.current?.setSpeed(o.speed)
    const applyTheme = () => {
      if (o.theme) setTheme(o.theme)
      if (o.burst) shapes.current?.burst()
    }
    if (o.flicker) {
      setFlicker(true)
      later(() => { setFlicker(false); applyTheme() }, 900)
      showResult(o.msg, 900)
    } else {
      applyTheme()
      showResult(o.msg)
    }
  }

  function press() {
    if (choice !== 'none') return
    setChoice('pressed')
    bumpStat('pressed')
    setPressing(true)
    later(() => {
      setPressing(false)
      play(Math.random() < scenario.chance ? scenario.hit : scenario.miss)
    }, 180)
  }

  function leave() {
    if (choice !== 'none') return
    setChoice('left')
    bumpStat('left')
    shapes.current?.setSpeed(0.2)
    showResult(scenario.leaveMsg ?? LEAVE_MESSAGES[Math.floor(Math.random() * LEAVE_MESSAGES.length)])
  }

  function nextScenario() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setTheme('light'); setFlicker(false); setMoney(false); setRevealed(false); setNukes(false); setShake(false)
    setChoice('none'); setResult(null); setShowNext(false)
    setIndex(i => i + 1)
  }

  const times = (n: number) => `${n} ${n === 1 ? 'time' : 'times'}`
  const btnClass = ['big-btn', pressing && 'pressed', choice === 'pressed' && !pressing && 'done', choice === 'left' && 'left']
    .filter(Boolean).join(' ')

  return (
    <div className={`press-page theme-${theme}${flicker ? ' flicker' : ''}${shake ? ' rumble' : ''}`}>
      <ShapesBackground ref={shapes} color={SHAPE_COLORS[theme]} />
      {money && <MoneyRain />}
      {nukes && <NukeLaunch />}

      <a className="back-link" href={href('/')}>&larr; All games</a>

      <main className={'stage' + (revealed && scenario.translation ? ' has-translation' : '')}>
        <section className="scenario" key={index}>
          <div className="label">Scenario {(index % SCENARIOS.length) + 1}</div>
          <h1 lang={scenario.lang} className={revealed ? 'crossed' : undefined}>{scenario.text}</h1>
          {scenario.translation && revealed && <p className="translation">{scenario.translation}</p>}
        </section>

        <div className="button-area">
          <div className={scenario.danger ? 'hazard' : 'no-hazard'}>
            <div className="hazard-inner">
              <button className={btnClass} onClick={press} disabled={choice !== 'none'} aria-label="Press the button">
                {!scenario.hidePercent && <span className="cap">{Math.round(scenario.chance * 100)}%</span>}
              </button>
            </div>
          </div>
          <button className="leave" onClick={leave} disabled={choice !== 'none'}>Leave it</button>
        </div>

        <p className={'result' + (result ? ' show' : '')} aria-live="polite">{result}</p>
        <button className={'next' + (showNext ? '' : ' hidden')} onClick={nextScenario}>Next Scenario &rarr;</button>
        <p className="stats">You've pressed it {times(stats.pressed)} · left it {times(stats.left)}</p>
      </main>
    </div>
  )
}
