import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KAS, TIER_LABEL, TIERS, type Tier } from '../bok'
import { analyzePlan, PLAN_STATUS_LABEL, PLAN_STATUSES, planCredits, sumCounts, type PlanStatus } from '../coverage'
import { useData } from '../store'
import { StatusBar } from './PlanDetail'
import { TierBadge } from '../components/common'

const covered = (s: PlanStatus | undefined) => s === 'required'

export default function Compare() {
  const data = useData()
  const [picked, setPicked] = useState<Set<string>>(() => new Set(data.plans.map((p) => p.id)))
  const [tier, setTier] = useState<Tier>('cs')
  const [openKa, setOpenKa] = useState<string | null>(null)

  const plans = data.plans.filter((p) => picked.has(p.id))
  const analyses = useMemo(() => plans.map((p) => analyzePlan(p, data.courses)), [plans, data.courses])

  if (data.plans.length === 0) {
    return (
      <div className="page">
        <h1>Compare Plans</h1>
        <div className="empty">
          Add <Link to="/plans">degree plans</Link> to compare them.
        </div>
      </div>
    )
  }

  // Topics where the chosen plans disagree (guaranteed in some but not all).
  const diffs = KAS.flatMap((ka) =>
    ka.topics
      .filter((t) => t.tier === tier)
      .filter((t) => {
        const n = analyses.filter((a) => covered(a.status.get(t.id))).length
        return n > 0 && n < analyses.length
      })
      .map((t) => ({ ka, t })),
  )

  return (
    <div className="page wide">
      <h1>Compare Plans</h1>
      <div className="toolbar">
        <span className="chips">
          {data.plans.map((p) => (
            <label key={p.id} className={`pick ${picked.has(p.id) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={picked.has(p.id)}
                onChange={() => {
                  const s = new Set(picked)
                  if (s.has(p.id)) s.delete(p.id)
                  else s.add(p.id)
                  setPicked(s)
                }}
              />
              {p.name}
            </label>
          ))}
        </span>
        <span className="seg-toggle">
          {TIERS.map((t) => (
            <label key={t} className={tier === t ? 'on' : ''}>
              <input type="radio" checked={tier === t} onChange={() => setTier(t)} />
              {TIER_LABEL[t]}
            </label>
          ))}
        </span>
      </div>
      <p className="muted small">
        Bars show {TIER_LABEL[tier]} topics guaranteed for every student (green) and covered only by some elective choices (amber).
        Click a knowledge area to see its units.
      </p>

      {plans.length > 0 && (
        <div className="table-scroll">
          <table className="grid compact compare">
            <thead>
              <tr>
                <th>Knowledge area</th>
                {plans.map((p) => (
                  <th key={p.id}>
                    <Link to={`/plans/${p.id}`}>{p.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="meta">
                <td className="muted">Minimum credits</td>
                {plans.map((p) => (
                  <td key={p.id}>{planCredits(p, data.courses).total}</td>
                ))}
              </tr>
              <tr className="total">
                <td>
                  <b>All knowledge areas</b>
                </td>
                {analyses.map((a, i) => (
                  <td key={plans[i].id}>
                    <StatusBar counts={a.totals[tier]} width={120} />
                  </td>
                ))}
              </tr>
              {KAS.map((ka) => {
                if (!ka.topics.some((t) => t.tier === tier)) return null
                const open = openKa === ka.code
                return (
                  <Fragment key={ka.code}>
                    <tr className="clickable" onClick={() => setOpenKa(open ? null : ka.code)}>
                      <td>
                        <span className="caret">{open ? '▾' : '▸'}</span> <span className="code">{ka.code}</span> {ka.name}
                      </td>
                      {analyses.map((a, i) => (
                        <td key={plans[i].id}>
                          <StatusBar counts={a.byKa.get(ka.code)![tier]} width={120} />
                        </td>
                      ))}
                    </tr>
                    {open &&
                      ka.units
                        .filter((u) => u.topics.some((t) => t.tier === tier))
                        .map((u) => (
                          <tr key={u.code} className="sub">
                            <td className="small">
                              <span className="code muted">{u.code}</span> {u.name}
                            </td>
                            {analyses.map((a, i) => {
                              const counts = { required: 0, selected: 0, elective: 0, none: 0 }
                              u.topics.filter((t) => t.tier === tier).forEach((t) => counts[a.status.get(t.id)!]++)
                              return (
                                <td key={plans[i].id}>
                                  {sumCounts(counts) ? <StatusBar counts={counts} width={80} /> : null}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {plans.length > 1 && (
        <>
          <h2>
            Where the plans differ <span className="muted small">({diffs.length} {TIER_LABEL[tier]} topics guaranteed by some plans but not all)</span>
          </h2>
          {diffs.length === 0 ? (
            <div className="empty">The selected plans guarantee the same {TIER_LABEL[tier]} topics.</div>
          ) : (
            <div className="table-scroll">
              <table className="grid compact diff">
                <thead>
                  <tr>
                    <th>Topic</th>
                    {plans.map((p) => (
                      <th key={p.id} className="r" title={p.name}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diffs.map(({ ka, t }, i) => (
                    <Fragment key={t.id}>
                      {(i === 0 || diffs[i - 1].ka !== ka) && (
                        <tr className="group-row">
                          <td colSpan={plans.length + 1}>
                            <b>{ka.code}</b> {ka.name}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="small">
                          <TierBadge tier={t.tier} /> <span className="code muted">{t.unitCode}</span> {t.text}
                        </td>
                        {analyses.map((a, j) => {
                          const s = a.status.get(t.id)!
                          return (
                            <td key={plans[j].id} className="r">
                              <i className={`sw seg-${s}`} title={PLAN_STATUS_LABEL[s]} />
                            </td>
                          )
                        })}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="legend small">
            {PLAN_STATUSES.filter((s) => s !== 'selected').map((s) => (
              <span key={s}>
                <i className={`sw seg-${s}`} /> {PLAN_STATUS_LABEL[s]}
              </span>
            ))}
          </p>
        </>
      )}
    </div>
  )
}
