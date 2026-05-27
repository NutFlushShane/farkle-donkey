export function rollDice(count: number): number[] {
  return Array.from({ length: count }, () => Math.ceil(Math.random() * 6))
}

export function calculateScore(dice: number[]): number {
  if (!dice.length) return 0

  const counts = Array(7).fill(0)
  dice.forEach(d => counts[d]++)

  // Straight: one of each 1–6
  if (dice.length === 6 && counts.slice(1).every(c => c === 1)) return 1500

  // Three pairs
  if (dice.length === 6 && counts.slice(1).filter(c => c === 2).length === 3) return 750

  let score = 0
  const rem = [...counts]

  for (let v = 1; v <= 6; v++) {
    if (rem[v] >= 3) {
      score += (v === 1 ? 1000 : v * 100) * 2 ** (rem[v] - 3)
      rem[v] = 0
    }
  }

  score += rem[1] * 100
  score += rem[5] * 50

  return score
}

// A selection is valid if every die contributes to a scoring combination.
// Rules: N≥3-of-a-kind uses all N dice; individual 1s and 5s each score on their own;
// straights and three-pairs use all 6 dice.
export function isValidSelection(selected: number[]): boolean {
  if (!selected.length) return false
  if (calculateScore(selected) === 0) return false

  const counts = Array(7).fill(0)
  selected.forEach(d => counts[d]++)

  // Straight or three pairs: all 6 dice must be present
  if (selected.length === 6) {
    if (counts.slice(1).every(c => c === 1)) return true
    if (counts.slice(1).filter(c => c === 2).length === 3) return true
  }

  // Every value group must be either N≥3-of-a-kind or individual 1/5
  for (let v = 1; v <= 6; v++) {
    if (!counts[v]) continue
    if (counts[v] >= 3) continue       // valid N-of-a-kind
    if (v === 1 || v === 5) continue   // individual 1s and 5s always score
    return false                        // 1 or 2 of a non-scoring face
  }

  return true
}
