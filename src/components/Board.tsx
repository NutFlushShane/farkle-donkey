'use client'

import { useState } from 'react'
import { calculateScore, countFaces, isSixDiceCombo, scorableMask, scoreBreakdown } from '@/lib/farkle'
import { decide } from '@/lib/bot'
import {
  canBank, canRoll, diceToRoll, heldDice, liveDice, mustOpen, scoreToBeat, selection,
  type Action, type GameState,
} from '@/lib/game'
import { quip } from '@/lib/quips'
import { buzz, sfx } from '@/lib/sfx'
import { Die3D, FlatDie } from './Dice'
import { CoinBurst, CountUp } from './fx'
import { Avatar, Donkey, Wordmark, type Mood } from './ui'

interface BoardProps {
  state: GameState
  dispatch: (a: Action) => void
  settling: boolean
  rollMs: number
  muted: boolean
  onToggleMute: () => void
  onRules: () => void
  onMenu: () => void
  onRoll: () => void
}

export default function Board({ state, dispatch, settling, rollMs, muted, onToggleMute, onRules, onMenu, onRoll }: BoardProps) {
  const { players, current, turnPhase, event, settings } = state
  const player = players[current]
  const isBot = !!player.bot
  const interactive = !isBot && !state.handoff && !settling

  const live = liveDice(state)
  const rolled = live.map(d => d.value)
  const selecting = turnPhase === 'selecting' && !settling
  const mask = turnPhase === 'selecting' ? scorableMask(rolled) : rolled.map(() => true)
  const counts = countFaces(rolled)
  const six = turnPhase === 'selecting' && isSixDiceCombo(rolled)
  const sel = selection(state)
  const total = state.turnScore + sel.score
  const next = diceToRoll(state)
  const farkled = turnPhase === 'farkled' && !settling
  const toBeat = scoreToBeat(state)
  const opening = mustOpen(state, total) && settings.openingMin > 0

  const [hint, setHint] = useState<{ seq: number; action: 'roll' | 'bank' } | null>(null)
  const activeHint = hint && hint.seq === state.rollSeq ? hint : null
  const [nope, setNope] = useState<{ id: number; n: number } | null>(null)

  const tap = (id: number, i: number) => {
    if (!interactive || turnPhase !== 'selecting') return
    setHint(null)
    if (!mask[i]) {
      sfx.nope()
      buzz(20)
      setNope(n => ({ id, n: (n?.n ?? 0) + 1 }))
      return
    }
    const die = live[i]
    if (die.status === 'selected') sfx.untick()
    else sfx.tick()
    buzz(8)
    dispatch({ type: 'TOGGLE', id })
  }

  const askDonkey = () => {
    const move = decide(state, 'stubborn')
    dispatch({ type: 'SELECT', ids: move.keepIds })
    setHint({ seq: state.rollSeq, action: move.action })
    sfx.tick()
  }

  // ------------------------------------------------------------ the donkey's take
  const seed = state.rollSeq * 3 + current
  const freshHot = event.kind === 'hot' && state.hotCount > 0 && !sel.vals.length
  const bigKind = counts.some(c => c >= 4)
  const risky = total >= 800 && next <= 2 && sel.valid
  let mood: Mood = 'idle'
  let line: string
  if (settling) {
    line = quip('rolling', seed)
  } else if (farkled) {
    mood = 'sad'
    line = quip(isBot ? 'farkleBot' : 'farkle', seed)
  } else if (turnPhase === 'ready') {
    const justBanked = event.kind === 'bank' && event.player !== current
    if (toBeat !== null) line = quip('final', seed, { score: (toBeat + 50 - player.score).toLocaleString() })
    else if (justBanked) {
      mood = 'happy'
      line = `${players[event.player].name} banked ${event.points.toLocaleString()}. ${isBot ? quip('readyBot', seed) : quip('ready', seed, { name: player.name })}`
    } else line = isBot ? quip('readyBot', seed) : quip('ready', seed, { name: player.name })
  } else if (activeHint) {
    mood = 'think'
    line = activeHint.action === 'bank' ? 'I’d keep these and bank it.' : `I’d keep these and roll ${diceToRoll(state)}.`
  } else if (isBot) {
    mood = 'think'
    line = quip('thinking', seed)
  } else if (freshHot) {
    mood = 'wow'
    line = quip('hot', seed)
  } else if (six) {
    mood = 'wow'
    line = quip(counts.filter(c => c === 2).length === 3 ? 'pairs' : 'straight', seed)
  } else if (bigKind && !sel.vals.length) {
    mood = 'wow'
    line = quip('bigKind', seed)
  } else if (risky) {
    mood = 'nervous'
    line = quip('risky', seed)
  } else if (opening) {
    line = quip('open', seed, { min: settings.openingMin })
  } else {
    line = quip('pick', seed)
  }

  // ------------------------------------------------------------ kept dice, grouped by keep
  const held = heldDice(state)
  const batches = [...new Set(held.map(d => d.batch))].sort((a, b) => a - b).map(b => held.filter(d => d.batch === b).map(d => d.value))

  const breakdown = sel.vals.length ? scoreBreakdown(sel.vals) : null

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* header */}
      <header className="flex h-11 flex-none items-center gap-1.5">
        <Wordmark className="text-xl" />
        <span className="eyebrow ml-1.5 rounded-full bg-walnut-2 px-2 py-1 whitespace-nowrap text-muted">to {settings.target.toLocaleString()}</span>
        <span className="flex-1" />
        <IconButton label={muted ? 'Sound off' : 'Sound on'} onClick={onToggleMute}>{muted ? <MuteIcon /> : <SoundIcon />}</IconButton>
        <IconButton label="How to play" onClick={onRules}>?</IconButton>
        <IconButton label="Menu" onClick={onMenu}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><circle cx="4" cy="10" r="1.8" /><circle cx="10" cy="10" r="1.8" /><circle cx="16" cy="10" r="1.8" /></svg>
        </IconButton>
      </header>

      <Scoreboard state={state} />

      {/* the donkey, peeking over the table */}
      <div className="relative z-10 flex flex-none items-end gap-2 pt-2">
        <div className="bubble mb-3 ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-cream px-3.5 py-2 text-[14px] leading-snug font-medium text-walnut shadow-lg" key={line} role="status" aria-live="polite">
          {line}
          {selecting && !isBot && !activeHint && (
            <button onClick={askDonkey} className="ml-2 inline-flex items-center rounded-full bg-walnut px-2 py-0.5 align-middle text-[11px] font-semibold text-brass-bright">
              Ask me
            </button>
          )}
        </div>
        <Donkey mood={mood} className="-mb-5 h-[68px] w-auto flex-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" />
      </div>

      {/* the table */}
      <main key={farkled ? `f${state.rollSeq}` : 'table'} className={`felt relative flex min-h-0 flex-1 flex-col rounded-[28px] px-4 pt-4 pb-3 ${farkled ? 'felt-shake' : ''}`}>
        <div className="flex items-start justify-between gap-3" data-pot>
          <div className="min-w-0">
            <p className="eyebrow truncate text-sand/80">{player.name}’s turn</p>
            <p className={`num font-display text-[44px] leading-none font-semibold transition-colors ${farkled ? 'text-rust line-through decoration-2' : total ? 'text-brass-bright' : 'text-cream/40'}`}>
              <CountUp value={farkled ? state.turnScore : total} />
            </p>
          </div>
          <div className="flex max-w-[55%] flex-wrap justify-end gap-1.5 pt-1" aria-label="Kept this turn">
            {batches.map((vals, i) => (
              <span key={i} className="fade-up flex items-center gap-1 rounded-lg bg-black/25 py-1 pr-1.5 pl-1 ring-1 ring-white/5">
                {vals.map((v, j) => <FlatDie key={j} value={v} size={16} />)}
                <span className="num ml-0.5 font-mono text-[10px] text-sand">{calculateScore(vals)}</span>
              </span>
            ))}
            {state.hotCount > 0 && <span className="rounded-lg bg-rust/80 px-1.5 py-1 font-mono text-[10px] font-semibold text-cream">HOT×{state.hotCount}</span>}
          </div>
        </div>

        {toBeat !== null && (
          <p className="eyebrow mt-2 self-start rounded-full bg-rust/90 px-2.5 py-1 text-cream">Final round · beat {toBeat.toLocaleString()}</p>
        )}

        {/* dice */}
        <div
          className="dice-tray flex min-h-0 flex-1 flex-wrap content-center items-center justify-center gap-x-2 gap-y-1 py-2"
          onClick={() => interactive && turnPhase === 'ready' && onRoll()}
        >
          {live.map((d, i) => (
            <div key={d.id} className={nope?.id === d.id ? 'die-nope' : ''} onAnimationEnd={() => setNope(null)} style={{ flexBasis: live.length > 4 ? '30%' : 'auto' }}>
              <Die3D
                id={d.id}
                value={d.value}
                rollSeq={state.rollSeq}
                order={i}
                duration={rollMs}
                selected={d.status === 'selected'}
                dim={selecting && !mask[i]}
                farkled={farkled}
                disabled={!interactive || turnPhase !== 'selecting'}
                label={selecting && mask[i] && d.status !== 'selected' && !six ? (d.value === 1 ? '100' : d.value === 5 ? '50' : `${counts[d.value]}×`) : six && selecting && d.status !== 'selected' ? '★' : ''}
                onTap={() => (turnPhase === 'ready' ? interactive && onRoll() : tap(d.id, i))}
              />
            </div>
          ))}
        </div>

        {/* what the selection is worth */}
        <div className="flex min-h-8 flex-none flex-wrap items-center justify-center gap-1.5">
          {breakdown?.combos.map(c => (
            <span key={c.label} className="fade-up inline-flex items-center gap-1.5 rounded-full bg-black/30 py-1 pr-2.5 pl-1.5 ring-1 ring-brass/30">
              <span className="flex gap-0.5">{c.values.map((v, j) => <FlatDie key={j} value={v} size={14} />)}</span>
              <span className="text-[12px] text-parchment">{c.label}</span>
              <span className="num font-display text-[15px] font-semibold text-brass-bright">+{c.points.toLocaleString()}</span>
            </span>
          ))}
          {breakdown && breakdown.dead.length > 0 && (
            <span className="rounded-full bg-rust/80 px-2.5 py-1 text-[12px] text-cream">{breakdown.dead.join(', ')} won’t score</span>
          )}
          {!breakdown && selecting && !isBot && <span className="text-[12px] text-sand/60">Tap the scoring dice to keep them</span>}
          {turnPhase === 'ready' && !isBot && !settling && <span className="text-[12px] text-sand/60">Tap the table or hit Roll</span>}
        </div>

        {farkled && (
          <>
            <div className="flash-rust pointer-events-none absolute inset-0 rounded-[28px]" />
            <div className="stamp pointer-events-none absolute top-1/2 left-1/2 rounded-xl border-4 border-rust px-5 py-1 font-display text-5xl font-bold tracking-tight text-rust uppercase" style={{ textShadow: '0 2px 0 rgba(0,0,0,.3)' }}>
              Farkle!
            </div>
          </>
        )}
        {event.kind === 'hot' && settling && (
          <div key={event.seq} className="hot-banner pointer-events-none absolute top-1/2 left-1/2 z-10 rounded-full px-6 py-2 font-display text-3xl font-bold whitespace-nowrap text-walnut shadow-xl">
            🔥 Hot dice!
          </div>
        )}
      </main>

      {/* actions */}
      <footer className="flex flex-none gap-2.5 pt-3">
        {isBot ? (
          <div className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-walnut-2/80 text-sand ring-1 ring-sand/10">
            <Avatar player={player} size={24} />
            <span className="text-[15px]">{player.name} is playing</span>
            <span className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brass" style={{ animationDelay: `${i * 120}ms` }} />)}</span>
          </div>
        ) : turnPhase === 'farkled' ? (
          <Btn tone="rust" onClick={() => dispatch({ type: 'END_TURN' })} disabled={settling}>Pass the dice →</Btn>
        ) : turnPhase === 'ready' ? (
          <Btn tone="brass" onClick={onRoll} disabled={!interactive} pulse>Roll {next} dice</Btn>
        ) : (
          <>
            <Btn tone="leather" onClick={() => dispatch({ type: 'BANK' })} disabled={!interactive || !canBank(state)}>
              <span className="block text-[11px] font-medium tracking-wide text-sand/80 uppercase">{opening ? `Need ${settings.openingMin}` : 'Bank'}</span>
              <span className="num font-display text-xl leading-tight font-semibold">{total.toLocaleString()}</span>
            </Btn>
            <Btn tone="brass" onClick={onRoll} disabled={!interactive || !canRoll(state)}>
              <span className="block text-[11px] font-medium tracking-wide uppercase opacity-70">{sel.valid ? (next === 6 ? 'Hot dice!' : 'Keep & roll') : 'Pick dice'}</span>
              <span className="text-xl leading-tight font-bold">Roll {next} →</span>
            </Btn>
          </>
        )}
      </footer>

      {event.kind === 'bank' && <CoinBurst key={event.seq} fromSelector="[data-pot]" toSelector={`[data-chip="${event.player}"]`} points={event.points} />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Scoreboard({ state }: { state: GameState }) {
  const { players, current, settings, finalRound } = state
  const leader = Math.max(...players.map(p => p.score))
  const many = players.length > 3
  return (
    <div className={`-mx-3 flex flex-none gap-2 px-3 pb-1 ${many ? 'snap-x overflow-x-auto [scrollbar-width:none]' : ''}`}>
      {players.map((p, i) => {
        const active = i === current
        const pct = Math.min(100, (p.score / settings.target) * 100)
        return (
          <div
            key={i}
            data-chip={i}
            ref={el => { if (active && many && el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) }}
            className={`relative flex min-w-0 snap-center items-center gap-2 rounded-2xl px-2.5 py-2 transition-all duration-300 ${many ? 'w-[40%] flex-none' : 'flex-1'} ${active ? 'glow-active bg-walnut-3' : 'bg-walnut-2/70'}`}
          >
            <Avatar player={p} size={30} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className={`truncate text-[13px] leading-tight ${active ? 'font-semibold text-cream' : 'text-sand'}`}>{p.name}</span>
                {p.score === leader && leader > 0 && <span className="text-[11px]" title="Leader">👑</span>}
                {finalRound === i && <span className="eyebrow text-rust">!</span>}
              </div>
              <CountUp value={p.score} className="num block font-display text-[19px] leading-tight font-semibold" />
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40">
                <div className="h-full rounded-full bg-gradient-to-r from-leather to-brass transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid h-9 w-9 place-items-center rounded-full text-[15px] font-semibold text-sand transition-colors hover:bg-walnut-2 hover:text-cream">
      {children}
    </button>
  )
}

const TONES = {
  brass: 'bg-gradient-to-b from-brass-bright to-brass text-walnut shadow-[0_6px_20px_rgba(217,178,111,0.35),inset_0_1px_0_rgba(255,255,255,0.6)]',
  leather: 'bg-gradient-to-b from-leather-bright to-leather text-cream shadow-[0_6px_18px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]',
  rust: 'bg-gradient-to-b from-[#e0885f] to-rust text-cream shadow-[0_6px_20px_rgba(208,113,74,0.35)]',
}

export function Btn({ tone, onClick, disabled, pulse, children }: { tone: keyof typeof TONES; onClick: () => void; disabled?: boolean; pulse?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-14 flex-1 rounded-2xl px-4 text-lg font-bold transition-all active:scale-[0.97] disabled:opacity-35 disabled:shadow-none ${TONES[tone]} ${pulse && !disabled ? 'pulse-ring' : ''}`}
    >
      {children}
    </button>
  )
}

function SoundIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" />
    </svg>
  )
}
function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" />
    </svg>
  )
}
