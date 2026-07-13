import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { id: 'user-1', full_name: 'Test User', email: 'test@example.com', role: 'admin', active: true },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

const fetchInitialData = vi.fn().mockResolvedValue(undefined);
const resetSessionData = vi.fn();
vi.mock('../store', () => ({
  useStore: { getState: () => ({ fetchInitialData, resetSessionData }) },
}));

import { supabase } from '../lib/supabase';

function Consumer() {
  const { loading, profile } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{profile ? `${profile.fullName} (${profile.role})` : 'signed out'}</div>;
}

// AuthContext has no separate getSession() call -- onAuthStateChange is the
// sole source of the session, including the initial load (Supabase fires an
// INITIAL_SESSION event with the current session immediately on
// subscription). Every test drives the provider by capturing and manually
// invoking that callback, mirroring the only way the real client ever
// delivers a session.
function mockAuthStateChange(): (event: string, session: unknown) => void {
  let callback!: (event: string, session: unknown) => void;
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((cb: never) => {
    callback = cb as never;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  }) as never);
  return (event, session) => callback(event, session);
}

describe('AuthProvider', () => {
  beforeEach(() => {
    fetchInitialData.mockClear();
    resetSessionData.mockClear();
  });

  it('shows signed out state when there is no session', async () => {
    const fireAuthStateChange = mockAuthStateChange();
    render(<AuthProvider><Consumer /></AuthProvider>);
    fireAuthStateChange('INITIAL_SESSION', null);
    await waitFor(() => expect(screen.getByText('signed out')).toBeDefined());
    expect(resetSessionData).toHaveBeenCalled();
  });

  // Regression test: a prior version of applySession also made a separate,
  // redundant getSession() call that raced against this INITIAL_SESSION
  // event, guarded by "whichever call resolves last wins". The
  // INITIAL_SESSION branch unconditionally skipped fetchInitialData() to
  // avoid double-fetching against that other call -- so whenever
  // INITIAL_SESSION won the race (which it did in production), data never
  // loaded and the app spun forever with no error, even though sign-in and
  // the profile fetch both succeeded. Removing the redundant call fixed it;
  // this proves the sole remaining path still fetches data on a real session.
  it('loads the profile and fetches initial data when INITIAL_SESSION reports a session', async () => {
    const fireAuthStateChange = mockAuthStateChange();
    render(<AuthProvider><Consumer /></AuthProvider>);
    fireAuthStateChange('INITIAL_SESSION', { user: { id: 'user-1' } });
    await waitFor(() => expect(screen.getByText('Test User (admin)')).toBeDefined());
    await waitFor(() => expect(fetchInitialData).toHaveBeenCalled());
  });

  it('does not re-fetch initial data on a silent TOKEN_REFRESHED event', async () => {
    const fireAuthStateChange = mockAuthStateChange();
    render(<AuthProvider><Consumer /></AuthProvider>);
    fireAuthStateChange('INITIAL_SESSION', { user: { id: 'user-1' } });
    await waitFor(() => expect(fetchInitialData).toHaveBeenCalledTimes(1));

    fireAuthStateChange('TOKEN_REFRESHED', { user: { id: 'user-1' } });
    await waitFor(() => expect(screen.getByText('Test User (admin)')).toBeDefined());
    expect(fetchInitialData).toHaveBeenCalledTimes(1);
  });
});
