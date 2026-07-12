import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role } from '../lib/permissions';
import { useStore } from '../store';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, active')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return { id: data.id, fullName: data.full_name, email: data.email, role: data.role, active: data.active };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let latestRequestId = 0;

    async function applySession(nextSession: Session | null, event?: AuthChangeEvent) {
      const requestId = ++latestRequestId;
      try {
        const nextProfile = nextSession ? await fetchProfile(nextSession.user.id) : null;
        if (!mounted || requestId !== latestRequestId) return;
        setSession(nextSession);
        setProfile(nextProfile);
        // Skip re-fetching batches/trainees on silent background token
        // refreshes — session/profile state still stays in sync above,
        // this only avoids burning Supabase API quota on data that
        // hasn't changed. Also skip INITIAL_SESSION: onAuthStateChange
        // fires that on attach in parallel with our explicit
        // getSession() call below for the same session, so honoring it
        // here would double-fetch on every page load. The initial
        // getSession() call (no event) and genuine sign-ins still fetch.
        if (nextProfile && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') {
          useStore.getState().fetchInitialData().catch((err) => console.error('Failed to load initial data', err));
        }
      } catch (err) {
        if (!mounted || requestId !== latestRequestId) return;
        console.error('Failed to load auth session', err);
        setSession(null);
        setProfile(null);
      } finally {
        if (mounted && requestId === latestRequestId) setLoading(false);
      }
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => applySession(session))
      .catch((err) => {
        if (!mounted) return;
        console.error('Failed to get session', err);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      applySession(session, event);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
