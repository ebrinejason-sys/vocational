import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../lib/permissions';
import Preloader from './Preloader';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Preloader />;
  if (!session || (profile !== null && !profile.active)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
