import { TaskList } from '../components/TaskList';

export function TasksPage() {
  return (
    <div className="dashboard-grid">
      <h2>Tasks</h2>
      <TaskList />
    </div>
  );
}
