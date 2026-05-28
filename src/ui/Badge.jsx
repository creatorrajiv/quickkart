/**
 * Badge — colored chip primitive
 * ──────────────────────────────────────────────────────────────────────────
 * For statuses, counts, tags.
 *
 *   <Badge tone="success">Active</Badge>
 *   <Badge tone="warning" icon="●">Closed</Badge>
 *   <Badge variant="solid" tone="brand">NEW</Badge>
 */

const TONES = {
  neutral: { soft: 'bg-ink-100   text-ink-700',     solid: 'bg-ink-700    text-white' },
  brand:   { soft: 'bg-brand-100 text-brand-700',   solid: 'bg-brand-500  text-white' },
  success: { soft: 'bg-green-100 text-green-700',   solid: 'bg-green-600  text-white' },
  warning: { soft: 'bg-amber-100 text-amber-700',   solid: 'bg-amber-500  text-white' },
  danger:  { soft: 'bg-red-100   text-red-700',     solid: 'bg-red-600    text-white' },
  info:    { soft: 'bg-blue-100  text-blue-700',    solid: 'bg-blue-600   text-white' },
  purple:  { soft: 'bg-purple-100 text-purple-700', solid: 'bg-purple-600 text-white' },
};

const SIZES = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs    px-2   py-0.5 gap-1',
  lg: 'text-sm    px-2.5 py-1   gap-1.5',
};

export default function Badge({
  tone = 'neutral', variant = 'soft', size = 'md', icon, className = '', children,
}) {
  return (
    <span className={[
      'inline-flex items-center font-medium rounded-full whitespace-nowrap',
      TONES[tone]?.[variant] ?? TONES.neutral.soft,
      SIZES[size],
      className,
    ].join(' ')}>
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
