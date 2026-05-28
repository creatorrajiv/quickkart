import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * RoleGuard
 * Combines session check + role check in one wrapper.
 * - Unauthenticated  → redirect to /login
 * - Wrong role       → redirect to `unauthorizedRedirect` (default '/')
 * - Correct role     → renders children
 *
 * Usage (wrap a Route):
 *   <Route
 *     path="/admin/*"
 *     element={
 *       <RoleGuard allowedRoles={['admin']}>
 *         <AdminLayout />
 *       </RoleGuard>
 *     }
 *   />
 *
 * Usage (wrap a page component directly):
 *   <RoleGuard allowedRoles={['admin', 'agent']}>
 *     <SomePage />
 *   </RoleGuard>
 *
 * Props:
 *   allowedRoles        string[]  — required; roles permitted to view children
 *   fallback            ReactNode — shown while auth resolves (default: null)
 *   loginRedirect       string    — redirect if not logged in (default: '/login')
 *   unauthorizedRedirect string   — redirect if logged in but wrong role (default: '/')
 */
export default function RoleGuard({
  allowedRoles,
  children,
  fallback             = null,
  loginRedirect        = '/login',
  unauthorizedRedirect = '/',
}) {
  const { session, profile, loading } = useAuth();

  if (loading)   return fallback;
  if (!session)  return <Navigate to={loginRedirect}        replace />;

  const hasRole = profile && allowedRoles.includes(profile.role);
  if (!hasRole)  return <Navigate to={unauthorizedRedirect} replace />;

  return children;
}
