// Pure scoring rules. No React, no randomness except rollDice.

export function rollDice(count: number): number[] {
  return Array.from({ length: count }, () => Math.ceil(Math.random() * 6) || 1)
}

export function countFaces(dice: number[]): number[] {
  const counts = Array(7).fill(0)
  dice.forEach(d => counts[d]++)
  return counts
}

const isStraight = (dice: number[], c: number[]) => dice.length === 6 && c.slice(1).every(n => n === 1)
const isThreePairs = (dice: number[], c: number[]) => dice.length === 6 && c.slice(1).filter(n => n === 2).length === 3

const KIND = ['', '', '', 'Three', 'Four', 'Five', 'Six']

export interface Combo {
  label: string
  points: number
  values: number[]
}

// Splits a set of kept dice into the combos it scores, plus any dice that score nothing.
export function scoreBreakdown(dice: number[]): { combos: Combo[]; dead: number[] } {
  const c = countFaces(dice)
  if (isStraight(dice, c)) return { combos: [{ label: 'Straight', points: 1500, values: [1, 2, 3, 4, 5, 6] }], dead: [] }
  if (isThreePairs(dice, c)) return { combos: [{ label: 'Three pairs', points: 750, values: [...dice].sort() }], dead: [] }

  const combos: Combo[] = []
  const dead: number[] = []
  for (let v = 1; v <= 6; v++) {
    const n = c[v]
    if (!n) continue
    if (n >= 3) {
      combos.push({ label: `${KIND[n]} ${v}s`, points: (v === 1 ? 1000 : v * 100) * 2 ** (n - 3), values: Array(n).fill(v) })
    } else if (v === 1 || v === 5) {
      combos.push({ label: n === 1 ? `Single ${v}` : `Two ${v}s`, points: n * (v === 1 ? 100 : 50), values: Array(n).fill(v) })
    } else {
      dead.push(...Array(n).fill(v))
    }
  }
  return { combos, dead }
}

export function calculateScore(dice: number[]): number {
  return scoreBreakdown(dice).combos.reduce((sum, c) => sum + c.points, 0)
}

// A selection is valid if it scores and every die contributes to a scoring combination.
export function isValidSelection(selected: number[]): boolean {
  if (!selected.length) return false
  const { combos, dead } = scoreBreakdown(selected)
  return combos.length > 0 && dead.length === 0
}

// For a fresh roll: which dice could be part of some scoring keep.
export function scorableMask(rolled: number[]): boolean[] {
  const c = countFaces(rolled)
  if (isStraight(rolled, c) || isThreePairs(rolled, c)) return rolled.map(() => true)
  return rolled.map(v => v === 1 || v === 5 || c[v] >= 3)
}

// Whether the roll is one of the six-dice specials (selected as a single group).
export function isSixDiceCombo(rolled: number[]): boolean {
  const c = countFaces(rolled)
  return isStraight(rolled, c) || isThreePairs(rolled, c)
}

export interface Keep {
  idx: number[]   // indexes into the rolled array
  score: number
}

// Every distinct legal keep for a roll (deduplicated by the multiset of values kept).
export function legalKeeps(rolled: number[]): Keep[] {
  const seen = new Set<string>()
  const keeps: Keep[] = []
  for (let mask = 1; mask < 1 << rolled.length; mask++) {
    const idx = rolled.map((_, i) => i).filter(i => mask & (1 << i))
    const vals = idx.map(i => rolled[i])
    const key = [...vals].sort().join('')
    if (seen.has(key)) continue
    seen.add(key)
    if (isValidSelection(vals)) keeps.push({ idx, score: calculateScore(vals) })
  }
  return keeps
}
