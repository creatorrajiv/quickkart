import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster }         from 'sonner';
import { AuthProvider }    from './context/AuthContext';
import { CartProvider }    from './context/CartProvider';
import { WishlistProvider } from './context/WishlistContext';
import { I18nProvider }    from './i18n/I18nProvider';

import { RoleRouter }      from './components/layout';
import { AppSettingsProvider } from './context/AppSettingsContext';

import LoginPage           from './pages/auth/LoginPage';
import RegisterPage        from './pages/auth/RegisterPage';
import ForgotPasswordPage  from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage   from './pages/auth/ResetPasswordPage';
import AppSettingsPage     from './pages/admin/AppSettingsPage';
import { ProductsPage, AdminOrdersPage, ShopsPage, AgentsPage, ShopkeepersPage, AdminDashboardPage, BannersPage, CategoriesPage, CouponsPage, ReviewsPage } from './pages/admin';
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
import WishlistPage      from './pages/customer/WishlistPage';
import SubscriptionsPage from './pages/customer/SubscriptionsPage';
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
    <I18nProvider>
    <AppSettingsProvider>
    <AuthProvider>
      <CartProvider>
      <WishlistProvider>
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
            <Route path="/login"            element={<LoginPage />} />
            <Route path="/register"         element={<RegisterPage />} />
            <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
            <Route path="/reset-password"   element={<ResetPasswordPage />} />

            {/* ── Customer ── */}
            <Route path="/shop"          element={<CustomerHomePage />} />
            <Route path="/cart"          element={<CartPage />} />
            <Route path="/orders"        element={<OrdersPage />} />
            <Route path="/orders/:id"    element={<OrderDetailPage />} />
            <Route path="/wishlist"      element={<WishlistPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />

            {/* ── Admin ── */}
            <Route path="/admin/products" element={<ProductsPage />} />
            <Route path="/admin/orders"   element={<AdminOrdersPage />} />
            <Route path="/admin/shops"    element={<ShopsPage />} />
            <Route path="/admin/agents"        element={<AgentsPage />} />
            <Route path="/admin/shopkeepers"   element={<ShopkeepersPage />} />
            <Route path="/admin"               element={<AdminDashboardPage />} />
            <Route path="/admin/banners"       element={<BannersPage />} />
            <Route path="/admin/categories"    element={<CategoriesPage />} />
            <Route path="/admin/coupons"       element={<CouponsPage />} />
            <Route path="/admin/reviews"       element={<ReviewsPage />} />
            <Route path="/admin/settings"      element={<AppSettingsPage />} />

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
      </WishlistProvider>
      </CartProvider>
    </AuthProvider>
    </AppSettingsProvider>
    </I18nProvider>
    </ErrorBoundary>
  );
}
