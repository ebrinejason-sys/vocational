import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { cn } from '../lib/utils';

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors',
        isDark ? 'border-primary-700 bg-primary-900/40' : 'border-gray-200 bg-gray-100',
        className
      )}
    >
      <span
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm transition-transform duration-200',
          isDark ? 'translate-x-7 text-primary-300' : 'translate-x-1'
        )}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
