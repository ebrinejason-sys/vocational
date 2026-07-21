import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Login from './Login';
import { ThemeProvider } from '../lib/theme';

const mockSignIn = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    accessToken: null,
    profile: null,
    loading: false,
    signIn: (...args: unknown[]) => mockSignIn(...args),
    completeSignIn: vi.fn(),
    signOut: vi.fn(),
  }),
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
  it('submits email and password via custom auth', async () => {
    mockSignIn.mockResolvedValue({});
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('you@streetchildren.org'), { target: { value: 'staff@scm.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('staff@scm.org', 'secret123'));
  });

  it('shows an error message when sign-in fails', async () => {
    mockSignIn.mockResolvedValue({ error: 'Invalid email or password' });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('you@streetchildren.org'), { target: { value: 'staff@scm.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/don’t match our records/)).toBeDefined());
  });
});
