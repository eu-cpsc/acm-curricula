import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------- data model
//
// A "Program" is one save file (e.g. evangel-cs.curriculum.json): an
// institution's program with its courses and the degree plans built from them.
// The CS2023 body of knowledge is NOT in the file; it ships with the app.

export interface Course {
  id: string
  dept: string
  number: string
  name: string
  credits: number | null
  description: string
  /** Topic IDs (see bok.ts) this course covers. */
  coverage: string[]
}

/** "Choose `choose` of these `options`." */
export interface ElectiveGroup {
  id: string
  name: string
  choose: number
  options: string[]
}

/** One way through the program, e.g. "B.S. Computer Science – Cybersecurity track". */
export interface DegreePlan {
  id: string
  name: string
  description: string
  required: string[]
  electives: ElectiveGroup[]
}

export interface Program {
  format: 'acm-curriculum-planner'
  version: 2
  institution: string
  name: string
  courses: Course[]
  plans: DegreePlan[]
}

export function emptyProgram(): Program {
  return { format: 'acm-curriculum-planner', version: 2, institution: '', name: 'New program', courses: [], plans: [] }
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Validate and upgrade a parsed save file. Throws if it isn't one. */
export function normalize(input: unknown): Program {
  const d = (input ?? {}) as any
  if (!Array.isArray(d.courses) || !Array.isArray(d.plans)) {
    throw new Error('This is not a curriculum file (expected "courses" and "plans").')
  }
  const courses: Course[] = d.courses.map((c: any) => ({
    id: String(c.id ?? newId()),
    dept: String(c.dept ?? ''),
    number: String(c.number ?? ''),
    name: String(c.name ?? ''),
    credits: typeof c.credits === 'number' ? c.credits : null,
    description: String(c.description ?? ''),
    coverage: Array.isArray(c.coverage) ? [...new Set<string>(c.coverage.map(String))] : [],
  }))
  const ids = (xs: unknown) => (Array.isArray(xs) ? xs.map(String) : [])
  const group = (g: any): ElectiveGroup => ({
    id: String(g.id ?? newId()),
    name: String(g.name ?? 'Electives'),
    choose: Math.max(0, Number(g.choose) || 0),
    options: ids(g.options),
  })

  const plans: DegreePlan[] = []
  for (const p of d.plans as any[]) {
    if (Array.isArray(p.groups)) {
      // Version 1 files: core / elective / track groups. Each track becomes its own plan.
      const base = p.groups.filter((g: any) => g.kind !== 'track')
      const required = base.flatMap((g: any) => ids(g.required))
      const electives = base.filter((g: any) => ids(g.options).length).map(group)
      const tracks = p.groups.filter((g: any) => g.kind === 'track')
      const variants = tracks.length ? tracks : [null]
      for (const t of variants) {
        plans.push({
          id: newId(),
          name: t ? `${p.name} – ${t.name}` : String(p.name ?? 'Plan'),
          description: String(p.description ?? ''),
          required: [...new Set([...required, ...(t ? ids(t.required) : [])])],
          electives: [...electives.map((e: ElectiveGroup) => ({ ...e, id: newId() })), ...(t && ids(t.options).length ? [group({ ...t, id: newId() })] : [])],
        })
      }
    } else {
      plans.push({
        id: String(p.id ?? newId()),
        name: String(p.name ?? 'Plan'),
        description: String(p.description ?? ''),
        required: ids(p.required),
        electives: Array.isArray(p.electives) ? p.electives.map(group) : [],
      })
    }
  }
  return {
    format: 'acm-curriculum-planner',
    version: 2,
    institution: String(d.institution ?? ''),
    name: String(d.name ?? (d.institution ? 'Program' : 'New program')),
    courses,
    plans,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --------------------------------------------------------------- the store

export type SaveMode = 'file' | 'download'

export interface FileState {
  /** File name shown to the user. */
  name: string
  /** 'file': edits are written straight to the file (Chrome/Edge). 'download': user saves a copy. */
  mode: SaveMode
  /** Edits not yet written to the file. */
  dirty: boolean
  /** In 'file' mode, false until the browser has write permission (e.g. after a reload). */
  connected: boolean
  saving: boolean
  error: string | null
}

interface State {
  program: Program | null
  file: FileState | null
}

let state: State = { program: null, file: null }
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getState(): State {
  return state
}

/** Replace the whole state (used by fileio.ts). */
export function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function setFileState(patch: Partial<FileState>) {
  if (state.file) setState({ file: { ...state.file, ...patch } })
}

export function useAppState(): State {
  return useSyncExternalStore(subscribe, getState)
}

/** The open program. Only call from pages rendered while a program is open. */
export function useData(): Program {
  return useSyncExternalStore(subscribe, () => state.program!)
}

export function useFile(): FileState | null {
  return useSyncExternalStore(subscribe, () => state.file)
}

type ChangeListener = (p: Program) => void
let onChange: ChangeListener = () => {}
/** fileio.ts registers the autosave hook here. */
export function setChangeListener(fn: ChangeListener) {
  onChange = fn
}

export function update(fn: (p: Program) => Program) {
  if (!state.program) return
  const program = fn(state.program)
  setState({ program, file: state.file ? { ...state.file, dirty: true } : null })
  onChange(program)
}

// ----------------------------------------------------------------- actions

export function courseLabel(c: Pick<Course, 'dept' | 'number'>): string {
  return `${c.dept} ${c.number}`.trim()
}

export function compareCourses(a: Course, b: Course): number {
  return a.dept.localeCompare(b.dept) || a.number.localeCompare(b.number, undefined, { numeric: true })
}

export function addCourse(c: Omit<Course, 'id' | 'coverage'>): string {
  const id = newId()
  update((d) => ({ ...d, courses: [...d.courses, { ...c, id, coverage: [] }] }))
  return id
}

export function updateCourse(id: string, patch: Partial<Course>) {
  update((d) => ({ ...d, courses: d.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
}

export function deleteCourse(id: string) {
  update((d) => ({
    ...d,
    courses: d.courses.filter((c) => c.id !== id),
    plans: d.plans.map((p) => ({
      ...p,
      required: p.required.filter((x) => x !== id),
      electives: p.electives.map((g) => ({ ...g, options: g.options.filter((x) => x !== id) })),
    })),
  }))
}

/** Add (on=true) or remove topic IDs from a course's coverage. */
export function setCoverage(courseId: string, topicIds: string[], on: boolean) {
  update((d) => ({
    ...d,
    courses: d.courses.map((c) => {
      if (c.id !== courseId) return c
      const set = new Set(c.coverage)
      for (const t of topicIds) {
        if (on) set.add(t)
        else set.delete(t)
      }
      return { ...c, coverage: [...set] }
    }),
  }))
}

export function addPlan(name: string, copyFrom?: DegreePlan): string {
  const id = newId()
  const plan: DegreePlan = copyFrom
    ? { ...structuredClone(copyFrom), id, name, electives: copyFrom.electives.map((g) => ({ ...g, id: newId() })) }
    : { id, name, description: '', required: [], electives: [] }
  update((d) => ({ ...d, plans: [...d.plans, plan] }))
  return id
}

export function updatePlan(id: string, fn: (p: DegreePlan) => DegreePlan) {
  update((d) => ({ ...d, plans: d.plans.map((p) => (p.id === id ? fn(p) : p)) }))
}

export function deletePlan(id: string) {
  update((d) => ({ ...d, plans: d.plans.filter((p) => p.id !== id) }))
}

export function updateElectiveGroup(planId: string, groupId: string, patch: Partial<ElectiveGroup>) {
  updatePlan(planId, (p) => ({
    ...p,
    electives: p.electives.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
  }))
}
