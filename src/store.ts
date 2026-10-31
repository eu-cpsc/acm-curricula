import { useSyncExternalStore } from 'react'
import publishedJson from '../data/curriculum.json'

// ---------------------------------------------------------------- data model

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

export type GroupKind = 'core' | 'elective' | 'track'

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  core: 'Core',
  elective: 'Elective group',
  track: 'Track',
}

/**
 * A block of requirements in a degree plan.
 *  - core:     every `required` course is taken by all students.
 *  - elective: all students take every `required` course plus `choose` of `options`.
 *  - track:    students pick ONE track; within it they take `required` + `choose` of `options`.
 */
export interface RequirementGroup {
  id: string
  name: string
  kind: GroupKind
  description: string
  required: string[]
  options: string[]
  choose: number
}

export interface DegreePlan {
  id: string
  name: string
  description: string
  groups: RequirementGroup[]
}

export interface AppData {
  version: 1
  institution: string
  courses: Course[]
  plans: DegreePlan[]
}

export const EMPTY_DATA: AppData = { version: 1, institution: '', courses: [], plans: [] }

// --------------------------------------------------------------- the store

const STORAGE_KEY = 'acm-curriculum-planner:data'
/** Set once the user edits; until then the browser follows data/curriculum.json. */
const DIRTY_KEY = 'acm-curriculum-planner:dirty'

/** The curriculum committed to the repo at data/curriculum.json. */
export function publishedData(): AppData {
  return normalize(publishedJson)
}

export function hasLocalChanges(): boolean {
  return localStorage.getItem(DIRTY_KEY) === '1'
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && hasLocalChanges()) return normalize(JSON.parse(raw))
  } catch (e) {
    console.error('Failed to load saved data', e)
  }
  return publishedData()
}

/** Coerce possibly-partial imported JSON into a valid AppData. */
export function normalize(input: unknown): AppData {
  const d = (input ?? {}) as Partial<AppData>
  if (!Array.isArray(d.courses) || !Array.isArray(d.plans)) {
    throw new Error('Not a curriculum file: expected "courses" and "plans" arrays.')
  }
  return {
    version: 1,
    institution: d.institution ?? '',
    courses: d.courses.map((c) => ({
      id: c.id ?? newId(),
      dept: c.dept ?? '',
      number: String(c.number ?? ''),
      name: c.name ?? '',
      credits: c.credits ?? null,
      description: c.description ?? '',
      coverage: Array.isArray(c.coverage) ? [...new Set(c.coverage)] : [],
    })),
    plans: d.plans.map((p) => ({
      id: p.id ?? newId(),
      name: p.name ?? 'Untitled plan',
      description: p.description ?? '',
      groups: (p.groups ?? []).map((g) => ({
        id: g.id ?? newId(),
        name: g.name ?? '',
        kind: g.kind ?? 'core',
        description: g.description ?? '',
        required: g.required ?? [],
        options: g.options ?? [],
        choose: g.choose ?? 0,
      })),
    })),
  }
}

let state: AppData = load()
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getData(): AppData {
  return state
}

export function setData(next: AppData) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    localStorage.setItem(DIRTY_KEY, '1')
  } catch (e) {
    console.error('Failed to save data', e)
  }
  listeners.forEach((l) => l())
}

/** Discard local edits and follow data/curriculum.json again. */
export function resetToPublished() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(DIRTY_KEY)
  state = publishedData()
  listeners.forEach((l) => l())
}

export function update(fn: (d: AppData) => AppData) {
  setData(fn(state))
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, getData)
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
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
      groups: p.groups.map((g) => ({
        ...g,
        required: g.required.filter((x) => x !== id),
        options: g.options.filter((x) => x !== id),
      })),
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

export function addPlan(name: string): string {
  const id = newId()
  update((d) => ({
    ...d,
    plans: [
      ...d.plans,
      {
        id,
        name,
        description: '',
        groups: [{ id: newId(), name: 'Core', kind: 'core', description: '', required: [], options: [], choose: 0 }],
      },
    ],
  }))
  return id
}

export function updatePlan(id: string, fn: (p: DegreePlan) => DegreePlan) {
  update((d) => ({ ...d, plans: d.plans.map((p) => (p.id === id ? fn(p) : p)) }))
}

export function deletePlan(id: string) {
  update((d) => ({ ...d, plans: d.plans.filter((p) => p.id !== id) }))
}

export function updateGroup(planId: string, groupId: string, patch: Partial<RequirementGroup>) {
  updatePlan(planId, (p) => ({
    ...p,
    groups: p.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
  }))
}
