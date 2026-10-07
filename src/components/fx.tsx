'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const motionQuery = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    cb => {
      const mq = window.matchMedia(motionQuery)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(motionQuery).matches,
    () => false,
  )
}

// Animates a number toward its target.
export function useCountUp(target: number, ms = 600): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const begin = from.current
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const v = Math.round(begin + (target - begin) * (1 - (1 - t) ** 3))
      from.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return shown
}

export function CountUp({ value, className }: { value: number; className?: string }) {
  return <span className={className}>{useCountUp(value).toLocaleString()}</span>
}

// Full-screen confetti in brand colours. Stops after a few seconds.
export function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || reduced) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      el.width = innerWidth * dpr
      el.height = innerHeight * dpr
    }
    resize()
    const colors = ['#D9B26F', '#F0CF8E', '#F8F6F0', '#4D6A52', '#A47A5C', '#D0714A']
    const bits = Array.from({ length: 160 }, (_, i) => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 16 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      c: colors[i % colors.length],
    }))
    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      for (const b of bits) {
        b.vy += 0.35
        b.vx *= 0.99
        b.x += b.vx
        b.y += b.vy
        b.r += b.vr
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(b.r)
        ctx.fillStyle = b.c
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)))
        ctx.restore()
      }
      if (now - start < 5000) raf = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, innerWidth, innerHeight)
    }
    raf = requestAnimationFrame(frame)
    addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
    }
  }, [reduced])
  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-50 h-full w-full" aria-hidden />
}

// Gold coins that fly from one element to another, then a "+N" pop at the destination.
export function CoinBurst({ fromSelector, toSelector, points }: { fromSelector: string; toSelector: string; points: number }) {
  const layer = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const host = layer.current
    const from = document.querySelector(fromSelector)
    const to = document.querySelector(toSelector)
    if (!host || !from || !to) return
    const a = from.getBoundingClientRect()
    const b = to.getBoundingClientRect()
    const ax = a.left + a.width / 2
    const ay = a.top + a.height / 2
    const bx = b.left + b.width / 2
    const by = b.top + b.height / 2
    const coins = reduced ? 0 : Math.min(14, 4 + Math.floor(points / 150))
    const anims: Animation[] = []
    for (let i = 0; i < coins; i++) {
      const c = document.createElement('div')
      c.className = 'coin'
      c.style.left = `${ax}px`
      c.style.top = `${ay}px`
      host.appendChild(c)
      const mx = (ax + bx) / 2 + (Math.random() - 0.5) * 160
      const my = Math.min(ay, by) - 60 - Math.random() * 80
      anims.push(
        c.animate(
          [
            { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
            { transform: `translate(calc(${mx - ax}px - 50%), calc(${my - ay}px - 50%)) scale(1.1)`, opacity: 1, offset: 0.45 },
            { transform: `translate(calc(${bx - ax}px - 50%), calc(${by - ay}px - 50%)) scale(.7)`, opacity: 1, offset: 0.92 },
            { transform: `translate(calc(${bx - ax}px - 50%), calc(${by - ay}px - 50%)) scale(.3)`, opacity: 0 },
          ],
          { duration: 700 + Math.random() * 250, delay: i * 35, easing: 'cubic-bezier(.3,.1,.4,1)', fill: 'forwards' },
        ),
      )
    }
    const pop = document.createElement('div')
    pop.className = 'coin-pop'
    pop.textContent = `+${points.toLocaleString()}`
    pop.style.left = `${bx}px`
    pop.style.top = `${by}px`
    host.appendChild(pop)
    anims.push(
      pop.animate(
        [
          { transform: 'translate(-50%,-30%) scale(.6)', opacity: 0 },
          { transform: 'translate(-50%,-90%) scale(1.15)', opacity: 1, offset: 0.3 },
          { transform: 'translate(-50%,-160%) scale(1)', opacity: 0 },
        ],
        { duration: 1400, delay: reduced ? 0 : 650, easing: 'ease-out', fill: 'forwards' },
      ),
    )
    return () => {
      anims.forEach(x => x.cancel())
      host.replaceChildren()
    }
  }, [fromSelector, toSelector, points, reduced])
  return <div ref={layer} className="pointer-events-none fixed inset-0 z-40" aria-hidden />
}
