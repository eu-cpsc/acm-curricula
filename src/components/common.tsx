import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { courseLabel, type Course } from '../store'
import { TIER_SHORT, TIER_LABEL, type Tier } from '../bok'

export function CourseChip({ course, extra }: { course: Course; extra?: ReactNode }) {
  return (
    <Link className="chip" to={`/courses/${course.id}`} title={course.name} onClick={(e) => e.stopPropagation()}>
      {courseLabel(course)}
      {extra != null && <span className="chip-extra">{extra}</span>}
    </Link>
  )
}

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={`tier tier-${tier}`} title={TIER_LABEL[tier]}>
      {TIER_SHORT[tier]}
    </span>
  )
}

export function TriCheckbox({
  checked,
  indeterminate,
  onChange,
  title,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: (next: boolean) => void
  title?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="cb"
      title={title}
      checked={checked}
      onClick={(e) => e.stopPropagation()}
      onChange={() => onChange(!checked)}
    />
  )
}

export interface Segment {
  value: number
  className: string
  label?: string
}

/** Horizontal stacked bar. */
export function Bar({ segments, total, width = 120 }: { segments: Segment[]; total: number; width?: number | string }) {
  return (
    <span className="bar" style={{ width }} title={segments.map((s) => `${s.label ?? s.className}: ${s.value}`).join('\n')}>
      {total > 0 &&
        segments.map((s, i) =>
          s.value > 0 ? <span key={i} className={s.className} style={{ width: `${(s.value / total) * 100}%` }} /> : null,
        )}
    </span>
  )
}

export function CoverageCell({ covered, total }: { covered: number; total: number }) {
  if (total === 0) return <span className="muted">—</span>
  return (
    <span className="cov-cell">
      <Bar segments={[{ value: covered, className: 'seg-covered', label: 'Covered' }]} total={total} width={60} />
      <span className="num">
        {covered}/{total}
      </span>
    </span>
  )
}

export function EditableText({
  value,
  onSave,
  className,
  placeholder,
  multiline,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
  placeholder?: string
  multiline?: boolean
}) {
  const common = {
    className: `inline-edit ${className ?? ''}`,
    defaultValue: value,
    placeholder,
    onBlur: (e: { currentTarget: { value: string } }) => {
      const v = e.currentTarget.value
      if (v !== value) onSave(v)
    },
  }
  return multiline ? (
    <textarea key={value} rows={3} {...common} />
  ) : (
    <input key={value} {...common} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  )
}
