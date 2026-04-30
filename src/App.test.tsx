import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'

// Mock the sound module so tests don't touch the real Web Audio API
// and so we can assert when tones start/stop.
vi.mock('./sound', () => ({
  startRestTone: vi.fn(),
  stopRestTone: vi.fn(),
}))

import App, { WORK_SECONDS, REST_SECONDS } from './App'
import { startRestTone, stopRestTone } from './sound'

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(startRestTone).mockClear()
  vi.mocked(stopRestTone).mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function getTimerDisplay() {
  return screen.getByLabelText(/time remaining/i)
}

function getTaskInput() {
  return screen.getByLabelText(/task/i) as HTMLInputElement
}

function typeTask(value: string) {
  fireEvent.change(getTaskInput(), { target: { value } })
}

function clickButton(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('20-20-20 Timer', () => {
  it('renders the idle state', () => {
    render(<App />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(getTaskInput()).toBeInTheDocument()
    const startBtn = screen.getByRole('button', { name: /start/i })
    expect(startBtn).toBeDisabled()
    expect(getTimerDisplay()).toHaveTextContent('20:00')
  })

  it('does not start without a task', () => {
    render(<App />)
    const startBtn = screen.getByRole('button', { name: /start/i })
    expect(startBtn).toBeDisabled()
    // Clicking a disabled button still does nothing; verify state unchanged.
    fireEvent.click(startBtn)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /pause/i }),
    ).not.toBeInTheDocument()
  })

  it('starts the work countdown when a task is provided', async () => {
    render(<App />)
    typeTask('Write report')
    clickButton(/start/i)

    expect(screen.getByText('Working on: Write report')).toBeInTheDocument()
    expect(getTimerDisplay()).toHaveTextContent('20:00')

    await tick(1000)
    expect(getTimerDisplay()).toHaveTextContent('19:59')
  })

  it('pause halts the countdown and resume continues it', async () => {
    render(<App />)
    typeTask('Read book')
    clickButton(/start/i)

    await tick(3000)
    expect(getTimerDisplay()).toHaveTextContent('19:57')

    clickButton(/pause/i)
    await tick(5000)
    expect(getTimerDisplay()).toHaveTextContent('19:57')

    clickButton(/resume/i)
    await tick(2000)
    expect(getTimerDisplay()).toHaveTextContent('19:55')
  })

  it('restart resets the current phase to its full duration', async () => {
    render(<App />)
    typeTask('Code review')
    clickButton(/start/i)

    await tick(10_000)
    expect(getTimerDisplay()).toHaveTextContent('19:50')

    clickButton(/restart/i)
    expect(getTimerDisplay()).toHaveTextContent('20:00')
    expect(screen.getByText('Working on: Code review')).toBeInTheDocument()
  })

  it('transitions from work to rest and starts the tone', async () => {
    render(<App />)
    typeTask('Write tests')
    clickButton(/start/i)

    await tick(WORK_SECONDS * 1000)
    expect(screen.getByText(/Rest — look 20 ft away/)).toBeInTheDocument()
    expect(getTimerDisplay()).toHaveTextContent('00:20')
    expect(startRestTone).toHaveBeenCalledTimes(1)
  })

  it('stops the tone and shows Acknowledge when rest hits zero', async () => {
    render(<App />)
    typeTask('Refactor')
    clickButton(/start/i)

    await tick(WORK_SECONDS * 1000)
    expect(
      screen.queryByRole('button', { name: /acknowledge/i }),
    ).not.toBeInTheDocument()

    await tick(REST_SECONDS * 1000)
    expect(stopRestTone).toHaveBeenCalled()
    expect(getTimerDisplay()).toHaveTextContent('00:00')
    expect(
      screen.getByRole('button', { name: /acknowledge/i }),
    ).toBeInTheDocument()
  })

  it('Acknowledge adds a tile to history and returns to idle', async () => {
    render(<App />)
    typeTask('Write report')
    clickButton(/start/i)
    await tick(WORK_SECONDS * 1000)
    await tick(REST_SECONDS * 1000)
    clickButton(/acknowledge/i)

    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(getTimerDisplay()).toHaveTextContent('20:00')
    expect(getTaskInput().value).toBe('')

    // History tile present with task name.
    expect(screen.getByText('Write report')).toBeInTheDocument()
  })

  it('history accumulates across multiple cycles', async () => {
    render(<App />)

    for (const taskName of ['First task', 'Second task']) {
      typeTask(taskName)
      clickButton(/start/i)
      await tick(WORK_SECONDS * 1000)
      await tick(REST_SECONDS * 1000)
      clickButton(/acknowledge/i)
    }

    const tiles = screen.getAllByRole('listitem')
    expect(tiles).toHaveLength(2)
    expect(tiles[0]).toHaveTextContent('First task')
    expect(tiles[1]).toHaveTextContent('Second task')
  })

  it('restart during rest resets the rest countdown and re-triggers the tone', async () => {
    render(<App />)
    typeTask('Eye break')
    clickButton(/start/i)

    // Enter rest.
    await tick(WORK_SECONDS * 1000)
    expect(getTimerDisplay()).toHaveTextContent('00:20')
    expect(startRestTone).toHaveBeenCalledTimes(1)

    // Burn 5 seconds of rest, then restart.
    await tick(5000)
    expect(getTimerDisplay()).toHaveTextContent('00:15')

    clickButton(/restart/i)
    expect(getTimerDisplay()).toHaveTextContent('00:20')
    // startRestTone called once on entering rest, again on restart.
    expect(startRestTone).toHaveBeenCalledTimes(2)
  })

  it('skip during work jumps straight to rest', () => {
    render(<App />)
    typeTask('Quick task')
    clickButton(/start/i)

    clickButton(/skip/i)
    expect(screen.getByText(/Rest — look 20 ft away/)).toBeInTheDocument()
    expect(getTimerDisplay()).toHaveTextContent('00:20')
    expect(startRestTone).toHaveBeenCalledTimes(1)
  })

  it('skip during rest jumps to acknowledge', async () => {
    render(<App />)
    typeTask('Another task')
    clickButton(/start/i)
    await tick(WORK_SECONDS * 1000)

    clickButton(/skip/i)
    expect(getTimerDisplay()).toHaveTextContent('00:00')
    expect(stopRestTone).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: /acknowledge/i }),
    ).toBeInTheDocument()
    // Skip button hidden once rest is expired.
    expect(
      screen.queryByRole('button', { name: /skip/i }),
    ).not.toBeInTheDocument()
  })
})
