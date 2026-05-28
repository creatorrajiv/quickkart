/** Skeleton — animated placeholder block. */
export default function Skeleton({ className = '', rounded = 'rounded-xl' }) {
  return <div className={['animate-pulse bg-gradient-to-r from-ink-100 via-ink-200 to-ink-100', rounded, className].join(' ')} />;
}
