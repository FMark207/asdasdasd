/*
 * Pebble Stack game engine: physics (Matter.js), input, camera and canvas drawing.
 * The React component (PebbleStack.tsx) owns the HUD/overlays and talks to this
 * module through the callbacks below.
 */
import Matter from 'matter-js'
import { createPebble, drawSprite, pointInPoly, rng as makeRng, type Pebble, type Rng } from '../../lib/pebbles'
import { createScenery, zoneName, type View } from './scenery'

const { Engine, Bodies, Body, Composite, Constraint, Query, Events } = Matter

export interface Hud { score: number; best: number; altitude: string }
export interface GameOverInfo { title: string; score: number; best: number; isBest: boolean }

export interface GameCallbacks {
  /** score / best / altitude changed */
  onHud(h: Hud): void
  /** called every time a point is scored (for the "pop" animation) */
  onScore(): void
  /** altitude zone label or dark sky changed */
  onZone(zone: string, dark: boolean): void
  onToast(msg: string): void
  onGameOver(info: GameOverInfo): void
  /** where the hint bubble should point (null = hide it) */
  onHint(pos: { x: number; y: number } | null): void
  /** best score so far (from local storage) */
  getBest(): number
}

type Mobility = 'free' | 'move' | 'barely' | 'locked'
interface Entry {
  body: Matter.Body
  peb: Pebble
  ghost: boolean
  stacked: boolean
  isBase?: boolean
  mobility: Mobility
  constraint?: Matter.Constraint
}


// very grippy stones (friction above 1 = rough, "sticky" rock) so pebbles barely slide off
const PEB_OPTS = { friction: 1.5, frictionStatic: 6, restitution: 0, frictionAir: 0.015, density: 0.002, slop: 0.03 }
// extra slow-down for a freshly dropped pebble while it is touching the stack (0..1 per step)
const CONTACT_DAMP = 0.05
const MAT_HALF = 200

/*
 * Only the top of the stack can move:
 *   top pebble          -> can move (slightly damped)
 *   second from the top -> can barely move (heavily damped)
 *   everything below    -> locked in place (static)
 */
const DAMP = { move: 0.04, barely: 0.4 }

// altitude text: stack height in world units -> "meters" (grows faster the higher you go)
const METERS = [[0, 0], [150, 3], [400, 300], [700, 2000], [1000, 10000], [1300, 50000], [1600, 100000], [2200, 400000], [3200, 384400000]]
function heightToMeters(h: number) {
  for (let i = 1; i < METERS.length; i++) {
    const [h0, m0] = METERS[i - 1], [h1, m1] = METERS[i]
    if (h <= h1) {
      const t = (h - h0) / (h1 - h0)
      return m0 <= 0 ? m1 * t : m0 * Math.pow(m1 / m0, t)
    }
  }
  return METERS[METERS.length - 1][1]
}
function fmtMeters(m: number) {
  if (m < 1000) return Math.round(m) + ' m'
  return Math.round(m / 1000).toLocaleString('en-US') + ' km'
}

