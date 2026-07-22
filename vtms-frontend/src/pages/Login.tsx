import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import Brand from '../components/Brand';
import ThemeToggle from '../components/ThemeToggle';
import Preloader from '../components/Preloader';

const PUBLIC_AUTH_PATHS = new Set(['/login', '/welcome', '/reset-password', '/forgot-password']);

export default function Login() {
  const { accessToken, profile, loading: authLoading, signIn, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) {
    return <Preloader label="Loading…" />;
  }

  if (accessToken && profile?.active) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
    const target = PUBLIC_AUTH_PATHS.has(from) ? '/' : from;
    return <Navigate to={target} replace />;
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(
        result.error === 'Invalid email or password'
          ? 'That email and password don’t match our records.'
          : result.error,
      );
      return;
    }
    if (result.requiresOtp) {
      setOtpEmail(result.email ?? email.trim());
      setOtp('');
      return;
    }
    navigate('/', { replace: true });
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    if (!otpEmail) return;
    setError(null);
    setSubmitting(true);
    const result = await verifyOtp(otpEmail, otp);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate('/', { replace: true });
  }

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20';

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 bg-[var(--app-bg)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, rgba(13,148,136,0.12), transparent 60%)',
        }}
      />

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in-up">
        <div className="flex flex-col items-center text-center mb-6">
          <Brand size="lg" markOnly className="mb-4" />
          <h1 className="font-display text-2xl font-semibold text-gray-900">Street Children Ministry</h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-600">
            CTVET · Vocational Skills Training
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          {otpEmail ? (
            <>
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">Enter login code</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  We emailed a 6-digit code to <span className="font-semibold text-gray-700">{otpEmail}</span>.
                </p>
              </div>
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <label htmlFor="otp" className="block text-xs font-semibold text-gray-600 mb-1.5">
                    One-time code
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      minLength={6}
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={inputCls}
                      placeholder="123456"
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
                  disabled={submitting || otp.length !== 6}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors',
                    submitting || otp.length !== 6
                      ? 'bg-primary-400 cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700',
                  )}
                >
                  {submitting ? 'Verifying…' : 'Verify & continue'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpEmail(null);
                    setOtp('');
                    setError(null);
                  }}
                  className="w-full text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  Back to password
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">Sign in to your workspace</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Password first, then a one-time code emailed to you.
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                      placeholder="you@streetchildren.org"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(inputCls, 'pr-10')}
                      placeholder="••••••••"
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
                    submitting ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700',
                  )}
                >
                  <LogIn className="w-4 h-4" />
                  {submitting ? 'Checking…' : 'Continue'}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-gray-500">
                <Link to="/forgot-password" className="text-primary-600 hover:text-primary-700 font-semibold">
                  Forgot your password?
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400 font-display italic">
          “To look after orphans &amp; widows in their distress.” — James 1:27
        </p>
      </div>
    </div>
  );
}
