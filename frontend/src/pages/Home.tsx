import { useAuth } from '../context/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { PMDashboard } from './PMDashboard';
import { DeveloperDashboard } from './DeveloperDashboard';

export function Home() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') return <AdminDashboard />;
  if (user?.role === 'PM') return <PMDashboard />;
  return <DeveloperDashboard />;
}
