import { useEffect, useRef, useState } from 'react'
import './App.css'
import { startRestTone, stopRestTone } from './sound'

type Phase = 'idle' | 'work' | 'rest'

type RestStatus = 'acknowledged' | 'break'

interface TaskItem {
  id: string
  text: string
  createdAt: Date
  completed: boolean
}

export const WORK_SECONDS = 20 * 60
export const REST_SECONDS = 20
const BLOCK_MINUTES = 20
const BLOCKS_PER_DAY = (24 * 60) / BLOCK_MINUTES

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function blockIndex(d: Date): number {
  const midnight = startOfDay(d)
  const minutes = (d.getTime() - midnight.getTime()) / 60000
  return Math.floor(minutes / BLOCK_MINUTES)
}

function blockTimeLabel(i: number): string {
  const h = Math.floor((i * BLOCK_MINUTES) / 60)
  const m = (i * BLOCK_MINUTES) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatTime(s: number): string {
  const safe = Math.max(0, s)
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0')
  const ss = (safe % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function formatTime12(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatSince(createdAt: Date, now: Date): string {
  const diff = Math.max(0, now.getTime() - createdAt.getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function cycleStatus(current: RestStatus | undefined): RestStatus | undefined {
  if (!current) return 'acknowledged'
  if (current === 'acknowledged') return 'break'
  return undefined
}

function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [secondsLeft, setSecondsLeft] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [taskInput, setTaskInput] = useState<string>('')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState<string>('')
  const [dayBlocks, setDayBlocks] = useState<Record<number, RestStatus>>({})
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const secondsRef = useRef(secondsLeft)
  useEffect(() => {
    secondsRef.current = secondsLeft
  }, [secondsLeft])

  useEffect(() => {
    if (phase === 'idle' || isPaused) return
    const id = setInterval(() => {
      const current = secondsRef.current
      if (current > 1) {
        secondsRef.current = current - 1
        setSecondsLeft(current - 1)
        return
      }
      if (phase === 'work') {
        secondsRef.current = REST_SECONDS
        setSecondsLeft(REST_SECONDS)
        setPhase('rest')
        startRestTone()
      } else {
        // Rest complete — end silently and return to idle. User marks the cell
        // manually via the grid if they want to record the rest.
        stopRestTone()
        secondsRef.current = 0
        setSecondsLeft(0)
        setPhase('idle')
      }
    }, 1000)
    return () => clearInterval(id)
  }, [phase, isPaused])

  function handleStart() {
    setPhase('work')
    setSecondsLeft(WORK_SECONDS)
    setIsPaused(false)
  }

  function handlePauseToggle() {
    if (phase === 'idle') return
    setIsPaused((p) => !p)
  }

  function handleSkip() {
    if (phase === 'work') {
      secondsRef.current = REST_SECONDS
      setSecondsLeft(REST_SECONDS)
      setPhase('rest')
      setIsPaused(false)
      startRestTone()
    } else if (phase === 'rest') {
      stopRestTone()
      secondsRef.current = 0
      setSecondsLeft(0)
      setPhase('idle')
      setIsPaused(false)
    }
  }

  function handleCancel() {
    if (phase === 'idle') return
    stopRestTone()
    setPhase('idle')
    setSecondsLeft(0)
    setIsPaused(false)
  }

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    const text = taskInput.trim()
    if (!text) return
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random())
    setTasks((t) => [
      ...t,
      { id, text, createdAt: new Date(), completed: false },
    ])
    setTaskInput('')
  }

  function handleToggleComplete(id: string) {
    setTasks((t) =>
      t.map((x) => (x.id === id ? { ...x, completed: !x.completed } : x)),
    )
  }

  function handleStartEdit(id: string, currentText: string) {
    setEditingId(id)
    setEditText(currentText)
  }

  function handleSaveEdit(id: string) {
    const trimmed = editText.trim()
    if (!trimmed) {
      setEditingId(null)
      setEditText('')
      return
    }
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, text: trimmed } : x)))
    setEditingId(null)
    setEditText('')
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  function handleDeleteTask(id: string) {
    setTasks((t) => t.filter((x) => x.id !== id))
    if (editingId === id) handleCancelEdit()
  }

  function handleCycleBlock(i: number) {
    setDayBlocks((d) => {
      const next = { ...d }
      const updated = cycleStatus(d[i])
      if (updated) next[i] = updated
      else delete next[i]
      return next
    })
  }

  let phaseLabel: string
  if (phase === 'idle') {
    phaseLabel = 'Ready'
  } else if (phase === 'work') {
    phaseLabel = 'Working'
  } else {
    phaseLabel = 'Rest — look 20 ft away'
  }

  const displaySeconds = phase === 'idle' ? WORK_SECONDS : secondsLeft
  const currentBlock = blockIndex(now)

  return (
    <main className={`app phase-${phase}`}>
      <h1>20-20-20 Timer</h1>

      <div className="phase-label">{phaseLabel}</div>
      <div className="timer-display" aria-label="time remaining">
        {formatTime(displaySeconds)}
      </div>

      <div className="controls">
        {phase === 'idle' && (
          <button type="button" onClick={handleStart}>
            Start
          </button>
        )}
        {phase !== 'idle' && (
          <>
            <button type="button" onClick={handlePauseToggle}>
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" onClick={handleSkip}>
              Skip
            </button>
            <button type="button" onClick={handleCancel}>
              Cancel
            </button>
          </>
        )}
      </div>

      <form className="task-form" onSubmit={handleAddTask}>
        <label className="task-input-label">
          Task
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="What are you working on?"
          />
        </label>
        <button type="submit" disabled={taskInput.trim() === ''}>
          Add
        </button>
      </form>

      {tasks.length > 0 && (
        <ul className="task-list" aria-label="tasks">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={`task-item${task.completed ? ' task-completed' : ''}`}
            >
              <input
                type="checkbox"
                className="task-check"
                checked={task.completed}
                onChange={() => handleToggleComplete(task.id)}
                aria-label={`Mark "${task.text}" complete`}
              />
              <span className="task-since">
                {formatSince(task.createdAt, now)}
              </span>
              <span className="task-time">{formatTime12(task.createdAt)}</span>
              {editingId === task.id ? (
                <>
                  <input
                    type="text"
                    className="task-edit-input"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(task.id)
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(task.id)}
                  >
                    Save
                  </button>
                  <button type="button" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="task-text">{task.text}</span>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(task.id, task.text)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="history-section">
        <h2>Today's rests</h2>
        <ul className="history-board" aria-label="today's rests">
          {Array.from({ length: BLOCKS_PER_DAY }, (_, i) => {
            const status = dayBlocks[i]
            let cls = 'history-cell'
            let label: string
            if (status) {
              cls += ` status-${status}`
              label = `${blockTimeLabel(i)} — ${status}`
            } else if (i < currentBlock) {
              cls += ' status-missed'
              label = `${blockTimeLabel(i)} — missed`
            } else if (i === currentBlock) {
              cls += ' status-current'
              label = `${blockTimeLabel(i)} — current block`
            } else {
              cls += ' status-future'
              label = `${blockTimeLabel(i)} — upcoming`
            }
            return (
              <li key={i}>
                <button
                  type="button"
                  className={cls}
                  title={label}
                  aria-label={label}
                  onClick={() => handleCycleBlock(i)}
                />
              </li>
            )
          })}
        </ul>
        <div className="history-legend">
          <span className="legend-item">
            <span className="history-cell status-acknowledged" />
            Acknowledged
          </span>
          <span className="legend-item">
            <span className="history-cell status-break" />
            Break
          </span>
          <span className="legend-item">
            <span className="history-cell status-missed" />
            Missed
          </span>
          <span className="legend-item">
            <span className="history-cell status-current" />
            Now
          </span>
          <span className="legend-item">
            <span className="history-cell status-future" />
            Upcoming
          </span>
        </div>
      </section>
    </main>
  )
}

export default App
