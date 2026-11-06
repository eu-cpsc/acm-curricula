import { Link } from 'react-router-dom'
import { downloadCopy, reconnect, saveAs } from '../fileio'
import { useFile } from '../store'

/** Save state of the open program, shown in the header. */
export function FileStatus() {
  const f = useFile()
  if (!f) return null

  let label: string
  let cls = 'ok'
  let action: (() => void) | null = null
  let actionLabel = ''

  if (f.error) {
    label = f.error
    cls = 'warn'
    action = saveAs
    actionLabel = 'Save as…'
  } else if (f.mode === 'file' && !f.connected) {
    label = f.dirty ? 'Unsaved edits' : 'Not connected'
    cls = 'warn'
    action = reconnect
    actionLabel = 'Allow saving'
  } else if (f.mode === 'file') {
    label = f.saving || f.dirty ? 'Saving…' : 'Saved'
  } else if (f.dirty) {
    label = 'Unsaved edits'
    cls = 'warn'
    action = downloadCopy
    actionLabel = 'Download'
  } else {
    label = 'No unsaved edits'
  }

  return (
    <span className={`file-status ${cls}`}>
      <Link to="/program" className="file-name" title={f.mode === 'file' ? 'Edits are saved to this file automatically' : 'Edits are kept in this browser until you download the file'}>
        {f.name}
      </Link>
      <span className="file-label">{label}</span>
      {action && (
        <button className="file-action" onClick={action}>
          {actionLabel}
        </button>
      )}
    </span>
  )
}
