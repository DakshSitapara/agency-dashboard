import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface Props {
  children: JSX.Element;
  allow?: Role[];
}

// Note: this only controls what renders in the browser for a smoother UX.
// It is NOT the access control boundary - every API route re-checks role and
// row ownership server-side (see backend/src/middleware/auth.ts and
// backend/src/utils/authz.ts), so hiding a link here grants no actual access.
export function ProtectedRoute({ children, allow }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
