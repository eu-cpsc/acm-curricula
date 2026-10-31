// Loads the ACM CS2023 Body of Knowledge from json/ka-*.json and builds
// lookup indexes. Topic IDs are derived from unit code + tier + position,
// e.g. "OS-Memory:cs:3", so they stay stable as long as the JSON is unchanged.

export type Tier = 'cs' | 'ka' | 'non'

export const TIERS: Tier[] = ['cs', 'ka', 'non']

export const TIER_LABEL: Record<Tier, string> = {
  cs: 'CS Core',
  ka: 'KA Core',
  non: 'Non-core',
}

export const TIER_SHORT: Record<Tier, string> = { cs: 'CS', ka: 'KA', non: 'NC' }

interface RawItem {
  description: string
  topics?: RawItem[]
}

interface RawUnit {
  name: string
  code: string
  'hours-cs': string
  'hours-ka': string
  'topics-cs': RawItem[]
  'topics-ka': RawItem[]
  'topics-non': RawItem[]
  'outcomes-cs': RawItem[]
  'outcomes-ka': RawItem[]
  'outcomes-non': RawItem[]
}

interface RawKA {
  name: string
  code: string
  units: RawUnit[]
}

export interface SubItem {
  text: string
  depth: number
}

export interface Topic {
  id: string
  kaCode: string
  unitCode: string
  tier: Tier
  num: number
  text: string
  subtopics: SubItem[]
  /** lower-cased text + subtopics, for searching */
  search: string
}

export interface Unit {
  code: string
  name: string
  kaCode: string
  hoursCs: string
  hoursKa: string
  topics: Topic[]
  outcomes: Record<Tier, SubItem[]>
}

export interface KnowledgeArea {
  code: string
  name: string
  units: Unit[]
  topics: Topic[]
}

function flatten(items: RawItem[] | undefined, depth = 0, out: SubItem[] = []): SubItem[] {
  for (const it of items ?? []) {
    if (it.description) out.push({ text: it.description, depth })
    flatten(it.topics, depth + 1, out)
  }
  return out
}

const modules = import.meta.glob<RawKA>('../json/ka-*.json', { eager: true, import: 'default' })

export const KAS: KnowledgeArea[] = Object.values(modules)
  .map((raw) => {
    const units: Unit[] = raw.units.map((u) => {
      const topics: Topic[] = []
      for (const tier of TIERS) {
        ;(u[`topics-${tier}`] ?? []).forEach((t, i) => {
          const subtopics = flatten(t.topics)
          topics.push({
            id: `${u.code}:${tier}:${i + 1}`,
            kaCode: raw.code,
            unitCode: u.code,
            tier,
            num: i + 1,
            text: t.description,
            subtopics,
            search: [t.description, ...subtopics.map((s) => s.text)].join(' ').toLowerCase(),
          })
        })
      }
      return {
        code: u.code,
        name: u.name,
        kaCode: raw.code,
        hoursCs: (u['hours-cs'] ?? '').trim(),
        hoursKa: (u['hours-ka'] ?? '').trim(),
        topics,
        outcomes: {
          cs: flatten(u['outcomes-cs']),
          ka: flatten(u['outcomes-ka']),
          non: flatten(u['outcomes-non']),
        },
      }
    })
    return { code: raw.code, name: raw.name, units, topics: units.flatMap((u) => u.topics) }
  })
  .sort((a, b) => a.code.localeCompare(b.code))

export const KA_BY_CODE = new Map(KAS.map((k) => [k.code, k]))
export const UNITS: Unit[] = KAS.flatMap((k) => k.units)
export const UNIT_BY_CODE = new Map(UNITS.map((u) => [u.code, u]))
export const TOPICS: Topic[] = UNITS.flatMap((u) => u.topics)
export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]))

export function countByTier(topics: Topic[]): Record<Tier, number> {
  const c: Record<Tier, number> = { cs: 0, ka: 0, non: 0 }
  for (const t of topics) c[t.tier]++
  return c
}
