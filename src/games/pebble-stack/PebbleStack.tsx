import { useEffect, useRef, useState } from 'react'
import { href } from '../../lib/router'
import { KEYS, loadJSON, saveJSON, type PebbleStats } from '../../lib/storage'
import { createPebbleStackGame, type GameOverInfo, type Hud, type PebbleStackGame } from './engine'
import './PebbleStack.css'

export default function PebbleStack() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const scoreRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<PebbleStackGame | null>(null)
  const hintShownRef = useRef(true)
  const [savedStats] = useState(() => loadJSON<PebbleStats>(KEYS.pebbleStack, { best: 0, games: 0, total: 0 }))
  const statsRef = useRef<PebbleStats>(savedStats)

  const [hud, setHud] = useState<Hud>({ score: 0, best: savedStats.best, altitude: '0 m' })
  const [zone, setZone] = useState({ name: 'Ground level', dark: false })
  const [toast, setToast] = useState<string | null>(null)
  const [hintVisible, setHintVisible] = useState(true)
  const [over, setOver] = useState<GameOverInfo | null>(null)
  const [overVisible, setOverVisible] = useState(false)
  const [freeScroll, setFreeScroll] = useState(false)

  function toggleFreeScroll() {
    const game = gameRef.current
    if (!game) return
    setFreeScroll(game.setFreeCam(!freeScroll))
  }

  useEffect(() => {
    let toastTimer = 0, overTimer = 0
    const hintEl = hintRef.current!
    // phones: stop pull-to-refresh / page bounce while dragging pebbles
    document.body.classList.add('no-overscroll')

    const game = createPebbleStackGame(canvasRef.current!, {
      onHud: setHud,
      onZone: (name, dark) => setZone({ name, dark }),
      onScore() {
        const el = scoreRef.current
        if (!el) return
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop')
      },
      onToast(msg) {
        setToast(msg)
        clearTimeout(toastTimer)
        toastTimer = window.setTimeout(() => setToast(null), 1800)
      },
      onHint(pos) {
        if (!pos) {
          if (hintShownRef.current) { hintShownRef.current = false; setHintVisible(false) }
          return
        }
        if (!hintShownRef.current) return // only shown until the first grab of each game
        // position directly (every frame) without re-rendering React
        hintEl.style.left = Math.min(window.innerWidth - 8, Math.max(pos.x + 30, hintEl.offsetWidth + 8)) + 'px'
        hintEl.style.top = pos.y + 'px'
      },
      onGameOver(info) {
        const s = statsRef.current
        s.games++
        s.total += info.score
        if (info.score > s.best) s.best = info.score
        saveJSON(KEYS.pebbleStack, s)
        setOver(info)
        overTimer = window.setTimeout(() => setOverVisible(true), 1100)
      },
      getBest: () => statsRef.current.best,
    })
    gameRef.current = game
    // handy for testing: window.pebbleGame.peek(1500) jumps the camera up
    ;(window as unknown as { pebbleGame: unknown }).pebbleGame = game.debug

    return () => {
      clearTimeout(toastTimer)
      clearTimeout(overTimer)
      document.body.classList.remove('no-overscroll')
      game.destroy()
      gameRef.current = null
    }
  }, [])

  function playAgain() {
    hintShownRef.current = true
    setOver(null)
    setOverVisible(false)
    setHintVisible(true)
    gameRef.current?.restart()
  }

  // Enter / Space / R restarts after a game over
  useEffect(() => {
    if (!overVisible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'r') { e.preventDefault(); playAgain() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overVisible])

  return (
    <div className={'pebble-stack' + (zone.dark ? ' dark' : '')}>
      <canvas ref={canvasRef} className="ps-canvas" />

      <a className="back-link" href={href('/')}>&larr; All games</a>

      <button
        className={'ps-lock' + (freeScroll ? ' free' : '')}
        onClick={toggleFreeScroll}
        aria-pressed={freeScroll}
        title={freeScroll ? 'Back to the stack' : 'Free scroll: explore the sky and space'}
        aria-label={freeScroll ? 'Turn off free scroll' : 'Turn on free scroll'}
      >
        {freeScroll ? '🔓' : '🔒'}
      </button>
      {freeScroll && <div className="ps-free-note">Scroll or drag to explore · tap 🔓 to go back</div>}

      <div className="ps-hud">
        <div className="ps-score" ref={scoreRef}>{hud.score}</div>
        <div className="ps-sub">Best {hud.best} &middot; {hud.altitude}</div>
        <div className="ps-zone">{zone.name}</div>
      </div>

      <div ref={hintRef} className={'ps-hint' + (hintVisible && !freeScroll ? '' : ' gone')}>
        Grab the pebble &amp; balance it on the stack
      </div>

      <div className={'ps-toast' + (toast ? ' show' : '')}>{toast}</div>

      <div className={'ps-over' + (overVisible ? '' : ' hidden')}>
        <div className="ps-card">
          <h2>{over?.title}</h2>
          <div className="big">{over?.score ?? 0}</div>
          <p className="muted">pebbles stacked</p>
          {over?.isBest && over.score > 0 && <p className="newbest">New best score!</p>}
          <p className="muted">Best {over?.best ?? 0}</p>
          <button onClick={playAgain}>Play again</button>
          <a className="link" href={href('/')}>Back to all games</a>
        </div>
      </div>
    </div>
  )
}
