import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath } from '../../services/auth';
import { PageLoader } from '../states/LoadingState';

/**
 * RoleBasedDashboard
 * Authoritative dispatcher that redirects the user to their purpose-built
 * dashboard matching their trusted profile role in Supabase.
 */
export default function RoleBasedDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/register" replace />;
  }

  const destination = getRoleDashboardPath(user.role);
  return <Navigate to={destination} replace />;
}
