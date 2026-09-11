import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { NotificationBell } from "./NotificationBell";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>
            <strong>Agency</strong>
            <small>Operations hub</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {(user?.role === "ADMIN" || user?.role === "PM") && (
            <NavLink
              to="/projects"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Projects
            </NavLink>
          )}
          <NavLink
            to="/tasks"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Tasks
          </NavLink>
        </nav>
        <div className="header-right">
          <NotificationBell />
          <div className="user-chip">
            <span className="avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
            <span className="user-meta">
              <strong>{user?.name}</strong>
              <small>{user?.role}</small>
            </span>
          </div>
          <button onClick={handleLogout} className="logout-button">
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
