import { useEffect, useRef } from 'react'
import { createPebble, drawSprite, rng } from '../lib/pebbles'
import { href } from '../lib/router'
import { KEYS, loadJSON, type ButtonStats, type PebbleStats } from '../lib/storage'
import './Hub.css'

const TITLE = 'The Toolbox'

export default function Hub() {
  const pebble = loadJSON<PebbleStats>(KEYS.pebbleStack, { best: 0, games: 0, total: 0 })
  const button = loadJSON<ButtonStats>(KEYS.pressTheButton, { pressed: 0, left: 0 })

  return (
    <div className="hub">
      <header>
        <h1 aria-label={TITLE}>
          {[...TITLE].map((c, i) => (c === ' ' ? ' ' : <span key={i}>{c}</span>))}
        </h1>
        <p>A bunch of small things to play with</p>
      </header>

      <main className="grid">
        <a className="tile" href={href('/pebble-stack')}>
          <div className="thumb"><PebbleThumb /></div>
          <h3>Pebble Stack</h3>
          <div className="meta">
            {pebble.best > 0 ? `Your best: ${pebble.best} pebbles` : 'Balance pebbles all the way to space'}
          </div>
        </a>

        <a className="tile" href={href('/press-the-button')}>
          <div className="thumb btn-thumb"><div className="mini-btn"><span>50%</span></div></div>
          <h3>Would You Press The Button?</h3>
          <div className="meta">
            {button.pressed > 0
              ? `You pressed it ${button.pressed} ${button.pressed === 1 ? 'time' : 'times'}`
              : 'Take the chance… or leave it'}
          </div>
        </a>

        <div className="tile soon"><div className="thumb">Coming soon</div><h3>Project #3</h3></div>
        <div className="tile soon"><div className="thumb">Coming soon</div><h3>Project #4</h3></div>
      </main>
    </div>
  )
}

/** a little stack of real-looking pebbles on a sky background */
function PebbleThumb() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = 400, H = 300
    c.width = W * dpr; c.height = H * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)

    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#9fcbf1'); sky.addColorStop(0.55, '#e3f0fb'); sky.addColorStop(1, '#ffffff')
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)

    // a few clouds
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    for (const [x, y, s] of [[70, 60, 1], [320, 95, 0.8], [250, 40, 0.6]]) {
      for (const [dx, dy, r] of [[-30, 4, 18], [-10, -6, 24], [14, -2, 22], [34, 6, 16]]) {
        ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.283); ctx.fill()
      }
    }

    const r = rng(20261116)
    const sizes = [1.3, 1.15, 1.05, 0.95, 0.85, 0.75]
    const pebbles = sizes.map(s => createPebble(r, { size: s, flat: s > 1.2 }))
    const scale = 0.55
    let y = H - 22

    // woven mat
    ctx.fillStyle = '#d2bb92'
    ctx.beginPath(); ctx.ellipse(W / 2, y, 110, 20, 0, 0, 6.283); ctx.fill()
    ctx.strokeStyle = 'rgba(140,110,70,0.35)'
    for (let k = 1; k < 9; k++) {
      ctx.beginPath(); ctx.ellipse(W / 2, y, 110 * k / 9, 20 * k / 9, 0, 0, 6.283); ctx.stroke()
    }

    pebbles.forEach((p, i) => {
      const cy = y - p.maxY * scale
      const cx = W / 2 + (i % 2 ? 4 : -3)
      ctx.save(); ctx.translate(cx + 1, cy + 3); ctx.scale(scale, scale); drawSprite(ctx, p.shadow); ctx.restore()
      ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale); drawSprite(ctx, p.sprite); ctx.restore()
      y = cy + p.minY * scale + 1.5
    })
  }, [])

  return <canvas ref={ref} />
}
