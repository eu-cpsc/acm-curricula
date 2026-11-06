import { useState } from 'react'
import { canWriteFiles, newProgram, openFile, openProgramData } from '../fileio'
import { sampleProgram } from '../sample'
import { KAS, TOPICS, UNITS } from '../bok'

export default function Welcome() {
  const [error, setError] = useState('')
  const run = (fn: () => Promise<void>) => () => fn().catch((e) => setError((e as Error).message))

  return (
    <div className="page welcome">
      <h1>ACM Curriculum Planner</h1>
      <p className="lead">
        Map your courses to the ACM/IEEE-CS/AAAI <b>CS2023</b> curriculum guidelines ({KAS.length} knowledge areas, {UNITS.length}{' '}
        knowledge units, {TOPICS.length.toLocaleString()} topics), then compare degree plans and elective choices to see how well each one
        covers them.
      </p>
      <div className="welcome-actions">
        <button className="primary big" onClick={run(openFile)}>
          Open program file…
        </button>
        <button className="big" onClick={run(newProgram)}>
          New program
        </button>
        <button className="big" onClick={run(() => openProgramData(sampleProgram(), 'sample.curriculum.json'))}>
          Try the sample
        </button>
      </div>
      {error && <p className="error">Couldn’t open that file: {error}</p>}
      <div className="card">
        <h3>Where your data lives</h3>
        <p className="small">
          A program (your institution’s courses and degree plans) is saved in a <code>.curriculum.json</code> file on your own device.
          Nothing is uploaded. To share a program, send someone the file and they can open it here.
        </p>
        <p className="small">
          {canWriteFiles ? (
            <>This browser can save straight to the file: edits are written to it as you work.</>
          ) : (
            <>
              This browser can open files but not write to them, so edits are kept in the browser until you <b>download</b> the updated
              file. Chrome or Edge on a computer can save to the file automatically.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
