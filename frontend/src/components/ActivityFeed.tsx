import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { ActivityItem } from '../types';

interface Props {
  projectId?: string; // when set, also joins that project's live room (Admin/PM viewing a project page)
  title?: string;
}

export function ActivityFeed({ projectId, title = 'Activity Feed' }: Props) {
  const socket = useSocket();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const latestTimestamp = useRef<string | null>(null);

  // Initial load + "missed while offline" catchup: always a fresh DB read,
  // capped at 20 per the spec, never served from a client-side cache.
  useEffect(() => {
    setLoading(true);
    api
      .get('/activity', { params: { projectId, limit: 20 } })
      .then((res) => {
        const data: ActivityItem[] = res.data.data;
        setItems(data);
        latestTimestamp.current = data[0]?.createdAt ?? null;
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;

    if (projectId) {
      socket.emit('project:join', projectId);
    }

    const handler = (event: ActivityItem) => {
      if (projectId && event.projectId !== projectId) return;
      setItems((prev) => {
        if (prev.some((p) => p.id === event.id)) return prev;
        return [event, ...prev].slice(0, 50);
      });
    };

    socket.on('activity:new', handler);

    // If the socket reconnects (laptop woke up, wifi blip), pull anything we
    // missed while disconnected from the DB rather than trusting the socket
    // to have buffered it - sockets never buffer missed events server-side.
    const onReconnect = () => {
      api
        .get('/activity', { params: { projectId, after: latestTimestamp.current ?? undefined, limit: 20 } })
        .then((res) => {
          const missed: ActivityItem[] = res.data.data;
          if (missed.length === 0) return;
          setItems((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const fresh = missed.filter((m) => !ids.has(m.id));
            return [...fresh, ...prev].slice(0, 50);
          });
        });
    };
    socket.on('connect', onReconnect);

    return () => {
      socket.off('activity:new', handler);
      socket.off('connect', onReconnect);
      if (projectId) socket.emit('project:leave', projectId);
    };
  }, [socket, projectId]);

  useEffect(() => {
    if (items[0]) latestTimestamp.current = items[0].createdAt;
  }, [items]);

  return (
    <div className="activity-feed">
      <h3>{title}</h3>
      {loading ? (
        <p className="muted">Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="muted">No activity yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id} className="activity-item">
              <span className="activity-text">{item.message}</span>
              <span className="activity-meta">
                {item.projectName} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
