import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { analyzePlan, planCredits } from '../coverage'
import { addPlan, deletePlan, useData } from '../store'
import { StatusBar } from './PlanDetail'

export default function Plans() {
  const data = useData()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [copyFrom, setCopyFrom] = useState('')

  return (
    <div className="page">
      <div className="page-head">
        <h1>Degree Plans</h1>
        {data.plans.length > 1 && (
          <Link to="/compare" className="button">
            Compare plans →
          </Link>
        )}
      </div>
      <p className="muted small">
        Each plan is one path through the program: its required courses plus groups of electives. Model tracks or concentrations as
        separate plans (duplicate a plan to start a new track).
      </p>
      <form
        className="toolbar add-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          nav(`/plans/${addPlan(name.trim(), data.plans.find((p) => p.id === copyFrom))}`)
        }}
      >
        <input className="grow" placeholder="Plan name, e.g. B.S. Computer Science – Cybersecurity" value={name} onChange={(e) => setName(e.target.value)} />
        {data.plans.length > 0 && (
          <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
            <option value="">Start empty</option>
            {data.plans.map((p) => (
              <option key={p.id} value={p.id}>
                Copy of {p.name}
              </option>
            ))}
          </select>
        )}
        <button className="primary" type="submit">
          Add plan
        </button>
      </form>
      {data.plans.length === 0 ? (
        <div className="empty">No degree plans yet.</div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Plan</th>
              <th className="r">Required</th>
              <th>Electives</th>
              <th className="r">Min credits</th>
              <th>CS Core covered</th>
              <th>KA Core covered</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.plans.map((p) => {
              const a = analyzePlan(p, data.courses)
              return (
                <tr key={p.id}>
                  <td>
                    <Link to={`/plans/${p.id}`}>
                      <b>{p.name}</b>
                    </Link>
                    {p.description && <div className="muted small">{p.description}</div>}
                  </td>
                  <td className="r">{p.required.length}</td>
                  <td className="small">{p.electives.map((g) => `${g.name}: ${g.choose} of ${g.options.length}`).join('; ') || '—'}</td>
                  <td className="r">{planCredits(p, data.courses).total}</td>
                  <td>
                    <StatusBar counts={a.totals.cs} width={110} />
                  </td>
                  <td>
                    <StatusBar counts={a.totals.ka} width={110} />
                  </td>
                  <td className="r nowrap">
                    <button className="link" onClick={() => nav(`/plans/${addPlan(`${p.name} (copy)`, p)}`)}>
                      Duplicate
                    </button>
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
