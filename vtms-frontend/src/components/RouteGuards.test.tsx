import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { RequireAuth, RequireRole } from './RouteGuards';

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/unauthorized" element={<div>unauthorized page</div>} />
        <Route path="/protected" element={<RequireAuth><div>protected content</div></RequireAuth>} />
        <Route
          path="/admin-only"
          element={
            <RequireAuth>
              <RequireRole roles={['admin']}><div>admin content</div></RequireRole>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAuth', () => {
  it('redirects to /login when there is no session', () => {
    mockUseAuth.mockReturnValue({ session: null, profile: null, loading: false });
    renderWithRouter('/protected');
    expect(screen.getByText('login page')).toBeDefined();
  });

  it('renders children when a session exists', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '1' } },
      profile: { id: '1', fullName: 'A', email: 'a@b.com', role: 'admin', active: true },
      loading: false,
    });
    renderWithRouter('/protected');
    expect(screen.getByText('protected content')).toBeDefined();
  });
});

describe('RequireRole', () => {
  it('redirects to /unauthorized when role is not allowed', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '1' } },
      profile: { id: '1', fullName: 'A', email: 'a@b.com', role: 'trainer', active: true },
      loading: false,
    });
    renderWithRouter('/admin-only');
    expect(screen.getByText('unauthorized page')).toBeDefined();
  });

  it('renders children when role is allowed', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '1' } },
      profile: { id: '1', fullName: 'A', email: 'a@b.com', role: 'admin', active: true },
      loading: false,
    });
    renderWithRouter('/admin-only');
    expect(screen.getByText('admin content')).toBeDefined();
  });
});
