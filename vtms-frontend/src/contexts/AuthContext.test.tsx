import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
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

import { supabase } from '../lib/supabase';

function Consumer() {
  const { loading, profile } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{profile ? `${profile.fullName} (${profile.role})` : 'signed out'}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never);
  });

  it('shows signed out state when there is no session', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('signed out')).toBeDefined());
  });

  it('loads the profile once a session exists', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } as never },
      error: null,
    } as never);
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Test User (admin)')).toBeDefined());
  });
});
