import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath } from '../../services/auth';
import AuthStateScreen from '../states/AuthStateScreen';

/**
 * RoleBasedDashboard
 * Authoritative dispatcher that redirects the user to their purpose-built
 * dashboard matching their trusted profile role in Supabase.
 */
export default function RoleBasedDashboard() {
  const { user, authStatus, authError, retryAuth, logout } = useAuth();

  if (authStatus === 'initializing' || authStatus === 'loading_profile') {
    return <AuthStateScreen mode="loading" message="Loading your dashboard..." />;
  }

  if (authStatus === 'error' || authStatus === 'profile_missing' || authStatus === 'invalid_role') {
    return (
      <AuthStateScreen
        mode={authStatus}
        message={authError}
        onRetry={retryAuth}
        onSignOut={logout}
      />
    );
  }

  if (!user) {
    return <Navigate to="/register" replace />;
  }

  const destination = getRoleDashboardPath(user.role);
  if (!destination) {
    return (
      <AuthStateScreen
        mode="invalid_role"
        message={`Unable to route account with role "${user.role}".`}
        onRetry={retryAuth}
        onSignOut={logout}
      />
    );
  }

  return <Navigate to={destination} replace />;
}
