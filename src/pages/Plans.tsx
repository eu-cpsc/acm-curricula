import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { analyzePlan, pct, planCourseIds } from '../coverage'
import { addPlan, deletePlan, useData } from '../store'
import { Bar } from '../components/common'

export default function Plans() {
  const data = useData()
  const nav = useNavigate()
  const [name, setName] = useState('')

  return (
    <div className="page">
      <h1>Degree Plans</h1>
      <form
        className="toolbar add-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) nav(`/plans/${addPlan(name.trim())}`)
        }}
      >
        <input className="grow" placeholder="Plan name, e.g. B.S. Computer Science" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" type="submit">
          Add plan
        </button>
      </form>
      {data.plans.length === 0 && <div className="empty">No degree plans yet.</div>}
      {data.plans.length > 0 && (
        <table className="grid">
          <thead>
            <tr>
              <th>Plan</th>
              <th className="r">Courses</th>
              <th>Groups</th>
              <th>CS Core guaranteed</th>
              <th>KA Core guaranteed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.plans.map((p) => {
              const a = analyzePlan(p, data.courses, null)
              const tot = (t: 'cs' | 'ka') => Object.values(a.totals[t]).reduce((s, n) => s + n, 0)
              return (
                <tr key={p.id}>
                  <td>
                    <Link to={`/plans/${p.id}`}>
                      <b>{p.name}</b>
                    </Link>
                    {p.description && <div className="muted small">{p.description}</div>}
                  </td>
                  <td className="r">{planCourseIds(p).size}</td>
                  <td className="small">{p.groups.map((g) => g.name).join(', ')}</td>
                  {(['cs', 'ka'] as const).map((t) => (
                    <td key={t} className="nowrap">
                      <Bar
                        total={tot(t)}
                        segments={[
                          { value: a.totals[t].guaranteed, className: 'seg-guaranteed', label: 'Guaranteed' },
                          { value: a.totals[t].track, className: 'seg-track', label: 'Some tracks' },
                          { value: a.totals[t].elective, className: 'seg-elective', label: 'Elective only' },
                        ]}
                      />{' '}
                      {pct(a.totals[t].guaranteed, tot(t))}%
                    </td>
                  ))}
                  <td className="r">
                    <button className="link danger" onClick={() => confirm(`Delete plan "${p.name}"?`) && deletePlan(p.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
