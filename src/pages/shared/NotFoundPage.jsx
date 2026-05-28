/**
 * NotFoundPage — 404
 * ──────────────────────────────────────────────────────────────────────────
 * Friendlier than a blind redirect. Suggests where to go next based on role.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../ui';

export default function NotFoundPage() {
  const { session, profile } = useAuth();

  const homePath = !session ? '/login'
    : profile?.role === 'admin'      ? '/admin'
    : profile?.role === 'agent'      ? '/agent/active-orders'
    : profile?.role === 'shopkeeper' ? '/shopkeeper/dashboard'
    : '/shop';

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute top-10 left-10 h-72 w-72 rounded-full bg-brand-200/50 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-accent-200/50 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md text-center">
        <p className="font-display text-[8rem] sm:text-[10rem] font-extrabold leading-none bg-brand-gradient bg-clip-text text-transparent">
          404
        </p>
        <h1 className="font-display text-2xl font-extrabold text-ink-900 -mt-4">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="mt-6 flex flex-col gap-2 max-w-xs mx-auto">
          <Link to={homePath}>
            <Button size="lg" fullWidth>Take me home</Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="lg" fullWidth>Sign in</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
