// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { hasUnsavedEdits, openProgramData, restoreSession, closeProgram } from './fileio'
import { sampleProgram } from './sample'
import { addCourse, getState, setState } from './store'

describe('working copy (download mode)', () => {
  beforeEach(() => {
    localStorage.clear()
    setState({ program: null, file: null })
  })

  it('opens a program with no unsaved edits', async () => {
    await openProgramData(sampleProgram(), 'sample.curriculum.json')
    expect(getState().file).toMatchObject({ name: 'sample.curriculum.json', mode: 'download', dirty: false })
    expect(hasUnsavedEdits()).toBe(false)
  })

  it('keeps edits across a reload', async () => {
    await openProgramData(sampleProgram(), 'sample.curriculum.json')
    addCourse({ dept: 'CPSC', number: '499', name: 'Added', credits: 3, description: '' })
    expect(hasUnsavedEdits()).toBe(true)

    setState({ program: null, file: null }) // simulate a page reload
    await restoreSession()

    expect(getState().program?.courses.some((c) => c.number === '499')).toBe(true)
    expect(getState().file).toMatchObject({ name: 'sample.curriculum.json', dirty: true })
  })

  it('forgets the working copy when the program is closed', async () => {
    await openProgramData(sampleProgram(), 'sample.curriculum.json')
    closeProgram()
    await restoreSession()
    expect(getState().program).toBeNull()
  })
})
