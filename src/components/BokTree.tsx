import { useEffect, useMemo, useState } from 'react'
import { KAS, TIERS, TIER_LABEL, type KnowledgeArea, type Tier, type Topic, type Unit } from '../bok'
import { coverageIndex, PLAN_STATUS_LABEL, type PlanStatus } from '../coverage'
import { compareCourses, setCoverage, type Course } from '../store'
import { Bar, CourseChip, TierBadge, TriCheckbox } from './common'

// ------------------------------------------------------------------ filters

export type CoverageFilter = 'all' | 'covered' | 'uncovered' | 'assigned' | 'unassigned'

export interface BokFilterState {
  search: string
  ka: string // '' = all
  tiers: Set<Tier>
  coverage: CoverageFilter
}

export function useBokFilters(init?: Partial<BokFilterState>) {
  const [f, setF] = useState<BokFilterState>({
    search: '',
    ka: '',
    tiers: new Set(TIERS),
    coverage: 'all',
    ...init,
  })
  return [f, (patch: Partial<BokFilterState>) => setF((prev) => ({ ...prev, ...patch }))] as const
}

export function BokFilters({
  f,
  set,
  assignMode,
  children,
}: {
  f: BokFilterState
  set: (p: Partial<BokFilterState>) => void
  assignMode?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="toolbar">
      <input
        type="search"
        className="search"
        placeholder="Search topics…"
        value={f.search}
        onChange={(e) => set({ search: e.target.value })}
      />
      <select value={f.ka} onChange={(e) => set({ ka: e.target.value })}>
        <option value="">All knowledge areas</option>
        {KAS.map((k) => (
          <option key={k.code} value={k.code}>
            {k.code} — {k.name}
          </option>
        ))}
      </select>
      <span className="seg-toggle">
        {TIERS.map((t) => (
          <label key={t} className={f.tiers.has(t) ? 'on' : ''} title={TIER_LABEL[t]}>
            <input
              type="checkbox"
              checked={f.tiers.has(t)}
              onChange={() => {
                const s = new Set(f.tiers)
                if (s.has(t)) s.delete(t)
                else s.add(t)
                set({ tiers: s })
              }}
            />
            {TIER_LABEL[t]}
          </label>
        ))}
      </span>
      <select value={f.coverage} onChange={(e) => set({ coverage: e.target.value as CoverageFilter })}>
        <option value="all">All topics</option>
        <option value="uncovered">Not covered by any course</option>
        <option value="covered">Covered by some course</option>
        {assignMode && <option value="assigned">Assigned to this course</option>}
        {assignMode && <option value="unassigned">Not assigned to this course</option>}
      </select>
      {children}
    </div>
  )
}

// --------------------------------------------------------------------- tree

interface Props {
  filters: BokFilterState
  /** Courses whose coverage is shown as chips. */
  courses: Course[]
  /** When set, checkboxes edit this course's coverage. */
  assignCourse?: Course | null
  /** Optional per-topic plan status, used to color rows. */
  planStatus?: Map<string, PlanStatus>
  tracksFor?: Map<string, string[]>
  /** Extra predicate applied on top of the filters. */
  topicFilter?: (t: Topic) => boolean
}

interface VisibleUnit {
  unit: Unit
  topics: Topic[]
}
interface VisibleKa {
  ka: KnowledgeArea
  units: VisibleUnit[]
  topics: Topic[]
}

