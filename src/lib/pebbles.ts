/*
 * Procedural, realistic-looking pebble generator.
 * Shared by the hub thumbnail and the Pebble Stack game.
 *
 * Draw a sprite at the pebble's centroid:
 *   ctx.drawImage(s.canvas, -s.ox, -s.oy, s.w, s.h)
 */

export type Rng = () => number
export interface Vec { x: number; y: number }
export interface Sprite { canvas: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }

export interface Palette {
  name: string
  w: number
  base: string
  blot: string[]
  speck: string[]
  density: number
  vein: string
  veins: number
}

export interface Pebble {
  verts: Vec[]
  palette: Palette
  minX: number; maxX: number; minY: number; maxY: number
  halfW: number; halfH: number
  sprite: Sprite
  shadow: Sprite
}

/** Small seeded random generator (mulberry32) */
export function rng(seed: number): Rng {
  let a = (seed >>> 0) || 1
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const R = (r: Rng, a: number, b: number) => a + (b - a) * r()
const pick = <T,>(r: Rng, arr: T[]) => arr[Math.floor(r() * arr.length)]

// Stone types. w = how often they appear.
export const PALETTES: Palette[] = [
  { name: 'granite', w: 3, base: '#9b958f', blot: ['#8a847f', '#b1aaa3', '#a3958e'], speck: ['#4b4744', '#3a3735', '#ece8e2', '#d9cfc6', '#b89c90'], density: 1.1, vein: '#ebe7e1', veins: 0.5 },
  { name: 'sand', w: 3, base: '#d6ccb6', blot: ['#cfc3aa', '#e0d8c6', '#c8bca2'], speck: ['#b9ab90', '#f1ece0', '#a89a82'], density: 0.45, vein: '#e8e1d0', veins: 0.15 },
  { name: 'coral', w: 2, base: '#c97a60', blot: ['#bf6c52', '#d68c72', '#c4806a'], speck: ['#f0b9a6', '#8f4a3a', '#f7e2d6', '#a65a45'], density: 1.2, vein: '#e7a891', veins: 0.1 },
  { name: 'cream', w: 3, base: '#e2dac8', blot: ['#d9cfba', '#ebe5d7', '#d4cab4'], speck: ['#c4b8a0', '#f6f2ea', '#b8ab92'], density: 0.3, vein: '#f4f0e7', veins: 0.2 },
  { name: 'rose', w: 2, base: '#b8a39a', blot: ['#a8928a', '#c8b5ac', '#bf9f94'], speck: ['#6e625e', '#ece2dc', '#d2a99b', '#8c7b75'], density: 1.0, vein: '#e2d6d0', veins: 0.35 },
  { name: 'slate', w: 2, base: '#7a7672', blot: ['#6a6662', '#8a8682', '#7f7772'], speck: ['#4a4745', '#a9a5a0', '#5c5856'], density: 0.6, vein: '#c4bfb9', veins: 0.7 },
  { name: 'quartz', w: 1, base: '#ebe7df', blot: ['#e2ddd3', '#f3f0ea', '#ddd6ca'], speck: ['#b3ada4', '#c9c2b8', '#9f988f'], density: 0.35, vein: '#aaa39a', veins: 0.6 },
  { name: 'ochre', w: 1, base: '#c9a874', blot: ['#bd9a65', '#d6b886', '#c29f6c'], speck: ['#8f7448', '#ead7b4', '#a5865a'], density: 0.7, vein: '#e2cda4', veins: 0.2 },
]
const TOTAL_W = PALETTES.reduce((s, p) => s + p.w, 0)

function pickPalette(r: Rng): Palette {
  let x = r() * TOTAL_W
  for (const p of PALETTES) { x -= p.w; if (x <= 0) return p }
  return PALETTES[0]
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Andrew's monotone chain convex hull
function hull(points: Vec[]): Vec[] {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Vec, a: Vec, b: Vec) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Vec[] = [], upper: Vec[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  upper.pop(); lower.pop()
  return lower.concat(upper)
}

function centroid(v: Vec[]): Vec {
  let A = 0, cx = 0, cy = 0
  for (let i = 0; i < v.length; i++) {
    const p = v[i], q = v[(i + 1) % v.length]
    const c = p.x * q.y - q.x * p.y
    A += c; cx += (p.x + q.x) * c; cy += (p.y + q.y) * c
  }
  A *= 0.5
  return { x: cx / (6 * A), y: cy / (6 * A) }
}

// Smooth outline through the hull points (quadratic curves via midpoints)
function traceInto(ctx: CanvasRenderingContext2D, v: Vec[], dx = 0, dy = 0) {
  const n = v.length
  const mid = (i: number) => ({
    x: (v[i % n].x + v[(i + 1) % n].x) / 2 + dx,
    y: (v[i % n].y + v[(i + 1) % n].y) / 2 + dy,
  })
  const m0 = mid(n - 1)
  ctx.moveTo(m0.x, m0.y)
  for (let i = 0; i < n; i++) {
    const m = mid(i)
    ctx.quadraticCurveTo(v[i].x + dx, v[i].y + dy, m.x, m.y)
  }
  ctx.closePath()
}
function trace(ctx: CanvasRenderingContext2D, v: Vec[]) { ctx.beginPath(); traceInto(ctx, v) }

function makeShape(r: Rng, size: number, flat: boolean): Vec[] {
  const a = R(r, 55, 82) * size                       // half width
  const b = a * R(r, 0.33, 0.52) * (flat ? 0.8 : 1)    // half height
  const n = R(r, 2.0, 2.8)                            // superellipse "boxiness"
  const top = R(r, 0.95, 1.12), bot = R(r, 0.78, 0.97) // domed top, flatter bottom
  const skew = R(r, -0.1, 0.1), taper = R(r, -0.15, 0.15)
  const p1 = r() * 6.283, p2 = r() * 6.283, p3 = r() * 6.283
  const w1 = R(r, 0, 0.035), w2 = R(r, 0, 0.022), w3 = R(r, 0, 0.012)
  const N = 60, pts: Vec[] = []
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    const c = Math.cos(t), s = Math.sin(t)
    let x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
    let y = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)
    y *= s < 0 ? top : bot
    y *= 1 + taper * x / a
    const k = 1 + w1 * Math.sin(2 * t + p1) + w2 * Math.sin(3 * t + p2) + w3 * Math.sin(5 * t + p3)
    x *= k; y *= k
    x += y * skew
    pts.push({ x, y })
  }
  const h = hull(pts)
  const c = centroid(h)
  return h.map(p => ({ x: p.x - c.x, y: p.y - c.y }))
}

