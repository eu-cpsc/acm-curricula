// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { sampleProgram } from './sample'
import { getState, setState } from './store'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('welcome screen', () => {
  beforeEach(() => {
    localStorage.clear()
    setState({ program: null, file: null })
  })

  it('offers to open, create or try the sample, and opens the sample', async () => {
    renderAt('/')
    expect(screen.getByText('Open program file…')).toBeTruthy()
    expect(screen.getByText('New program')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByText('Try the sample')))
    expect(getState().program?.institution).toBe('Sample University')
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy()
  })
})

describe('every page renders with the sample program', () => {
  const program = sampleProgram()
  const os = program.courses.find((c) => c.number === '415')!
  const plan = program.plans[0]

  beforeEach(() => {
    setState({ program, file: { name: 'sample.curriculum.json', mode: 'download', dirty: false, connected: true, saving: false, error: null } })
  })

  const pages: [string, string | RegExp][] = [
    ['/', 'Overview'],
    ['/knowledge', /Knowledge Areas/],
    ['/knowledge?view=matrix', /Knowledge Areas/],
    ['/courses', 'Courses'],
    ['/plans', 'Degree Plans'],
    ['/compare', 'Compare Plans'],
    ['/program', 'Program'],
  ]
  for (const [path, heading] of pages) {
    it(path, () => {
      renderAt(path)
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
    })
  }

  it('course detail', () => {
    renderAt(`/courses/${os.id}`)
    expect((screen.getByDisplayValue('Operating Systems') as HTMLInputElement).value).toBe('Operating Systems')
    expect(screen.getByRole('heading', { name: 'Topic coverage' })).toBeTruthy()
  })

  it('plan detail, including what-if mode', () => {
    renderAt(`/plans/${plan.id}`)
    expect(screen.getByDisplayValue(plan.name)).toBeTruthy()
    fireEvent.click(screen.getByText('What-if: pick electives'))
    expect(screen.getByText(/of 3 picked/)).toBeTruthy()
  })

  it('shows a not-found message for unknown IDs', () => {
    renderAt('/courses/nope')
    expect(screen.getByText(/Course not found/)).toBeTruthy()
  })
})
