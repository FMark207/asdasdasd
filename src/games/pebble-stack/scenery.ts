/*
 * Everything drawn behind the pebbles: the sky that turns from white → blue →
 * clouds → space, birds, plane, satellite, moon, planet, the drifting shapes
 * and the woven mat.
 *
 * "v" is the visual altitude (0 at the ground, ~1300+ in space).
 */

export interface View {
  W: number
  H: number
  scale: number
  w2s: (x: number, y: number) => { x: number; y: number }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/* ---------- sky colours ---------- */
const SKY: [number, number][] = ([
  [0, '#ffffff'], [300, '#ffffff'], [450, '#e8f3fc'], [600, '#c4e0f8'], [760, '#93c3ee'],
  [920, '#5a90d6'], [1080, '#2a4d98'], [1220, '#111c4b'], [1360, '#070a1c'], [1600, '#020308'],
] as [number, string][]).map(([v, hex]) => [v, parseInt(hex.slice(1), 16)])

function skyColor(v: number) {
  let i = 1
  while (i < SKY.length - 1 && v > SKY[i][0]) i++
  const [v0, c0] = SKY[i - 1], [v1, c1] = SKY[i]
  const t = Math.max(0, Math.min(1, (v - v0) / (v1 - v0)))
  const ch = (c: number, s: number) => (c >> s) & 255
  const mix = (s: number) => Math.round(ch(c0, s) + (ch(c1, s) - ch(c0, s)) * t)
  return `rgb(${mix(16)},${mix(8)},${mix(0)})`
}

/* ---------- zones ---------- */
export function zoneName(v: number) {
  if (v < 300) return 'Ground level'
  if (v < 520) return 'Up in the air'
  if (v < 950) return 'Cloud layer'
  if (v < 1150) return 'Stratosphere'
  if (v < 1350) return 'Edge of space'
  if (v < 1800) return 'Outer space'
  return 'Deep space'
}

/* ---------- woven mat (pre-rendered once) ---------- */
function makeMat() {
  const RES = 2, rx = 210, ry = 44, th = 14, w = rx * 2 + 10, h = ry * 2 + th + 10
  const c = document.createElement('canvas')
  c.width = w * RES; c.height = h * RES
  const g = c.getContext('2d')!
  g.scale(RES, RES)
  const cx = w / 2, cy = ry + 5
  // side
  g.fillStyle = '#a7895f'
  g.beginPath(); g.ellipse(cx, cy + th, rx, ry, 0, 0, Math.PI); g.lineTo(cx - rx, cy); g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill()
  for (let i = 0; i < 90; i++) {
    const t = i / 90 * Math.PI, x = cx - Math.cos(t) * rx, yb = cy + Math.sin(t) * ry
    g.strokeStyle = i % 2 ? 'rgba(80,60,35,0.25)' : 'rgba(230,205,160,0.25)'
    g.lineWidth = 2; g.beginPath(); g.moveTo(x, yb + 1); g.lineTo(x + 2, yb + th - 1); g.stroke()
  }
  // top: concentric braided rope
  g.fillStyle = '#d7c19a'
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 6.283); g.fill()
  const rings = 22
  for (let k = rings; k >= 1; k--) {
    const f = k / rings, erx = rx * f, ery = ry * f
    g.strokeStyle = k % 2 ? '#cdb487' : '#dcc7a2'
    g.lineWidth = rx / rings * 0.9 * (ry / rx) * 2.2
    g.beginPath(); g.ellipse(cx, cy, erx, ery, 0, 0, 6.283); g.stroke()
    const n = Math.floor(18 + 120 * f)
    g.strokeStyle = 'rgba(120,92,55,0.35)'; g.lineWidth = 0.9
    for (let i = 0; i < n; i++) {
      const t = i / n * 6.283, x = cx + Math.cos(t) * erx, y = cy + Math.sin(t) * ery
      g.beginPath(); g.moveTo(x - 1.8, y - 1); g.lineTo(x + 1.8, y + 1); g.stroke()
    }
  }
  // shading
  const sg = g.createRadialGradient(cx, cy - ry * 0.3, 10, cx, cy, rx)
  sg.addColorStop(0, 'rgba(255,245,225,0.18)'); sg.addColorStop(0.7, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(60,40,15,0.22)')
  g.fillStyle = sg; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 6.283); g.fill()
  return { canvas: c, w, h, cx, cy }
}

