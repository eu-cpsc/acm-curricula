import { describe, expect, it } from 'vitest'
import { TOPICS } from './bok'
import { analyzePlan, coverageIndex, planCredits, sumCounts } from './coverage'
import { course, group, ids, plan } from './test/fixtures'

const [t1, t2, t3] = ids('OS-Purpose')

describe('coverageIndex', () => {
  it('maps each topic to the courses covering it', () => {
    const courses = [course('a', [t1, t2]), course('b', [t2])]
    const idx = coverageIndex(courses)
    expect(idx.get(t1)?.map((c) => c.id)).toEqual(['a'])
    expect(idx.get(t2)?.map((c) => c.id)).toEqual(['a', 'b'])
    expect(idx.has(t3)).toBe(false)
    expect(coverageIndex(courses)).toBe(idx) // memoized
  })
})

describe('analyzePlan', () => {
  it('marks required-course topics guaranteed and the rest not covered', () => {
    const a = analyzePlan(plan(['a']), [course('a', [t1])])
    expect(a.status.get(t1)).toBe('required')
    expect(a.status.get(t2)).toBe('none')
  })

  it('counts every topic exactly once per tier', () => {
    const a = analyzePlan(plan(['a']), [course('a', [t1])])
    const total = sumCounts(a.totals.cs) + sumCounts(a.totals.ka) + sumCounts(a.totals.non)
    expect(total).toBe(TOPICS.length)
    expect(a.totals.cs.required).toBe(1)
  })

  it('treats a topic in only some elective options as elective only', () => {
    const courses = [course('x', [t1]), course('y', [])]
    expect(analyzePlan(plan([], [group(1, ['x', 'y'])]), courses).status.get(t1)).toBe('elective')
  })

  it('guarantees a topic every allowed elective choice covers', () => {
    // choose 1 of 2, both cover t1
    const both = [course('x', [t1]), course('y', [t1])]
    expect(analyzePlan(plan([], [group(1, ['x', 'y'])]), both).status.get(t1)).toBe('required')

    // choose 2 of 3: two options cover t1, so any pick of two includes one of them
    const three = [course('x', [t1, t2]), course('y', [t1]), course('z', [])]
    const a = analyzePlan(plan([], [group(2, ['x', 'y', 'z'])]), three)
    expect(a.status.get(t1)).toBe('required')
    expect(a.status.get(t2)).toBe('elective') // only x covers t2; picking y+z avoids it
  })

  it('does not guarantee anything from a "choose 0" group', () => {
    const courses = [course('x', [t1])]
    expect(analyzePlan(plan([], [group(0, ['x'])]), courses).status.get(t1)).toBe('elective')
  })

  it('what-if: only the picked electives count', () => {
    const courses = [course('x', [t1]), course('y', [t1, t2]), course('z', [t3])]
    const p = plan([], [group(1, ['x', 'y', 'z'])])
    const a = analyzePlan(p, courses, new Set(['x']))
    expect(a.status.get(t1)).toBe('selected')
    expect(a.status.get(t2)).toBe('elective')
    expect(a.status.get(t3)).toBe('elective')
  })

  it('what-if: required courses still count as guaranteed', () => {
    const a = analyzePlan(plan(['r'], [group(1, ['x'])]), [course('r', [t1]), course('x', [t1, t2])], new Set(['x']))
    expect(a.status.get(t1)).toBe('required')
    expect(a.status.get(t2)).toBe('selected')
  })

  it('ignores courses that no longer exist', () => {
    expect(analyzePlan(plan(['gone'], [group(1, ['gone2'])]), []).totals.cs.none).toBeGreaterThan(0)
  })
})

describe('planCredits', () => {
  it('adds required credits and the cheapest N options of each group', () => {
    const courses = [course('r', [], 4), course('x', [], 3), course('y', [], 1), course('z', [], 2), course('n', [], null)]
    const c = planCredits(plan(['r', 'n'], [group(2, ['x', 'y', 'z'])]), courses)
    expect(c).toEqual({ required: 4, electives: 3, total: 7 })
  })
})
