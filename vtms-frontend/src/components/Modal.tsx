import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider dialog for long forms */
  size?: 'md' | 'lg';
}

/**
 * Simple accessible modal (title required for screen readers).
 * Escape and backdrop click close the dialog.
 */
export default function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vtms-modal-title"
        className={cn(
          'relative z-10 w-full bg-white shadow-xl border border-gray-100',
          'rounded-t-2xl sm:rounded-xl max-h-[92vh] flex flex-col',
          size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 id="vtms-modal-title" className="text-base font-bold text-gray-900 truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
