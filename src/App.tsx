import { NavLink, Route, Routes } from 'react-router-dom'
import { useData } from './store'
import Dashboard from './pages/Dashboard'
import BodyOfKnowledge from './pages/BodyOfKnowledge'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import Plans from './pages/Plans'
import PlanDetail from './pages/PlanDetail'
import DataPage from './pages/DataPage'

export default function App() {
  const data = useData()
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          Curriculum Planner
          {data.institution && <span className="muted"> · {data.institution}</span>}
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/knowledge">Knowledge Areas</NavLink>
          <NavLink to="/courses">Courses</NavLink>
          <NavLink to="/plans">Degree Plans</NavLink>
          <NavLink to="/data">Data</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/knowledge" element={<BodyOfKnowledge />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/plans/:id" element={<PlanDetail />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </div>
  )
}
