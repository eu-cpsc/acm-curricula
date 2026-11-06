import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KAS, TOPIC_BY_ID } from '../bok'
import { planHasCourse } from '../coverage'
import { addCourse, compareCourses, courseLabel, deleteCourse, useData } from '../store'
import { TierBadge } from '../components/common'

export default function Courses() {
  const data = useData()
  const nav = useNavigate()
  const [form, setForm] = useState({ dept: data.courses[0]?.dept ?? 'CPSC', number: '', name: '', credits: '3' })
  const sorted = [...data.courses].sort(compareCourses)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.number.trim() || !form.name.trim()) return
    const id = addCourse({
      dept: form.dept.trim().toUpperCase(),
      number: form.number.trim(),
      name: form.name.trim(),
      credits: form.credits === '' ? null : Number(form.credits),
      description: '',
    })
    nav(`/courses/${id}`)
  }

  return (
    <div className="page">
      <h1>Courses</h1>
      <form className="toolbar add-form" onSubmit={submit}>
        <input placeholder="Dept" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} size={6} />
        <input placeholder="Number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} size={6} />
        <input
          placeholder="Course name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="grow"
        />
        <input
          placeholder="Cr"
          type="number"
          min={0}
          step="any"
          value={form.credits}
          onChange={(e) => setForm({ ...form, credits: e.target.value })}
          style={{ width: 60 }}
          title="Credit hours"
        />
        <button type="submit" className="primary">
          Add course
        </button>
      </form>

      {sorted.length === 0 ? (
        <div className="empty">No courses yet.</div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Course</th>
              <th>Name</th>
              <th className="r">Cr</th>
              <th>Knowledge areas (topics)</th>
              <th className="r">Topics</th>
              <th>Plans</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const tiers = { cs: 0, ka: 0, non: 0 }
              const byKa = new Map<string, number>()
              for (const id of c.coverage) {
                const t = TOPIC_BY_ID.get(id)
                if (!t) continue
                tiers[t.tier]++
                byKa.set(t.kaCode, (byKa.get(t.kaCode) ?? 0) + 1)
              }
              const plans = data.plans.filter((p) => planHasCourse(p, c.id))
              return (
                <tr key={c.id}>
                  <td className="nowrap">
                    <Link to={`/courses/${c.id}`}>
                      <b>{courseLabel(c)}</b>
                    </Link>
                  </td>
                  <td>
                    <Link to={`/courses/${c.id}`}>{c.name}</Link>
                  </td>
                  <td className="r">{c.credits ?? ''}</td>
                  <td>
                    {KAS.filter((k) => byKa.has(k.code)).map((k) => (
                      <span key={k.code} className="ka-pill" title={k.name}>
                        {k.code} <span className="muted">{byKa.get(k.code)}</span>
                      </span>
                    ))}
                  </td>
                  <td className="r nowrap">
                    {(['cs', 'ka', 'non'] as const).map((t) =>
                      tiers[t] ? (
                        <span key={t} className="tier-count">
                          <TierBadge tier={t} /> {tiers[t]}
                        </span>
                      ) : null,
                    )}
                  </td>
                  <td className="small">
                    {plans.map((p) => (
                      <Link key={p.id} to={`/plans/${p.id}`} className="plan-link">
                        {p.name}
                      </Link>
                    ))}
                  </td>
                  <td className="r">
                    <button
                      className="link danger"
                      onClick={() => confirm(`Delete ${courseLabel(c)} ${c.name}?`) && deleteCourse(c.id)}
                    >
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
