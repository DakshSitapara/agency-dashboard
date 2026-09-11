import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { AppNotification } from '../types';

export function NotificationBell() {
  const socket = useSocket();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get('/notifications').then((res) => {
      setNotifications(res.data.data.notifications);
      setUnreadCount(res.data.data.unreadCount);
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (n: AppNotification) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1); // pushed live over the socket - no polling interval anywhere
    };
    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [socket]);

  async function markOne(id: string) {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAll() {
    await api.patch('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="notification-bell">
      <button onClick={() => setOpen((o) => !o)} className="bell-button">
        🔔 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <strong>Notifications</strong>
            <button onClick={markAll} className="link-button">
              Mark all as read
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="muted">No notifications</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id} className={n.isRead ? 'read' : 'unread'} onClick={() => !n.isRead && markOne(n.id)}>
                  <div>{n.message}</div>
                  <div className="activity-meta">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
