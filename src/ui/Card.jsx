/**
 * Card — surface primitive
 * ──────────────────────────────────────────────────────────────────────────
 * Wraps content with a consistent surface, border, radius, shadow.
 *
 * Variants:
 *   default — white bg, soft shadow
 *   flat    — no shadow, just border
 *   raised  — bigger shadow, hover lift
 *   ghost   — no border, just bg
 *
 * Compositional bits: <Card.Header />, <Card.Body />, <Card.Footer />.
 */

const VARIANTS = {
  default: 'bg-white border border-ink-100 shadow-card',
  flat:    'bg-white border border-ink-200',
  raised:  'bg-white border border-ink-100 shadow-pop hover:shadow-pop hover:-translate-y-0.5 transition-all duration-200',
  ghost:   'bg-ink-50',
};

function Card({ variant = 'default', className = '', children, onClick, ...rest }) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={[
        'rounded-2xl',
        VARIANTS[variant],
        clickable ? 'cursor-pointer transition-all active:scale-[0.99]' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ className = '', children }) {
  return <div className={['px-5 py-4 border-b border-ink-100', className].join(' ')}>{children}</div>;
};
Card.Body = function CardBody({ className = '', children }) {
  return <div className={['p-5', className].join(' ')}>{children}</div>;
};
Card.Footer = function CardFooter({ className = '', children }) {
  return <div className={['px-5 py-4 border-t border-ink-100', className].join(' ')}>{children}</div>;
};

export default Card;
