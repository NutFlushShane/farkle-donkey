'use client'

import { useEffect, useRef } from 'react'
import { Ears, FlatDie } from './Dice'
import type { Player, Settings } from '@/lib/game'

export type Mood = 'idle' | 'happy' | 'sad' | 'nervous' | 'think' | 'wow'

// The Prosper Donkey himself. Moods are motion: hop, droop, jitter, ponder.
export function Donkey({ mood = 'idle', className = '' }: { mood?: Mood; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={mood} src="/donk-head.webp" alt="" draggable={false} data-mood={mood} className={`donk select-none ${className}`} />
  )
}

export function Avatar({ player, size = 32 }: { player: Pick<Player, 'name' | 'bot'>; size?: number }) {
  if (player.bot) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/donk-face.webp" alt="" width={size} height={size} className="flex-none rounded-full bg-felt ring-1 ring-brass/40" />
    )
  }
  return (
    <span
      className="grid flex-none place-items-center rounded-full bg-leather font-display font-semibold text-cream ring-1 ring-sand/30"
      style={{ width: size, height: size, fontSize: size * 0.46 }}
    >
      {player.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Ears className="h-[1.1em] w-[1.1em] text-cream" />
      <span className="font-display font-semibold tracking-tight">Farkle</span>
    </span>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={e => e.target === ref.current && onClose()} aria-label={title}>
      <div className="max-h-[88dvh] overflow-y-auto px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-sand/25 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-walnut-2 text-sand hover:text-cream" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

const RULES: { dice: number[]; label: string; points: string }[] = [
  { dice: [1], label: 'Single 1', points: '100' },
  { dice: [5], label: 'Single 5', points: '50' },
  { dice: [1, 1, 1], label: 'Three 1s', points: '1,000' },
  { dice: [4, 4, 4], label: 'Three of a kind', points: 'face × 100' },
  { dice: [4, 4, 4, 4], label: 'Each extra die', points: 'doubles it' },
  { dice: [1, 2, 3, 4, 5, 6], label: 'Straight', points: '1,500' },
  { dice: [2, 2, 3, 3, 6, 6], label: 'Three pairs', points: '750' },
]

export function RulesSheet({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: Settings }) {
  return (
    <Sheet open={open} onClose={onClose} title="How to play">
      <ol className="space-y-2.5 text-[15px] leading-snug text-parchment">
        <li><b className="text-cream">Roll</b> six dice. Tap the scoring ones to keep them.</li>
        <li><b className="text-cream">Push your luck:</b> roll what’s left, or <b className="text-cream">bank</b> your points and pass.</li>
        <li>Roll nothing that scores? <b className="text-rust">Farkle.</b> You lose the turn’s points.</li>
        <li>Score with all six? <b className="text-brass-bright">Hot dice</b>, roll all six again.</li>
        <li>First to <b className="text-cream">{settings.target.toLocaleString()}</b> triggers the final round. Everyone else gets one last turn to beat them.</li>
        {settings.openingMin > 0 && (
          <li>House rule: you need <b className="text-cream">{settings.openingMin}</b> in one turn to get on the board.</li>
        )}
      </ol>

      <p className="eyebrow mt-6 mb-2 text-muted">Scoring</p>
      <ul className="divide-y divide-sand/10 rounded-2xl bg-walnut-2/70 ring-1 ring-sand/10">
        {RULES.map(r => (
          <li key={r.label} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="flex flex-none gap-1">
              {r.dice.map((v, i) => <FlatDie key={i} value={v} size={20} />)}
            </span>
            <span className="flex-1 text-sm text-parchment">{r.label}</span>
            <span className="num font-display text-[17px] font-semibold text-brass-bright">{r.points}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-muted">
        The ears are the 1. Tip: tap one die of a set to grab the whole set, or ask the donkey for advice.
      </p>
    </Sheet>
  )
}
