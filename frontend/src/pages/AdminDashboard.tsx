import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { ActivityFeed } from '../components/ActivityFeed';

interface AdminStats {
  totalProjects: number;
  tasksByStatus: Record<string, number>;
  overdueCount: number;
  onlineUsers: number;
}

export function AdminDashboard() {
  const socket = useSocket();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setStats(res.data.data));
  }, []);

  // Live presence count - pushed over the socket whenever anyone connects/disconnects.
  useEffect(() => {
    if (!socket) return;
    const handler = (payload: { count: number }) => {
      setStats((prev) => (prev ? { ...prev, onlineUsers: payload.count } : prev));
    };
    socket.on('presence:count', handler);
    return () => {
      socket.off('presence:count', handler);
    };
  }, [socket]);

  if (!stats) return <p className="muted">Loading dashboard…</p>;

  return (
    <div className="dashboard-grid">
      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-value">{stats.totalProjects}</span>
          <span className="stat-label">Total Projects</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.overdueCount}</span>
          <span className="stat-label">Overdue Tasks</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.onlineUsers}</span>
          <span className="stat-label">Active Users Online</span>
        </div>
        {Object.entries(stats.tasksByStatus).map(([status, count]) => (
          <div className="stat-card" key={status}>
            <span className="stat-value">{count}</span>
            <span className="stat-label">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
      <ActivityFeed title="Global Activity Feed (all projects)" />
    </div>
  );
}
