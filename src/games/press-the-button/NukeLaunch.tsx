import { useEffect, useRef } from 'react'

/*
 * Two nuke rockets rising up the left and right sides of the screen,
 * with flame + smoke particles coming out of the engines.
 * Everything is drawn on one canvas; it runs for as long as it's mounted.
 */

interface Rocket { x: number; delay: number; sway: number }
interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; max: number; r: number
  kind: 'flame' | 'smoke'
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** draws one rocket pointing up, with (0,0) at the engine nozzle */
function drawRocket(ctx: CanvasRenderingContext2D, s: number) {
  const w = 26 * s, h = 120 * s
  // fins
  ctx.fillStyle = '#3a3d46'
  ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.28); ctx.lineTo(-w * 1.05, 0); ctx.lineTo(-w / 2, 0); ctx.fill()
  ctx.beginPath(); ctx.moveTo(w / 2, -h * 0.28); ctx.lineTo(w * 1.05, 0); ctx.lineTo(w / 2, 0); ctx.fill()
  // body (white with a little shading)
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
  g.addColorStop(0, '#c9ccd4'); g.addColorStop(0.35, '#ffffff'); g.addColorStop(1, '#a9adb8')
  ctx.fillStyle = g
  ctx.fillRect(-w / 2, -h, w, h)
  // nose cone
  ctx.fillStyle = '#d8312b'
  ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.quadraticCurveTo(0, -h - w * 2.2, w / 2, -h); ctx.closePath(); ctx.fill()
  // hazard band + radiation sign
  ctx.fillStyle = '#1b1b1f'; ctx.fillRect(-w / 2, -h * 0.62, w, h * 0.16)
  ctx.fillStyle = '#f5c400'
  ctx.beginPath(); ctx.arc(0, -h * 0.54, w * 0.3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1b1b1f'
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 3)
    ctx.beginPath(); ctx.moveTo(0, -h * 0.54)
    ctx.arc(0, -h * 0.54, w * 0.26, a - 0.5, a + 0.5); ctx.closePath(); ctx.fill()
  }
  // nozzle
  ctx.fillStyle = '#2a2c33'
  ctx.fillRect(-w * 0.32, -2 * s, w * 0.64, 6 * s)
}

export default function NukeLaunch() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let W = 0, H = 0, dpr = 1, s = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      // rocket size (flames & smoke scale with it)
      s = Math.max(0.8, Math.min(1.9, Math.min(W / 560, H / 520)))
    }
    resize()
    window.addEventListener('resize', resize)

    const rockets: Rocket[] = [
      { x: 0.1, delay: 0, sway: rand(0, 6) },
      { x: 0.9, delay: 0.35, sway: rand(0, 6) },
    ]
    const particles: Particle[] = []
    const FLIGHT = 3.2 // seconds to fly off the top
    const start = performance.now()
    let last = start, raf = 0

    const frame = (now: number) => {
      const t = (now - start) / 1000
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // rocket positions (accelerating upwards)
      const travel = H + 260 * s
      const positions = rockets.map(r => {
        const rt = Math.max(0, t - r.delay)
        const k = rt / FLIGHT
        const y = H + 20 * s - travel * k * k
        const x = W * r.x + Math.sin(rt * 3 + r.sway) * 6 * s
        return { x, y, rt, active: k < 1.05 }
      })

      // spawn particles at each engine
      for (const p of positions) {
        if (!p.active) continue
        for (let i = 0; i < 6; i++) {
          particles.push({
            x: p.x + rand(-5, 5) * s, y: p.y + 4 * s,
            vx: rand(-40, 40) * s, vy: rand(220, 420) * s,
            life: 0, max: rand(0.18, 0.4), r: rand(5, 10) * s, kind: 'flame',
          })
        }
        for (let i = 0; i < 2; i++) {
          particles.push({
            x: p.x + rand(-6, 6) * s, y: p.y + 14 * s,
            vx: rand(-60, 60) * s, vy: rand(30, 110) * s,
            life: 0, max: rand(1.4, 2.6), r: rand(8, 14) * s, kind: 'smoke',
          })
        }
      }

      // update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const q = particles[i]
        q.life += dt
        if (q.life >= q.max) { particles.splice(i, 1); continue }
        q.x += q.vx * dt; q.y += q.vy * dt
        if (q.kind === 'smoke') { q.vx *= 0.97; q.vy *= 0.95; q.r += 22 * s * dt }
      }

      // smoke (behind the flames)
      for (const q of particles) {
        if (q.kind !== 'smoke') continue
        const a = 0.35 * (1 - q.life / q.max)
        ctx.fillStyle = `rgba(150,150,158,${a.toFixed(3)})`
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill()
      }

      // flames (bright, additive)
      ctx.globalCompositeOperation = 'lighter'
      for (const q of particles) {
        if (q.kind !== 'flame') continue
        const f = q.life / q.max
        const col = f < 0.3 ? '255,240,180' : f < 0.6 ? '255,170,40' : '255,80,20'
        ctx.fillStyle = `rgba(${col},${(0.9 * (1 - f)).toFixed(3)})`
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 - f * 0.5), 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      // rockets on top
      for (const p of positions) {
        if (!p.active) continue
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.rt * 3) * 0.03); drawRocket(ctx, s); ctx.restore()
      }

      // keep going while rockets fly or smoke lingers
      if (positions.some(p => p.active) || particles.length) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="nuke-layer" aria-hidden="true" />
}
