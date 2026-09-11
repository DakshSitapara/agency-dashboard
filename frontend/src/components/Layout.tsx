import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Agency Dashboard
        </Link>
        <nav>
          {(user?.role === 'ADMIN' || user?.role === 'PM') && <Link to="/projects">Projects</Link>}
          <Link to="/tasks">Tasks</Link>
        </nav>
        <div className="header-right">
          <NotificationBell />
          <span className="user-chip">
            {user?.name} <span className="role-tag">{user?.role}</span>
          </span>
          <button onClick={handleLogout} className="link-button">
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
