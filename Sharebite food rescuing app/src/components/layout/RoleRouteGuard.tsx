import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath } from '../../services/auth';
import { PageLoader } from '../states/LoadingState';
import type { UserRole } from '../../types';

interface RoleRouteGuardProps {
  allowedRoles: (UserRole | string)[];
  children: React.ReactNode;
  fallbackPath?: string;
}

/**
 * RoleRouteGuard
 * Enforces role-based route access.
 * Prevents unauthorized users from accessing other roles' dashboards or actions.
 * If unauthorized, immediately redirects to their own designated role dashboard.
 */
export default function RoleRouteGuard({ allowedRoles, children, fallbackPath }: RoleRouteGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/register" replace />;
  }

  const userRole = user.role;
  const isAllowed = allowedRoles.includes(userRole);

  if (!isAllowed) {
    // Exclusively redirect to the user's own authoritative dashboard
    const destination = fallbackPath && fallbackPath !== '/dashboard'
      ? fallbackPath
      : getRoleDashboardPath(userRole);
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}
