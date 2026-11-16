import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'

/** RGBA colour as [r, g, b, alpha] */
export type Rgba = [number, number, number, number]

export interface ShapesHandle {
  /** temporary speed multiplier (eases back to normal) */
  setSpeed(m: number): void
  /** quick spin + scatter for a fun reaction */
  burst(): void
}

interface Shape {
  kind: 'square' | 'circle' | 'triangle'
  x: number; y: number; vx: number
  size: number; speed: number; rot: number; spin: number
  filled: boolean
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/**
 * Slowly drifting squares, circles and triangles behind the page.
 * The colour fades smoothly whenever the `color` prop changes.
 */
export default function ShapesBackground({ color, count = 26, ref }: { color: Rgba; count?: number; ref?: Ref<ShapesHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetColor = useRef<Rgba>(color)
  const fx = useRef({ speedTarget: 1, spinBoost: 0, burst: false })

  useEffect(() => { targetColor.current = color }, [color])

  useImperativeHandle(ref, () => ({
    setSpeed(m) { fx.current.speedTarget = m },
    burst() { fx.current.spinBoost = 6; fx.current.speedTarget = 6; fx.current.burst = true },
  }), [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let W = 0, H = 0, dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * dpr; canvas.height = H * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const shapes: Shape[] = Array.from({ length: count }, () => ({
      kind: (['square', 'circle', 'triangle'] as const)[(Math.random() * 3) | 0],
      x: Math.random(), y: Math.random(), vx: 0,
      size: rand(14, 48), speed: rand(8, 20), rot: rand(0, 6.283), spin: rand(-0.3, 0.3),
      filled: Math.random() < 0.5,
    }))

    const col = [...targetColor.current]
    let speedMul = 1
    let last = performance.now()
    let raf = 0

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const f = fx.current
      const t = targetColor.current
      for (let i = 0; i < 4; i++) col[i] += (t[i] - col[i]) * Math.min(1, dt * 3)
      speedMul += (f.speedTarget - speedMul) * Math.min(1, dt * 2)
      f.speedTarget += (1 - f.speedTarget) * Math.min(1, dt * 0.8)
      f.spinBoost *= Math.pow(0.2, dt)
      if (f.burst) {
        f.burst = false
        for (const s of shapes) s.vx = (s.x - 0.5) * rand(0.4, 1.2)
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const style = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${col[3].toFixed(3)})`
      ctx.fillStyle = style; ctx.strokeStyle = style; ctx.lineWidth = 2
      for (const s of shapes) {
        s.y -= (s.speed * speedMul * dt) / H
        s.x += s.vx * dt; s.vx *= Math.pow(0.3, dt)
        s.rot += (s.spin + Math.sign(s.spin || 1) * f.spinBoost) * dt
        if (s.y < -0.1) { s.y = 1.1; s.x = Math.random() }
        if (s.x < -0.1) s.x = 1.1
        if (s.x > 1.1) s.x = -0.1
        const r = s.size / 2
        ctx.save()
        ctx.translate(s.x * W, s.y * H)
        ctx.rotate(s.rot)
        ctx.beginPath()
        if (s.kind === 'square') ctx.rect(-r, -r, r * 2, r * 2)
        else if (s.kind === 'circle') ctx.arc(0, 0, r, 0, 6.283)
        else { ctx.moveTo(0, -r * 1.1); ctx.lineTo(r, r * 0.7); ctx.lineTo(-r, r * 0.7); ctx.closePath() }
        if (s.filled) ctx.fill(); else ctx.stroke()
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [count])

  return <canvas ref={canvasRef} className="shapes-bg" aria-hidden="true" />
}
