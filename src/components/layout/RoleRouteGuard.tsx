import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath, isRoleAllowed } from '../../services/auth';
import AuthStateScreen from '../states/AuthStateScreen';
import type { UserRole } from '../../types';

interface RoleRouteGuardProps {
  allowedRoles: (UserRole | string)[];
  children: React.ReactNode;
  fallbackPath?: string;
}

/**
 * RoleRouteGuard
 * Enforces role-based route access using authoritative profile roles.
 * Includes an explicit self-redirect loop guard so unrecognized roles or
 * mismatched destinations never trigger an infinite React redirect crash.
 */
export default function RoleRouteGuard({ allowedRoles, children, fallbackPath }: RoleRouteGuardProps) {
  const { user, authStatus, authError, retryAuth, logout } = useAuth();
  const location = useLocation();

  if (authStatus === 'initializing' || authStatus === 'loading_profile') {
    return <AuthStateScreen mode="loading" message="Verifying route permissions..." />;
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

  if (!isRoleAllowed(user.role, allowedRoles)) {
    const authoritativePath = getRoleDashboardPath(user.role);
    const destination =
      fallbackPath && fallbackPath !== '/dashboard' ? fallbackPath : authoritativePath;

    // Prevent infinite self-redirect loop if role is invalid or destination equals current pathname
    if (!destination || destination === location.pathname) {
      return (
        <AuthStateScreen
          mode="invalid_role"
          message={`Your account role ("${user.role}") does not have permission to view this dashboard.`}
          onRetry={retryAuth}
          onSignOut={logout}
        />
      );
    }

    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}
