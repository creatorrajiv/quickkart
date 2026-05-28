/**
 * RoleRouter — Role-aware landing redirect
 * ──────────────────────────────────────────────────────────────────────────
 * Mounted at "/". Sends the user to the right home screen for their role:
 *
 *   • no session       → /login
 *   • role = admin     → /admin/orders
 *   • role = agent     → /agent/active-orders
 *   • role = customer  → /shop
 *
 * Why this exists:
 *   Earlier, "/" hardcoded a redirect to /admin/products. Customers landing on
 *   "/" got bounced to an admin page that refused their role — confusing.
 *
 * Adaptability:
 *   New role? Add a case. Change a default landing screen? Edit one line.
 *   Want a public landing page for unauthenticated visitors? Replace the
 *   <Navigate to="/login"> branch with a marketing component.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ROLE_HOMES = {
  admin:      '/admin',
  agent:      '/agent/active-orders',
  customer:   '/shop',
  shopkeeper: '/shopkeeper/dashboard',
};

export default function RoleRouter() {
  const { session, profile, loading } = useAuth();

  // Wait for auth + profile to resolve before routing
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  const home = ROLE_HOMES[profile?.role] ?? '/login';
  return <Navigate to={home} replace />;
}
