import logo from '../assets/scm-logo.jpg';

/**
 * Branded full-screen loader shown while the session and first data load
 * resolve. The crest scales in behind a soft pulsing ring — the app's one
 * deliberate load moment, kept calm and on-brand.
 */
export default function Preloader({ label = 'Preparing your workspace…' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--app-bg)] px-6 text-center">
      <div className="relative animate-logo-in">
        <span className="absolute inset-0 rounded-2xl bg-primary-500/30 animate-ring-pulse" aria-hidden="true" />
        <img
          src={logo}
          alt="Street Children Ministry"
          className="relative h-20 w-20 rounded-2xl object-cover shadow-lg ring-1 ring-black/10"
        />
      </div>

      <p className="mt-6 font-display text-lg font-semibold text-gray-900 animate-fade-in-up">
        Street Children Ministry
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 animate-fade-in-up">
        CTVET · Vocational Skills Training
      </p>

      <div className="mt-8 flex items-center gap-2 text-sm text-gray-500 animate-fade-in">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500" />
        <span className="ml-2">{label}</span>
      </div>
    </div>
  );
}
