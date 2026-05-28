/**
 * Button — primary UI primitive
 * ──────────────────────────────────────────────────────────────────────────
 * Variants:
 *   primary    — brand gradient, white text (main CTA)
 *   secondary  — white surface, brand border + text
 *   ghost      — transparent, ink text (back/cancel)
 *   danger     — red, white text (destructive)
 *   outline    — ink border, ink text (alt secondary)
 *
 * Sizes: sm | md | lg
 * Loading state: pass loading=true to disable + show spinner.
 *
 * Usage:
 *   <Button variant="primary" size="lg" onClick={...}>Place order</Button>
 *   <Button variant="ghost" leftIcon={<X/>}>Cancel</Button>
 */

import { forwardRef } from 'react';

const VARIANTS = {
  primary:   'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-brand hover:shadow-brand-lg',
  secondary: 'bg-white border border-brand-500 text-brand-600 hover:bg-brand-50',
  ghost:     'bg-transparent text-ink-700 hover:bg-ink-100',
  danger:    'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white shadow-sm',
  outline:   'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50',
};

const SIZES = {
  sm: 'h-9  px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2   rounded-xl',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-2xl',
};

const Button = forwardRef(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  children,
  ...rest
}, ref) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'transition-all duration-150 active:scale-[0.98]',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export default Button;
