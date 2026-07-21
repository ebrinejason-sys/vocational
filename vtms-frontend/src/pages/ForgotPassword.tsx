import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import Brand from '../components/Brand';
import ThemeToggle from '../components/ThemeToggle';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailWarning(null);
    setSubmitting(true);
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      emailSent?: boolean;
      emailWarning?: string;
    };
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.');
      return;
    }
    if (data.emailSent === false && data.emailWarning) {
      setEmailWarning(data.emailWarning);
    }
    setDone(true);
  }

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20';

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 bg-[var(--app-bg)]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in-up">
        <div className="flex flex-col items-center text-center mb-6">
          <Brand size="lg" markOnly className="mb-4" />
          <h1 className="font-display text-2xl font-semibold text-gray-900">Reset password</h1>
        </div>

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
          {done ? (
            <div className="text-center py-2">
              {emailWarning ? (
                <>
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                  <p className="text-sm text-gray-700 font-semibold">Email could not be sent</p>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">{emailWarning}</p>
                  <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                    Usual fix: verify <code className="text-[10px]">scmtvet.com</code> in Resend,
                    or temporarily set <code className="text-[10px]">EMAIL_FROM</code> to{' '}
                    <code className="text-[10px]">VTMS &lt;onboarding@resend.dev&gt;</code>
                    (only delivers to your Resend account email).
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">
                    If that email is registered, we sent a reset link. Check your inbox (and spam).
                  </p>
                </>
              )}
              <Link to="/login" className="inline-block mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-gray-500">
                Enter your staff email and we&apos;ll send a link to choose a new password.
              </p>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    placeholder="you@streetchildren.org"
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
                  'w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors',
                  submitting ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700',
                )}
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>

              <p className="text-center text-xs text-gray-500">
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
