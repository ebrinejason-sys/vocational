import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminStaff from './AdminStaff';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: '1', fullName: 'Jane Admin', email: 'jane@agape.org', role: 'admin', active: true },
    signOut: vi.fn(),
  }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({
          data: [
            { id: '1', full_name: 'Jane Admin', email: 'jane@agape.org', role: 'admin', active: true },
            { id: '2', full_name: 'Tom Trainer', email: 'tom@agape.org', role: 'trainer', active: true },
          ],
          error: null,
        }),
      }),
    }),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));

describe('AdminStaff', () => {
  it('lists existing staff from Supabase', async () => {
    render(<AdminStaff />);
    await waitFor(() => expect(screen.getByText('Jane Admin')).toBeDefined());
    expect(screen.getByText('Tom Trainer')).toBeDefined();
  });

  it('renders the invite form', () => {
    render(<AdminStaff />);
    expect(screen.getByPlaceholderText('Full name')).toBeDefined();
    expect(screen.getByPlaceholderText('Email')).toBeDefined();
  });
});
