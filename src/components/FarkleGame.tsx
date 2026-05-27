'use client'

import { useReducer, useState } from 'react'
import Image from 'next/image'
import { rollDice, calculateScore, isValidSelection } from '@/lib/farkle'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DieStatus = 'active' | 'selected' | 'held' | 'farkled'
type TurnPhase = 'rolling' | 'selecting' | 'farkled'
type GamePhase = 'setup' | 'playing' | 'over'

interface Die {
  id: number
  value: number
  status: DieStatus
}

interface Player {
  name: string
  score: number
}

interface GameState {
  phase: GamePhase
  players: Player[]
  currentPlayer: number
  dice: Die[]
  turnScore: number   // accumulated from previously held dice this turn
  turnPhase: TurnPhase
  hotDice: boolean
  winner: number | null
}

type Action =
  | { type: 'START_GAME'; players: string[] }
  | { type: 'ROLL' }
  | { type: 'TOGGLE_DIE'; id: number }
  | { type: 'ROLL_AGAIN' }
  | { type: 'BANK' }
  | { type: 'NEXT_TURN' }
  | { type: 'RESET' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WIN_SCORE = 10_000

function makeDice(): Die[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: i,
    value: 1,
    status: 'active' as DieStatus,
  }))
}

const initialState: GameState = {
  phase: 'setup',
  players: [],
  currentPlayer: 0,
  dice: makeDice(),
  turnScore: 0,
  turnPhase: 'rolling',
  hotDice: false,
  winner: null,
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {

    case 'START_GAME': {
      return {
        ...initialState,
        phase: 'playing',
        players: action.players.map(name => ({ name, score: 0 })),
      }
    }

    case 'ROLL': {
      if (state.turnPhase !== 'rolling') return state

      const values = rollDice(6)
      const newDice: Die[] = state.dice.map((die, i) => {
        if (die.status === 'held') return die
        return { ...die, value: values[i], status: 'active' }
      })

      const activeVals = newDice.filter(d => d.status === 'active').map(d => d.value)

      if (calculateScore(activeVals) === 0) {
        return {
          ...state,
          dice: newDice.map(d => d.status === 'active' ? { ...d, status: 'farkled' } : d),
          turnPhase: 'farkled',
          hotDice: false,
        }
      }

      return { ...state, dice: newDice, turnPhase: 'selecting', hotDice: false }
    }

    case 'TOGGLE_DIE': {
      if (state.turnPhase !== 'selecting') return state
      const die = state.dice.find(d => d.id === action.id)
      if (!die || (die.status !== 'active' && die.status !== 'selected')) return state
      const newStatus: DieStatus = die.status === 'selected' ? 'active' : 'selected'
      return {
        ...state,
        dice: state.dice.map(d => d.id === action.id ? { ...d, status: newStatus } : d),
      }
    }

    case 'ROLL_AGAIN': {
      const selected = state.dice.filter(d => d.status === 'selected').map(d => d.value)
      if (!isValidSelection(selected)) return state

      const addedScore = calculateScore(selected)
      const newTurnScore = state.turnScore + addedScore

      // Move selected → held
      let newDice = state.dice.map(d =>
        d.status === 'selected' ? { ...d, status: 'held' as DieStatus } : d
      )

      // Hot dice: all 6 are now held → reset them all to active for next roll
      const hotDice = newDice.every(d => d.status === 'held')
      if (hotDice) {
        newDice = newDice.map(d => ({ ...d, status: 'active' as DieStatus }))
      }

      return {
        ...state,
        dice: newDice,
        turnScore: newTurnScore,
        turnPhase: 'rolling',
        hotDice,
      }
    }

    case 'BANK': {
      const selected = state.dice.filter(d => d.status === 'selected').map(d => d.value)
      const selectedScore = selected.length ? calculateScore(selected) : 0

      // Need a valid selection OR accumulated turn score already exists
      if (selected.length > 0 && !isValidSelection(selected)) return state
      const total = state.turnScore + selectedScore
      if (total === 0) return state

      const newPlayers = state.players.map((p, i) =>
        i === state.currentPlayer ? { ...p, score: p.score + total } : p
      )

      if (newPlayers[state.currentPlayer].score >= WIN_SCORE) {
        return {
          ...state,
          players: newPlayers,
          phase: 'over',
          winner: state.currentPlayer,
          dice: state.dice.map(d =>
            d.status === 'selected' ? { ...d, status: 'held' } : d
          ),
        }
      }

      const next = (state.currentPlayer + 1) % state.players.length
      return {
        ...state,
        players: newPlayers,
        currentPlayer: next,
        dice: makeDice(),
        turnScore: 0,
        turnPhase: 'rolling',
        hotDice: false,
      }
    }

    case 'NEXT_TURN': {
      const next = (state.currentPlayer + 1) % state.players.length
      return {
        ...state,
        currentPlayer: next,
        dice: makeDice(),
        turnScore: 0,
        turnPhase: 'rolling',
        hotDice: false,
      }
    }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Die face dot grid
// ---------------------------------------------------------------------------

const T = true, F = false
const DOTS: Record<number, boolean[]> = {
  1: [F, F, F, F, T, F, F, F, F],
  2: [T, F, F, F, F, F, F, F, T],
  3: [T, F, F, F, T, F, F, F, T],
  4: [T, F, T, F, F, F, T, F, T],
  5: [T, F, T, F, T, F, T, F, T],
  6: [T, F, T, T, F, T, T, F, T],
}

// Returns why a selection is invalid, or "+N pts" if valid
function selectionMessage(selected: number[]): string {
  if (!selected.length) return 'Select dice to keep'
  const counts = Array(7).fill(0)
  selected.forEach(d => counts[d]++)
  for (let v = 2; v <= 6; v++) {
    if (v === 5) continue
    if (counts[v] > 0 && counts[v] < 3) {
      return `${v}s need three-of-a-kind to score`
    }
  }
  const score = calculateScore(selected)
  if (score === 0) return 'No scoring dice selected'
  return `+${score.toLocaleString()} pts`
}

interface DieProps {
  die: Die
  onClick?: () => void
  rolling?: boolean
  unrolled?: boolean
  hint?: { text: string; scorable: boolean }
}

function DieComponent({ die, onClick, rolling, unrolled, hint }: DieProps) {
  const dots = DOTS[die.value] ?? DOTS[1]

  const isClickable = die.status === 'active' || die.status === 'selected'

  const containerClass = [
    'relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl select-none transition-all duration-150',
    rolling ? 'animate-die-roll' : '',
    die.status === 'held'
      ? 'opacity-40 cursor-default ring-2 ring-white/30'
      : die.status === 'farkled'
        ? 'opacity-30 cursor-default'
        : die.status === 'selected'
          ? 'cursor-pointer ring-4 ring-[#F0C040] scale-105 shadow-[0_0_16px_rgba(240,192,64,0.7)]'
          : unrolled
            ? 'cursor-default opacity-70'
            : 'cursor-pointer hover:scale-105 hover:shadow-lg',
  ].join(' ')

  const bgClass =
    die.status === 'held'
      ? 'bg-[#1a2e4a]'
      : die.status === 'farkled'
        ? 'bg-red-950'
        : unrolled
          ? 'bg-[#2A4A6F]'
          : 'bg-white'

  const dotColor =
    die.status === 'held'
      ? 'bg-[#4A6FA5]'
      : die.status === 'farkled'
        ? 'bg-red-700'
        : 'bg-[#0D1B2A]'

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={isClickable && !unrolled ? onClick : undefined}
        disabled={!isClickable || !!unrolled}
        className={`${containerClass} ${bgClass} shadow-md flex items-center justify-center p-2`}
        aria-label={`Die showing ${die.value}${die.status === 'selected' ? ', selected' : ''}`}
      >
        <div className="grid grid-cols-3 grid-rows-3 gap-0.5 w-full h-full">
          {!unrolled && dots.map((hasDot, i) => (
            <div key={i} className="flex items-center justify-center">
              {hasDot && (
                <div className={`rounded-full ${dotColor}`} style={{ width: '40%', height: '40%' }} />
              )}
            </div>
          ))}
          {unrolled && (
            <div className="col-span-3 row-span-3 flex items-center justify-center">
              <div className="text-white/30 text-2xl font-black">?</div>
            </div>
          )}
        </div>
        {die.status === 'selected' && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#F0C040] rounded-full flex items-center justify-center text-[10px] font-black text-[#0D1B2A]">
            ✓
          </div>
        )}
      </button>
      {hint && (
        <span className={`text-[10px] font-bold leading-none ${hint.scorable ? 'text-[#F0C040]' : 'text-white/30'}`}>
          {hint.text}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Setup screen
// ---------------------------------------------------------------------------

function SetupScreen({ onStart }: { onStart: (names: string[]) => void }) {
  const [count, setCount] = useState(2)
  const [names, setNames] = useState(['', '', '', '', '', ''])

  const handleStart = () => {
    const filled = names.slice(0, count).map((n, i) => n.trim() || `Player ${i + 1}`)
    onStart(filled)
  }

  return (
    <div className="flex flex-col items-center gap-8 py-10 px-6 max-w-md mx-auto w-full">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-24 h-24 rounded-full bg-[#3D5E8C] shadow-xl ring-4 ring-white/20 overflow-hidden">
          <Image src="/donkey.jpg" alt="Prosper Donkey" fill className="object-cover" priority />
        </div>
        <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-lg">
          FARKLE
        </h1>
        <p className="text-[#B8C9E8] text-sm font-medium tracking-widest uppercase">Prosper Donkey Edition</p>
      </div>

      {/* Player count */}
      <div className="w-full bg-[#2A4A6F]/60 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-sm border border-white/10">
        <label className="text-[#B8C9E8] text-xs font-bold tracking-widest uppercase">Number of Players</label>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`flex-1 py-2 rounded-xl font-black text-lg transition-all ${
                count === n
                  ? 'bg-[#F0C040] text-[#0D1B2A] shadow-lg scale-105'
                  : 'bg-[#0D1B2A]/60 text-[#B8C9E8] hover:bg-[#0D1B2A]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Player names */}
      <div className="w-full bg-[#2A4A6F]/60 rounded-2xl p-5 flex flex-col gap-3 backdrop-blur-sm border border-white/10">
        <label className="text-[#B8C9E8] text-xs font-bold tracking-widest uppercase">Player Names</label>
        {Array.from({ length: count }, (_, i) => (
          <input
            key={i}
            type="text"
            value={names[i]}
            onChange={e => setNames(prev => prev.map((n, j) => j === i ? e.target.value : n))}
            placeholder={`Player ${i + 1}`}
            className="w-full bg-[#0D1B2A]/60 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-[#4A6FA5] font-medium focus:outline-none focus:ring-2 focus:ring-[#F0C040]/60"
          />
        ))}
      </div>

      <button
        onClick={handleStart}
        className="w-full py-4 bg-[#F0C040] hover:bg-[#F5D060] active:scale-95 text-[#0D1B2A] font-black text-xl rounded-2xl shadow-xl transition-all tracking-wide"
      >
        ROLL THE DICE 🎲
      </button>

      <div className="text-[#B8C9E8]/60 text-xs text-center">First to {WIN_SCORE.toLocaleString()} wins</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score panel
// ---------------------------------------------------------------------------

function ScorePanel({ players, currentPlayer, winner }: {
  players: Player[]
  currentPlayer: number
  winner: number | null
}) {
  return (
    <div className="flex flex-col gap-2 w-full sm:w-48">
      {players.map((p, i) => {
        const isActive = i === currentPlayer && winner === null
        const isWinner = i === winner
        return (
          <div
            key={i}
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl font-bold transition-all ${
              isWinner
                ? 'bg-[#F0C040] text-[#0D1B2A] ring-2 ring-white'
                : isActive
                  ? 'bg-[#2A4A6F] text-white ring-2 ring-[#F0C040]/60'
                  : 'bg-[#0D1B2A]/40 text-[#B8C9E8]'
            }`}
          >
            <span className="text-sm truncate max-w-[7rem]">
              {isActive && '▶ '}{isWinner && '🏆 '}{p.name}
            </span>
            <span className="text-sm tabular-nums ml-2">{p.score.toLocaleString()}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Game Over screen
// ---------------------------------------------------------------------------

function GameOverScreen({ players, winner, onReset }: {
  players: Player[]
  winner: number
  onReset: () => void
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  return (
    <div className="flex flex-col items-center gap-8 py-10 px-6 max-w-md mx-auto w-full">
      <div className="relative w-24 h-24 rounded-full bg-[#F0C040] shadow-xl ring-4 ring-white/20 overflow-hidden">
        <Image src="/donkey.jpg" alt="Prosper Donkey" fill className="object-cover" />
      </div>
      <div className="text-center">
        <div className="text-5xl mb-2">🏆</div>
        <h2 className="text-3xl font-black text-white">{players[winner].name} wins!</h2>
        <p className="text-[#B8C9E8] mt-1">{players[winner].score.toLocaleString()} points</p>
      </div>

      <div className="w-full bg-[#2A4A6F]/60 rounded-2xl p-5 flex flex-col gap-2 border border-white/10">
        {sorted.map((p, i) => (
          <div key={p.name} className="flex justify-between text-sm font-semibold">
            <span className="text-[#B8C9E8]">{i + 1}. {p.name}</span>
            <span className="text-white tabular-nums">{p.score.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onReset}
        className="w-full py-4 bg-[#F0C040] hover:bg-[#F5D060] active:scale-95 text-[#0D1B2A] font-black text-xl rounded-2xl shadow-xl transition-all"
      >
        PLAY AGAIN
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main game board
// ---------------------------------------------------------------------------

function GameBoard({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const [rolling, setRolling] = useState(false)

  const { dice, turnPhase, turnScore, currentPlayer, players, hotDice } = state
  const player = players[currentPlayer]

  const selectedVals = dice.filter(d => d.status === 'selected').map(d => d.value)
  const selectedScore = calculateScore(selectedVals)
  const selectionValid = isValidSelection(selectedVals)
  const totalIfBanked = turnScore + selectedScore
  const canBank = totalIfBanked > 0 && (selectedVals.length === 0 || selectionValid)
  const canRollAgain = selectionValid

  // Per-die hints shown in selecting phase on active (unselected) dice
  const activeCounts = Array(7).fill(0)
  dice.filter(d => d.status === 'active').forEach(d => activeCounts[d.value]++)
  function getDieHint(value: number): { text: string; scorable: boolean } {
    if (value === 1) return { text: '100', scorable: true }
    if (value === 5) return { text: '50', scorable: true }
    if (activeCounts[value] >= 3) return { text: `${value}×3 ok`, scorable: true }
    return { text: 'need 3+', scorable: false }
  }

  const handleRoll = () => {
    if (rolling) return
    setRolling(true)
    dispatch({ type: 'ROLL' })
    setTimeout(() => setRolling(false), 450)
  }

  // Status message
  let message = ''
  if (hotDice) message = '🔥 HOT DICE! Roll again!'
  else if (turnPhase === 'rolling') message = turnScore > 0 ? `Keep rolling or bank ${turnScore.toLocaleString()} pts` : 'Roll the dice!'
  else if (turnPhase === 'selecting') message = selectionMessage(selectedVals)
  else if (turnPhase === 'farkled') message = '💀 FARKLE! No scoring dice.'

  return (
    <div className="flex flex-col gap-6 items-center w-full max-w-lg px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#F0C040]/60 bg-[#3D5E8C]">
            <Image src="/donkey.jpg" alt="" fill className="object-cover" />
          </div>
          <div>
            <div className="text-white font-black text-lg leading-tight">{player.name}</div>
            <div className="text-[#B8C9E8] text-xs">Total: {player.score.toLocaleString()}</div>
          </div>
        </div>
        <ScorePanel players={players} currentPlayer={currentPlayer} winner={null} />
      </div>

      {/* Turn score bar */}
      <div className="w-full bg-[#0D1B2A]/60 rounded-2xl px-5 py-3 flex items-center justify-between border border-white/10">
        <div className="text-[#B8C9E8] text-xs font-bold uppercase tracking-widest">Turn</div>
        <div className={`text-2xl font-black tabular-nums transition-colors ${hotDice ? 'text-[#F0C040]' : 'text-white'}`}>
          {totalIfBanked > 0 ? totalIfBanked.toLocaleString() : '—'}
        </div>
        {hotDice && <div className="text-[#F0C040] text-xs font-bold animate-pulse">HOT 🔥</div>}
      </div>

      {/* Status message */}
      <div className={`text-sm font-semibold text-center transition-colors ${
        turnPhase === 'farkled' ? 'text-red-400'
        : hotDice ? 'text-[#F0C040]'
        : (turnPhase === 'selecting' && selectedVals.length > 0 && !selectionValid) ? 'text-amber-400'
        : 'text-[#B8C9E8]'
      }`}>
        {message}
      </div>

      {/* Dice grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {dice.map(die => (
          <DieComponent
            key={die.id}
            die={die}
            rolling={rolling && die.status !== 'held'}
            unrolled={die.status === 'active' && turnPhase === 'rolling'}
            hint={die.status === 'active' && turnPhase === 'selecting' ? getDieHint(die.value) : undefined}
            onClick={() => dispatch({ type: 'TOGGLE_DIE', id: die.id })}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 w-full">
        {turnPhase === 'rolling' && (
          <button
            onClick={handleRoll}
            disabled={rolling}
            className="flex-1 py-4 bg-[#F0C040] hover:bg-[#F5D060] active:scale-95 disabled:opacity-60 text-[#0D1B2A] font-black text-lg rounded-2xl shadow-xl transition-all"
          >
            {rolling ? 'Rolling…' : hotDice ? '🔥 ROLL ALL 6' : 'ROLL'}
          </button>
        )}

        {turnPhase === 'selecting' && (
          <>
            <button
              onClick={() => dispatch({ type: 'ROLL_AGAIN' })}
              disabled={!canRollAgain}
              className="flex-1 py-4 bg-[#2A4A6F] hover:bg-[#3A5A8F] active:scale-95 disabled:opacity-40 text-white font-black text-base rounded-2xl shadow-lg transition-all border border-white/20"
            >
              ROLL AGAIN
            </button>
            <button
              onClick={() => dispatch({ type: 'BANK' })}
              disabled={!canBank}
              className="flex-1 py-4 bg-[#F0C040] hover:bg-[#F5D060] active:scale-95 disabled:opacity-40 text-[#0D1B2A] font-black text-base rounded-2xl shadow-xl transition-all"
            >
              BANK {totalIfBanked > 0 ? totalIfBanked.toLocaleString() : ''}
            </button>
          </>
        )}

        {turnPhase === 'farkled' && (
          <button
            onClick={() => dispatch({ type: 'NEXT_TURN' })}
            className="flex-1 py-4 bg-red-800/80 hover:bg-red-700 active:scale-95 text-white font-black text-lg rounded-2xl shadow-xl transition-all border border-red-500/30"
          >
            NEXT PLAYER →
          </button>
        )}
      </div>

      {/* Quick rules reminder */}
      <details className="w-full text-xs text-[#B8C9E8]/60 text-center cursor-pointer">
        <summary className="hover:text-[#B8C9E8] transition-colors">Scoring rules ▾</summary>
        <div className="mt-2 text-left bg-[#0D1B2A]/60 rounded-xl p-3 space-y-0.5 border border-white/10">
          <div>1 = 100 pts &nbsp;·&nbsp; 5 = 50 pts</div>
          <div>Three 1s = 1,000 pts</div>
          <div>Three of a kind = face × 100 pts</div>
          <div>Four/Five/Six of a kind doubles each time</div>
          <div>Straight (1–6) = 1,500 pts</div>
          <div>Three pairs = 750 pts</div>
          <div>🔥 Score all dice? Hot dice — roll all 6!</div>
        </div>
      </details>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function FarkleGame() {
  const [state, dispatch] = useReducer(reducer, initialState)

  return (
    <div className="min-h-screen bg-[#4A6FA5] flex flex-col items-center justify-start pb-10"
      style={{ backgroundImage: 'radial-gradient(ellipse at top, #5A7FC0 0%, #3A5A8C 40%, #1E3A60 100%)' }}>

      {/* Top bar */}
      <div className="w-full max-w-lg px-4 pt-4 flex items-center justify-between">
        <span className="text-white/60 text-xs font-bold tracking-widest uppercase">Prosper Donkey</span>
        {state.phase !== 'setup' && (
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            className="text-white/40 hover:text-white text-xs transition-colors"
          >
            ✕ New Game
          </button>
        )}
      </div>

      {state.phase === 'setup' && (
        <SetupScreen onStart={names => dispatch({ type: 'START_GAME', players: names })} />
      )}

      {state.phase === 'playing' && (
        <GameBoard state={state} dispatch={dispatch} />
      )}

      {state.phase === 'over' && state.winner !== null && (
        <GameOverScreen
          players={state.players}
          winner={state.winner}
          onReset={() => dispatch({ type: 'RESET' })}
        />
      )}
    </div>
  )
}
