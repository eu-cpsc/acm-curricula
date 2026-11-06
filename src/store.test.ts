import { beforeEach, describe, expect, it } from 'vitest'
import { TOPIC_BY_ID } from './bok'
import { sampleProgram } from './sample'
import { addPlan, deleteCourse, emptyProgram, getState, normalize, setCoverage, setState } from './store'
import { course, ids } from './test/fixtures'

describe('normalize (opening a file)', () => {
  it('rejects files that are not curriculum files', () => {
    expect(() => normalize({ hello: 1 })).toThrow(/not a curriculum file/)
    expect(() => normalize(null)).toThrow()
  })

  it('fills in missing fields and removes duplicate coverage', () => {
    const p = normalize({ courses: [{ id: 'a', number: 101, coverage: ['x', 'x', 'y'] }], plans: [{ name: 'BS' }] })
    expect(p.format).toBe('acm-curriculum-planner')
    expect(p.version).toBe(2)
    expect(p.courses[0]).toMatchObject({ id: 'a', dept: '', number: '101', credits: null, coverage: ['x', 'y'] })
    expect(p.plans[0]).toMatchObject({ name: 'BS', required: [], electives: [] })
  })

  it('round-trips a saved program unchanged', () => {
    const p = sampleProgram()
    expect(normalize(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })

  it('upgrades version 1 files: each track becomes its own plan', () => {
    const v1 = {
      version: 1,
      institution: 'Old U',
      courses: [course('a', []), course('b', []), course('c', []), course('d', [])],
      plans: [
        {
          name: 'BS',
          groups: [
            { kind: 'core', name: 'Core', required: ['a'], options: [], choose: 0 },
            { kind: 'elective', name: 'Electives', required: [], options: ['c', 'd'], choose: 1 },
            { kind: 'track', name: 'Security', required: ['b'], options: [], choose: 0 },
            { kind: 'track', name: 'AI', required: [], options: ['b', 'd'], choose: 1 },
          ],
        },
      ],
    }
    const p = normalize(v1)
    expect(p.plans.map((x) => x.name)).toEqual(['BS – Security', 'BS – AI'])
    const [sec, ai] = p.plans
    expect(sec.required).toEqual(['a', 'b'])
    expect(sec.electives.map((g) => [g.choose, g.options])).toEqual([[1, ['c', 'd']]])
    expect(ai.required).toEqual(['a'])
    expect(ai.electives.map((g) => [g.choose, g.options])).toEqual([
      [1, ['c', 'd']],
      [1, ['b', 'd']],
    ])
    expect(new Set(p.plans.flatMap((x) => x.electives.map((g) => g.id))).size).toBe(3)
  })

  it('upgrades a version 1 plan without tracks to a single plan', () => {
    const p = normalize({ courses: [], plans: [{ name: 'BA', groups: [{ kind: 'core', required: ['a'], options: [] }] }] })
    expect(p.plans).toHaveLength(1)
    expect(p.plans[0]).toMatchObject({ name: 'BA', required: ['a'], electives: [] })
  })
})

describe('sample program', () => {
  it('only references topics and courses that exist', () => {
    const p = sampleProgram()
    const courseIds = new Set(p.courses.map((c) => c.id))
    for (const c of p.courses) for (const t of c.coverage) expect(TOPIC_BY_ID.has(t), t).toBe(true)
    for (const plan of p.plans)
      for (const id of [...plan.required, ...plan.electives.flatMap((g) => g.options)]) expect(courseIds.has(id)).toBe(true)
  })
})

describe('editing actions', () => {
  beforeEach(() => {
    const p = emptyProgram()
    p.courses = [course('a', []), course('b', [])]
    p.plans = [{ id: 'p', name: 'BS', description: '', required: ['a'], electives: [{ id: 'g', name: 'E', choose: 1, options: ['a', 'b'] }] }]
    setState({ program: p, file: { name: 'x.curriculum.json', mode: 'download', dirty: false, connected: true, saving: false, error: null } })
  })

  it('marks the file dirty on edit', () => {
    setCoverage('a', ids('OS-Memory'), true)
    expect(getState().file?.dirty).toBe(true)
    expect(getState().program!.courses[0].coverage).toEqual(ids('OS-Memory'))
  })

  it('adds and removes coverage without duplicates', () => {
    const t = ids('OS-Memory')
    setCoverage('a', t, true)
    setCoverage('a', t, true)
    setCoverage('a', [t[0]], false)
    expect(getState().program!.courses[0].coverage).toEqual(t.slice(1))
  })

  it('removes a deleted course from every plan', () => {
    deleteCourse('a')
    const p = getState().program!
    expect(p.courses.map((c) => c.id)).toEqual(['b'])
    expect(p.plans[0].required).toEqual([])
    expect(p.plans[0].electives[0].options).toEqual(['b'])
  })

  it('duplicates a plan as an independent copy', () => {
    const id = addPlan('Copy', getState().program!.plans[0])
    const [orig, copy] = getState().program!.plans
    expect(copy.id).toBe(id)
    expect(copy.required).toEqual(orig.required)
    expect(copy.electives[0].id).not.toBe(orig.electives[0].id)
    copy.required.push('b')
    expect(orig.required).toEqual(['a'])
  })
})
