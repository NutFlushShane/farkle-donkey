'use client'

import type { GameState } from '@/lib/game'
import { Btn } from './Board'
import { Confetti, CountUp } from './fx'
import { Avatar } from './ui'

// Full-screen "pass the phone" card between human turns.
export function Handoff({ state, onReady }: { state: GameState; onReady: () => void }) {
  const player = state.players[state.current]
  const { event } = state
  const prev = state.players[event.player]
  const recap =
    event.kind === 'bank' ? `${prev.name} banked ${event.points.toLocaleString()}.`
    : event.kind === 'farkle' ? `${prev.name} farkled${event.points ? ` and lost ${event.points.toLocaleString()}` : ''}.`
    : null
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-ink/95 px-6 backdrop-blur-md">
      <div className="fade-up flex w-full max-w-sm flex-col items-center text-center">
        <div className="-rotate-2 overflow-hidden rounded-[28px] bg-gradient-to-b from-cream to-parchment px-6 pt-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-brass/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/donk-phone.webp" alt="The Prosper Donkey checking his phone" className="h-52 w-auto" />
        </div>
        {recap && <p className="mt-2 text-sm text-muted">{recap}</p>}
        <p className="eyebrow mt-4 text-brass">Pass the phone to</p>
        <h2 className="mt-1 flex items-center gap-3 font-display text-4xl font-semibold">
          <Avatar player={player} size={40} />
          {player.name}
        </h2>
        <p className="mt-2 text-sand">
          You have <span className="num font-semibold text-cream">{player.score.toLocaleString()}</span>
          {state.finalRound !== null && <span className="text-rust"> · final round!</span>}
        </p>
        <div className="mt-8 flex w-full">
          <Btn tone="brass" onClick={onReady} pulse>I’m {player.name}, let’s roll</Btn>
        </div>
      </div>
    </div>
  )
}

export function GameOver({ state, onRematch, onNewTable }: { state: GameState; onRematch: () => void; onNewTable: () => void }) {
  const winner = state.players[state.winner ?? 0]
  const standings = state.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score)
  const humanWon = !winner.bot
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {humanWon && <Confetti />}
      <section className="relative flex flex-col items-center text-center">
        <div className="absolute top-10 h-48 w-48 rounded-full bg-brass/25 blur-3xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/donk-aces.webp" alt="The Prosper Donkey holding pocket aces" className="donk relative h-52 w-auto" data-mood={humanWon ? 'happy' : 'wow'} />
        <p className="eyebrow mt-2 text-brass">{humanWon ? 'Winner winner, hay for dinner' : 'The house always wins'}</p>
        <h1 className="fade-up mt-1 font-display text-[44px] leading-none font-semibold tracking-tight">{winner.name} takes the pot</h1>
        <p className="mt-2 font-display text-2xl text-brass-bright"><CountUp value={winner.score} className="num" /> points</p>
      </section>

      <section className="fade-up mt-6 rounded-3xl bg-walnut/90 p-2 ring-1 ring-sand/10" style={{ animationDelay: '150ms' }}>
        <div className="eyebrow grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 py-2 text-muted">
          <span>Player</span><span className="text-right">Best</span><span className="text-right">Farkles</span><span className="text-right">Score</span>
        </div>
        {standings.map((p, rank) => (
          <div key={p.i} className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 rounded-2xl px-3 py-2.5 ${rank === 0 ? 'bg-walnut-3' : ''}`}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="num w-4 font-mono text-xs text-muted">{rank + 1}</span>
              <Avatar player={p} size={26} />
              <span className="truncate font-medium">{p.name}</span>
            </span>
            <span className="num text-right text-sm text-sand">{p.stats.bestTurn.toLocaleString()}</span>
            <span className="num text-right text-sm text-sand">{p.stats.farkles}</span>
            <span className="num text-right font-display text-lg font-semibold">{p.score.toLocaleString()}</span>
          </div>
        ))}
      </section>

      <div className="flex-1" />
      <div className="mt-6 flex gap-2.5">
        <Btn tone="leather" onClick={onNewTable}>New table</Btn>
        <Btn tone="brass" onClick={onRematch} pulse>Rematch</Btn>
      </div>
    </div>
  )
}
