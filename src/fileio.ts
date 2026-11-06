// Opening and saving the program file.
//
// Chrome/Edge (desktop) support the File System Access API: we keep a handle
// to the file and write every edit back to it. Other browsers (Safari,
// Firefox, mobile) can only read a chosen file; edits are kept in the browser
// and the user saves by downloading a copy.
//
// In both cases a working copy is kept in localStorage so a reload or crash
// doesn't lose edits, and the file handle is kept in IndexedDB so the same
// file can be reconnected after a reload.

import { emptyProgram, getState, normalize, setChangeListener, setFileState, setState, type FileState, type Program } from './store'

const SESSION_KEY = 'acm-curriculum-planner:session'
const FILE_EXT = '.curriculum.json'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Handle = FileSystemFileHandle & {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>
}
const w = window as any
export const canWriteFiles = typeof w.showOpenFilePicker === 'function' && typeof w.showSaveFilePicker === 'function'
const pickerTypes = [{ description: 'Curriculum file', accept: { 'application/json': ['.json'] } }]
/* eslint-enable @typescript-eslint/no-explicit-any */

let handle: Handle | null = null

// ------------------------------------------------------------ IndexedDB handle

function idb<T>(fn: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode = 'readonly'): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('acm-curriculum-planner', 1)
      open.onupgradeneeded = () => open.result.createObjectStore('handles')
      open.onerror = () => resolve(undefined)
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction('handles', mode)
          const req = fn(tx.objectStore('handles'))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve(undefined)
        } catch {
          resolve(undefined) // e.g. the handle can't be stored; reconnecting after reload just won't be offered
        }
      }
    } catch {
      resolve(undefined)
    }
  })
}
const saveHandle = (h: Handle | null) => idb<unknown>((s) => (h ? s.put(h, 'current') : s.delete('current')) as IDBRequest<unknown>, 'readwrite')
const loadHandle = () => idb<Handle>((s) => s.get('current') as IDBRequest<Handle>)

// -------------------------------------------------------------- working copy

interface Session {
  program: Program
  file: Pick<FileState, 'name' | 'mode' | 'dirty'>
}

function persistSession() {
  const { program, file } = getState()
  try {
    if (program && file) {
      const s: Session = { program, file: { name: file.name, mode: file.mode, dirty: file.dirty } }
      localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    } else localStorage.removeItem(SESSION_KEY)
  } catch (e) {
    console.error('Could not keep a working copy in this browser', e)
  }
}

// ------------------------------------------------------------------ writing

function serialize(p: Program): string {
  return JSON.stringify(p, null, 2) + '\n'
}

let writeTimer: number | undefined
let writing: Promise<void> = Promise.resolve()

function scheduleWrite() {
  window.clearTimeout(writeTimer)
  writeTimer = window.setTimeout(() => {
    writing = writing.then(writeNow)
  }, 400)
}

async function writeNow() {
  const { program, file } = getState()
  if (!program || !file || file.mode !== 'file' || !file.connected || !handle) return
  setFileState({ saving: true })
  try {
    const stream = await handle.createWritable()
    await stream.write(serialize(program))
    await stream.close()
    // Only clear dirty if nothing changed while we were writing.
    setFileState({ saving: false, error: null, dirty: getState().program !== program })
  } catch (e) {
    setFileState({ saving: false, error: `Could not save: ${(e as Error).message}` })
  }
  persistSession()
}

setChangeListener(() => {
  persistSession()
  const f = getState().file
  if (f?.mode === 'file' && f.connected) scheduleWrite()
})

// ------------------------------------------------------------------ actions

function openProgram(program: Program, file: Omit<FileState, 'saving' | 'error'>) {
  setState({ program, file: { ...file, saving: false, error: null } })
  persistSession()
}

