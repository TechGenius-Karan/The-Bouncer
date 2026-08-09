import { useState } from 'react'
import { HomeScreen } from './components/HomeScreen'
import { HowToPlayModal } from './components/HowToPlayModal'
import { PlayScreen } from './components/PlayScreen'
import { RevealScreen } from './components/RevealScreen'
import { StatsModal } from './components/StatsModal'
import type { RoundResult } from './game/types'

type Screen = 'home' | 'play' | 'reveal'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [showHowTo, setShowHowTo] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [result, setResult] = useState<RoundResult | null>(null)

  return (
    <div className="min-h-screen bg-canvas py-0 sm:py-10">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col overflow-hidden bg-screen sm:min-h-[820px] sm:rounded-screen sm:shadow-screen">
        {screen === 'home' && (
          <HomeScreen
            onPlay={() => setScreen('play')}
            onHowToPlay={() => setShowHowTo(true)}
            onShowStats={() => setShowStats(true)}
          />
        )}

        {screen === 'play' && (
          <PlayScreen
            onDone={(r) => {
              setResult(r)
              setScreen('reveal')
            }}
          />
        )}

        {screen === 'reveal' && result && (
          <RevealScreen
            result={result}
            onHome={() => {
              setResult(null)
              setScreen('home')
            }}
          />
        )}
      </div>

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
    </div>
  )
}
