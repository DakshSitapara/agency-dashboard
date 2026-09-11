import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Project, TaskPriority } from '../types';
import { TaskList } from '../components/TaskList';
import { ActivityFeed } from '../components/ActivityFeed';

interface Developer {
  id: string;
  name: string;
}

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [title, setTitle] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  function loadProject() {
    if (!id) return;
    api.get(`/projects/${id}`).then((res) => setProject(res.data.data));
  }

  useEffect(loadProject, [id]);
  useEffect(() => {
    api.get('/users/developers').then((res) => setDevelopers(res.data.data));
  }, []);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    try {
      await api.post('/tasks', {
        title,
        projectId: id,
        assignedToId: assignedToId || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      setTitle('');
      setAssignedToId('');
      setDueDate('');
      loadProject();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Could not create task');
    }
  }

  if (!project) return <p className="muted">Loading project…</p>;

  return (
    <div className="dashboard-grid">
      <section>
        <h2>{project.name}</h2>
        <p className="muted">{project.client?.name}</p>
        {project.description && <p>{project.description}</p>}
      </section>

      <section>
        <h3>Add Task</h3>
        <form onSubmit={handleCreateTask} className="inline-form">
          <input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
            <option value="">Unassigned</option>
            {developers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button type="submit">Add Task</button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>

      <section>
        <h3>Tasks</h3>
        <TaskList projectId={project.id} />
      </section>

      <ActivityFeed projectId={project.id} title="Project Activity (live)" />
    </div>
  );
}
