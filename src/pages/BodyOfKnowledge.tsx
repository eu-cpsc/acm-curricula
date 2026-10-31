import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BokFilters, BokTree, useBokFilters } from '../components/BokTree'
import { BokMatrix } from '../components/BokMatrix'
import { planCourseIds } from '../coverage'
import { compareCourses, courseLabel, useData } from '../store'

export default function BodyOfKnowledge() {
  const data = useData()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'matrix' ? 'matrix' : 'list'
  const [f, setF] = useBokFilters({ ka: params.get('ka') ?? '' })
  const [planId, setPlanId] = useState('')
  const [assignId, setAssignId] = useState('')

  const sorted = useMemo(() => [...data.courses].sort(compareCourses), [data.courses])
  const shown = useMemo(() => {
    const plan = data.plans.find((p) => p.id === planId)
    if (!plan) return sorted
    const ids = planCourseIds(plan)
    return sorted.filter((c) => ids.has(c.id))
  }, [sorted, data.plans, planId])
  const assignCourse = data.courses.find((c) => c.id === assignId) ?? null

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Knowledge Areas &amp; Topics</h1>
        <span className="seg-toggle">
          <label className={view === 'list' ? 'on' : ''}>
            <input type="radio" checked={view === 'list'} onChange={() => setParams({})} />
            Topic list
          </label>
          <label className={view === 'matrix' ? 'on' : ''}>
            <input type="radio" checked={view === 'matrix'} onChange={() => setParams({ view: 'matrix' })} />
            Unit × course matrix
          </label>
        </span>
      </div>
      <BokFilters f={f} set={setF} assignMode={!!assignCourse && view === 'list'}>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} title="Limit which courses are shown">
          <option value="">Courses: all</option>
          {data.plans.map((p) => (
            <option key={p.id} value={p.id}>
              Courses in: {p.name}
            </option>
          ))}
        </select>
        {view === 'list' && (
          <select
            value={assignId}
            onChange={(e) => setAssignId(e.target.value)}
            className={assignCourse ? 'assigning' : ''}
            title="Pick a course to tick topics it covers"
          >
            <option value="">Assign mode: off</option>
            {sorted.map((c) => (
              <option key={c.id} value={c.id}>
                Assign to {courseLabel(c)} {c.name}
              </option>
            ))}
          </select>
        )}
      </BokFilters>
      {view === 'list' ? (
        <BokTree filters={f} courses={shown} assignCourse={assignCourse} />
      ) : (
        <BokMatrix filters={f} courses={shown} />
      )}
    </div>
  )
}
