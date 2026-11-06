import { UNIT_BY_CODE } from '../bok'
import type { Course, DegreePlan, ElectiveGroup } from '../store'

/** Topic IDs of one unit and tier, e.g. ids('OS-Memory', 'cs'). */
export function ids(unit: string, tier: 'cs' | 'ka' | 'non' = 'cs'): string[] {
  const u = UNIT_BY_CODE.get(unit)
  if (!u) throw new Error(`no unit ${unit}`)
  return u.topics.filter((t) => t.tier === tier).map((t) => t.id)
}

export function course(id: string, coverage: string[], credits: number | null = 3): Course {
  return { id, dept: 'CPSC', number: id, name: `Course ${id}`, credits, description: '', coverage }
}

export function group(choose: number, options: string[]): ElectiveGroup {
  return { id: `g-${options.join('-')}`, name: 'Electives', choose, options }
}

export function plan(required: string[], electives: ElectiveGroup[] = []): DegreePlan {
  return { id: 'p', name: 'Plan', description: '', required, electives }
}
