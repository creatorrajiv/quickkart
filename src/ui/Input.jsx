/**
 * Input + Textarea + Select — form primitives
 * ──────────────────────────────────────────────────────────────────────────
 * Consistent height, focus ring, error state, optional left/right icons.
 */

import { forwardRef } from 'react';

const SIZES = {
  sm: 'h-9  text-xs  rounded-lg  px-3',
  md: 'h-11 text-sm  rounded-xl  px-3.5',
  lg: 'h-13 text-base rounded-2xl px-4',
};

const baseInput = (size, error) => [
  'w-full bg-white border outline-none transition-colors',
  SIZES[size],
  error
    ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
    : 'border-ink-200 hover:border-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
  'placeholder:text-ink-400',
  'disabled:bg-ink-100 disabled:text-ink-500 disabled:cursor-not-allowed',
].join(' ');

export const Input = forwardRef(function Input({
  size = 'md', error = false, leftIcon, rightIcon, className = '', ...rest
}, ref) {
  if (!leftIcon && !rightIcon) {
    return <input ref={ref} className={[baseInput(size, error), className].join(' ')} {...rest} />;
  }
  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">{leftIcon}</span>
      )}
      <input
        ref={ref}
        className={[
          baseInput(size, error),
          leftIcon  ? 'pl-10' : '',
          rightIcon ? 'pr-10' : '',
          className,
        ].join(' ')}
        {...rest}
      />
      {rightIcon && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">{rightIcon}</span>
      )}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({
  error = false, className = '', rows = 3, ...rest
}, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={[
        'w-full bg-white border outline-none transition-colors rounded-xl px-3.5 py-2.5 text-sm',
        error
          ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
          : 'border-ink-200 hover:border-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
        'placeholder:text-ink-400',
        'disabled:bg-ink-100 disabled:text-ink-500 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
      {...rest}
    />
  );
});

export const Select = forwardRef(function Select({
  size = 'md', error = false, className = '', children, ...rest
}, ref) {
  return (
    <select
      ref={ref}
      className={[
        baseInput(size, error),
        'appearance-none bg-no-repeat pr-9',
        'bg-[length:14px_14px] bg-[right_0.75rem_center]',
        // Tiny inline chevron — no extra asset needed
        'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2024%2024%27%20stroke%3D%27%2364748b%27%20stroke-width%3D%272.5%27%3E%3Cpath%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20d%3D%27M19%209l-7%207-7-7%27%2F%3E%3C%2Fsvg%3E")]',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </select>
  );
});

/** Field wrapper — label + hint + error message. */
export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-xs font-semibold text-ink-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error  && <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

export default Input;
