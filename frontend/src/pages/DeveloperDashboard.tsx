import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ActivityFeed } from '../components/ActivityFeed';
import { Task, TaskStatus } from '../types';

const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export function DeveloperDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);

  function load() {
    // Backend's /dashboard already returns tasks pre-sorted by priority then
    // due date for this role - see dashboard.controller.ts.
    api.get('/dashboard').then((res) => setTasks(res.data.data.tasks));
  }

  useEffect(load, []);

  async function changeStatus(taskId: string, status: TaskStatus) {
    await api.patch(`/tasks/${taskId}/status`, { status });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  }

  return (
    <div className="dashboard-grid">
      <section>
        <h2>Your Assigned Tasks</h2>
        {tasks.length === 0 ? (
          <p className="muted">No tasks assigned to you yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Project</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className={t.isOverdue ? 'overdue-row' : ''}>
                  <td>{t.title}</td>
                  <td>{t.project?.name}</td>
                  <td>
                    <span className={`priority-badge priority-${t.priority.toLowerCase()}`}>{t.priority}</span>
                  </td>
                  <td>
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                    {t.isOverdue && <span className="overdue-tag"> Overdue</span>}
                  </td>
                  <td>
                    <select value={t.status} onChange={(e) => changeStatus(t.id, e.target.value as TaskStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <ActivityFeed title="Activity on Your Tasks" />
    </div>
  );
}
