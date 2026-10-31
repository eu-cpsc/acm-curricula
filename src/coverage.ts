import { KAS, type Tier, type Topic } from './bok'
import type { Course, DegreePlan } from './store'

// ------------------------------------------------------ topic -> courses index

const indexCache = new WeakMap<Course[], Map<string, Course[]>>()

/** Map of topic ID -> courses covering it (memoized on the courses array). */
export function coverageIndex(courses: Course[]): Map<string, Course[]> {
  let idx = indexCache.get(courses)
  if (!idx) {
    idx = new Map()
    for (const c of courses) {
      for (const t of c.coverage) {
        const list = idx.get(t)
        if (list) list.push(c)
        else idx.set(t, [c])
      }
    }
    indexCache.set(courses, idx)
  }
  return idx
}

export interface TierCount {
  total: number
  covered: number
}

export type TierCounts = Record<Tier, TierCount>

export function emptyCounts(): TierCounts {
  return { cs: { total: 0, covered: 0 }, ka: { total: 0, covered: 0 }, non: { total: 0, covered: 0 } }
}

export function countCovered(topics: Topic[], isCovered: (t: Topic) => boolean): TierCounts {
  const c = emptyCounts()
  for (const t of topics) {
    c[t.tier].total++
    if (isCovered(t)) c[t.tier].covered++
  }
  return c
}

export function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100)
}

// ---------------------------------------------------------- degree plan logic

export type PlanStatus = 'guaranteed' | 'track' | 'elective' | 'none'

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  guaranteed: 'Guaranteed',
  track: 'Some tracks',
  elective: 'Elective only',
  none: 'Not covered',
}

export function planCourseIds(plan: DegreePlan): Set<string> {
  const s = new Set<string>()
  for (const g of plan.groups) {
    g.required.forEach((id) => s.add(id))
    g.options.forEach((id) => s.add(id))
  }
  return s
}

/** Courses every student in the plan takes (optionally within one track). */
function guaranteedCourseIds(plan: DegreePlan, groupFilter: (kind: string, id: string) => boolean): Set<string> {
  const s = new Set<string>()
  for (const g of plan.groups) {
    if (!groupFilter(g.kind, g.id)) continue
    g.required.forEach((id) => s.add(id))
    // "Choose N of N" means all options are effectively required.
    if (g.options.length > 0 && g.choose >= g.options.length) g.options.forEach((id) => s.add(id))
  }
  return s
}

export interface PlanAnalysis {
  status: Map<string, PlanStatus>
  /** For topics covered only in some tracks: which track names. */
  tracksFor: Map<string, string[]>
  byKa: Map<string, Record<Tier, Record<PlanStatus, number>>>
  totals: Record<Tier, Record<PlanStatus, number>>
}

function zeroStatus(): Record<PlanStatus, number> {
  return { guaranteed: 0, track: 0, elective: 0, none: 0 }
}

/**
 * Classify every topic for a degree plan.
 * @param trackId analyze as a student in this track; null = any student.
 */
export function analyzePlan(plan: DegreePlan, courses: Course[], trackId: string | null): PlanAnalysis {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const topicsOf = (ids: Iterable<string>) => {
    const s = new Set<string>()
    for (const id of ids) byId.get(id)?.coverage.forEach((t) => s.add(t))
    return s
  }

  const tracks = plan.groups.filter((g) => g.kind === 'track')
  const base = topicsOf(guaranteedCourseIds(plan, (kind, id) => kind !== 'track' || id === trackId))

  // When analyzing "any student", a topic every track guarantees is also guaranteed.
  const trackTopics = tracks.map((t) => ({ name: t.name, topics: topicsOf(guaranteedCourseIds(plan, (_k, id) => id === t.id)) }))
  const optionTopics = topicsOf(
    plan.groups
      .filter((g) => g.kind !== 'track' || trackId === null || g.id === trackId)
      .flatMap((g) => [...g.options, ...(g.kind === 'track' ? g.required : [])]),
  )

  const status = new Map<string, PlanStatus>()
  const tracksFor = new Map<string, string[]>()
  const byKa = new Map<string, Record<Tier, Record<PlanStatus, number>>>()
  const totals = { cs: zeroStatus(), ka: zeroStatus(), non: zeroStatus() }

  for (const ka of KAS) {
    const rec = { cs: zeroStatus(), ka: zeroStatus(), non: zeroStatus() }
    for (const t of ka.topics) {
      let s: PlanStatus
      if (base.has(t.id)) s = 'guaranteed'
      else if (trackId === null && trackTopics.length > 0 && trackTopics.every((x) => x.topics.has(t.id))) s = 'guaranteed'
      else if (trackId === null && trackTopics.some((x) => x.topics.has(t.id))) {
        s = 'track'
        tracksFor.set(t.id, trackTopics.filter((x) => x.topics.has(t.id)).map((x) => x.name))
      } else if (optionTopics.has(t.id)) s = 'elective'
      else s = 'none'
      status.set(t.id, s)
      rec[t.tier][s]++
      totals[t.tier][s]++
    }
    byKa.set(ka.code, rec)
  }
  return { status, tracksFor, byKa, totals }
}

export function creditSum(ids: string[], courses: Course[]): number {
  const byId = new Map(courses.map((c) => [c.id, c]))
  return ids.reduce((s, id) => s + (byId.get(id)?.credits ?? 0), 0)
}