const RES = 2 // render sprites at 2x for crisp edges

function newCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return { c, g: c.getContext('2d')! }
}

function makeSprite(v: Vec[], pal: Palette, r: Rng, minX: number, maxX: number, minY: number, maxY: number): Sprite {
  const pad = 3
  const bw = maxX - minX, bh = maxY - minY
  const a = bw / 2, b = bh / 2
  const cw = Math.ceil((bw + pad * 2) * RES), ch = Math.ceil((bh + pad * 2) * RES)
  const { c, g } = newCanvas(cw, ch)
  g.scale(RES, RES)
  g.translate(-minX + pad, -minY + pad)

  g.save()
  trace(g, v); g.clip()

  // base colour
  g.fillStyle = pal.base
  g.fillRect(minX - 5, minY - 5, bw + 10, bh + 10)

  // soft colour blotches (low-frequency variation)
  const blots = 8 + Math.floor(r() * 8)
  for (let i = 0; i < blots; i++) {
    const x = R(r, minX, maxX), y = R(r, minY, maxY), rad = R(r, 0.15, 0.6) * a
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    const col = pick(r, pal.blot)
    gr.addColorStop(0, hexA(col, R(r, 0.35, 0.7)))
    gr.addColorStop(1, hexA(col, 0))
    g.fillStyle = gr
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }

  // mineral veins
  const veinCount = Math.round(pal.veins * R(r, 0, 3.5))
  for (let i = 0; i < veinCount; i++) {
    const y0 = R(r, minY, maxY), y1 = R(r, minY, maxY)
    const lw = R(r, 0.6, 2.6)
    g.beginPath()
    g.moveTo(minX - 4, y0)
    g.bezierCurveTo(R(r, minX, 0), R(r, minY, maxY), R(r, 0, maxX), R(r, minY, maxY), maxX + 4, y1)
    g.strokeStyle = hexA(pal.vein, R(r, 0.08, 0.16)); g.lineWidth = lw * 3.5; g.stroke()
    g.strokeStyle = hexA(pal.vein, R(r, 0.18, 0.38)); g.lineWidth = lw; g.stroke()
  }

  // speckles (mineral grains)
  const count = Math.floor(bw * bh * pal.density * 0.4)
  for (let i = 0; i < count; i++) {
    const x = R(r, minX, maxX), y = R(r, minY, maxY)
    g.fillStyle = pick(r, pal.speck)
    g.globalAlpha = R(r, 0.2, 0.75)
    const s = r() < 0.9 ? R(r, 0.25, 0.8) : R(r, 0.8, 1.8)
    if (r() < 0.5) g.fillRect(x, y, s, s)
    else { g.beginPath(); g.arc(x, y, s / 2, 0, 6.283); g.fill() }
  }
  g.globalAlpha = 1

  // fine grain noise (per pixel)
  const img = g.getImageData(0, 0, cw, ch), d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const nz = (r() - 0.5) * 30
    d[i] += nz; d[i + 1] += nz; d[i + 2] += nz
  }
  g.putImageData(img, 0, 0)

  // lighting: brighter top, darker bottom
  const lg = g.createLinearGradient(0, minY, 0, maxY)
  lg.addColorStop(0, 'rgba(255,255,255,0.22)')
  lg.addColorStop(0.35, 'rgba(255,255,255,0.04)')
  lg.addColorStop(0.6, 'rgba(0,0,0,0)')
  lg.addColorStop(1, 'rgba(35,22,12,0.34)')
  g.fillStyle = lg
  g.fillRect(minX - 5, minY - 5, bw + 10, bh + 10)

  // inner edge shadow (rounded, 3D look) — shadow of a frame around the hole
  g.save()
  g.shadowColor = 'rgba(28,18,10,0.55)'
  g.shadowBlur = b * 0.55 * RES
  g.shadowOffsetY = -b * 0.2 * RES
  g.shadowOffsetX = -a * 0.03 * RES
  g.beginPath()
  g.rect(minX - 300, minY - 300, bw + 600, bh + 600)
  traceInto(g, v)
  g.fillStyle = '#000'
  g.fill('evenodd')
  g.restore()

  // top rim highlight
  g.save()
  g.shadowColor = 'rgba(255,250,242,0.45)'
  g.shadowBlur = b * 0.35 * RES
  g.shadowOffsetY = b * 0.15 * RES
  g.shadowOffsetX = a * 0.04 * RES
  g.beginPath()
  g.rect(minX - 300, minY - 300, bw + 600, bh + 600)
  traceInto(g, v)
  g.fillStyle = '#000'
  g.fill('evenodd')
  g.restore()

  // soft specular sheen
  g.save()
  g.translate(-a * 0.2, minY + b * 0.55)
  g.scale(1, 0.42)
  const sg = g.createRadialGradient(0, 0, 0, 0, 0, a * 0.85)
  sg.addColorStop(0, 'rgba(255,255,255,0.16)')
  sg.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sg
  g.fillRect(-a, -a, a * 2, a * 2)
  g.restore()

  g.restore() // clip

  // crisp cut-out rim
  trace(g, v)
  g.strokeStyle = 'rgba(40,28,18,0.2)'
  g.lineWidth = 0.7
  g.stroke()

  return { canvas: c, ox: -minX + pad, oy: -minY + pad, w: cw / RES, h: ch / RES }
}

