/**
 * Modal — accessible dialog primitive
 * ──────────────────────────────────────────────────────────────────────────
 *   <Modal open={open} onClose={() => setOpen(false)} title="Edit shop">
 *     <Modal.Body>…</Modal.Body>
 *     <Modal.Footer>…</Modal.Footer>
 *   </Modal>
 *
 *  • Backdrop click + Esc close.
 *  • Body scroll locked while open.
 *  • Slide-up animation on mobile, fade on desktop.
 */

import { useEffect } from 'react';

function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={[
          'w-full bg-white shadow-pop max-h-[92vh] flex flex-col',
          'rounded-t-3xl sm:rounded-3xl',
          'animate-slide-up',
          widths[size],
        ].join(' ')}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
            <h2 className="font-display text-lg font-bold text-ink-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-ink-500 hover:bg-ink-100 active:scale-95 transition-all"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

Modal.Body   = function ({ className = '', children }) { return <div className={['p-5', className].join(' ')}>{children}</div>; };
Modal.Footer = function ({ className = '', children }) { return <div className={['flex justify-end gap-2 px-5 py-4 border-t border-ink-100 bg-ink-50/50', className].join(' ')}>{children}</div>; };

export default Modal;