export function createScenery() {
  const MAT = makeMat()

  const makePuffs = (n: number) => Array.from({ length: n }, (_, i) => {
    const f = i / (n - 1) - 0.5
    return { dx: f * 150 + rand(-10, 10), dy: rand(-14, 6), r: rand(22, 40) * (1 - Math.abs(f) * 0.9) }
  })
  const clouds = Array.from({ length: 15 }, () => ({
    x: rand(-1, 1), A: rand(480, 1050), p: rand(0.5, 0.95), s: rand(0.6, 1.4), drift: rand(-6, 6),
    puffs: makePuffs(6 + ((Math.random() * 4) | 0)),
  }))
  const birds = Array.from({ length: 7 }, () => ({ x: rand(-1, 1), A: rand(280, 560), p: rand(0.7, 0.95), sp: rand(18, 40), ph: rand(0, 6) }))
  const stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.4, 1.6), tw: rand(0, 6) }))
  const shooting = { t: -1, x: 0, y: 0, dx: 1 }
  const shapes = Array.from({ length: 22 }, () => ({
    kind: (['square', 'circle', 'triangle'] as const)[(Math.random() * 3) | 0],
    x: Math.random(), y: Math.random(),
    size: rand(14, 46), speed: rand(6, 16), rot: rand(0, 6.283), spin: rand(-0.25, 0.25),
    filled: Math.random() < 0.5,
  }))
  let lastShapeTime = 0

  /** sky + all the decorations */
  function drawSky(ctx: CanvasRenderingContext2D, view: View, v: number, time: number) {
    const { W, H, scale } = view
    const decorY = (A: number, p: number) => H * 0.45 - (A - v) * p * scale

    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, skyColor(v + 220))
    g.addColorStop(1, skyColor(v))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // stars
    const sa = smooth(1000, 1300, v)
    if (sa > 0) {
      ctx.fillStyle = '#fff'
      for (const s of stars) {
        const yy = ((s.y * H + v * 0.08) % H + H) % H
        ctx.globalAlpha = sa * (0.55 + 0.45 * Math.sin(time * 2 + s.tw))
        ctx.beginPath(); ctx.arc(s.x * W, yy, s.r, 0, 6.283); ctx.fill()
      }
      ctx.globalAlpha = 1
      // shooting star
      if (shooting.t < 0 && Math.random() < 0.004 * sa) {
        Object.assign(shooting, { t: 0, x: rand(0.1, 0.9) * W, y: rand(0.05, 0.4) * H, dx: Math.random() < 0.5 ? 1 : -1 })
      }
      if (shooting.t >= 0) {
        shooting.t += 1 / 60
        const k = shooting.t / 0.8, len = 120
        const hx = shooting.x + shooting.dx * k * 300, hy = shooting.y + k * 150
        const sg = ctx.createLinearGradient(hx, hy, hx - shooting.dx * len, hy - len / 2)
        sg.addColorStop(0, `rgba(255,255,255,${sa * (1 - k)})`); sg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = sg; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - shooting.dx * len, hy - len / 2); ctx.stroke()
        if (k >= 1) shooting.t = -1
      }
    }

    // earth's glow at the bottom when in space
    const ea = smooth(1100, 1400, v)
    if (ea > 0) {
      const R = W * 1.6
      const cy = H + R - H * 0.12 + Math.max(0, v - 1400) * 0.25 * scale
      ctx.save()
      ctx.globalAlpha = ea
      const eg = ctx.createRadialGradient(W / 2, cy, R * 0.98, W / 2, cy, R * 1.06)
      eg.addColorStop(0, 'rgba(120,190,255,0.9)'); eg.addColorStop(0.4, 'rgba(70,140,255,0.35)'); eg.addColorStop(1, 'rgba(40,90,255,0)')
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(W / 2, cy, R * 1.06, 0, 6.283); ctx.fill()
      const body = ctx.createLinearGradient(0, cy - R, 0, cy - R + H * 0.3)
      body.addColorStop(0, '#2f6fc4'); body.addColorStop(1, '#0d2a5c')
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(W / 2, cy, R, 0, 6.283); ctx.fill()
      ctx.restore()
    }

    // moon
    const ma = smooth(1150, 1400, v)
    if (ma > 0) {
      const mx = W * 0.78, my = decorY(1650, 0.3), mr = 46 * scale
      ctx.save(); ctx.globalAlpha = ma
      const mg = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr)
      mg.addColorStop(0, '#f4f2ea'); mg.addColorStop(1, '#a9a69c')
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.283); ctx.fill()
      ctx.fillStyle = 'rgba(110,105,95,0.35)'
      for (const [a, b, r] of [[-0.3, -0.1, 0.18], [0.25, 0.2, 0.22], [0.1, -0.4, 0.1], [-0.15, 0.4, 0.12]]) {
        ctx.beginPath(); ctx.arc(mx + a * mr, my + b * mr, r * mr, 0, 6.283); ctx.fill()
      }
      ctx.restore()
    }

    // ringed planet
    const pa = smooth(1400, 1700, v)
    if (pa > 0) {
      const px = W * 0.2, py = decorY(2100, 0.25), pr = 70 * scale
      ctx.save(); ctx.globalAlpha = pa; ctx.translate(px, py); ctx.rotate(-0.35)
      ctx.strokeStyle = 'rgba(230,200,150,0.75)'; ctx.lineWidth = 7 * scale
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, Math.PI, 2 * Math.PI); ctx.stroke()
      const pg = ctx.createLinearGradient(0, -pr, 0, pr)
      pg.addColorStop(0, '#f0c98a'); pg.addColorStop(0.5, '#d49a5a'); pg.addColorStop(1, '#8a5a32')
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, pr, 0, 6.283); ctx.fill()
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI); ctx.stroke()
      ctx.restore()
    }

    // satellite drifting past
    const sta = smooth(1050, 1250, v) * (1 - smooth(1700, 1900, v))
    if (sta > 0) {
      const sx = ((time * 25) % (W + 200)) - 100, sy = decorY(1350, 0.5)
      ctx.save(); ctx.globalAlpha = sta; ctx.translate(sx, sy); ctx.rotate(0.3); ctx.scale(scale, scale)
      ctx.fillStyle = '#c9ccd6'; ctx.fillRect(-7, -5, 14, 10)
      ctx.fillStyle = '#3d5fa8'; ctx.fillRect(-30, -4, 20, 8); ctx.fillRect(10, -4, 20, 8)
      ctx.restore()
    }

    // airplane with contrail
    const pla = smooth(600, 750, v) * (1 - smooth(1050, 1150, v))
    if (pla > 0) {
      const px = W + 100 - ((time * 60) % (W + 400)), py = decorY(860, 0.7)
      ctx.save(); ctx.globalAlpha = pla
      const cg = ctx.createLinearGradient(px, py, px + 260, py)
      cg.addColorStop(0, 'rgba(255,255,255,0.9)'); cg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = cg; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + 8, py); ctx.lineTo(px + 260, py); ctx.stroke()
      ctx.translate(px, py); ctx.scale(scale, scale)
      ctx.fillStyle = '#eef1f6'
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 3.2, 0, 0, 6.283); ctx.fill()
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(6, -10); ctx.lineTo(9, -10); ctx.lineTo(5, 0); ctx.fill()
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(6, 9); ctx.lineTo(9, 9); ctx.lineTo(5, 0); ctx.fill()
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(15, -7); ctx.lineTo(17, -7); ctx.lineTo(16, 0); ctx.fill()
      ctx.restore()
    }

    // birds
    const ba = smooth(120, 300, v) * (1 - smooth(800, 950, v))
    ctx.strokeStyle = `rgba(60,60,70,${0.55 * ba})`; ctx.lineWidth = 1.6; ctx.lineCap = 'round'
    for (const b of birds) {
      const y = decorY(b.A, b.p)
      if (y < -20 || y > H + 20) continue
      const span = W + 200
      const x = (((b.x + 1) / 2 * span + time * b.sp) % span) - 100
      const f = Math.sin(time * 8 + b.ph) * 4 * scale, s = 7 * scale
      ctx.beginPath(); ctx.moveTo(x - s, y - f); ctx.quadraticCurveTo(x - s / 2, y - 2, x, y); ctx.quadraticCurveTo(x + s / 2, y - 2, x + s, y - f); ctx.stroke()
    }

    // clouds
    const ca = smooth(260, 460, v) * (1 - smooth(880, 1060, v))
    if (ca > 0) {
      for (const c of clouds) {
        const y = decorY(c.A, c.p)
        if (y < -120 || y > H + 120) continue
        const span = W + 400
        const x = ((((c.x + 1) / 2) * span + time * c.drift) % span + span) % span - 200
        ctx.save()
        ctx.translate(x, y); ctx.scale(c.s * scale, c.s * scale)
        ctx.globalAlpha = 0.92 * ca
        ctx.fillStyle = 'rgba(205,220,236,0.9)'
        for (const p of c.puffs) { ctx.beginPath(); ctx.arc(p.dx, p.dy + p.r * 0.22, p.r, 0, 6.283); ctx.fill() }
        ctx.fillStyle = '#ffffff'
        for (const p of c.puffs) { ctx.beginPath(); ctx.arc(p.dx, p.dy, p.r, 0, 6.283); ctx.fill() }
        ctx.restore()
      }
    }
  }

  /** light gray squares, circles and triangles slowly scrolling upwards */
  function drawShapes(ctx: CanvasRenderingContext2D, view: View, v: number, time: number) {
    const { W, H, scale } = view
    const dt = Math.min(0.1, time - lastShapeTime)
    lastShapeTime = time
    const dark = smooth(700, 1000, v)
    const col = dark > 0.5 ? `rgba(255,255,255,${0.07 * dark})` : `rgba(150,155,165,${0.16 * (1 - dark)})`
    ctx.save()
    ctx.lineWidth = 2
    ctx.fillStyle = col; ctx.strokeStyle = col
    for (const s of shapes) {
      s.y -= (s.speed * dt) / H
      s.rot += s.spin * dt
      if (s.y < -0.1) { s.y = 1.1; s.x = Math.random() }
      const r = s.size * Math.max(scale, 0.7) / 2
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
    ctx.restore()
  }

  function drawMat(ctx: CanvasRenderingContext2D, view: View) {
    const { H, scale } = view
    const s = view.w2s(0, 0)
    if (s.y - MAT.cy * scale > H + 20) return
    // soft floor shadow
    ctx.save()
    ctx.translate(s.x, s.y + 30 * scale); ctx.scale(scale, scale * 0.25)
    const fg = ctx.createRadialGradient(0, 0, 50, 0, 0, 260)
    fg.addColorStop(0, 'rgba(0,0,0,0.13)'); fg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = fg; ctx.fillRect(-270, -270, 540, 540)
    ctx.restore()
    ctx.drawImage(MAT.canvas, s.x - MAT.cx * scale, s.y - MAT.cy * scale, MAT.w * scale, MAT.h * scale)
  }

  return { drawSky, drawShapes, drawMat }
}
