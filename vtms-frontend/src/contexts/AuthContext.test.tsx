import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../lib/supabase', () => ({
  supabase: {
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

function makeJwt(sub: string, expSecondsFromNow = 3600): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub,
    email: 'test@example.com',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
  }));
  return `${header}.${payload}.sig`;
}

vi.mock('../lib/session', () => ({
  getAccessToken: vi.fn(() => null),
  setAccessToken: vi.fn(),
  getUserIdFromToken: vi.fn(() => null),
}));

const fetchInitialData = vi.fn().mockResolvedValue(undefined);
const resetSessionData = vi.fn();
vi.mock('../store', () => ({
  useStore: { getState: () => ({ fetchInitialData, resetSessionData }), setState: vi.fn() },
}));

import { getAccessToken, getUserIdFromToken } from '../lib/session';

function Consumer() {
  const { loading, profile } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{profile ? `${profile.fullName} (${profile.role})` : 'signed out'}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    fetchInitialData.mockClear();
    resetSessionData.mockClear();
    vi.mocked(getAccessToken).mockReturnValue(null);
    vi.mocked(getUserIdFromToken).mockReturnValue(null);
  });

  it('shows signed out state when there is no stored token', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('signed out')).toBeDefined());
  });

  it('restores session from stored token and loads data', async () => {
    const token = makeJwt('user-1');
    vi.mocked(getAccessToken).mockReturnValue(token);
    vi.mocked(getUserIdFromToken).mockReturnValue('user-1');
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Test User (admin)')).toBeDefined());
    await waitFor(() => expect(fetchInitialData).toHaveBeenCalled());
  });
});
