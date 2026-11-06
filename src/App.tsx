import { NavLink, Route, Routes } from 'react-router-dom'
import { useAppState } from './store'
import { FileStatus } from './components/FileStatus'
import Welcome from './pages/Welcome'
import Dashboard from './pages/Dashboard'
import BodyOfKnowledge from './pages/BodyOfKnowledge'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import Plans from './pages/Plans'
import PlanDetail from './pages/PlanDetail'
import Compare from './pages/Compare'
import ProgramPage from './pages/ProgramPage'

export default function App() {
  const { program } = useAppState()
  if (!program) {
    return (
      <div className="app">
        <header className="topbar">
          <span className="brand">ACM Curriculum Planner</span>
        </header>
        <main>
          <Welcome />
        </main>
      </div>
    )
  }
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand" title="Overview">
          {program.name || 'Program'}
          {program.institution && <span className="muted"> · {program.institution}</span>}
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/knowledge">Knowledge Areas</NavLink>
          <NavLink to="/courses">Courses</NavLink>
          <NavLink to="/plans">Degree Plans</NavLink>
          <NavLink to="/compare">Compare</NavLink>
          <NavLink to="/program">Program</NavLink>
        </nav>
        <FileStatus />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/knowledge" element={<BodyOfKnowledge />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/plans/:id" element={<PlanDetail />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/program" element={<ProgramPage />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </div>
  )
}
