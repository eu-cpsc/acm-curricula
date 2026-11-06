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

/**
 * How a topic is covered by a degree plan:
 *  - required: every student covers it (a required course, or an elective
 *    group where every possible choice includes it)
 *  - selected: covered by the electives picked in a what-if selection
 *  - elective: only some elective choices cover it
 *  - none:     no course in the plan covers it
 */
export type PlanStatus = 'required' | 'selected' | 'elective' | 'none'

export const PLAN_STATUSES: PlanStatus[] = ['required', 'selected', 'elective', 'none']

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  required: 'Guaranteed',
  selected: 'Selected electives',
  elective: 'Elective only',
  none: 'Not covered',
}

export function planCourseIds(plan: DegreePlan): Set<string> {
  return new Set([...plan.required, ...plan.electives.flatMap((g) => g.options)])
}

export function planHasCourse(plan: DegreePlan, courseId: string): boolean {
  return plan.required.includes(courseId) || plan.electives.some((g) => g.options.includes(courseId))
}

export type StatusCounts = Record<PlanStatus, number>

export interface PlanAnalysis {
  status: Map<string, PlanStatus>
  byKa: Map<string, Record<Tier, StatusCounts>>
  totals: Record<Tier, StatusCounts>
}

function zero(): StatusCounts {
  return { required: 0, selected: 0, elective: 0, none: 0 }
}

/**
 * Classify every topic for a degree plan.
 * @param selection what-if: elective course IDs a student picked. null = any student.
 */
export function analyzePlan(plan: DegreePlan, courses: Course[], selection: Set<string> | null = null): PlanAnalysis {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const covers = (courseId: string) => new Set(byId.get(courseId)?.coverage ?? [])

  const required = new Set<string>()
  for (const id of plan.required) covers(id).forEach((t) => required.add(t))

  const selected = new Set<string>()
  const optional = new Set<string>()
  for (const g of plan.electives) {
    const optionTopics = g.options.map(covers)
    const counts = new Map<string, number>()
    optionTopics.forEach((ts) => ts.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)))
    counts.forEach((n, t) => {
      optional.add(t)
      // Any student who picks `choose` options must include one covering t
      // when fewer than `choose` options leave it out.
      if (selection === null && g.choose > 0 && n > g.options.length - g.choose) required.add(t)
    })
    if (selection) g.options.forEach((id, i) => selection.has(id) && optionTopics[i].forEach((t) => selected.add(t)))
  }

  const status = new Map<string, PlanStatus>()
  const byKa = new Map<string, Record<Tier, StatusCounts>>()
  const totals = { cs: zero(), ka: zero(), non: zero() }
  for (const ka of KAS) {
    const rec = { cs: zero(), ka: zero(), non: zero() }
    for (const t of ka.topics) {
      const s: PlanStatus = required.has(t.id) ? 'required' : selected.has(t.id) ? 'selected' : optional.has(t.id) ? 'elective' : 'none'
      status.set(t.id, s)
      rec[t.tier][s]++
      totals[t.tier][s]++
    }
    byKa.set(ka.code, rec)
  }
  return { status, byKa, totals }
}

/** Minimum credits: required courses plus the cheapest `choose` options of each group. */
export function planCredits(plan: DegreePlan, courses: Course[]): { required: number; electives: number; total: number } {
  const cr = new Map(courses.map((c) => [c.id, c.credits ?? 0]))
  const required = plan.required.reduce((s, id) => s + (cr.get(id) ?? 0), 0)
  const electives = plan.electives.reduce(
    (s, g) =>
      s +
      g.options
        .map((id) => cr.get(id) ?? 0)
        .sort((a, b) => a - b)
        .slice(0, g.choose)
        .reduce((x, y) => x + y, 0),
    0,
  )
  return { required, electives, total: required + electives }
}

export function sumCounts(c: StatusCounts): number {
  return PLAN_STATUSES.reduce((s, k) => s + c[k], 0)
}
