import { Link } from 'react-router-dom'
import { KAS, TOPICS, TIERS, TIER_LABEL } from '../bok'
import { countCovered, coverageIndex, pct } from '../coverage'
import { compareCourses, useData } from '../store'
import { CourseChip, CoverageCell } from '../components/common'
import { loadSample } from '../sample'

export default function Dashboard() {
  const data = useData()
  const idx = coverageIndex(data.courses)
  const all = countCovered(TOPICS, (t) => idx.has(t.id))

  return (
    <div className="page">
      <h1>Overview</h1>
      {data.courses.length === 0 && (
        <div className="callout">
          No courses yet. <Link to="/courses">Add your courses</Link>, then assign CS2023 topics to each one — or{' '}
          <button className="link" onClick={loadSample}>
            load sample data
          </button>{' '}
          to explore.
        </div>
      )}
      <div className="stats">
        <Stat label="Courses" value={data.courses.length} to="/courses" />
        <Stat label="Degree plans" value={data.plans.length} to="/plans" />
        {TIERS.map((t) => (
          <Stat
            key={t}
            label={`${TIER_LABEL[t]} topics covered`}
            value={`${pct(all[t].covered, all[t].total)}%`}
            sub={`${all[t].covered} of ${all[t].total}`}
            to="/knowledge"
          />
        ))}
      </div>

      <h2>Coverage by knowledge area</h2>
      <p className="muted small">Counts are topics covered by at least one course.</p>
      <table className="grid">
        <thead>
          <tr>
            <th>KA</th>
            <th>Name</th>
            <th className="r">Units</th>
            {TIERS.map((t) => (
              <th key={t}>{TIER_LABEL[t]}</th>
            ))}
            <th>Courses</th>
          </tr>
        </thead>
        <tbody>
          {KAS.map((ka) => {
            const c = countCovered(ka.topics, (t) => idx.has(t.id))
            const courses = data.courses.filter((co) => co.coverage.some((id) => id.startsWith(ka.code + '-'))).sort(compareCourses)
            return (
              <tr key={ka.code}>
                <td className="code">{ka.code}</td>
                <td>{ka.name}</td>
                <td className="r">{ka.units.length}</td>
                {TIERS.map((t) => (
                  <td key={t}>
                    <CoverageCell covered={c[t].covered} total={c[t].total} />
                  </td>
                ))}
                <td className="chips">
                  {courses.map((co) => (
                    <CourseChip key={co.id} course={co} />
                  ))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value, sub, to }: { label: string; value: string | number; sub?: string; to: string }) {
  return (
    <Link to={to} className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </Link>
  )
}
