// Game state machine. Pure: dice values come in on the action, never from Math.random here.

import { calculateScore, countFaces, isSixDiceCombo, isValidSelection, scorableMask } from './farkle'

export type BotLevel = 'easy' | 'normal' | 'stubborn'
export type DieStatus = 'active' | 'selected' | 'held'
export type TurnPhase = 'ready' | 'selecting' | 'farkled'

export interface Die {
  id: number
  value: number
  status: DieStatus
  batch: number // which keep this turn the die was held in (-1 if not held)
}

export interface PlayerStats {
  bestTurn: number
  farkles: number
  hotDice: number
}

export interface Player {
  name: string
  bot: BotLevel | null
  score: number
  stats: PlayerStats
}

export interface Settings {
  target: number
  openingMin: number // 0 = off
}

export interface GameEvent {
  seq: number
  kind: 'start' | 'hot' | 'farkle' | 'bank' | 'win'
  player: number
  points: number
}

export interface GameState {
  phase: 'setup' | 'playing' | 'over'
  settings: Settings
  players: Player[]
  current: number
  dice: Die[]
  turnScore: number // banked-able points from dice already held this turn
  turnPhase: TurnPhase
  batch: number
  hotCount: number
  rollSeq: number
  finalRound: number | null // index of the player who crossed the target
  winner: number | null
  handoff: boolean // waiting for the next human to take the phone
  event: GameEvent
}

export interface SeatConfig {
  name: string
  bot: BotLevel | null
}

export type Action =
  | { type: 'START'; seats: SeatConfig[]; settings: Settings }
  | { type: 'REMATCH' }
  | { type: 'ROLL'; values: number[] }
  | { type: 'TOGGLE'; id: number }
  | { type: 'SELECT'; ids: number[] }
  | { type: 'BANK' }
  | { type: 'END_TURN' }
  | { type: 'ACK_HANDOFF' }
  | { type: 'RESET' }
  | { type: 'LOAD'; state: GameState }

export const DEFAULT_SETTINGS: Settings = { target: 10_000, openingMin: 0 }

const freshDice = (): Die[] =>
  Array.from({ length: 6 }, (_, id) => ({ id, value: id + 1, status: 'active', batch: -1 }))

