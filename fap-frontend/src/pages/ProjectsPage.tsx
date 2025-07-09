import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

interface Project { id: number; name: string }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    axios.get<Project[]>('http://localhost:8000/api/projects')
      .then(res => setProjects(res.data))
      .catch(console.error)
  }, [])

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Projects</h1>
      <ul>
        {projects.map(p =>
          <li key={p.id}>
            <button onClick={() => navigate(`/projects/${p.id}/issues`)}>
              {p.name}
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}
