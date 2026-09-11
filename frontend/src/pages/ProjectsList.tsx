import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Project } from '../types';

interface Client {
  id: string;
  name: string;
}

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get('/projects').then((res) => setProjects(res.data.data));
    api.get('/clients').then((res) => setClients(res.data.data));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/projects', { name, description: description || undefined, clientId });
      setName('');
      setDescription('');
      setClientId('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not create project');
    }
  }

  return (
    <div className="dashboard-grid">
      <section>
        <h2>New Project</h2>
        <form onSubmit={handleCreate} className="inline-form">
          <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="submit">Create</button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>

      <section>
        <h2>Projects</h2>
        <div className="project-cards">
          {projects.map((p) => (
            <Link to={`/projects/${p.id}`} key={p.id} className="project-card">
              <strong>{p.name}</strong>
              <span className="muted">{p.client?.name}</span>
              <span className="muted">{p._count?.tasks ?? 0} tasks</span>
            </Link>
          ))}
          {projects.length === 0 && <p className="muted">No projects yet.</p>}
        </div>
      </section>
    </div>
  );
}
