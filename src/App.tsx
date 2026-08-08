import { useState } from 'react'
import { PUZZLES } from './data/puzzles'
import { HomeScreen } from './components/HomeScreen'
import { HowToPlayModal } from './components/HowToPlayModal'
import { PlayScreen, type RoundResult } from './components/PlayScreen'
import { RevealScreen } from './components/RevealScreen'

type Screen = 'home' | 'play' | 'reveal'

export default function App() {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [screen, setScreen] = useState<Screen>('home')
  const [showHowTo, setShowHowTo] = useState(false)
  const [result, setResult] = useState<RoundResult | null>(null)

  const puzzle = PUZZLES[puzzleIndex]

  return (
    <div className="min-h-screen bg-canvas py-0 sm:py-10">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col overflow-hidden bg-screen sm:min-h-[820px] sm:rounded-screen sm:shadow-screen">
        {screen === 'home' && (
          <HomeScreen
            puzzle={puzzle}
            onPlay={() => setScreen('play')}
            onHowToPlay={() => setShowHowTo(true)}
          />
        )}

        {screen === 'play' && (
          <PlayScreen
            key={puzzle.id}
            puzzle={puzzle}
            onDone={(r) => {
              setResult(r)
              setScreen('reveal')
            }}
          />
        )}

        {screen === 'reveal' && result && (
          <RevealScreen
            puzzle={puzzle}
            result={result}
            onPlayAgain={() => {
              setPuzzleIndex((i) => (i + 1) % PUZZLES.length)
              setResult(null)
              setScreen('play')
            }}
            onHome={() => {
              setResult(null)
              setScreen('home')
            }}
          />
        )}
      </div>

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}
    </div>
  )
}
