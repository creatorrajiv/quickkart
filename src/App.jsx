import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster }         from 'sonner';
import { AuthProvider }    from './context/AuthContext';
import { CartProvider }    from './context/CartProvider';

import { RoleRouter }      from './components/layout';

import LoginPage           from './pages/auth/LoginPage';
import RegisterPage        from './pages/auth/RegisterPage';
import { ProductsPage, AdminOrdersPage, ShopsPage, AgentsPage, ShopkeepersPage, AdminDashboardPage, BannersPage, CategoriesPage } from './pages/admin';
import ProfilePage  from './pages/shared/ProfilePage';
import NotFoundPage from './pages/shared/NotFoundPage';
import TermsPage    from './pages/shared/TermsPage';
import PrivacyPage  from './pages/shared/PrivacyPage';
import { ErrorBoundary, InstallPrompt } from './components/common';
import {
  ShopkeeperDashboardPage,
  ShopkeeperInventoryPage,
  ShopkeeperShopProfilePage,
} from './pages/shopkeeper';
import {
  HomePage as CustomerHomePage,
  CartPage,
  OrdersPage,
  OrderDetailPage,
} from './pages/customer';
import {
  ActiveOrdersPage,
  OrderHistoryPage as AgentHistoryPage,
} from './pages/agent';

/**
 * App Router
 *
 * Provider order matters:
 *   <AuthProvider>     ← session + profile (innermost data needed by pages)
 *     <CartProvider>   ← cart depends on nothing, but lives inside auth so
 *                         it can be cleared when the user signs out (later)
 *       <Router>       ← navigation
 *
 * Pages do their own auth/role guards internally:
 *   • Admin pages    → require role === 'admin'
 *   • Agent pages    → require role === 'agent'
 *   • Customer pages → require any authenticated session
 *
 * The "/" path is now role-aware via <RoleRouter />, which redirects to the
 * proper landing screen based on the signed-in user's role.
 */

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <CartProvider>
        {/* Sonner toasts — see lib/notify.js for the helpers that fire these. */}
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={4500}
          toastOptions={{
            style: { borderRadius: '14px', fontFamily: 'Inter, system-ui, sans-serif' },
          }}
        />
        <InstallPrompt />
        <BrowserRouter>
          <Routes>
            {/* ── Auth ── */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* ── Customer ── */}
            <Route path="/shop"          element={<CustomerHomePage />} />
            <Route path="/cart"          element={<CartPage />} />
            <Route path="/orders"        element={<OrdersPage />} />
            <Route path="/orders/:id"    element={<OrderDetailPage />} />

            {/* ── Admin ── */}
            <Route path="/admin/products" element={<ProductsPage />} />
            <Route path="/admin/orders"   element={<AdminOrdersPage />} />
            <Route path="/admin/shops"    element={<ShopsPage />} />
            <Route path="/admin/agents"        element={<AgentsPage />} />
            <Route path="/admin/shopkeepers"   element={<ShopkeepersPage />} />
            <Route path="/admin"               element={<AdminDashboardPage />} />
            <Route path="/admin/banners"       element={<BannersPage />} />
            <Route path="/admin/categories"    element={<CategoriesPage />} />

            {/* ── Shared (public legal pages + private profile) ── */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/terms"   element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* ── Shopkeeper (kirana owner) ── */}
            <Route path="/shopkeeper/dashboard"  element={<ShopkeeperDashboardPage />} />
            <Route path="/shopkeeper/inventory"  element={<ShopkeeperInventoryPage />} />
            <Route path="/shopkeeper/profile"    element={<ShopkeeperShopProfilePage />} />

            {/* ── Agent ── */}
            <Route path="/agent/active-orders" element={<ActiveOrdersPage />} />
            <Route path="/agent/history"       element={<AgentHistoryPage />} />

            {/* ── Root: role-aware redirect ── */}
            <Route path="/" element={<RoleRouter />} />

            {/* ── 404 ── */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
