import { useEffect, useRef, useState } from 'react'
import './App.css'
import { startRestTone, stopRestTone } from './sound'

type Phase = 'idle' | 'work' | 'rest'

interface HistoryEntry {
  task: string
  completedAt: Date
}

export const WORK_SECONDS = 20 * 60
export const REST_SECONDS = 20

function formatTime(s: number): string {
  const safe = Math.max(0, s)
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0')
  const ss = (safe % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString()
}

function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [secondsLeft, setSecondsLeft] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [taskInput, setTaskInput] = useState<string>('')
  const [committedTask, setCommittedTask] = useState<string>('')
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // Mirror the live countdown into a ref so the interval callback can read
  // the freshest value without depending on (and re-creating itself for) every
  // secondsLeft change.
  const secondsRef = useRef(secondsLeft)
  useEffect(() => {
    secondsRef.current = secondsLeft
  }, [secondsLeft])

  // Tick the countdown once per second while a phase is active and not paused.
  // Phase transitions happen inside the tick callback so the interval is the
  // single source of truth for time-driven state changes.
  useEffect(() => {
    if (phase === 'idle' || isPaused) return
    const id = setInterval(() => {
      const current = secondsRef.current
      if (current > 1) {
        secondsRef.current = current - 1
        setSecondsLeft(current - 1)
        return
      }
      // We're at the last second of this phase — perform the transition.
      if (phase === 'work') {
        secondsRef.current = REST_SECONDS
        setSecondsLeft(REST_SECONDS)
        setPhase('rest')
        startRestTone()
      } else {
        // phase === 'rest' — clamp at zero and wait for acknowledgment.
        secondsRef.current = 0
        setSecondsLeft(0)
        stopRestTone()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [phase, isPaused])

  const restExpired = phase === 'rest' && secondsLeft === 0

  function handleStart() {
    const trimmed = taskInput.trim()
    if (!trimmed) return
    setCommittedTask(trimmed)
    setPhase('work')
    setSecondsLeft(WORK_SECONDS)
    setIsPaused(false)
  }

  function handlePauseToggle() {
    if (phase === 'idle') return
    setIsPaused((p) => !p)
  }

  function handleRestart() {
    if (phase === 'idle') return
    if (phase === 'work') {
      setSecondsLeft(WORK_SECONDS)
    } else {
      // Restart during rest: reset to full 20s and ensure the tone is playing.
      // startRestTone is idempotent (no-op if already playing).
      setSecondsLeft(REST_SECONDS)
      startRestTone()
    }
    setIsPaused(false)
  }

  function handleSkip() {
    if (phase === 'work') {
      setSecondsLeft(REST_SECONDS)
      setPhase('rest')
      setIsPaused(false)
      startRestTone()
    } else if (phase === 'rest') {
      setSecondsLeft(0)
      stopRestTone()
    }
  }

  function handleAcknowledge() {
    stopRestTone()
    setHistory((h) => [...h, { task: committedTask, completedAt: new Date() }])
    setCommittedTask('')
    setTaskInput('')
    setPhase('idle')
    setSecondsLeft(0)
    setIsPaused(false)
  }

  let phaseLabel: string
  if (phase === 'idle') {
    phaseLabel = 'Ready'
  } else if (phase === 'work') {
    phaseLabel = `Working on: ${committedTask}`
  } else {
    phaseLabel = restExpired
      ? 'Rest complete — acknowledge to continue'
      : 'Rest — look 20 ft away'
  }

  const displaySeconds = phase === 'idle' ? WORK_SECONDS : secondsLeft

  return (
    <main className={`app phase-${phase}`}>
      <h1>20-20-20 Timer</h1>

      <label className="task-input-label">
        Task
        <input
          type="text"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          disabled={phase !== 'idle'}
          placeholder="What are you working on?"
        />
      </label>

      <div className="phase-label">{phaseLabel}</div>
      <div className="timer-display" aria-label="time remaining">
        {formatTime(displaySeconds)}
      </div>

      <div className="controls">
        {phase === 'idle' && (
          <button
            type="button"
            onClick={handleStart}
            disabled={taskInput.trim() === ''}
          >
            Start
          </button>
        )}
        {phase !== 'idle' && (
          <>
            <button type="button" onClick={handlePauseToggle}>
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" onClick={handleRestart}>
              Restart
            </button>
            {!restExpired && (
              <button type="button" onClick={handleSkip}>
                Skip
              </button>
            )}
          </>
        )}
        {restExpired && (
          <button type="button" onClick={handleAcknowledge}>
            Acknowledge
          </button>
        )}
      </div>

      <section className="history-section">
        <h2>Completed rests</h2>
        {history.length === 0 ? (
          <p className="history-empty">No rests acknowledged yet.</p>
        ) : (
          <ul className="history-grid">
            {history.map((entry, idx) => (
              <li key={idx} className="history-tile">
                <div className="history-task">{entry.task}</div>
                <div className="history-time">
                  {formatClock(entry.completedAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
