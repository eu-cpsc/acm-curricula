import { KAS, TIER_LABEL } from '../bok'
import { coverageIndex } from '../coverage'
import { canWriteFiles, closeProgram, downloadCopy, openFile, saveAs } from '../fileio'
import { compareCourses, courseLabel, update, useData, useFile } from '../store'
import { EditableText } from '../components/common'

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

export default function ProgramPage() {
  const data = useData()
  const file = useFile()

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
    download((file?.name ?? 'program').replace(/\.curriculum\.json$|\.json$/, '') + '-coverage.csv', rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv')
  }

  return (
    <div className="page">
      <h1>Program</h1>
      <div className="card">
        <h3>Details</h3>
        <div className="form-grid">
          <label>Institution</label>
          <EditableText value={data.institution} placeholder="e.g. Evangel University" onSave={(v) => update((d) => ({ ...d, institution: v }))} />
          <label>Program</label>
          <EditableText value={data.name} placeholder="e.g. Computer Science" onSave={(v) => update((d) => ({ ...d, name: v }))} />
        </div>
        <p className="small muted">
          {data.courses.length} courses · {data.plans.length} degree plans
        </p>
      </div>

      <div className="card">
        <h3>File</h3>
        {file && (
          <p className="small">
            <b>{file.name}</b> —{' '}
            {file.mode === 'file'
              ? file.connected
                ? 'edits are saved to this file automatically.'
                : 'this browser needs permission again before it can save to the file (use “Allow saving” at the top).'
              : file.dirty
                ? 'you have edits that are only in this browser. Download the file to keep them.'
                : 'edits are kept in this browser until you download the file.'}
          </p>
        )}
        <div className="toolbar">
          <button className="primary" onClick={() => void saveAs()}>
            {canWriteFiles ? 'Save as…' : 'Download file'}
          </button>
          {canWriteFiles && <button onClick={downloadCopy}>Download a copy</button>}
          <button onClick={() => void openFile().catch((e) => alert((e as Error).message))}>Open another file…</button>
          <button onClick={closeProgram}>Close program</button>
        </div>
      </div>

      <div className="card">
        <h3>Export</h3>
        <div className="toolbar">
          <button onClick={exportCsv}>Coverage spreadsheet (CSV, topic × course)</button>
        </div>
      </div>
    </div>
  )
}
