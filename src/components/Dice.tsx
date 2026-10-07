'use client'

import { useEffect, useRef } from 'react'

// Pip positions on a 100×100 face (the 1 is the donkey's ears).
const PIPS: Record<number, [number, number][]> = {
  1: [],
  2: [[27, 27], [73, 73]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
}

// The Prosper Donkey ears mark.
export const EARS_PATH =
  'M36 88 C 28 70, 22 42, 28 14 C 31 6, 38 6, 41 14 C 47 42, 45 70, 44 88 Z M34 76 C 30 58, 28 36, 32 20 C 34 16, 37 16, 38 20 C 40 36, 39 58, 38 76 Z M64 88 C 72 70, 78 42, 72 14 C 69 6, 62 6, 59 14 C 53 42, 55 70, 56 88 Z M66 76 C 70 58, 72 36, 68 20 C 66 16, 63 16, 62 20 C 60 36, 61 58, 62 76 Z'

export function Ears({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path fill="currentColor" fillRule="evenodd" d={EARS_PATH} />
    </svg>
  )
}

export function Face({ value }: { value: number }) {
  if (value === 1) return <Ears className="die-ears" />
  return (
    <svg viewBox="0 0 100 100" className="die-pips" aria-hidden>
      {PIPS[value].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={9.5} />
      ))}
    </svg>
  )
}

export function FlatDie({ value, size = 22, className = '' }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`flat-die ${className}`} style={{ width: size, height: size }} aria-label={`${value}`}>
      <Face value={value} />
    </span>
  )
}

// Cube rotation that brings each value to the front. Opposite faces sum to 7.
const SHOW: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] }
const FACES: [number, string][] = [
  [1, 'translateZ(var(--half))'],
  [6, 'rotateY(180deg) translateZ(var(--half))'],
  [3, 'rotateY(90deg) translateZ(var(--half))'],
  [4, 'rotateY(-90deg) translateZ(var(--half))'],
  [2, 'rotateX(90deg) translateZ(var(--half))'],
  [5, 'rotateX(-90deg) translateZ(var(--half))'],
]

// Small deterministic PRNG so layout jitter is stable across renders.
export function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

interface Die3DProps {
  id: number
  value: number
  rollSeq: number
  order: number
  duration: number
  selected: boolean
  dim: boolean
  farkled: boolean
  disabled: boolean
  label?: string
  onTap: () => void
}

export function Die3D({ id, value, rollSeq, order, duration, selected, dim, farkled, disabled, label, onTap }: Die3DProps) {
  const cube = useRef<HTMLDivElement>(null)
  const toss = useRef<HTMLDivElement>(null)
  const [rx, ry] = SHOW[value]
  const seed = rollSeq * 7 + id
  const tilt = (rand(seed) - 0.5) * 24
  const nudgeX = (rand(seed + 3) - 0.5) * 14
  const nudgeY = (rand(seed + 5) - 0.5) * 12

  useEffect(() => {
    if (!rollSeq || !duration || !cube.current || !toss.current) return
    const r = (n: number) => rand(rollSeq * 31 + id * 5 + n)
    const spinX = 360 * (2 + Math.floor(r(1) * 2)) * (r(2) > 0.5 ? 1 : -1)
    const spinY = 360 * (1 + Math.floor(r(3) * 2)) * (r(4) > 0.5 ? 1 : -1)
    const delay = order * 55
    const opts = { duration, delay, easing: 'cubic-bezier(.15,.65,.25,1)', fill: 'backwards' as const }
    const a = cube.current.animate(
      [
        { transform: `rotateX(${rx + spinX}deg) rotateY(${ry + spinY}deg) rotateZ(${r(5) * 180}deg)` },
        { transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(0deg)` },
      ],
      opts,
    )
    const fromX = (r(6) - 0.5) * 220
    const b = toss.current.animate(
      [
        { transform: `translate(${fromX}px, -150%) scale(1.35)`, opacity: 0 },
        { transform: `translate(${fromX * 0.3}px, 6%) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: 'translate(0, -10%) scale(1)', offset: 0.75 },
        { transform: 'translate(0, 0) scale(1)' },
      ],
      opts,
    )
    return () => {
      a.cancel()
      b.cancel()
    }
    // Only a new roll should replay the toss.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollSeq])

  return (
    <button
      type="button"
      onClick={onTap}
      aria-disabled={disabled}
      aria-pressed={selected}
      aria-label={`Die showing ${value}${selected ? ', kept' : ''}`}
      className={`die-slot ${selected ? 'is-selected' : ''} ${dim ? 'is-dim' : ''} ${farkled ? 'is-farkled' : ''}`}
      style={{ '--tilt': `${tilt}deg`, '--nx': `${nudgeX}px`, '--ny': `${nudgeY}px` } as React.CSSProperties}
    >
      <div className="die-toss" ref={toss}>
        <div className="die-shadow" />
        <div className="die-lift">
          <div className="die-ring" />
          <div className="die-cube" ref={cube} style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}>
            {FACES.map(([v, t]) => (
              <div key={v} className="die-face" style={{ transform: t }}>
                <Face value={v} />
              </div>
            ))}
          </div>
          {selected && <div className="die-check">✓</div>}
        </div>
      </div>
      <span className="die-label">{label ?? ''}</span>
    </button>
  )
}