export function BokTree({ filters, courses, assignCourse, planStatus, tracksFor, topicFilter }: Props) {
  const idx = coverageIndex(courses)
  const assigned = useMemo(() => new Set(assignCourse?.coverage ?? []), [assignCourse])
  const q = filters.search.trim().toLowerCase()
  const filtering = q !== '' || filters.coverage !== 'all' || !!topicFilter

  // Expand state: `open*` is the default, `toggled*` are the exceptions.
  const [openUnits, setOpenUnits] = useState(false)
  const [toggledUnits, setToggledUnits] = useState<Set<string>>(new Set())
  const [toggledKas, setToggledKas] = useState<Set<string>>(new Set())
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set())

  useEffect(() => {
    setOpenUnits(q !== '')
    setToggledUnits(new Set())
  }, [q])

  const toggle = (set: Set<string>, key: string) => {
    const s = new Set(set)
    if (s.has(key)) s.delete(key)
    else s.add(key)
    return s
  }

  const visible: VisibleKa[] = useMemo(() => {
    const match = (t: Topic, unitMatches: boolean) => {
      if (!filters.tiers.has(t.tier)) return false
      if (topicFilter && !topicFilter(t)) return false
      if (q && !unitMatches && !t.search.includes(q)) return false
      switch (filters.coverage) {
        case 'covered':
          return idx.has(t.id)
        case 'uncovered':
          return !idx.has(t.id)
        case 'assigned':
          return assigned.has(t.id)
        case 'unassigned':
          return !assigned.has(t.id)
      }
      return true
    }
    const out: VisibleKa[] = []
    for (const ka of KAS) {
      if (filters.ka && ka.code !== filters.ka) continue
      const units: VisibleUnit[] = []
      for (const unit of ka.units) {
        const unitMatches = q !== '' && (unit.name.toLowerCase().includes(q) || unit.code.toLowerCase().includes(q))
        const topics = unit.topics.filter((t) => match(t, unitMatches))
        if (topics.length) units.push({ unit, topics })
      }
      if (units.length) out.push({ ka, units, topics: units.flatMap((u) => u.topics) })
    }
    return out
  }, [filters, q, idx, assigned, topicFilter])

  const total = visible.reduce((s, k) => s + k.topics.length, 0)

  const assignBox = (topics: Topic[], title: string) => {
    if (!assignCourse) return null
    const n = topics.filter((t) => assigned.has(t.id)).length
    return (
      <TriCheckbox
        title={title}
        checked={n === topics.length && n > 0}
        indeterminate={n > 0 && n < topics.length}
        onChange={(on) =>
          setCoverage(
            assignCourse.id,
            topics.map((t) => t.id),
            on,
          )
        }
      />
    )
  }

  const chipsFor = (topics: Topic[]) => {
    const counts = new Map<Course, number>()
    for (const t of topics) for (const c of idx.get(t.id) ?? []) counts.set(c, (counts.get(c) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || compareCourses(a[0], b[0]))
  }

  return (
    <div className="bok">
      <div className="bok-head">
        <span className="muted">
          {total} topic{total === 1 ? '' : 's'}
          {filtering && ' match'}
        </span>
        <span className="spacer" />
        <button
          className="link"
          onClick={() => {
            setOpenUnits(true)
            setToggledUnits(new Set())
            setToggledKas(new Set())
          }}
        >
          Expand all
        </button>
        <button
          className="link"
          onClick={() => {
            setOpenUnits(false)
            setToggledUnits(new Set())
            setOpenTopics(new Set())
          }}
        >
          Collapse units
        </button>
      </div>
      {visible.length === 0 && <div className="empty">No topics match the current filters.</div>}
      {visible.map(({ ka, units, topics }) => {
        const kaOpen = !toggledKas.has(ka.code)
        const covered = topics.filter((t) => idx.has(t.id)).length
        return (
          <section key={ka.code} className="bok-ka">
            <div className="row ka-row" onClick={() => setToggledKas(toggle(toggledKas, ka.code))}>
              <span className="caret">{kaOpen ? '▾' : '▸'}</span>
              {assignBox(topics, `Assign all shown ${ka.code} topics`)}
              <span className="code">{ka.code}</span>
              <span className="name">{ka.name}</span>
              <span className="spacer" />
              <TierStats topics={topics} isCovered={(t) => idx.has(t.id)} />
              <Bar segments={[{ value: covered, className: 'seg-covered', label: 'Covered' }]} total={topics.length} width={100} />
            </div>
            {kaOpen &&
              units.map(({ unit, topics }) => {
                const open = openUnits !== toggledUnits.has(unit.code)
                const chips = chipsFor(topics)
                return (
                  <div key={unit.code} className="bok-unit">
                    <div className="row unit-row" onClick={() => setToggledUnits(toggle(toggledUnits, unit.code))}>
                      <span className="caret">{open ? '▾' : '▸'}</span>
                      {assignBox(topics, `Assign all shown ${unit.code} topics`)}
                      <span className="code" title={unit.code}>
                        {unit.code}
                      </span>
                      <span className="name">{unit.name}</span>
                      <span className="hours" title="CS Core hours / KA Core hours (from CS2023)">
                        {unit.hoursCs && <>CS {hrs(unit.hoursCs)}</>}
                        {unit.hoursCs && unit.hoursKa && ' · '}
                        {unit.hoursKa && <>KA {hrs(unit.hoursKa)}</>}
                      </span>
                      <span className="spacer" />
                      <span className="chips">
                        {chips.map(([c, n]) => (
                          <CourseChip key={c.id} course={c} extra={n} />
                        ))}
                      </span>
                      <span className="num muted" title="Topics covered by any course / topics shown">
                        {topics.filter((t) => idx.has(t.id)).length}/{topics.length}
                      </span>
                    </div>
                    {open &&
                      topics.map((t) => {
                        const tOpen = openTopics.has(t.id)
                        const cs = idx.get(t.id) ?? []
                        const ps = planStatus?.get(t.id)
                        return (
                          <div key={t.id}>
                            <div
                              className={`row topic-row ${tOpen ? 'open' : ''} ${ps ? `ps-${ps}` : cs.length ? '' : 'uncovered'}`}
                              onClick={() => setOpenTopics(toggle(openTopics, t.id))}
                              title={ps ? PLAN_STATUS_LABEL[ps] + (tracksFor?.get(t.id) ? ` (${tracksFor.get(t.id)!.join(', ')})` : '') : undefined}
                            >
                              {assignCourse && (
                                <input
                                  type="checkbox"
                                  className="cb"
                                  checked={assigned.has(t.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setCoverage(assignCourse.id, [t.id], e.target.checked)}
                                />
                              )}
                              <TierBadge tier={t.tier} />
                              <span className="text">
                                {t.text}
                                {t.subtopics.length > 0 && !tOpen && <span className="muted"> (+{t.subtopics.length})</span>}
                              </span>
                              <span className="chips">
                                {cs.map((c) => (
                                  <CourseChip key={c.id} course={c} />
                                ))}
                              </span>
                            </div>
                            {tOpen && t.subtopics.length > 0 && (
                              <ul className="subtopics">
                                {t.subtopics.map((s, i) => (
                                  <li key={i} style={{ marginLeft: s.depth * 16 }}>
                                    {s.text}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )
              })}
          </section>
        )
      })}
    </div>
  )
}

function TierStats({ topics, isCovered }: { topics: Topic[]; isCovered: (t: Topic) => boolean }) {
  const parts = TIERS.map((tier) => {
    const ts = topics.filter((t) => t.tier === tier)
    return { tier, total: ts.length, covered: ts.filter(isCovered).length }
  }).filter((p) => p.total > 0)
  return (
    <span className="tier-stats">
      {parts.map((p) => (
        <span key={p.tier} title={`${TIER_LABEL[p.tier]}: ${p.covered} of ${p.total} topics covered`}>
          <TierBadge tier={p.tier} /> {p.covered}/{p.total}
        </span>
      ))}
    </span>
  )
}

/** Hours strings come from PDF extraction; only add the unit to plain numbers. */
function hrs(h: string) {
  return /^[\d.]+$/.test(h) ? `${h}h` : h
}
