import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import Brand from '../components/Brand';
import ThemeToggle from '../components/ThemeToggle';
import Preloader from '../components/Preloader';

/**
 * Landing page for invite links. Supabase redirects invited staff here with
 * a session already established from the link's token; all they need to do
 * is choose a password before entering the app.
 */
export default function Welcome() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) return <Preloader label="Checking your invite…" />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/', { replace: true }), 1200);
  }

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-white pl-10 pr-10 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20';

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 bg-[var(--app-bg)]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in-up">
        <div className="flex flex-col items-center text-center mb-6">
          <Brand size="lg" markOnly className="mb-4" />
          <h1 className="font-display text-2xl font-semibold text-gray-900">Welcome to the team</h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-600">
            Street Children Ministry · CTVET
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          {!session ? (
            <div className="text-center py-4">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <h2 className="text-base font-bold text-gray-900">This invite link isn’t valid</h2>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                It may have expired or already been used. Ask your administrator
                to send a new invitation from the Staff page.
              </p>
            </div>
          ) : done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <h2 className="text-base font-bold text-gray-900">Password set</h2>
              <p className="text-xs text-gray-500 mt-2">Taking you to your workspace…</p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">Choose your password</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Signed in as <span className="font-semibold text-gray-700">{session.user.email}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-xs font-semibold text-gray-600 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={inputCls}
                      placeholder="Repeat the password"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors',
                    submitting ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
                  )}
                >
                  {submitting ? 'Saving…' : 'Set password & continue'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
