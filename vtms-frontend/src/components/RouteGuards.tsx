import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../lib/permissions';
import Preloader from './Preloader';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { accessToken, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <Preloader />;

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (profile !== null && !profile.active) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--app-bg)]">
        <div className="max-w-sm w-full rounded-2xl bg-white border border-gray-100 shadow-sm p-6 text-center">
          <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h1 className="text-base font-bold text-gray-900">Account deactivated</h1>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Your staff account is inactive. Contact an administrator if you need access restored.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-4 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Authenticated but no staff profile row: an orphaned account or a failed
  // profile fetch. Every data query would be denied by RLS, so without this
  // screen the user would hang on the loader forever with no explanation.
  if (profile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--app-bg)]">
        <div className="max-w-sm w-full rounded-2xl bg-white border border-gray-100 shadow-sm p-6 text-center">
          <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h1 className="text-base font-bold text-gray-900">Account not set up</h1>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            You’re signed in, but no staff profile is linked to this account.
            Ask an administrator to add you on the Staff page, then sign in again.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-4 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
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