async function requestWrite(h: Handle): Promise<boolean> {
  try {
    if ((await h.queryPermission?.({ mode: 'readwrite' })) === 'granted') return true
    return (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted'
  } catch {
    return false
  }
}

function isAbort(e: unknown) {
  return e instanceof DOMException && e.name === 'AbortError'
}

/** Ask the user to pick a curriculum file and open it. */
export async function openFile(): Promise<void> {
  if (!confirmDiscard()) return
  if (canWriteFiles) {
    let h: Handle
    try {
      ;[h] = await w.showOpenFilePicker({ types: pickerTypes, multiple: false })
    } catch (e) {
      if (isAbort(e)) return
      throw e
    }
    const program = normalize(JSON.parse(await (await h.getFile()).text()))
    const connected = await requestWrite(h)
    handle = h
    await saveHandle(h)
    openProgram(program, { name: h.name, mode: 'file', dirty: false, connected })
    return
  }
  const f = await pickFileFallback()
  if (!f) return
  const program = normalize(JSON.parse(await f.text()))
  handle = null
  await saveHandle(null)
  openProgram(program, { name: f.name, mode: 'download', dirty: false, connected: true })
}

function pickFileFallback(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

function slug(p: Program) {
  const s = [p.institution, p.name]
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return (s || 'program') + FILE_EXT
}

/** Start a new, empty program. */
export async function newProgram(): Promise<void> {
  if (!confirmDiscard()) return
  const program = emptyProgram()
  if (canWriteFiles) {
    const ok = await saveAsFile(program)
    if (ok) return
    if (ok === null) return // cancelled
  }
  handle = null
  await saveHandle(null)
  openProgram(program, { name: slug(program), mode: 'download', dirty: true, connected: true })
}

/** Open the built-in sample (not tied to a file until saved). */
export async function openProgramData(program: Program, name: string): Promise<void> {
  if (!confirmDiscard()) return
  handle = null
  await saveHandle(null)
  openProgram(program, { name, mode: 'download', dirty: false, connected: true })
}

/**
 * Choose a new file and write the program to it. Returns true on success,
 * null if the user cancelled, false if the browser can't do it.
 */
async function saveAsFile(program: Program): Promise<boolean | null> {
  try {
    const h: Handle = await w.showSaveFilePicker({ suggestedName: slug(program), types: pickerTypes })
    const stream = await h.createWritable()
    await stream.write(serialize(program))
    await stream.close()
    handle = h
    await saveHandle(h)
    openProgram(program, { name: h.name, mode: 'file', dirty: false, connected: true })
    return true
  } catch (e) {
    if (isAbort(e)) return null
    console.error(e)
    return false
  }
}

/** "Save as…": a new file in Chrome/Edge, otherwise a download. */
export async function saveAs(): Promise<void> {
  const { program } = getState()
  if (!program) return
  if (canWriteFiles && (await saveAsFile(program)) !== false) return
  downloadCopy()
}

/** Download the program as a .curriculum.json file. */
export function downloadCopy() {
  const { program, file } = getState()
  if (!program) return
  const url = URL.createObjectURL(new Blob([serialize(program)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = file?.name || slug(program)
  a.click()
  URL.revokeObjectURL(url)
  if (file?.mode === 'download') {
    setFileState({ dirty: false })
    persistSession()
  }
}

/** Re-grant write access to the open file (needed after a reload). */
export async function reconnect(): Promise<void> {
  if (!handle) return saveAs()
  const ok = await requestWrite(handle)
  setFileState({ connected: ok, error: ok ? null : 'Permission to save to the file was not granted.' })
  if (ok && getState().file?.dirty) writing = writing.then(writeNow)
}

export function closeProgram() {
  if (!confirmDiscard()) return
  handle = null
  void saveHandle(null)
  setState({ program: null, file: null })
  persistSession()
}

/** True if there are edits that would be lost. */
export function hasUnsavedEdits(): boolean {
  const f = getState().file
  return !!f && f.dirty && (f.mode === 'download' || !f.connected)
}

function confirmDiscard(): boolean {
  return !hasUnsavedEdits() || confirm('The open program has unsaved edits. Discard them?')
}

/** Restore the previous session after a reload. */
export async function restoreSession(): Promise<void> {
  let s: Session | null = null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) s = JSON.parse(raw)
  } catch {
    s = null
  }
  if (!s) return
  let program: Program
  try {
    program = normalize(s.program)
  } catch {
    return
  }
  let connected = s.file.mode !== 'file'
  if (s.file.mode === 'file') {
    handle = (await loadHandle()) ?? null
    connected = !!handle && (await handle.queryPermission?.({ mode: 'readwrite' })) === 'granted'
  }
  setState({ program, file: { ...s.file, connected, saving: false, error: null } })
  if (connected && s.file.dirty) writing = writing.then(writeNow)
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedEdits()) e.preventDefault()
})
