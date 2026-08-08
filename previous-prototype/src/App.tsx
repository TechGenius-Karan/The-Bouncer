import { useState } from 'react'
import { GameController } from './game/GameController'
import { HARDCODED_PUZZLES } from './content/puzzles'

export default function App() {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const puzzle = HARDCODED_PUZZLES[puzzleIndex]
  const hasNext = puzzleIndex < HARDCODED_PUZZLES.length - 1

  function handleNextPuzzle() {
    setPuzzleIndex((i) => i + 1)
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div />
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">The Bouncer</h1>
        <div className="text-xs text-slate-400 font-medium">
          #{puzzleIndex + 1}
        </div>
      </header>

      {/* Game area — constrained width for comfortable play */}
      <main className="flex-1 flex flex-col max-w-sm mx-auto w-full px-4 py-5">
        <GameController
          key={puzzle.id}
          puzzle={puzzle}
          onNextPuzzle={hasNext ? handleNextPuzzle : undefined}
        />
      </main>
    </div>
  )
}