function makeShadow(v: Vec[], minX: number, maxX: number, minY: number, maxY: number): Sprite {
  const pad = 16
  const bw = maxX - minX, bh = maxY - minY
  const cw = Math.ceil((bw + pad * 2) * RES), ch = Math.ceil((bh + pad * 2) * RES)
  const { c, g } = newCanvas(cw, ch)
  g.scale(RES, RES)
  g.translate(-minX + pad, -minY + pad)
  // draw far away and throw only the shadow back in (works in every browser)
  g.shadowColor = 'rgba(40,28,16,0.42)'
  g.shadowBlur = 8 * RES
  g.shadowOffsetX = 10000 * RES
  g.beginPath()
  traceInto(g, v, -10000, 0)
  g.fillStyle = '#000'
  g.fill()
  return { canvas: c, ox: -minX + pad, oy: -minY + pad, w: cw / RES, h: ch / RES }
}

export function createPebble(r: Rng, opts: { size?: number; flat?: boolean; palette?: Palette } = {}): Pebble {
  const size = opts.size ?? R(r, 0.85, 1.15)
  const verts = makeShape(r, size, !!opts.flat)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of verts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const palette = opts.palette ?? pickPalette(r)
  return {
    verts, palette,
    minX, maxX, minY, maxY,
    halfW: Math.max(-minX, maxX), halfH: Math.max(-minY, maxY),
    sprite: makeSprite(verts, palette, r, minX, maxX, minY, maxY),
    shadow: makeShadow(verts, minX, maxX, minY, maxY),
  }
}

export function pointInPoly(v: Vec[], x: number, y: number) {
  let inside = false
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    if (((v[i].y > y) !== (v[j].y > y)) && (x < (v[j].x - v[i].x) * (y - v[i].y) / (v[j].y - v[i].y) + v[i].x)) inside = !inside
  }
  return inside
}

/** draw a sprite centred on the current origin */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite) {
  ctx.drawImage(s.canvas, -s.ox, -s.oy, s.w, s.h)
}
