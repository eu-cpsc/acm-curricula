import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { KAS } from '../bok'
import { coverageIndex } from '../coverage'
import { courseLabel, type Course } from '../store'
import type { BokFilterState } from './BokTree'

/** Compact grid: knowledge units (rows) x courses (columns). */
export function BokMatrix({ filters, courses }: { filters: BokFilterState; courses: Course[] }) {
  const idx = coverageIndex(courses)
  const sets = new Map(courses.map((c) => [c.id, new Set(c.coverage)]))
  const q = filters.search.trim().toLowerCase()

  if (courses.length === 0) return <div className="empty">Add courses to see the coverage matrix.</div>

  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th className="sticky-col">Knowledge unit</th>
            <th title="Topics covered by any course / topics in unit">Any</th>
            {courses.map((c) => (
              <th key={c.id} className="vert">
                <Link to={`/courses/${c.id}`} title={c.name}>
                  <span>{courseLabel(c)}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KAS.filter((k) => !filters.ka || k.code === filters.ka).map((ka) => {
            const rows = ka.units
              .map((u) => ({ u, topics: u.topics.filter((t) => filters.tiers.has(t.tier)) }))
              .filter(({ u, topics }) => topics.length > 0 && (!q || u.name.toLowerCase().includes(q) || u.code.toLowerCase().includes(q)))
              .filter(({ topics }) => {
                const any = topics.some((t) => idx.has(t.id))
                if (filters.coverage === 'covered') return any
                if (filters.coverage === 'uncovered') return topics.some((t) => !idx.has(t.id))
                return true
              })
            if (!rows.length) return null
            return (
              <Fragment key={ka.code}>
                <tr className="ka-row">
                  <th className="sticky-col" colSpan={1}>
                    {ka.code} — {ka.name}
                  </th>
                  <td colSpan={courses.length + 1} />
                </tr>
                {rows.map(({ u, topics }) => {
                  const any = topics.filter((t) => idx.has(t.id)).length
                  return (
                    <tr key={u.code}>
                      <th className="sticky-col unit" title={u.name}>
                        <span className="code">{u.code}</span> <span className="name">{u.name}</span>
                      </th>
                      <td className="cell any" style={heat(any / topics.length)} title={`${any} of ${topics.length} topics covered`}>
                        {any}/{topics.length}
                      </td>
                      {courses.map((c) => {
                        const s = sets.get(c.id)!
                        const n = topics.filter((t) => s.has(t.id)).length
                        return (
                          <td
                            key={c.id}
                            className="cell"
                            style={heat(n / topics.length)}
                            title={`${courseLabel(c)} — ${u.code}: ${n} of ${topics.length} topics`}
                          >
                            {n || ''}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function heat(frac: number): React.CSSProperties {
  if (frac <= 0) return {}
  return { background: `rgba(37, 99, 235, ${0.12 + frac * 0.68})`, color: frac > 0.55 ? '#fff' : undefined }
}
