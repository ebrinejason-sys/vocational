import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Login from './Login';
import { ThemeProvider } from '../lib/theme';

const mockSignIn = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => mockSignIn(...args) } },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ session: null, profile: null, loading: false }),
}));

function renderLogin() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('Login', () => {
  it('submits the trimmed email and password to Supabase', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('you@streetchildren.org'), { target: { value: 'staff@scm.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({ email: 'staff@scm.org', password: 'secret123' }));
  });

  it('shows an error message when sign-in fails', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('you@streetchildren.org'), { target: { value: 'staff@scm.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/don’t match our records/)).toBeDefined());
  });
});
