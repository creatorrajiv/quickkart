import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute
 * Ensures a Supabase session exists before rendering children.
 * Redirects to /login if the user is not authenticated.
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/orders" element={<OrdersPage />} />
 *   </Route>
 *
 * Or wrapping a single page:
 *   <ProtectedRoute><ProfilePage /></ProtectedRoute>
 *
 * Props:
 *   fallback  ReactNode — shown while auth resolves (default: null)
 *   redirectTo string   — where to send unauthenticated users (default: '/login')
 */
export default function ProtectedRoute({
  children,
  fallback   = null,
  redirectTo = '/login',
}) {
  const { session, loading } = useAuth();

  if (loading)   return fallback;
  if (!session)  return <Navigate to={redirectTo} replace />;

  return children;
}
