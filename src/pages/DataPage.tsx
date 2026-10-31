import { useRef, useState } from 'react'
import { KAS, TIER_LABEL } from '../bok'
import { coverageIndex } from '../coverage'
import { compareCourses, courseLabel, EMPTY_DATA, normalize, setData, update, useData } from '../store'
import { EditableText } from '../components/common'
import { loadSample } from '../sample'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function csvCell(s: string) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function DataPage() {
  const data = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const exportJson = () => download('curriculum.json', JSON.stringify(data, null, 2), 'application/json')

  const exportCsv = () => {
    const courses = [...data.courses].sort(compareCourses)
    const idx = coverageIndex(data.courses)
    const rows = [['KA', 'Unit', 'Tier', 'Topic #', 'Topic', 'Courses', ...courses.map(courseLabel)]]
    for (const ka of KAS)
      for (const u of ka.units)
        for (const t of u.topics) {
          const cs = idx.get(t.id) ?? []
          rows.push([
            ka.code,
            u.code,
            TIER_LABEL[t.tier],
            String(t.num),
            t.text,
            cs.map(courseLabel).join('; '),
            ...courses.map((c) => (cs.includes(c) ? 'X' : '')),
          ])
        }
    download('coverage.csv', rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv')
  }

  const importJson = async (file: File) => {
    try {
      const next = normalize(JSON.parse(await file.text()))
      if (data.courses.length && !confirm('Replace all current courses and plans with the imported file?')) return
      setData(next)
      setMsg(`Imported ${next.courses.length} courses and ${next.plans.length} plans.`)
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`)
    }
  }

  return (
    <div className="page">
      <h1>Data</h1>
      <p className="muted">
        Your data is saved in this browser automatically. Export it to back it up, share it, or commit it to the repository.
      </p>
      <div className="card">
        <h3>Institution</h3>
        <EditableText value={data.institution} placeholder="Institution name" onSave={(v) => update((d) => ({ ...d, institution: v }))} />
      </div>
      <div className="card">
        <h3>Export</h3>
        <div className="toolbar">
          <button className="primary" onClick={exportJson}>
            Download curriculum.json
          </button>
          <button onClick={exportCsv}>Download coverage CSV (topic × course)</button>
        </div>
      </div>
      <div className="card">
        <h3>Import</h3>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importJson(f)
            e.target.value = ''
          }}
        />
        {msg && <p className="small">{msg}</p>}
      </div>
      <div className="card">
        <h3>Reset</h3>
        <div className="toolbar">
          <button
            onClick={() => (!data.courses.length || confirm('Replace current data with sample data?')) && loadSample()}
          >
            Load sample data
          </button>
          <button className="danger" onClick={() => confirm('Delete ALL courses and plans?') && setData(EMPTY_DATA)}>
            Clear everything
          </button>
        </div>
      </div>
    </div>
  )
}
