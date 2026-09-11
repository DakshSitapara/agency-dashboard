import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Task, TaskStatus, TaskPriority } from '../types';
import { useAuth } from '../context/AuthContext';

const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface Props {
  projectId?: string;
}

export function TaskList({ projectId }: Props) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const status = params.get('status') || '';
  const priority = params.get('priority') || '';
  const dueFrom = params.get('dueFrom') || '';
  const dueTo = params.get('dueTo') || '';

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  function load() {
    setLoading(true);
    api
      .get('/tasks', {
        params: {
          projectId,
          status: status || undefined,
          priority: priority || undefined,
          dueFrom: dueFrom ? new Date(dueFrom).toISOString() : undefined,
          dueTo: dueTo ? new Date(dueTo).toISOString() : undefined,
        },
      })
      .then((res) => setTasks(res.data.data.items))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, status, priority, dueFrom, dueTo]);

  async function changeStatus(taskId: string, newStatus: TaskStatus) {
    await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
  }

  const canChangeStatus = (t: Task) => user?.role === 'ADMIN' || user?.role === 'PM' || (user?.role === 'DEVELOPER' && t.assignedToId === user.id);

  return (
    <div className="task-list">
      <div className="filters">
        <select value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => updateParam('priority', e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label>
          Due from <input type="date" value={dueFrom} onChange={(e) => updateParam('dueFrom', e.target.value)} />
        </label>
        <label>
          Due to <input type="date" value={dueTo} onChange={(e) => updateParam('dueTo', e.target.value)} />
        </label>
      </div>

      {loading ? (
        <p className="muted">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="muted">No tasks match these filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Project</th>
              <th>Assigned to</th>
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
                <td>{t.assignedTo?.name ?? '—'}</td>
                <td>
                  <span className={`priority-badge priority-${t.priority.toLowerCase()}`}>{t.priority}</span>
                </td>
                <td>
                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                  {t.isOverdue && <span className="overdue-tag"> Overdue</span>}
                </td>
                <td>
                  {canChangeStatus(t) ? (
                    <select value={t.status} onChange={(e) => changeStatus(t.id, e.target.value as TaskStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    t.status.replace('_', ' ')
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
