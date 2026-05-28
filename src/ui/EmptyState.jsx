/**
 * EmptyState — friendly "no data" component
 * ──────────────────────────────────────────────────────────────────────────
 *   <EmptyState
 *     icon="📦"
 *     title="No orders yet"
 *     description="Place your first order from the storefront."
 *     action={<Button>Go shopping</Button>}
 *   />
 */

export default function EmptyState({ icon = '✨', title, description, action, className = '' }) {
  return (
    <div className={[
      'flex flex-col items-center justify-center text-center px-6 py-12',
      className,
    ].join(' ')}>
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-accent-50 text-4xl shadow-sm">
        {icon}
      </div>
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