export const initialState: GameState = {
  phase: 'setup',
  settings: DEFAULT_SETTINGS,
  players: [],
  current: 0,
  dice: freshDice(),
  turnScore: 0,
  turnPhase: 'ready',
  batch: 0,
  hotCount: 0,
  rollSeq: 0,
  finalRound: null,
  winner: null,
  handoff: false,
  event: { seq: 0, kind: 'start', player: 0, points: 0 },
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const liveDice = (s: GameState) => s.dice.filter(d => d.status !== 'held')
export const heldDice = (s: GameState) => s.dice.filter(d => d.status === 'held')

export function selection(s: GameState) {
  const vals = s.dice.filter(d => d.status === 'selected').map(d => d.value)
  const valid = isValidSelection(vals)
  return { vals, valid, score: valid ? calculateScore(vals) : 0 }
}

export const turnTotal = (s: GameState) => s.turnScore + selection(s).score

export function canBank(s: GameState): boolean {
  if (s.phase !== 'playing' || s.turnPhase !== 'selecting') return false
  const sel = selection(s)
  if (sel.vals.length && !sel.valid) return false
  const total = s.turnScore + sel.score
  if (total <= 0) return false
  return !mustOpen(s, total)
}

// True when the opening-minimum house rule blocks banking this total.
export function mustOpen(s: GameState, total: number): boolean {
  return s.players[s.current].score === 0 && total < s.settings.openingMin
}

export function canRoll(s: GameState): boolean {
  if (s.phase !== 'playing') return false
  return s.turnPhase === 'ready' || (s.turnPhase === 'selecting' && selection(s).valid)
}

// How many dice the next roll will throw.
export function diceToRoll(s: GameState): number {
  if (s.turnPhase === 'ready') return liveDice(s).length
  const left = s.dice.filter(d => d.status === 'active').length
  return left === 0 ? 6 : left
}

// In the final round: the score the current player has to beat.
export function scoreToBeat(s: GameState): number | null {
  if (s.finalRound === null) return null
  return Math.max(...s.players.filter((_, i) => i !== s.current).map(p => p.score))
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const humans = (players: Player[]) => players.filter(p => !p.bot).length

function emit(s: GameState, kind: GameEvent['kind'], points = 0): GameEvent {
  return { seq: s.event.seq + 1, kind, player: s.current, points }
}

function newGame(seats: SeatConfig[], settings: Settings, seq: number): GameState {
  return {
    ...initialState,
    phase: 'playing',
    settings,
    players: seats.map(seat => ({ ...seat, score: 0, stats: { bestTurn: 0, farkles: 0, hotDice: 0 } })),
    handoff: false,
    event: { seq: seq + 1, kind: 'start', player: 0, points: 0 },
  }
}

// Pass play to the next seat, or finish the game when the final round comes back around.
function advance(s: GameState, players: Player[], event: GameEvent): GameState {
  const next = (s.current + 1) % players.length
  if (s.finalRound !== null && next === s.finalRound) {
    const best = Math.max(...players.map(p => p.score))
    const winner = players[s.finalRound].score === best ? s.finalRound : players.findIndex(p => p.score === best)
    return { ...s, players, phase: 'over', winner, event: { ...event, seq: event.seq + 1, kind: 'win', player: winner } }
  }
  return {
    ...s,
    players,
    current: next,
    dice: freshDice(),
    turnScore: 0,
    turnPhase: 'ready',
    batch: 0,
    hotCount: 0,
    handoff: !players[next].bot && humans(players) > 1,
    event,
  }
}

export function reducer(s: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START':
      return newGame(action.seats, action.settings, s.event.seq)

    case 'REMATCH':
      return newGame(s.players.map(({ name, bot }) => ({ name, bot })), s.settings, s.event.seq)

    case 'ROLL': {
      if (!canRoll(s)) return s
      let dice: Die[] = s.dice
      let { turnScore, batch, hotCount } = s
      let hot = false

      if (s.turnPhase === 'selecting') {
        turnScore += selection(s).score
        dice = dice.map(d => (d.status === 'selected' ? { ...d, status: 'held', batch } : d))
        batch++
        if (dice.every(d => d.status === 'held')) {
          hot = true
          hotCount++
          dice = dice.map(d => ({ ...d, status: 'active', batch: -1 }))
        }
      }

      dice = dice.map(d => (d.status === 'held' ? d : { ...d, status: 'active', value: action.values[d.id] }))
      const rolled = dice.filter(d => d.status === 'active').map(d => d.value)
      const farkled = calculateScore(rolled) === 0

      const players = hot
        ? s.players.map((p, i) => (i === s.current ? { ...p, stats: { ...p.stats, hotDice: p.stats.hotDice + 1 } } : p))
        : s.players

      return {
        ...s,
        players,
        dice,
        turnScore,
        batch,
        hotCount,
        turnPhase: farkled ? 'farkled' : 'selecting',
        rollSeq: s.rollSeq + 1,
        handoff: false,
        event: farkled ? emit(s, 'farkle', turnScore) : hot ? emit(s, 'hot', turnScore) : s.event,
      }
    }

    case 'TOGGLE': {
      if (s.turnPhase !== 'selecting') return s
      const die = s.dice.find(d => d.id === action.id)
      if (!die || die.status === 'held') return s

      const live = liveDice(s)
      const vals = live.map(d => d.value)
      if (!scorableMask(vals)[live.indexOf(die)]) return s

      // Dice that can't score alone move as a group: the whole straight / three pairs, or the whole N-of-a-kind.
      // 1s and 5s grab their triple when picked up but can be put back one at a time.
      const scoresAlone = die.value === 1 || die.value === 5
      const counts = countFaces(vals)
      let ids = [die.id]
      if (isSixDiceCombo(vals) && !scoresAlone) ids = live.map(d => d.id)
      else if (counts[die.value] >= 3 && (!scoresAlone || die.status === 'active'))
        ids = live.filter(d => d.value === die.value).map(d => d.id)

      const to: DieStatus = die.status === 'selected' ? 'active' : 'selected'
      return { ...s, dice: s.dice.map(d => (ids.includes(d.id) ? { ...d, status: to } : d)) }
    }

    case 'SELECT': {
      if (s.turnPhase !== 'selecting') return s
      return {
        ...s,
        dice: s.dice.map(d =>
          d.status === 'held' ? d : { ...d, status: action.ids.includes(d.id) ? 'selected' : 'active' },
        ),
      }
    }

    case 'BANK': {
      if (!canBank(s)) return s
      const total = turnTotal(s)
      const players = s.players.map((p, i) =>
        i === s.current ? { ...p, score: p.score + total, stats: { ...p.stats, bestTurn: Math.max(p.stats.bestTurn, total) } } : p,
      )
      const finalRound = s.finalRound ?? (players[s.current].score >= s.settings.target ? s.current : null)
      return advance({ ...s, finalRound }, players, emit(s, 'bank', total))
    }

    case 'END_TURN': {
      if (s.turnPhase !== 'farkled') return s
      const players = s.players.map((p, i) =>
        i === s.current ? { ...p, stats: { ...p.stats, farkles: p.stats.farkles + 1 } } : p,
      )
      return advance(s, players, s.event)
    }

    case 'ACK_HANDOFF':
      return { ...s, handoff: false }

    case 'RESET':
      return { ...initialState, event: { ...initialState.event, seq: s.event.seq + 1 } }

    case 'LOAD':
      return action.state

    default:
      return s
  }
}
