import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'

vi.mock('./sound', () => ({
  startRestTone: vi.fn(),
  stopRestTone: vi.fn(),
  playChime: vi.fn(),
}))

import App, { WORK_SECONDS, REST_SECONDS } from './App'
import { startRestTone, stopRestTone, playChime } from './sound'

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(startRestTone).mockClear()
  vi.mocked(stopRestTone).mockClear()
  vi.mocked(playChime).mockClear()
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
  return screen.getByPlaceholderText(
    /what are you working on/i,
  ) as HTMLInputElement
}

function typeTask(value: string) {
  fireEvent.change(getTaskInput(), { target: { value } })
}

function clickButton(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function gridCells() {
  return screen
    .getByLabelText(/today's rests/i)
    .querySelectorAll('button.history-cell')
}

describe('20-20-20 Timer', () => {
  it('renders the idle state with Start enabled', () => {
    render(<App />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start/i })).toBeEnabled()
    expect(getTimerDisplay()).toHaveTextContent('20:00')
  })

  it('starts the work countdown without requiring a task', async () => {
    render(<App />)
    clickButton(/^start$/i)
    expect(screen.getByText('Working')).toBeInTheDocument()
    await tick(1000)
    expect(getTimerDisplay()).toHaveTextContent('19:59')
  })

  it('pause halts the countdown and resume continues it', async () => {
    render(<App />)
    clickButton(/^start$/i)
    await tick(3000)
    expect(getTimerDisplay()).toHaveTextContent('19:57')

    clickButton(/pause/i)
    await tick(5000)
    expect(getTimerDisplay()).toHaveTextContent('19:57')

    clickButton(/resume/i)
    await tick(2000)
    expect(getTimerDisplay()).toHaveTextContent('19:55')
  })

  it('cancel returns to idle', async () => {
    render(<App />)
    clickButton(/^start$/i)
    await tick(10_000)
    clickButton(/cancel/i)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(getTimerDisplay()).toHaveTextContent('20:00')
  })

  it('skip jumps from work to rest immediately', async () => {
    render(<App />)
    clickButton(/^start$/i)
    await tick(5000)
    clickButton(/skip/i)
    expect(screen.getByText(/Rest — look 20 ft away/)).toBeInTheDocument()
    expect(getTimerDisplay()).toHaveTextContent('00:20')
    expect(startRestTone).toHaveBeenCalledTimes(1)
  })

  it('rest ends silently and returns to idle — no chime, no buttons', async () => {
    render(<App />)
    clickButton(/^start$/i)
    await tick(WORK_SECONDS * 1000)
    expect(screen.getByText(/Rest — look 20 ft away/)).toBeInTheDocument()

    await tick(REST_SECONDS * 1000)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(getTimerDisplay()).toHaveTextContent('20:00')
    expect(stopRestTone).toHaveBeenCalled()
    expect(playChime).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: /acknowledge/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /mark as break/i }),
    ).not.toBeInTheDocument()
  })

  it('adds a task via Enter and shows time + edit/delete', () => {
    render(<App />)
    typeTask('Write report')
    fireEvent.submit(getTaskInput().closest('form')!)

    const tasks = screen.getByLabelText(/tasks/i)
    expect(tasks).toHaveTextContent('Write report')
    expect(
      screen.getByRole('button', { name: /^edit$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^delete$/i }),
    ).toBeInTheDocument()
    // Task input is cleared after submission.
    expect(getTaskInput().value).toBe('')
    // 12-hour time has AM or PM.
    expect(tasks.textContent).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i)
  })

  it('adds a task via the Add button', () => {
    render(<App />)
    typeTask('Read book')
    clickButton(/^add$/i)
    expect(screen.getByLabelText(/tasks/i)).toHaveTextContent('Read book')
  })

  it('Add is disabled when task input is blank', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
    typeTask('x')
    expect(screen.getByRole('button', { name: /^add$/i })).toBeEnabled()
  })

  it('edits a task', () => {
    render(<App />)
    typeTask('Old text')
    clickButton(/^add$/i)
    clickButton(/^edit$/i)

    const editInput = screen.getByDisplayValue('Old text') as HTMLInputElement
    fireEvent.change(editInput, { target: { value: 'New text' } })
    clickButton(/^save$/i)

    expect(screen.getByLabelText(/tasks/i)).toHaveTextContent('New text')
    expect(screen.getByLabelText(/tasks/i)).not.toHaveTextContent('Old text')
  })

  it('marks a task complete and reflects it in the DOM', () => {
    render(<App />)
    typeTask('Buy milk')
    clickButton(/^add$/i)

    const checkbox = screen.getByRole('checkbox', {
      name: /mark "buy milk" complete/i,
    }) as HTMLInputElement
    expect(checkbox.checked).toBe(false)

    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
    expect(checkbox.closest('li')!.className).toContain('task-completed')

    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
    expect(checkbox.closest('li')!.className).not.toContain('task-completed')
  })

  it('shows a time-since label before the timestamp', () => {
    render(<App />)
    typeTask('Draft')
    clickButton(/^add$/i)
    // Immediately after adding, diff is 0 → "just now".
    expect(screen.getByLabelText(/tasks/i)).toHaveTextContent(/just now/i)
  })

  it('deletes a task', () => {
    render(<App />)
    typeTask('Trash me')
    clickButton(/^add$/i)
    expect(screen.getByLabelText(/tasks/i)).toHaveTextContent('Trash me')

    clickButton(/^delete$/i)
    expect(screen.queryByLabelText(/tasks/i)).not.toBeInTheDocument()
  })

  it('renders 72 grid cells as buttons', () => {
    render(<App />)
    expect(gridCells()).toHaveLength(72)
  })

  it('clicking a grid cell cycles empty → acknowledged → break → empty', () => {
    render(<App />)
    const cells = gridCells()
    // Pick a future cell (index 71, end of day) to avoid relying on time.
    const cell = cells[71] as HTMLButtonElement
    expect(cell.className).toContain('status-future')

    fireEvent.click(cell)
    expect(gridCells()[71].className).toContain('status-acknowledged')

    fireEvent.click(gridCells()[71])
    expect(gridCells()[71].className).toContain('status-break')

    fireEvent.click(gridCells()[71])
    // Back to the natural unset state for a future block.
    expect(gridCells()[71].className).toContain('status-future')
  })
})
