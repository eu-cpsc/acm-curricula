import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KAS, TIERS, TIER_LABEL, TOPIC_BY_ID, UNITS } from '../bok'
import { countCovered } from '../coverage'
import { courseLabel, deleteCourse, GROUP_KIND_LABEL, updateCourse, useData } from '../store'
import { BokFilters, BokTree, useBokFilters } from '../components/BokTree'
import { CourseChip, CoverageCell, EditableText, TierBadge } from '../components/common'

export default function CourseDetail() {
  const { id } = useParams()
  const data = useData()
  const nav = useNavigate()
  const course = data.courses.find((c) => c.id === id)
  const [f, setF] = useBokFilters({ coverage: course && course.coverage.length ? 'assigned' : 'all' })

  const covered = useMemo(() => new Set(course?.coverage ?? []), [course])

  if (!course) {
    return (
      <div className="page">
        <p>
          Course not found. <Link to="/courses">Back to courses</Link>
        </p>
      </div>
    )
  }

  const kaRows = KAS.map((ka) => ({ ka, counts: countCovered(ka.topics, (t) => covered.has(t.id)) })).filter(({ counts }) =>
    TIERS.some((t) => counts[t].covered > 0),
  )
  const units = UNITS.filter((u) => u.topics.some((t) => covered.has(t.id)))

  const overlap = data.courses
    .filter((c) => c.id !== course.id)
    .map((c) => ({ c, n: c.coverage.filter((t) => covered.has(t)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)

  const memberships = data.plans.flatMap((p) =>
    p.groups
      .filter((g) => g.required.includes(course.id) || g.options.includes(course.id))
      .map((g) => ({ p, g, role: g.required.includes(course.id) ? 'required' : `option (choose ${g.choose})` })),
  )

  const tierTotals = TIERS.map((t) => ({ t, n: course.coverage.filter((id) => TOPIC_BY_ID.get(id)?.tier === t).length }))

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/courses">Courses</Link> /
      </div>
      <div className="course-head">
        <EditableText className="dept" value={course.dept} onSave={(v) => updateCourse(course.id, { dept: v.toUpperCase() })} />
        <EditableText className="number" value={course.number} onSave={(v) => updateCourse(course.id, { number: v })} />
        <EditableText className="title" value={course.name} onSave={(v) => updateCourse(course.id, { name: v })} />
        <label className="credits">
          <input
            key={course.credits ?? ''}
            className="inline-edit"
            type="number"
            min={0}
            step="any"
            defaultValue={course.credits ?? ''}
            onBlur={(e) => updateCourse(course.id, { credits: e.target.value === '' ? null : Number(e.target.value) })}
          />
          credits
        </label>
        <span className="spacer" />
        <button
          className="link danger"
          onClick={() => {
            if (confirm(`Delete ${courseLabel(course)}?`)) {
              deleteCourse(course.id)
              nav('/courses')
            }
          }}
        >
          Delete course
        </button>
      </div>
      <EditableText
        multiline
        className="description"
        value={course.description}
        placeholder="Course description…"
        onSave={(v) => updateCourse(course.id, { description: v })}
      />

      <div className="cards">
        <div className="card">
          <h3>Topics covered</h3>
          <div className="tier-totals">
            {tierTotals.map(({ t, n }) => (
              <div key={t}>
                <TierBadge tier={t} /> <b>{n}</b> <span className="muted small">{TIER_LABEL[t]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Degree plans</h3>
          {memberships.length === 0 && <p className="muted small">Not part of any plan.</p>}
          {memberships.map(({ p, g, role }) => (
            <div key={p.id + g.id} className="small">
              <Link to={`/plans/${p.id}`}>{p.name}</Link> — {GROUP_KIND_LABEL[g.kind]} “{g.name}”, {role}
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Overlap with other courses</h3>
          {overlap.length === 0 && <p className="muted small">No shared topics.</p>}
          <div className="chips">
            {overlap.map(({ c, n }) => (
              <CourseChip key={c.id} course={c} extra={n} />
            ))}
          </div>
        </div>
      </div>

      {kaRows.length > 0 && (
        <>
          <h2>Knowledge areas</h2>
          <table className="grid compact">
            <thead>
              <tr>
                <th>KA</th>
                <th>Name</th>
                {TIERS.map((t) => (
                  <th key={t}>{TIER_LABEL[t]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kaRows.map(({ ka, counts }) => (
                <tr key={ka.code} className="clickable" onClick={() => setF({ ka: ka.code })} title="Filter topics below">
                  <td className="code">{ka.code}</td>
                  <td>{ka.name}</td>
                  {TIERS.map((t) => (
                    <td key={t}>
                      <CoverageCell covered={counts[t].covered} total={counts[t].total} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Topic coverage</h2>
      <p className="muted small">
        Tick topics (or whole units / knowledge areas) this course covers. Choose “All topics” to find new topics to add. Chips show
        other courses covering the same topic.
      </p>
      <BokFilters f={f} set={setF} assignMode />
      <BokTree filters={f} courses={data.courses} assignCourse={course} />

      {units.length > 0 && (
        <>
          <h2>Illustrative learning outcomes</h2>
          <p className="muted small">From CS2023 for each knowledge unit this course touches.</p>
          {units.map((u) => (
            <details key={u.code} className="outcomes">
              <summary>
                <span className="code">{u.code}</span> {u.name}{' '}
                <span className="muted small">
                  ({u.topics.filter((t) => covered.has(t.id)).length}/{u.topics.length} topics)
                </span>
              </summary>
              {TIERS.map((t) =>
                u.outcomes[t].length ? (
                  <div key={t}>
                    <div className="small">
                      <TierBadge tier={t} /> {TIER_LABEL[t]}
                    </div>
                    <ul>
                      {u.outcomes[t].map((o, i) => (
                        <li key={i} style={{ marginLeft: o.depth * 16 }}>
                          {o.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </details>
          ))}
        </>
      )}
    </div>
  )
}
