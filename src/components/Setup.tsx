'use client'

import { useState } from 'react'
import { DEFAULT_SETTINGS, type BotLevel, type SeatConfig, type Settings } from '@/lib/game'
import { KEYS, useStored } from '@/lib/storage'
import { Ears } from './Dice'
import { Avatar } from './ui'

const LEVELS: BotLevel[] = ['easy', 'normal', 'stubborn']
const BOT_NAMES: Record<BotLevel, string> = { easy: 'Burro', normal: 'Donkey', stubborn: 'Ol’ Stubborn' }
const LEVEL_LABEL: Record<BotLevel, string> = { easy: 'Easy', normal: 'Normal', stubborn: 'Stubborn' }
const TARGETS = [2_500, 5_000, 10_000]

interface Table {
  seats: SeatConfig[]
  settings: Settings
}

const DEFAULT_TABLE: Table = {
  seats: [{ name: '', bot: null }, { name: BOT_NAMES.normal, bot: 'normal' }],
  settings: DEFAULT_SETTINGS,
}

function parseTable(raw: string | null): Table | null {
  try {
    const t = raw ? (JSON.parse(raw) as Table) : null
    return t && Array.isArray(t.seats) && t.seats.length && t.settings ? t : null
  } catch {
    return null
  }
}

export default function Setup({ onStart, onRules }: { onStart: (t: Table) => void; onRules: () => void }) {
  // Last table is remembered; edits live in `draft` until the game starts.
  const saved = parseTable(useStored(KEYS.table))
  const [draft, setDraft] = useState<Table | null>(null)
  const table = draft ?? saved ?? DEFAULT_TABLE
  const { seats, settings } = table

  const update = (t: Partial<Table>) => setDraft({ ...table, ...t })
  const setSeat = (i: number, seat: Partial<SeatConfig>) => update({ seats: seats.map((s, j) => (j === i ? { ...s, ...seat } : s)) })
  const cycleLevel = (i: number) => {
    const seat = seats[i]
    if (!seat.bot) return
    const level = LEVELS[(LEVELS.indexOf(seat.bot) + 1) % LEVELS.length]
    const renamed = Object.values(BOT_NAMES).includes(seat.name) ? BOT_NAMES[level] : seat.name
    setSeat(i, { bot: level, name: renamed })
  }
  const add = (bot: BotLevel | null) => update({ seats: [...seats, { name: bot ? BOT_NAMES[bot] : '', bot }] })
  const remove = (i: number) => update({ seats: seats.filter((_, j) => j !== i) })

  const start = () => {
    let human = 0
    const named = seats.map(s => {
      if (s.bot) return s
      human++
      return { ...s, name: s.name.trim() || `Player ${human}` }
    })
    onStart({ seats: named, settings })
  }

  let humanNo = 0

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="relative z-20 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sand">
          <Ears className="h-4 w-4" />
          <span className="font-display text-[15px] font-semibold">Prosper Donkey</span>
        </span>
        <button onClick={onRules} className="eyebrow rounded-full bg-walnut-2 px-3 py-1.5 text-sand hover:text-cream">How to play</button>
      </header>

      {/* hero */}
      <section className="relative mt-3 flex min-h-[236px] items-end justify-between">
        <div className="fade-up relative z-10 pb-8">
          <p className="eyebrow text-brass">A game of nerve</p>
          <h1 className="font-display text-[clamp(52px,17vw,68px)] leading-[0.9] font-semibold tracking-tight">Farkle</h1>
          <p className="mt-2 font-display text-lg text-sand italic">Roll the dice.<br />Press your luck.</p>
        </div>
        <div className="pointer-events-none absolute -right-4 bottom-0 h-[226px] w-[min(196px,48vw)]">
          <div className="absolute inset-x-4 bottom-4 top-10 rounded-full bg-felt/60 blur-3xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/donk-aces.webp" alt="The Prosper Donkey holding pocket aces" className="donk relative h-full w-full object-contain object-bottom" data-mood="idle" />
        </div>
      </section>

      {/* seats */}
      <section className="fade-up relative z-10 rounded-3xl bg-walnut/90 p-4 ring-1 ring-sand/10 backdrop-blur" style={{ animationDelay: '80ms' }}>
        <p className="eyebrow mb-3 text-muted">At the table</p>
        <ul className="space-y-2">
          {seats.map((seat, i) => {
            const n = seat.bot ? 0 : ++humanNo
            return (
              <li key={i} className="flex items-center gap-2.5 rounded-2xl bg-walnut-2 py-1.5 pr-1.5 pl-2">
                <Avatar player={{ name: seat.name || `${n}`, bot: seat.bot }} size={34} />
                {seat.bot ? (
                  <span className="flex-1 truncate font-medium">{seat.name}</span>
                ) : (
                  <input
                    value={seat.name}
                    onChange={e => setSeat(i, { name: e.target.value })}
                    placeholder={n === 1 ? 'Your name' : `Player ${n}`}
                    maxLength={16}
                    enterKeyHint="done"
                    aria-label={`Player ${n} name`}
                    className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] font-medium text-cream placeholder:text-muted/70 focus:outline-none"
                  />
                )}
                {seat.bot && (
                  <button onClick={() => cycleLevel(i)} className="rounded-full bg-felt px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-cream ring-1 ring-brass/30" aria-label={`Difficulty: ${LEVEL_LABEL[seat.bot]}. Tap to change.`}>
                    {LEVEL_LABEL[seat.bot]} ↻
                  </button>
                )}
                {seats.length > 1 && (
                  <button onClick={() => remove(i)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-walnut-3 hover:text-cream" aria-label={`Remove ${seat.name || `player ${n}`}`}>
                    ✕
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {seats.length < 6 && (
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button onClick={() => add(null)} className="rounded-2xl border border-dashed border-sand/25 py-2.5 text-sm font-medium text-sand hover:border-sand/50 hover:text-cream">+ Player</button>
            <button onClick={() => add('normal')} className="rounded-2xl border border-dashed border-brass/35 py-2.5 text-sm font-medium text-brass hover:border-brass/60 hover:text-brass-bright">+ Donkey bot</button>
          </div>
        )}
      </section>

      {/* house rules */}
      <section className="fade-up mt-3 rounded-3xl bg-walnut/90 p-4 ring-1 ring-sand/10" style={{ animationDelay: '160ms' }}>
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow whitespace-nowrap text-muted">Play to</p>
          <div className="flex rounded-full bg-walnut-2 p-1">
            {TARGETS.map(t => (
              <button
                key={t}
                onClick={() => update({ settings: { ...settings, target: t } })}
                className={`num rounded-full px-2.5 py-1.5 text-[13px] min-[380px]:px-3 font-semibold transition-colors ${settings.target === t ? 'bg-cream text-walnut' : 'text-sand'}`}
              >
                {t.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="block text-[15px] font-medium">Opening 500</span>
            <span className="block text-[12px] text-muted">Need 500 in one turn to get on the board</span>
          </span>
          <input
            type="checkbox"
            checked={settings.openingMin > 0}
            onChange={e => update({ settings: { ...settings, openingMin: e.target.checked ? 500 : 0 } })}
            className="peer sr-only"
          />
          <span className="relative h-7 w-12 flex-none rounded-full bg-walnut-3 transition-colors peer-checked:bg-felt peer-focus-visible:ring-2 peer-focus-visible:ring-brass after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-sand after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-cream" />
        </label>
      </section>

      <div className="flex-1" />
      <button
        onClick={start}
        className="fade-up mt-4 h-15 w-full rounded-2xl bg-gradient-to-b from-brass-bright to-brass text-xl font-bold text-walnut shadow-[0_10px_30px_rgba(217,178,111,0.35),inset_0_1px_0_rgba(255,255,255,0.6)] transition-transform active:scale-[0.98]"
        style={{ animationDelay: '240ms' }}
      >
        Deal me in →
      </button>
    </div>
  )
}

export type { Table }
