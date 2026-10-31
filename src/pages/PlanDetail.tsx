import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KAS, TIER_LABEL, type Tier, type Topic } from '../bok'
import { analyzePlan, PLAN_STATUS_LABEL, planCourseIds, type PlanStatus } from '../coverage'
import {
  compareCourses,
  courseLabel,
  deletePlan,
  GROUP_KIND_LABEL,
  newId,
  updateGroup,
  updatePlan,
  useData,
  type Course,
  type DegreePlan,
  type GroupKind,
  type RequirementGroup,
} from '../store'
import { BokFilters, BokTree, useBokFilters } from '../components/BokTree'
import { Bar, CourseChip, EditableText } from '../components/common'

const STATUSES: PlanStatus[] = ['guaranteed', 'track', 'elective', 'none']

export default function PlanDetail() {
  const { id } = useParams()
  const data = useData()
  const nav = useNavigate()
  const plan = data.plans.find((p) => p.id === id)
  const [trackId, setTrackId] = useState<string>('')
  const [show, setShow] = useState<'all' | 'notGuaranteed' | 'none'>('notGuaranteed')
  const [f, setF] = useBokFilters({ tiers: new Set<Tier>(['cs']) })

  const analysis = useMemo(() => (plan ? analyzePlan(plan, data.courses, trackId || null) : null), [plan, data.courses, trackId])
  const topicFilter = useCallback(
    (t: Topic) => {
      const s = analysis?.status.get(t.id)
      return show === 'all' || (show === 'none' ? s === 'none' : s !== 'guaranteed')
    },
    [analysis, show],
  )

  if (!plan || !analysis) {
    return (
      <div className="page">
        <p>
          Plan not found. <Link to="/plans">Back to plans</Link>
        </p>
      </div>
    )
  }

  const tracks = plan.groups.filter((g) => g.kind === 'track')
  const ids = planCourseIds(plan)
  const planCourses = data.courses.filter((c) => ids.has(c.id)).sort(compareCourses)
  const byId = new Map(data.courses.map((c) => [c.id, c]))

  const addGroup = (kind: GroupKind) =>
    updatePlan(plan.id, (p) => ({
      ...p,
      groups: [
        ...p.groups,
        {
          id: newId(),
          kind,
          name: kind === 'track' ? 'New track' : kind === 'elective' ? 'Electives' : 'Core',
          description: '',
          required: [],
          options: [],
          choose: kind === 'core' ? 0 : 1,
        },
      ],
    }))

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/plans">Degree plans</Link> /
      </div>
      <div className="course-head">
        <EditableText className="title" value={plan.name} onSave={(v) => updatePlan(plan.id, (p) => ({ ...p, name: v }))} />
        <span className="spacer" />
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
        placeholder="Plan description…"
        onSave={(v) => updatePlan(plan.id, (p) => ({ ...p, description: v }))}
      />

      <CreditSummary plan={plan} byId={byId} />

      <h2>Requirements</h2>
      <div className="groups">
        {plan.groups.map((g, i) => (
          <GroupEditor key={g.id} plan={plan} group={g} index={i} courses={data.courses} byId={byId} />
        ))}
      </div>
      <div className="toolbar">
        <button onClick={() => addGroup('core')}>+ Core group</button>
        <button onClick={() => addGroup('elective')}>+ Elective group</button>
        <button onClick={() => addGroup('track')}>+ Track</button>
      </div>

      <h2>CS2023 coverage</h2>
      <div className="toolbar">
        <label>
          Analyze for:{' '}
          <select value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            <option value="">Any student{tracks.length ? ' (all tracks)' : ''}</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                Student in track: {t.name}
              </option>
            ))}
          </select>
        </label>
        <span className="legend">
          {STATUSES.map((s) => (
            <span key={s}>
              <i className={`sw seg-${s}`} /> {PLAN_STATUS_LABEL[s]}
            </span>
          ))}
        </span>
      </div>
      <p className="muted small">
        <b>Guaranteed</b>: covered by a course every student takes (core, required, or{' '}
        {trackId ? 'required in this track' : 'required in every track'}). <b>Some tracks</b>: required only in some tracks.{' '}
        <b>Elective only</b>: covered only by an optional course.
      </p>
      <table className="grid compact">
        <thead>
          <tr>
            <th>KA</th>
            <th>Name</th>
            {(['cs', 'ka'] as const).map((t) => (
              <th key={t}>{TIER_LABEL[t]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KAS.map((ka) => {
            const rec = analysis.byKa.get(ka.code)!
            return (
              <tr key={ka.code} className="clickable" onClick={() => setF({ ka: ka.code })} title="Show these topics below">
                <td className="code">{ka.code}</td>
                <td>{ka.name}</td>
                {(['cs', 'ka'] as const).map((t) => (
                  <td key={t}>
                    <StatusBar counts={rec[t]} />
                  </td>
                ))}
              </tr>
            )
          })}
          <tr className="total">
            <td />
            <td>
              <b>All knowledge areas</b>
            </td>
            {(['cs', 'ka'] as const).map((t) => (
              <td key={t}>
                <StatusBar counts={analysis.totals[t]} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <h2>Topic detail</h2>
      <BokFilters f={f} set={setF}>
        <select value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
          <option value="notGuaranteed">Gaps: not guaranteed</option>
          <option value="none">Not covered by plan at all</option>
          <option value="all">All statuses</option>
        </select>
      </BokFilters>
      <p className="muted small">Course chips are limited to courses in this plan. Row color shows plan status.</p>
      <BokTree filters={f} courses={planCourses} planStatus={analysis.status} tracksFor={analysis.tracksFor} topicFilter={topicFilter} />
    </div>
  )
}

function StatusBar({ counts }: { counts: Record<PlanStatus, number> }) {
  const total = STATUSES.reduce((s, k) => s + counts[k], 0)
  if (!total) return <span className="muted">—</span>
  return (
    <span className="cov-cell">
      <Bar
        total={total}
        width={140}
        segments={STATUSES.filter((s) => s !== 'none').map((s) => ({ value: counts[s], className: `seg-${s}`, label: PLAN_STATUS_LABEL[s] }))}
      />
      <span className="num">
        {counts.guaranteed}/{total}
      </span>
    </span>
  )
}

function minCredits(g: RequirementGroup, byId: Map<string, Course>) {
  const req = g.required.reduce((s, id) => s + (byId.get(id)?.credits ?? 0), 0)
  const opts = g.options
    .map((id) => byId.get(id)?.credits ?? 0)
    .sort((a, b) => a - b)
    .slice(0, g.choose)
  return req + opts.reduce((s, n) => s + n, 0)
}

function CreditSummary({ plan, byId }: { plan: DegreePlan; byId: Map<string, Course> }) {
  const common = plan.groups.filter((g) => g.kind !== 'track').reduce((s, g) => s + minCredits(g, byId), 0)
  const tracks = plan.groups.filter((g) => g.kind === 'track')
  return (
    <div className="cards">
      <div className="card">
        <h3>Credits (minimum)</h3>
        <div>
          <b>{common}</b> <span className="muted small">core &amp; electives (all students)</span>
        </div>
        {tracks.map((t) => (
          <div key={t.id}>
            <b>{common + minCredits(t, byId)}</b> <span className="muted small">with track “{t.name}” (+{minCredits(t, byId)})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupEditor({
  plan,
  group: g,
  index,
  courses,
  byId,
}: {
  plan: DegreePlan
  group: RequirementGroup
  index: number
  courses: Course[]
  byId: Map<string, Course>
}) {
  const set = (patch: Partial<RequirementGroup>) => updateGroup(plan.id, g.id, patch)
  const move = (dir: -1 | 1) =>
    updatePlan(plan.id, (p) => {
      const groups = [...p.groups]
      const j = index + dir
      if (j < 0 || j >= groups.length) return p
      ;[groups[index], groups[j]] = [groups[j], groups[index]]
      return { ...p, groups }
    })
  const used = new Set([...g.required, ...g.options])
  const available = courses.filter((c) => !used.has(c.id)).sort(compareCourses)

  const list = (key: 'required' | 'options', label: string) => (
    <div className="course-list">
      <div className="small muted">{label}</div>
      <div className="chips">
        {g[key]
          .map((id) => byId.get(id))
          .filter((c): c is Course => !!c)
          .sort(compareCourses)
          .map((c) => (
            <span key={c.id} className="chip-wrap">
              <CourseChip course={c} />
              <button className="x" title="Remove" onClick={() => set({ [key]: g[key].filter((x) => x !== c.id) })}>
                ×
              </button>
            </span>
          ))}
        <select
          value=""
          onChange={(e) => e.target.value && set({ [key]: [...g[key], e.target.value] })}
          className="add-select"
        >
          <option value="">+ add course</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {courseLabel(c)} {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  return (
    <div className={`group group-${g.kind}`}>
      <div className="group-head">
        <select value={g.kind} onChange={(e) => set({ kind: e.target.value as GroupKind })}>
          {(Object.keys(GROUP_KIND_LABEL) as GroupKind[]).map((k) => (
            <option key={k} value={k}>
              {GROUP_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <EditableText className="group-name" value={g.name} onSave={(v) => set({ name: v })} />
        <span className="muted small">min {minCredits(g, byId)} cr</span>
        <button className="link" onClick={() => move(-1)} disabled={index === 0} title="Move up">
          ↑
        </button>
        <button className="link" onClick={() => move(1)} disabled={index === plan.groups.length - 1} title="Move down">
          ↓
        </button>
        <button
          className="link danger"
          onClick={() =>
            confirm(`Remove group "${g.name}"?`) && updatePlan(plan.id, (p) => ({ ...p, groups: p.groups.filter((x) => x.id !== g.id) }))
          }
        >
          Remove
        </button>
      </div>
      <EditableText value={g.description} placeholder="Notes…" className="group-desc" onSave={(v) => set({ description: v })} />
      {list('required', g.kind === 'track' ? 'Required in this track' : 'Required courses')}
      {(g.kind !== 'core' || g.options.length > 0) && (
        <>
          <div className="small choose">
            Choose{' '}
            <input
              type="number"
              min={0}
              value={g.choose}
              onChange={(e) => set({ choose: Math.max(0, Number(e.target.value) || 0) })}
              style={{ width: 50 }}
            />{' '}
            of {g.options.length} options
          </div>
          {list('options', 'Options')}
        </>
      )}
    </div>
  )
}
