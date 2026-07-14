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
        if (!nextSession) {
          // Signed out — clear in-memory batches/trainees so a different
          // user signing in on the same tab never sees stale, previously
          // fetched session-scoped data before fetchInitialData() resolves.
          useStore.getState().resetSessionData();
        } else if (nextProfile && event !== 'TOKEN_REFRESHED') {
          // Skip re-fetching batches/trainees on silent background token
          // refreshes — session/profile state still stays in sync above,
          // this only avoids burning Supabase API quota on data that
          // hasn't changed. onAuthStateChange is the sole source of the
          // initial session (no separate getSession() call below), so its
          // INITIAL_SESSION event is the one and only place the first
          // load's fetch happens; excluding it here would mean it never
          // happens at all.
          useStore.getState().fetchInitialData().catch((err) => {
            console.error('Failed to load initial data', err);
            // Unstick the Layout preloader even if core fetch fails.
            useStore.setState({ dataLoaded: true });
          });
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

    // onAuthStateChange fires an INITIAL_SESSION event immediately on
    // subscription with the current session (Supabase's documented
    // contract), so it alone covers the initial load — a separate
    // getSession() call here would race it: whichever call's requestId
    // ends up "latest" wins, and if that happened to be the one skipping
    // fetchInitialData (see above), the app would never load any data.
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
