// The Donkey: a computer opponent.
//
// Stubborn/Normal play from a value table that maximises expected points per turn.
// Every score is a multiple of 50, so V(turnTotal, diceLeft) is solved exactly by
// dynamic programming over every roll outcome. Easy just grabs points and banks early.

import { countFaces, legalKeeps } from './farkle'
import { liveDice, mustOpen, scoreToBeat, type BotLevel, type GameState } from './game'

const STEP = 50
const CAP = 12_000 // above this, banking is assumed to be right

interface Outcome {
  p: number
  keeps: { score: number; left: number }[] // left = dice to throw next (6 after hot dice)
}

// Distinct rolls of n dice (as multisets) with their probabilities.
function outcomes(n: number): Outcome[] {
  const byKey = new Map<string, { dice: number[]; hits: number }>()
  for (let k = 0; k < 6 ** n; k++) {
    const dice: number[] = []
    for (let i = 0, x = k; i < n; i++, x = Math.floor(x / 6)) dice.push((x % 6) + 1)
    const key = countFaces(dice).join('')
    const hit = byKey.get(key)
    if (hit) hit.hits++
    else byKey.set(key, { dice, hits: 1 })
  }
  return [...byKey.values()].map(({ dice, hits }) => ({
    p: hits / 6 ** n,
    keeps: legalKeeps(dice).map(k => ({ score: k.score, left: n - k.idx.length || 6 })),
  }))
}

interface Table {
  value: (total: number, dice: number) => number // best achievable from here (bank or keep rolling)
  rollValue: (total: number, dice: number) => number // expected result of rolling now
}

const tables = new Map<number, Table>()

// openingMin > 0 builds the table for a player who isn't on the board yet.
function table(openingMin: number): Table {
  const cached = tables.get(openingMin)
  if (cached) return cached

  const rolls = [[], ...[1, 2, 3, 4, 5, 6].map(outcomes)]
  const size = CAP / STEP
  const V = rolls.map(() => new Float64Array(size))
  const R = rolls.map(() => new Float64Array(size))
  const value = (t: number, n: number) => (t >= CAP ? t : V[n][t / STEP])

  for (let i = size - 1; i >= 0; i--) {
    const t = i * STEP
    for (let n = 1; n <= 6; n++) {
      let ev = 0
      for (const o of rolls[n]) {
        let best = 0
        for (const k of o.keeps) best = Math.max(best, value(t + k.score, k.left))
        ev += o.p * best
      }
      R[n][i] = ev
      V[n][i] = t > 0 && t >= openingMin ? Math.max(t, ev) : ev
    }
  }

  const built: Table = { value, rollValue: (t, n) => (t >= CAP ? t : R[n][t / STEP]) }
  tables.set(openingMin, built)
  return built
}

export interface BotMove {
  keepIds: number[]
  action: 'roll' | 'bank'
}

// How far each level trusts the maths before banking (1 = perfectly neutral).
const NERVE: Record<BotLevel, number> = { easy: 0.7, normal: 0.75, stubborn: 1 }

export function decide(s: GameState, level: BotLevel): BotMove {
  const me = s.players[s.current]
  const live = liveDice(s)
  const rolled = live.map(d => d.value)
  const options = legalKeeps(rolled).map(k => {
    const total = s.turnScore + k.score
    const left = rolled.length - k.idx.length || 6
    return { keepIds: k.idx.map(i => live[i].id), total, left }
  })

  const opening = me.score === 0 ? s.settings.openingMin : 0
  const tbl = table(opening)
  const toBeat = scoreToBeat(s)

  const pick =
    level === 'easy'
      ? options.reduce((a, b) => (b.total > a.total || (b.total === a.total && b.left > a.left) ? b : a))
      : options.reduce((a, b) => (tbl.value(b.total, b.left) > tbl.value(a.total, a.left) ? b : a))

  const blocked = mustOpen(s, pick.total)
  const winsOrTriggers = me.score + pick.total >= s.settings.target
  const beats = toBeat !== null && me.score + pick.total > toBeat

  let bank: boolean
  if (blocked) bank = false
  else if (toBeat !== null) bank = beats // final round: banking short is pointless, past the line is enough
  else if (winsOrTriggers) bank = true
  else if (level === 'easy') bank = pick.total >= [0, 200, 250, 300, 350, 500, Infinity][pick.left]
  else bank = pick.total >= NERVE[level] * tbl.rollValue(pick.total, pick.left)

  return { keepIds: pick.keepIds, action: bank ? 'bank' : 'roll' }
}

