import logo from '../assets/scm-logo.jpg';
import { cn } from '../lib/utils';

const SIZES = {
  sm: { box: 'h-9 w-9', title: 'text-sm', sub: 'text-[9px]' },
  md: { box: 'h-11 w-11', title: 'text-base', sub: 'text-[10px]' },
  lg: { box: 'h-16 w-16', title: 'text-xl', sub: 'text-[11px]' },
} as const;

interface BrandProps {
  size?: keyof typeof SIZES;
  /** Hide the wordmark and show the crest alone. */
  markOnly?: boolean;
  className?: string;
}

/**
 * Street Children Ministry brand lockup — the crest in a rounded badge beside
 * the CTVET / VST wordmark. Reused in the sidebar, login card, and preloader
 * so the identity reads the same everywhere.
 */
export default function Brand({ size = 'md', markOnly = false, className }: BrandProps) {
  const s = SIZES[size];
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src={logo}
        alt="Street Children Ministry crest"
        className={cn('shrink-0 rounded-xl object-cover ring-1 ring-black/10 shadow-sm', s.box)}
      />
      {!markOnly && (
        <div className="leading-tight">
          <p className={cn('font-display font-semibold text-gray-900', s.title)}>
            Street Children Ministry
          </p>
          <p className={cn('uppercase tracking-[0.18em] font-semibold text-primary-600', s.sub)}>
            CTVET · Vocational Skills
          </p>
        </div>
      )}
    </div>
  );
}
