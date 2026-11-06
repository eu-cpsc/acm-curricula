import { describe, expect, it } from 'vitest'
import { KAS, TOPICS, TOPIC_BY_ID, UNITS } from './bok'

describe('CS2023 body of knowledge', () => {
  it('loads every knowledge area and unit from json/', () => {
    expect(KAS).toHaveLength(17)
    expect(UNITS).toHaveLength(162)
    expect(TOPICS.length).toBeGreaterThan(1000)
    expect(KAS.map((k) => k.code)).toEqual([...KAS.map((k) => k.code)].sort())
  })

  it('gives every unit and topic a unique ID', () => {
    expect(new Set(UNITS.map((u) => u.code)).size).toBe(UNITS.length)
    expect(TOPIC_BY_ID.size).toBe(TOPICS.length)
  })

  it('builds topic IDs as <unit>:<tier>:<n>, numbered from 1 within each tier', () => {
    for (const t of TOPICS) {
      expect(t.id).toBe(`${t.unitCode}:${t.tier}:${t.num}`)
      expect(t.unitCode.startsWith(t.kaCode + '-')).toBe(true)
      expect(t.text.trim()).not.toBe('')
    }
  })

  // Saved files reference topics by ID. If the JSON is regenerated and topics
  // move, these break, and so do users' files.
  it('keeps known topic IDs pointing at the same topics', () => {
    expect(TOPIC_BY_ID.get('OS-Purpose:cs:1')?.text).toMatch(/^Operating systems mediate between/)
    expect(TOPIC_BY_ID.get('OS-Purpose:cs:6')?.subtopics.length).toBeGreaterThan(0)
  })
})
