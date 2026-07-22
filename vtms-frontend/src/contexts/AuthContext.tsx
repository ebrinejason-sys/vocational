import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { getAccessToken, getUserIdFromToken, setAccessToken } from '../lib/session';
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
  accessToken: string | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error?: string; requiresOtp?: boolean; email?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ error?: string }>;
  completeSignIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { sub?: string; exp?: number };
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  // 30s clock skew buffer
  return payload.exp * 1000 < Date.now() - 30_000;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, active')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    active: data.active,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function applyAccessToken(token: string | null, loadData = true) {
    if (!token || isTokenExpired(token)) {
      setAccessToken(null);
      setAccessTokenState(null);
      setProfile(null);
      useStore.getState().resetSessionData();
      return;
    }

    const userId = decodeJwtPayload(token)?.sub ?? null;
    if (!userId) {
      setAccessToken(null);
      setAccessTokenState(null);
      setProfile(null);
      useStore.getState().resetSessionData();
      return;
    }

    // Persist before profile fetch so accessToken hook sends Authorization.
    setAccessToken(token);

    const nextProfile = await fetchProfile(userId);
    if (!nextProfile || !nextProfile.active) {
      setAccessToken(null);
      setAccessTokenState(null);
      setProfile(null);
      useStore.getState().resetSessionData();
      return;
    }

    setAccessTokenState(token);
    setProfile(nextProfile);

    if (loadData) {
      useStore.getState().fetchInitialData().catch((err) => {
        console.error('Failed to load initial data', err);
        useStore.setState({ dataLoaded: true });
      });
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = getAccessToken();
        if (stored && mounted) {
          await applyAccessToken(stored);
        }
      } catch (err) {
        console.error('Failed to restore session', err);
        if (mounted) await applyAccessToken(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function signIn(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = (await res.json()) as {
      accessToken?: string;
      requiresOtp?: boolean;
      email?: string;
      error?: string;
    };
    if (!res.ok) {
      return { error: data.error ?? 'Login failed' };
    }
    if (data.requiresOtp) {
      return { requiresOtp: true, email: data.email ?? email.trim() };
    }
    if (!data.accessToken) {
      return { error: data.error ?? 'Login failed' };
    }
    await applyAccessToken(data.accessToken);
    if (!getUserIdFromToken()) {
      return { error: 'Signed in, but session could not be established. Check JWT secret / profile.' };
    }
    return {};
  }

  async function verifyOtp(email: string, otp: string) {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
    });
    const data = (await res.json()) as { accessToken?: string; error?: string };
    if (!res.ok || !data.accessToken) {
      return { error: data.error ?? 'Invalid code' };
    }
    await applyAccessToken(data.accessToken);
    if (!getUserIdFromToken()) {
      return { error: 'Code accepted, but session could not be established.' };
    }
    return {};
  }

  async function signOut() {
    await applyAccessToken(null);
  }

  async function completeSignIn(token: string) {
    await applyAccessToken(token);
  }

  return (
    <AuthContext.Provider
      value={{ accessToken, profile, loading, signIn, verifyOtp, completeSignIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
