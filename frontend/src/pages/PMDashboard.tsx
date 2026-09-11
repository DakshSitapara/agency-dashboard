import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ActivityFeed } from '../components/ActivityFeed';
import { Project, Task } from '../types';

interface PMStats {
  projects: Project[];
  tasksByPriority: Record<string, number>;
  upcomingDueDates: Task[];
}

export function PMDashboard() {
  const [stats, setStats] = useState<PMStats | null>(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setStats(res.data.data));
  }, []);

  if (!stats) return <p className="muted">Loading dashboard…</p>;

  return (
    <div className="dashboard-grid">
      <section>
        <h2>Your Projects</h2>
        <div className="project-cards">
          {stats.projects.map((p) => (
            <Link to={`/projects/${p.id}`} key={p.id} className="project-card">
              <strong>{p.name}</strong>
              <span className="muted">{p.client?.name}</span>
              <span className="muted">{p._count?.tasks ?? 0} tasks</span>
            </Link>
          ))}
          {stats.projects.length === 0 && <p className="muted">You haven't created any projects yet.</p>}
        </div>
      </section>

      <section>
        <h2>Tasks by Priority</h2>
        <div className="stat-cards">
          {Object.entries(stats.tasksByPriority).map(([priority, count]) => (
            <div className="stat-card" key={priority}>
              <span className="stat-value">{count}</span>
              <span className="stat-label">{priority}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Due This Week</h2>
        {stats.upcomingDueDates.length === 0 ? (
          <p className="muted">Nothing due in the next 7 days.</p>
        ) : (
          <ul className="simple-list">
            {stats.upcomingDueDates.map((t) => (
              <li key={t.id}>
                <strong>{t.title}</strong> — {t.project?.name} — assigned to {t.assignedTo?.name ?? 'unassigned'} — due{' '}
                {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActivityFeed title="Activity on Your Projects" />
    </div>
  );
}
