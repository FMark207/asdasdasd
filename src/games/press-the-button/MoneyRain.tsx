import { useEffect, useState, type CSSProperties } from 'react'

interface Bill {
  id: number
  left: number   // vw
  sway: number   // px
  spin: number   // deg
  scale: number
  dur: number    // s
}

let nextId = 0
function makeBill(): Bill {
  // left strip (0–20% of the width) or right strip (80–100%)
  const left = Math.random() < 0.5 ? Math.random() * 20 : 80 + Math.random() * 20
  return {
    id: nextId++,
    left,
    sway: Math.random() * 60 - 30,
    spin: Math.random() * 720 - 360,
    scale: 0.75 + Math.random() * 0.5,
    dur: 3 + Math.random() * 2.5,
  }
}

/** Simple green bills falling down the left and right sides (for as long as it's mounted) */
export default function MoneyRain() {
  // a first big handful, then a steady stream
  const [bills, setBills] = useState<Bill[]>(() => Array.from({ length: 10 }, makeBill))

  useEffect(() => {
    const timer = setInterval(() => setBills(b => [...b, makeBill()]), 140)
    return () => clearInterval(timer)
  }, [])

  const remove = (id: number) => setBills(b => b.filter(x => x.id !== id))

  return (
    <div className="money-layer" aria-hidden="true">
      {bills.map(b => (
        <div
          key={b.id}
          className="bill"
          onAnimationEnd={() => remove(b.id)}
          style={{
            left: `calc(${b.left}vw - 30px)`,
            animationDuration: `${b.dur}s`,
            '--sway': `${b.sway}px`,
            '--spin': `${b.spin}deg`,
            '--scale': b.scale,
          } as CSSProperties}
        >
          <span>$</span>
        </div>
      ))}
    </div>
  )
}
