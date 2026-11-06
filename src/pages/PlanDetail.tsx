import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KAS, TIER_LABEL, type Tier, type Topic } from '../bok'
import { analyzePlan, PLAN_STATUS_LABEL, PLAN_STATUSES, planCourseIds, planCredits, sumCounts, type PlanStatus, type StatusCounts } from '../coverage'
import {
  addPlan,
  compareCourses,
  courseLabel,
  deletePlan,
  newId,
  updateElectiveGroup,
  updatePlan,
  useData,
  type Course,
  type DegreePlan,
  type ElectiveGroup,
} from '../store'
import { BokFilters, BokTree, useBokFilters } from '../components/BokTree'
import { Bar, CourseChip, EditableText } from '../components/common'

export default function PlanDetail() {
  const { id } = useParams()
  const data = useData()
  const nav = useNavigate()
  const plan = data.plans.find((p) => p.id === id)
  const [whatIf, setWhatIf] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [show, setShow] = useState<'gaps' | 'none' | 'all'>('gaps')
  const [f, setF] = useBokFilters({ tiers: new Set<Tier>(['cs']) })

  const analysis = useMemo(
    () => (plan ? analyzePlan(plan, data.courses, whatIf ? selection : null) : null),
    [plan, data.courses, whatIf, selection],
  )
  const topicFilter = useCallback(
    (t: Topic) => {
      const s = analysis?.status.get(t.id)
      if (show === 'all') return true
      if (show === 'none') return s === 'none'
      return s !== 'required' && s !== 'selected'
    },
    [analysis, show],
  )

  if (!plan || !analysis) {
    return (
      <div className="page">
        <p>
          Plan not found. <Link to="/plans">Back to degree plans</Link>
        </p>
      </div>
    )
  }

  const byId = new Map(data.courses.map((c) => [c.id, c]))
  const ids = planCourseIds(plan)
  const planCourses = data.courses.filter((c) => ids.has(c.id)).sort(compareCourses)
  const credits = planCredits(plan, data.courses)
  const set = (fn: (p: DegreePlan) => DegreePlan) => updatePlan(plan.id, fn)

  const toggleSelected = (courseId: string) => {
    const s = new Set(selection)
    if (s.has(courseId)) s.delete(courseId)
    else s.add(courseId)
    setSelection(s)
  }

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/plans">Degree plans</Link> /
      </div>
      <div className="course-head">
        <EditableText className="title" value={plan.name} onSave={(v) => set((p) => ({ ...p, name: v }))} />
        <span className="spacer" />
        <button className="link" onClick={() => nav(`/plans/${addPlan(`${plan.name} (copy)`, plan)}`)}>
          Duplicate
        </button>
        <button
          className="link danger"
          onClick={() => {
            if (confirm(`Delete plan "${plan.name}"?`)) {
              deletePlan(plan.id)
              nav('/plans')
            }
          }}
        >
          Delete plan
        </button>
      </div>
      <EditableText
        multiline
        className="description"
        value={plan.description}
        placeholder="Notes about this plan…"
        onSave={(v) => set((p) => ({ ...p, description: v }))}
      />

      <div className="cards">
        <div className="card">
          <h3>Credits (minimum)</h3>
          <div className="tier-totals">
            <div>
              <b>{credits.total}</b> <span className="muted small">total</span>
            </div>
            <div>
              <b>{credits.required}</b> <span className="muted small">required</span>
            </div>
            <div>
              <b>{credits.electives}</b> <span className="muted small">electives</span>
            </div>
          </div>
        </div>
        {(['cs', 'ka'] as const).map((t) => (
          <div className="card" key={t}>
            <h3>{TIER_LABEL[t]} topics</h3>
            <StatusBar counts={analysis.totals[t]} width={180} />
          </div>
        ))}
      </div>

      <h2>Required courses</h2>
      <div className="group group-core">
        <CourseList ids={plan.required} byId={byId} onChange={(required) => set((p) => ({ ...p, required }))} exclude={ids} courses={data.courses} />
      </div>

      <h2>Electives</h2>
      <div className="groups">
        {plan.electives.map((g) => (
          <ElectiveEditor key={g.id} plan={plan} group={g} byId={byId} courses={data.courses} exclude={ids} />
        ))}
      </div>
      <div className="toolbar">
        <button
          onClick={() =>
            set((p) => ({ ...p, electives: [...p.electives, { id: newId(), name: 'Electives', choose: 1, options: [] }] }))
          }
        >
          + Elective group
        </button>
      </div>

      <h2>CS2023 coverage</h2>
      <div className="toolbar">
        <span className="seg-toggle">
          <label className={!whatIf ? 'on' : ''}>
            <input type="radio" checked={!whatIf} onChange={() => setWhatIf(false)} />
            Any student
          </label>
          <label className={whatIf ? 'on' : ''}>
            <input type="radio" checked={whatIf} onChange={() => setWhatIf(true)} />
            What-if: pick electives
          </label>
        </span>
        <span className="legend">
          {PLAN_STATUSES.filter((s) => whatIf || s !== 'selected').map((s) => (
            <span key={s}>
              <i className={`sw seg-${s}`} /> {PLAN_STATUS_LABEL[s]}
            </span>
          ))}
        </span>
      </div>
      {whatIf ? (
        <div className="whatif">
          {plan.electives.length === 0 && <p className="muted small">This plan has no electives.</p>}
          {plan.electives.map((g) => {
            const n = g.options.filter((o) => selection.has(o)).length
            return (
              <div key={g.id} className="whatif-group">
                <span className="small">
                  <b>{g.name}</b>{' '}
                  <span className={n === g.choose ? 'muted' : 'warn-text'}>
                    ({n} of {g.choose} picked)
                  </span>
                </span>
                <span className="chips">
                  {g.options
                    .map((o) => byId.get(o))
                    .filter((c): c is Course => !!c)
                    .sort(compareCourses)
                    .map((c) => (
                      <label key={c.id} className={`pick ${selection.has(c.id) ? 'on' : ''}`} title={c.name}>
                        <input type="checkbox" checked={selection.has(c.id)} onChange={() => toggleSelected(c.id)} />
                        {courseLabel(c)}
                      </label>
                    ))}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="muted small">
          <b>Guaranteed</b> means every student covers the topic: it is in a required course, or every allowed combination of electives
          includes it. <b>Elective only</b> means some students will cover it, depending on their choices.
        </p>
      )}

      <table className="grid compact">
        <thead>
          <tr>
            <th>KA</th>
            <th>Name</th>
            <th>{TIER_LABEL.cs}</th>
            <th>{TIER_LABEL.ka}</th>
          </tr>
        </thead>
        <tbody>
          {KAS.map((ka) => {
            const rec = analysis.byKa.get(ka.code)!
            return (
              <tr key={ka.code} className="clickable" onClick={() => setF({ ka: ka.code })} title="Show these topics below">
                <td className="code">{ka.code}</td>
                <td>{ka.name}</td>
                <td>
                  <StatusBar counts={rec.cs} />
                </td>
                <td>
                  <StatusBar counts={rec.ka} />
                </td>
              </tr>
            )
          })}
          <tr className="total">
            <td />
            <td>
              <b>All knowledge areas</b>
            </td>
            <td>
              <StatusBar counts={analysis.totals.cs} />
            </td>
            <td>
              <StatusBar counts={analysis.totals.ka} />
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Topics</h2>
      <BokFilters f={f} set={setF}>
        <select value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
          <option value="gaps">Gaps: not covered for every student</option>
          <option value="none">Not covered by the plan at all</option>
          <option value="all">All topics</option>
        </select>
      </BokFilters>
      <p className="muted small">Course chips show only courses in this plan. Row color shows coverage status.</p>
      <BokTree filters={f} courses={planCourses} planStatus={analysis.status} topicFilter={topicFilter} />
    </div>
  )
}

export function StatusBar({ counts, width = 140 }: { counts: StatusCounts; width?: number }) {
  const total = sumCounts(counts)
  if (!total) return <span className="muted">—</span>
  const covered = counts.required + counts.selected
  return (
    <span className="cov-cell">
      <Bar
        total={total}
        width={width}
        segments={(['required', 'selected', 'elective'] as PlanStatus[]).map((s) => ({
          value: counts[s],
          className: `seg-${s}`,
          label: PLAN_STATUS_LABEL[s],
        }))}
      />
      <span className="num" title="Covered for every student / total">
        {covered}/{total}
      </span>
    </span>
  )
}

function CourseList({
  ids,
  byId,
  onChange,
  exclude,
  courses,
}: {
  ids: string[]
  byId: Map<string, Course>
  onChange: (ids: string[]) => void
  exclude: Set<string>
  courses: Course[]
}) {
  const available = courses.filter((c) => !exclude.has(c.id)).sort(compareCourses)
  return (
    <div className="chips">
      {ids
        .map((id) => byId.get(id))
        .filter((c): c is Course => !!c)
        .sort(compareCourses)
        .map((c) => (
          <span key={c.id} className="chip-wrap">
            <CourseChip course={c} />
            <button className="x" title="Remove" onClick={() => onChange(ids.filter((x) => x !== c.id))}>
              ×
            </button>
          </span>
        ))}
      <select value="" onChange={(e) => e.target.value && onChange([...ids, e.target.value])} className="add-select">
        <option value="">+ add course</option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>
            {courseLabel(c)} {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function ElectiveEditor({
  plan,
  group: g,
  byId,
  courses,
  exclude,
}: {
  plan: DegreePlan
  group: ElectiveGroup
  byId: Map<string, Course>
  courses: Course[]
  exclude: Set<string>
}) {
  const set = (patch: Partial<ElectiveGroup>) => updateElectiveGroup(plan.id, g.id, patch)
  return (
    <div className="group group-elective">
      <div className="group-head">
        <EditableText className="group-name" value={g.name} onSave={(v) => set({ name: v })} />
        <span className="small choose">
          Choose{' '}
          <input
            type="number"
            min={0}
            value={g.choose}
            onChange={(e) => set({ choose: Math.max(0, Number(e.target.value) || 0) })}
            style={{ width: 50 }}
          />{' '}
          of {g.options.length}
        </span>
        <button
          className="link danger"
          onClick={() =>
            confirm(`Remove elective group "${g.name}"?`) &&
            updatePlan(plan.id, (p) => ({ ...p, electives: p.electives.filter((x) => x.id !== g.id) }))
          }
        >
          Remove
        </button>
      </div>
      <CourseList ids={g.options} byId={byId} onChange={(options) => set({ options })} exclude={exclude} courses={courses} />
    </div>
  )
}