export function createPebbleStackGame(canvas: HTMLCanvasElement, cb: GameCallbacks) {
  const ctx = canvas.getContext('2d')!
  const scenery = createScenery()

  /* ---------- screen / camera ---------- */
  let W = 0, H = 0, dpr = 1, scale = 1
  // ground line as a fraction of the screen height (when the camera is at the bottom)
  let ground = 0.8
  // space taken by a phone's home bar / notch at the bottom
  let safeBottom = 0
  let camY = 0
  const w2s = (x: number, y: number) => ({ x: W / 2 + x * scale, y: H * ground + (y - camY) * scale })
  const s2w = (x: number, y: number) => ({ x: (x - W / 2) / scale, y: (y - H * ground) / scale + camY })
  const view: View = { W, H, scale, w2s }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = window.innerWidth; H = window.innerHeight
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
    // fit the mat (400 wide) on narrow phones, and the height on big screens
    // (short landscape phone screens get a little extra so the stones aren't tiny)
    scale = Math.max(0.5, Math.min(1.15, Math.min(W / 460, H / (H < 500 ? 620 : 820))))
    // tall phone screens: lift the ground a bit so the next pebble fits underneath
    ground = H > W * 1.2 ? 0.72 : 0.8
    safeBottom = readSafeBottom()
    view.W = W; view.H = H; view.scale = scale
  }

  function readSafeBottom() {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)'
    document.body.appendChild(probe)
    const v = parseFloat(getComputedStyle(probe).paddingBottom) || 0
    probe.remove()
    return v
  }
  resize()

  /* ---------- state ---------- */
  let engine: Matter.Engine
  let pebbles: Entry[] = []
  let tray: { peb: Pebble; t: number } | null = null
  let held: Entry | null = null
  let released: Entry | null = null
  let releasedTouching = false
  let state: 'ready' | 'holding' | 'settling' | 'over' = 'ready'
  let score = 0, stackTop = 0, baseTop = 0, settleFrames = 0, settleTime = 0
  let rng: Rng = makeRng(1)
  let floats: { x: number; y: number; text: string; life: number }[] = []
  let lastZone = '', lastDark = false
  const pointer = { x: 0, y: 0 }

  /* free scroll: the camera stops following the stack and the player can
     scroll / drag around to preview the sky, clouds and space */
  const FREE_MAX = 1800 // how far up you can scroll (world units)
  let freeCam = false
  let freeY = 0          // camera target while free scrolling
  let returning = false  // gliding back to the stack after free scroll
  let panning: { y: number; camY: number } | null = null
  const clampFree = (y: number) => Math.max(-FREE_MAX, Math.min(0, y))

  function setFreeCam(on: boolean) {
    if (on === freeCam || held) return freeCam // can't switch while holding a pebble
    freeCam = on
    if (on) freeY = camY
    else { returning = true; panning = null }
    canvas.style.cursor = on ? 'grab' : 'default'
    return freeCam
  }

  function addPebble(peb: Pebble, x: number, y: number): Entry {
    const body = Bodies.fromVertices(x, y, [peb.verts.map(v => ({ x: v.x, y: v.y }))], { ...PEB_OPTS })
    Body.setPosition(body, { x, y })
    const entry: Entry = { body, peb, ghost: false, stacked: false, mobility: 'free' }
    pebbles.push(entry)
    Composite.add(engine.world, body)
    return entry
  }

  function newGame() {
    engine = Engine.create()
    engine.positionIterations = 14
    engine.velocityIterations = 10
    engine.constraintIterations = 4
    const mat = Bodies.rectangle(0, 20, MAT_HALF * 2, 40, { isStatic: true, friction: 1, frictionStatic: 2.5, label: 'mat' })
    Composite.add(engine.world, mat)

    pebbles = []; floats = []
    held = null; released = null
    score = 0
    rng = makeRng((Math.random() * 1e9) | 0)

    // a big flat base stone to start with (like the photo)
    const base = createPebble(rng, { size: 1.3, flat: true })
    const baseEntry = addPebble(base, 0, -base.maxY - 0.5)
    baseEntry.stacked = true
    baseEntry.isBase = true
    updateStackMobility()
    watchBoard()
    stackTop = baseTop = computeTop()
    camY = 0

    spawnTray()
    updateHud()
  }

  function updateStackMobility() {
    const stack = pebbles.filter(p => p.stacked) // in the order they were stacked
    stack.forEach((p, i) => {
      const fromTop = stack.length - 1 - i
      p.mobility = fromTop === 0 ? 'move' : fromTop === 1 ? 'barely' : 'locked'
      if (p.mobility === 'locked') {
        if (!p.body.isStatic) Body.setStatic(p.body, true)
      } else {
        p.body.friction = 1.7
        p.body.frictionStatic = p.mobility === 'barely' ? 8 : 6
      }
    })
  }

  function applyStackDamping() {
    for (const p of pebbles) {
      if (p === held || !p.stacked || p.body.isStatic) continue
      if (p.mobility !== 'move' && p.mobility !== 'barely') continue
      const k = 1 - DAMP[p.mobility], b = p.body
      Body.setVelocity(b, { x: b.velocity.x * k, y: b.velocity.y * k })
      Body.setAngularVelocity(b, b.angularVelocity * k)
    }
    // the pebble you just dropped: once it touches the stack it quickly loses its
    // slide and spin, so it settles where it lands instead of sliding off
    if (released && releasedTouching) {
      const k = 1 - CONTACT_DAMP, b = released.body
      Body.setVelocity(b, { x: b.velocity.x * k, y: b.velocity.y * k })
      Body.setAngularVelocity(b, b.angularVelocity * k)
    }
  }

  // any pebble other than the base touching the wooden board = game over
  function watchBoard() {
    const check = (ev: Matter.IEventCollision<Matter.Engine>) => {
      if (state === 'over') return
      for (const pair of ev.pairs) {
        // remember whether the dropped pebble is resting on another pebble
        if (released && (pair.bodyA === released.body || pair.bodyB === released.body)) {
          const other = pair.bodyA === released.body ? pair.bodyB : pair.bodyA
          if (other.label !== 'mat') releasedTouching = true
        }
        const other = pair.bodyA.label === 'mat' ? pair.bodyB : pair.bodyB.label === 'mat' ? pair.bodyA : null
        if (!other) continue
        const entry = pebbles.find(p => p.body === other)
        if (entry && !entry.isBase && !entry.ghost) {
          gameOver('A pebble hit the board!')
          return
        }
      }
    }
    Events.on(engine, 'collisionStart', check)
    Events.on(engine, 'collisionActive', check)
  }

  function computeTop() {
    let top = 0
    for (const p of pebbles) if (p !== held && p.body.position.y < 200) top = Math.min(top, p.body.bounds.min.y)
    return top
  }

  function spawnTray() {
    // pebbles get a little more varied (and a bit smaller on average) as you go
    const size = 0.78 + rng() * 0.42 - Math.min(score, 30) * 0.004
    tray = { peb: createPebble(rng, { size }), t: 0 }
    state = 'ready'
  }

  function trayPos() {
    const p = tray!.peb
    const margin = W < 520 ? 16 : 30
    return {
      x: W - Math.max(p.halfW * scale + margin, 80),
      y: H - safeBottom - Math.max(p.halfH * scale + 40, 70),
    }
  }

  /* ---------- input ---------- */
  function hitTray(sx: number, sy: number) {
    if (!tray || state !== 'ready') return false
    const t = trayPos()
    const lx = (sx - t.x) / scale, ly = (sy - t.y) / scale
    if (pointInPoly(tray.peb.verts, lx, ly)) return true
    // a little forgiveness for fingers
    const p = tray.peb
    return (lx * lx) / ((p.halfW + 14) ** 2) + (ly * ly) / ((p.halfH + 14) ** 2) <= 1
  }

  function grab(sx: number, sy: number) {
    const t = trayPos()
    const wc = s2w(t.x, t.y)
    const entry = addPebble(tray!.peb, wc.x, wc.y)
    const body = entry.body
    const mw = s2w(sx, sy)
    // the cursor becomes the pivot point, so the pebble can swing around it
    const constraint = Constraint.create({
      pointA: { x: mw.x, y: mw.y },
      bodyB: body,
      pointB: { x: mw.x - wc.x, y: mw.y - wc.y },
      length: 0.01, stiffness: 0.55, damping: 0.08,
    })
    Composite.add(engine.world, constraint)
    body.frictionAir = 0.04
    // the new pebble starts below the mat, so it is a "ghost" (passes through everything)
    // until it has been lifted above the mat surface and is clear of other stones
    entry.ghost = true
    body.collisionFilter.mask = 0
    held = entry
    held.constraint = constraint
    tray = null
    state = 'holding'
    cb.onHint(null)
  }

  function overlapsAnything(body: Matter.Body) {
    const others = Composite.allBodies(engine.world).filter(b => b !== body)
    return Query.collides(body, others).length > 0
  }

  function release() {
    if (!held) return
    Composite.remove(engine.world, held.constraint!)
    const b = held.body
    b.frictionAir = PEB_OPTS.frictionAir
    // cap crazy throws
    const v = b.velocity, sp = Math.hypot(v.x, v.y), max = 22
    if (sp > max) Body.setVelocity(b, { x: v.x / sp * max, y: v.y / sp * max })
    if (Math.abs(b.angularVelocity) > 0.3) Body.setAngularVelocity(b, Math.sign(b.angularVelocity) * 0.3)
    released = held
    held = null
    if (state === 'holding') {
      state = 'settling'
      settleFrames = 0; settleTime = 0
    }
  }

  const onDown = (e: PointerEvent) => {
    pointer.x = e.clientX; pointer.y = e.clientY
    if (freeCam) {
      // drag to pan around
      panning = { y: e.clientY, camY: freeY }
      canvas.style.cursor = 'grabbing'
      try { canvas.setPointerCapture(e.pointerId) } catch { /* not critical */ }
      return
    }
    if (hitTray(e.clientX, e.clientY)) {
      grab(e.clientX, e.clientY)
      try { canvas.setPointerCapture(e.pointerId) } catch { /* not critical */ }
    }
  }
  const onMove = (e: PointerEvent) => {
    pointer.x = e.clientX; pointer.y = e.clientY
    if (freeCam) {
      if (panning) freeY = clampFree(panning.camY - (e.clientY - panning.y) / scale)
      return
    }
    canvas.style.cursor = held ? 'grabbing' : (hitTray(e.clientX, e.clientY) ? 'grab' : 'default')
  }
  const onUp = () => {
    if (freeCam) { panning = null; canvas.style.cursor = 'grab'; return }
    release(); canvas.style.cursor = 'default'
  }
  const onWheel = (e: WheelEvent) => {
    if (!freeCam) return
    e.preventDefault()
    freeY = clampFree(freeY + e.deltaY / scale)
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('blur', onUp)
  window.addEventListener('resize', resize)

  /* ---------- game logic ---------- */
  function step() {
    if (held) {
      const mw = s2w(pointer.x, pointer.y)
      held.constraint!.pointA.x = mw.x
      held.constraint!.pointA.y = mw.y
    }
    for (const p of pebbles) {
      if (p.ghost && p.body.bounds.max.y < -2 && !overlapsAnything(p.body)) {
        p.ghost = false
        p.body.collisionFilter.mask = 0xFFFFFFFF
      }
    }

    applyStackDamping()
    releasedTouching = false // re-detected by the collision events during this update
    Engine.update(engine, 1000 / 60)

    // something fell off the mat?
    for (let i = pebbles.length - 1; i >= 0; i--) {
      const p = pebbles[i]
      if (p === held) continue
      if (p.body.position.y > 260 && state !== 'over') gameOver(p === released ? 'Missed the stack!' : 'The tower fell!')
      if (p.body.position.y > 4000) { Composite.remove(engine.world, p.body); pebbles.splice(i, 1) }
    }

    if (state === 'settling') {
      settleTime++
      let maxV = 0
      for (const p of pebbles) maxV = Math.max(maxV, p.body.speed, Math.abs(p.body.angularVelocity) * 40)
      settleFrames = maxV < 0.14 ? settleFrames + 1 : 0
      if (settleFrames > 40 || settleTime > 60 * 7) onSettled()
    }

    // camera follows the top of the stack (or the free-scroll position)
    const follow = Math.min(0, stackTop + (ground - 0.42) * H / scale)
    if (freeCam) {
      camY += (freeY - camY) * 0.15
    } else if (returning) {
      // glide back to the current pebble a bit faster than normal
      camY += (follow - camY) * 0.08
      if (Math.abs(follow - camY) < 2) returning = false
    } else {
      camY += (follow - camY) * 0.04
    }

    if (tray) tray.t = Math.min(1, tray.t + 0.06)
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= 1 / 60
      if (floats[i].life <= 0) floats.splice(i, 1)
    }
  }

  function onSettled() {
    const r = released!
    const b = r.body
    let othersMinY = Infinity
    for (const p of pebbles) if (p !== r && p.stacked) othersMinY = Math.min(othersMinY, p.body.position.y)
    const onTop = b.position.y < othersMinY - 2 && b.bounds.max.y < -8
    if (onTop) {
      score++
      // the new pebble joins the stack: the one below it can now barely move,
      // and everything further down gets locked in place
      r.stacked = true
      updateStackMobility()
      floats.push({ x: b.position.x, y: b.bounds.min.y - 10, text: '+1', life: 1 })
      cb.onScore()
    } else {
      cb.onToast('Not on top of the stack — no point')
    }
    released = null
    stackTop = computeTop()
    updateHud()
    spawnTray()
  }

  function gameOver(title: string) {
    state = 'over'
    release()
    tray = null
    cb.onHint(null)
    const prevBest = cb.getBest()
    cb.onGameOver({ title, score, best: Math.max(prevBest, score), isBest: score > prevBest })
    updateHud()
  }

  function updateHud() {
    cb.onHud({
      score,
      best: Math.max(cb.getBest(), score),
      altitude: fmtMeters(heightToMeters((baseTop - stackTop) * 1.5)),
    })
  }

  /* ---------- drawing ---------- */
  // visual altitude moves a bit faster than the camera so you reach space in a reasonable game
  const visAlt = () => Math.max(0, -camY * 1.5)

  function drawPebbleAt(peb: Pebble, sx: number, sy: number, angle: number, sc: number, alpha: number) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(sx + 2 * sc, sy + 6 * sc); ctx.rotate(angle); ctx.scale(sc, sc)
    drawSprite(ctx, peb.shadow)
    ctx.restore()
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(sx, sy); ctx.rotate(angle); ctx.scale(sc, sc)
    drawSprite(ctx, peb.sprite)
    ctx.restore()
  }

  function render(time: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const v = visAlt()
    scenery.drawSky(ctx, view, v, time)
    scenery.drawShapes(ctx, view, v, time)
    scenery.drawMat(ctx, view)

    for (const p of pebbles) {
      const s = w2s(p.body.position.x, p.body.position.y)
      if (s.y < -300 || s.y > H + 300) continue
      drawPebbleAt(p.peb, s.x, s.y, p.body.angle, scale, p.ghost ? 0.6 : 1)
    }

    // pivot point of the held pebble
    if (held) {
      const b = held.body, c = held.constraint!
      const ap = w2s(b.position.x + c.pointB.x, b.position.y + c.pointB.y)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(ap.x, ap.y, 5, 0, 6.283); ctx.fill(); ctx.stroke()
    }

    // next pebble waiting in the bottom-right corner (hidden while free scrolling)
    if (tray && !freeCam) {
      const t = trayPos()
      const e = 1 - Math.pow(1 - tray.t, 3)
      const bob = Math.sin(time * 2.2) * 3
      ctx.save()
      ctx.translate(t.x, t.y + tray.peb.halfH * scale + 14)
      ctx.scale(1, 0.22)
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, tray.peb.halfW * scale * 1.1)
      pg.addColorStop(0, `rgba(0,0,0,${0.12 * e})`); pg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, tray.peb.halfW * scale * 1.1, 0, 6.283); ctx.fill()
      ctx.restore()
      drawPebbleAt(tray.peb, t.x, t.y + bob - (1 - e) * 30, 0, scale * (0.6 + 0.4 * e), e)
      cb.onHint({ x: t.x, y: t.y - tray.peb.halfH * scale - 14 })
    }

    // floating +1
    ctx.textAlign = 'center'
    ctx.font = `700 ${Math.round(28 * Math.max(scale, 0.8))}px Fredoka, sans-serif`
    for (const f of floats) {
      const s = w2s(f.x, f.y)
      ctx.globalAlpha = Math.min(1, f.life * 1.5)
      ctx.fillStyle = v > 860 ? '#fff' : '#2a2a2a'
      ctx.fillText(f.text, s.x, s.y - (1 - f.life) * 40)
    }
    ctx.globalAlpha = 1

    const zone = zoneName(v), dark = v > 860
    if (zone !== lastZone || dark !== lastDark) {
      lastZone = zone; lastDark = dark
      cb.onZone(zone, dark)
    }
  }

  /* ---------- main loop (fixed physics step) ---------- */
  const STEP = 1000 / 60
  let last = performance.now(), acc = 0, raf = 0
  function frame(now: number) {
    acc += Math.min(100, now - last)
    last = now
    let n = 0
    while (acc >= STEP && n < 5) { step(); acc -= STEP; n++ }
    if (n === 5) acc = 0
    render(now / 1000)
    raf = requestAnimationFrame(frame)
  }

  newGame()
  raf = requestAnimationFrame(frame)

  return {
    restart: newGame,
    /** turn free scroll on/off; returns the new mode (unchanged while holding a pebble) */
    setFreeCam,
    get state() { return state },
    destroy() {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('blur', onUp)
      window.removeEventListener('resize', resize)
      Engine.clear(engine)
    },
    /** handy for testing in the browser console */
    debug: {
      get state() { return state },
      get score() { return score },
      /** world → screen position (for automated tests) */
      toScreen: (x: number, y: number) => w2s(x, y),
      get pebbles() { return pebbles },
      trayPos: () => (tray ? trayPos() : null),
      peek(h: number) { stackTop = -h; camY = Math.min(0, stackTop + (ground - 0.42) * H / scale) },
    },
  }
}

export type PebbleStackGame = ReturnType<typeof createPebbleStackGame>
