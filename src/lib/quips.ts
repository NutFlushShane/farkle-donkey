// What the donkey says. Picked deterministically from a seed so re-renders don't reshuffle.

const LINES = {
  ready: ['Your roll, {name}.', 'Feeling lucky, {name}?', 'Steady hooves, {name}.', 'Shake ’em up, {name}.', 'Slow and steady prospers.'],
  readyBot: ['My turn. Watch and learn.', 'Hold my carrot.', 'Stand back, this one’s mine.'],
  rolling: ['Come on, come on…', 'Here they come…', 'Rattle rattle…', 'No farkles, no farkles…'],
  pick: ['Pick your keepers.', 'Tap the dice worth keeping.', 'Choose wisely…'],
  thinking: ['Hmm, let me chew on this…', 'Crunching the numbers…', 'Ears up. Thinking…'],
  risky: ['The carrot or the stick?', 'Bank it. Probably.', 'Greedy hooves get burned…', 'That’s a lot to lose…'],
  straight: ['A straight! Smooth as a meadow.', 'One through six. Beautiful.'],
  pairs: ['Three pairs. Pair-fect.', 'Pairs on pairs on pairs!'],
  bigKind: ['Now we’re trotting!', 'Stack ’em high!', 'Whoa, look at that pile!'],
  hot: ['Hot dice! Hee-haw!', 'All six scored. Roll ’em all!', 'Smokin’ hooves!'],
  farkle: ['Farkle! Hay happens.', 'Nothing. Not even a carrot.', 'Oof. Back to the barn.', 'Well, that was a bust.'],
  farkleBot: ['Hee-haw… I meant to do that.', 'Nobody saw that, right?'],
  bank: ['Banked. Stubborn pays off.', 'Safe in the stable.', 'Money in the saddlebag!', 'Smart donkey.'],
  open: ['Need {min} to get on the board.'],
  final: ['Final round! Beat {score} or bust.', 'Last chance: {score} to beat!'],
} satisfies Record<string, string[]>

export type QuipKind = keyof typeof LINES

export function quip(kind: QuipKind, seed: number, vars: Record<string, string | number> = {}): string {
  const list = LINES[kind]
  const line = list[Math.abs(seed) % list.length]
  return line.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}
