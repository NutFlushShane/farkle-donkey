'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { decide } from '@/lib/bot'
import { rollDice } from '@/lib/farkle'
import { initialState, reducer, type GameState } from '@/lib/game'
import { buzz, setMuted, sfx } from '@/lib/sfx'
import { KEYS, readStored, useStored, writeStored } from '@/lib/storage'
import Board from './Board'
import { useReducedMotion } from './fx'
import { GameOver, Handoff } from './Screens'
import Setup from './Setup'
import { RulesSheet, Sheet } from './ui'

function track(name: string, params: Record<string, unknown>) {
  ;(window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', name, params)
}

export default function FarkleGame() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const reduced = useReducedMotion()
  const rollMs = reduced ? 0 : 950
  const settleMs = reduced ? 120 : rollMs + 5 * 55 + 50

  const muted = useStored(KEYS.muted) === '1'
  useEffect(() => setMuted(muted), [muted])

  const [rulesOpen, setRulesOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // ---------------------------------------------------------------- resume a saved game
  useEffect(() => {
    try {
      const saved = JSON.parse(readStored(KEYS.game) ?? 'null') as GameState | null
      if (saved && (saved.phase === 'playing' || saved.phase === 'over') && saved.players?.length) {
        dispatch({ type: 'LOAD', state: { ...saved, event: { ...saved.event, kind: 'start' } } })
      }
    } catch {
      writeStored(KEYS.game, null)
    }
  }, [])

  // Skips the first run: on mount the state is still the blank setup, not the game being restored.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    writeStored(KEYS.game, state.phase === 'setup' ? null : JSON.stringify(state))
  }, [state])

  // ---------------------------------------------------------------- dice settle after each roll
  const [settledSeq, setSettledSeq] = useState(0)
  const settling = state.rollSeq > 0 && settledSeq !== state.rollSeq
  useEffect(() => {
    if (!settling) return
    const t = setTimeout(() => setSettledSeq(state.rollSeq), settleMs)
    return () => clearTimeout(t)
  }, [settling, state.rollSeq, settleMs])

  // ---------------------------------------------------------------- sound & haptics for game events
  const heard = useRef(state.event.seq)
  useEffect(() => {
    const e = state.event
    if (e.seq === heard.current) return
    heard.current = e.seq
    if (e.kind === 'bank') { sfx.bank(); buzz(30) }
    if (e.kind === 'hot') { sfx.hot(); buzz([20, 40, 20, 40, 60]) }
    if (e.kind === 'win') {
      sfx.win()
      buzz([60, 60, 120])
      track('game_over', { winner_is_bot: !!state.players[e.player].bot, players: state.players.length })
    }
  }, [state.event, state.players])

  useEffect(() => {
    if (state.rollSeq) sfx.roll(state.dice.filter(d => d.status !== 'held').length)
    // The roll sound belongs to the roll, nothing else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.rollSeq])

  const farkleShown = state.turnPhase === 'farkled' && !settling
  useEffect(() => {
    if (!farkleShown) return
    sfx.bray()
    buzz([80, 50, 160])
  }, [farkleShown])

  // ---------------------------------------------------------------- the bot plays its turns
  const bot = state.phase === 'playing' ? state.players[state.current]?.bot : null
  useEffect(() => {
    if (!bot || settling || state.handoff || menuOpen) return
    let t: ReturnType<typeof setTimeout>
    if (state.turnPhase === 'ready') {
      t = setTimeout(() => dispatch({ type: 'ROLL', values: rollDice(6) }), 900)
    } else if (state.turnPhase === 'farkled') {
      t = setTimeout(() => dispatch({ type: 'END_TURN' }), 1700)
    } else {
      const move = decide(state, bot)
      const picked = state.dice.filter(d => d.status === 'selected').map(d => d.id).sort().join()
      const ready = picked === [...move.keepIds].sort().join()
      t = setTimeout(
        () => dispatch(!ready ? { type: 'SELECT', ids: move.keepIds } : move.action === 'bank' ? { type: 'BANK' } : { type: 'ROLL', values: rollDice(6) }),
        ready ? 750 : 1000,
      )
    }
    return () => clearTimeout(t)
  }, [state, bot, settling, menuOpen])

  // ---------------------------------------------------------------- actions
  const roll = () => {
    sfx.unlock()
    buzz(15)
    dispatch({ type: 'ROLL', values: rollDice(6) })
  }

  const toggleMute = () => {
    sfx.unlock()
    writeStored(KEYS.muted, muted ? null : '1')
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      {state.phase === 'setup' && (
        <Setup
          onRules={() => setRulesOpen(true)}
          onStart={table => {
            sfx.unlock()
            writeStored(KEYS.table, JSON.stringify(table))
            dispatch({ type: 'START', seats: table.seats, settings: table.settings })
            track('game_start', { players: table.seats.length, bots: table.seats.filter(s => s.bot).length, target: table.settings.target })
          }}
        />
      )}

      {state.phase === 'playing' && (
        <>
          <Board
            state={state}
            dispatch={dispatch}
            settling={settling}
            rollMs={rollMs}
            muted={muted}
            onToggleMute={toggleMute}
            onRules={() => setRulesOpen(true)}
            onMenu={() => setMenuOpen(true)}
            onRoll={roll}
          />
          {state.handoff && <Handoff state={state} onReady={() => { sfx.unlock(); dispatch({ type: 'ACK_HANDOFF' }) }} />}
        </>
      )}

      {state.phase === 'over' && (
        <GameOver state={state} onRematch={() => dispatch({ type: 'REMATCH' })} onNewTable={() => dispatch({ type: 'RESET' })} />
      )}

      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} settings={state.settings} />

      <Sheet open={menuOpen} onClose={closeMenu} title="Table">
        <div className="space-y-2">
          <MenuItem onClick={() => { closeMenu(); dispatch({ type: 'REMATCH' }) }} title="Restart" sub="Same players, scores back to zero" />
          <MenuItem onClick={() => { closeMenu(); dispatch({ type: 'RESET' }) }} title="New table" sub="Change players and house rules" />
          <MenuItem onClick={() => { closeMenu(); setRulesOpen(true) }} title="How to play" sub="Scoring and rules" />
        </div>
        <p className="mt-4 text-center text-[12px] text-muted">
          A <a href="https://prosperdonkey.com" className="underline decoration-sand/30 underline-offset-2 hover:text-cream">Prosper Donkey</a> joint
        </p>
      </Sheet>
    </>
  )
}

function MenuItem({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-2xl bg-walnut-2 px-4 py-3.5 text-left transition-colors hover:bg-walnut-3">
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-[13px] text-muted">{sub}</span>
      </span>
      <span className="text-sand">→</span>
    </button>
  )
}
