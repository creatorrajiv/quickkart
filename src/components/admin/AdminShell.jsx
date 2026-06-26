/**
 * AdminShell — Shared layout for every /admin/* page
 * ──────────────────────────────────────────────────────────────────────────
 * Desktop: sticky left sidebar + main content area
 * Mobile:  collapsible drawer triggered from a top hamburger
 *
 * Usage:
 *   <AdminShell title="Orders" subtitle="324 total · 12 active" actions={<...>}>
 *     <main content />
 *   </AdminShell>
 *
 *  • Auth + role guard handled here so every admin page doesn't duplicate it
 *  • RoleMismatch screen rendered when a non-admin lands here
 */

import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { NotificationBell } from '../common';
import { Button } from '../../ui';

const NAV_LINKS = [
  { to: '/admin',              label: 'Dashboard',   icon: '📊' },
  { to: '/admin/orders',       label: 'Orders',      icon: '📦' },
  { to: '/admin/categories',   label: 'Categories',  icon: '📂' },
  { to: '/admin/products',     label: 'Products',    icon: '🛒' },
  { to: '/admin/shops',        label: 'Shops',       icon: '🏪' },
  { to: '/admin/agents',       label: 'Agents',      icon: '🛵' },
  { to: '/admin/shopkeepers',  label: 'Shopkeepers', icon: '🧑‍🍳' },
  { to: '/admin/banners',      label: 'Banners',     icon: '🖼️' },
  { to: '/admin/coupons',      label: 'Coupons',     icon: '🎟️' },
  { to: '/admin/reviews',      label: 'Reviews',     icon: '⭐' },
  { to: '/admin/settings',     label: 'Settings',    icon: '⚙️' },
];

export default function AdminShell({ title, subtitle, actions, children }) {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, signOut } = useAuth();
  const { app_name, app_logo_url } = useAppSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const isAdmin = profile?.role === 'admin';

  if (!authLoading && session && profile && !isAdmin) {
    return <RoleMismatch role={profile.role} email={session.user.email} onSignOut={signOut} />;
  }

  return (
    <div className="min-h-screen bg-ink-50">
      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm md:hidden" />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform md:translate-x-0
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        bg-gradient-to-b from-brand-600 via-brand-700 to-brand-900 text-white shadow-pop overflow-y-auto`}>
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          {app_logo_url ? (
            <img src={app_logo_url} alt={app_name} className="h-9 w-9 rounded-xl object-cover shadow" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-500 text-lg shadow">⚡</span>
          )}
          <div>
            <p className="font-display text-xl font-extrabold leading-none">{app_name}</p>
            <p className="text-[11px] uppercase tracking-wider text-white/70 mt-0.5">Admin Console</p>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {NAV_LINKS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${isActive ? 'bg-white text-brand-600 shadow-card' : 'text-white/85 hover:bg-white/10'}`
              }
            >
              <span className="text-lg leading-none">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Profile chip + sign out */}
        <div className="mt-auto px-3 py-4 border-t border-white/10">
          <NavLink to="/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/85 hover:bg-white/10 transition">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-600 font-extrabold text-sm">
              {(profile?.full_name?.[0] || profile?.email?.[0] || 'A').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">{profile?.full_name || 'Admin'}</p>
              <p className="text-[10px] text-white/70 truncate">{profile?.email}</p>
            </div>
          </NavLink>
          <button onClick={signOut} className="mt-2 w-full text-left px-3 py-2 rounded-xl text-xs text-white/85 hover:bg-white/10 transition">
            ↪ Sign out
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-ink-100">
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
            <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100 md:hidden" aria-label="Menu">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg font-extrabold text-ink-900 truncate">{title}</h1>
              {subtitle && <p className="text-[11px] text-ink-500 truncate">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <NotificationBell />
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 py-5 pb-10">{children}</main>
      </div>
    </div>
  );
}

function RoleMismatch({ role, email, onSignOut }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-amber-100 bg-white shadow-card p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-amber-900">Access denied</h2>
        <p className="text-sm text-amber-800">
          Admin console requires <code className="rounded bg-amber-100 px-1 font-mono text-xs">admin</code> role. Yours: <code className="rounded bg-amber-100 px-1 font-mono text-xs">{role}</code>.
        </p>
        <div className="rounded-xl bg-ink-50 border border-ink-100 p-3 font-mono text-xs text-ink-700 overflow-x-auto">
          <pre>{`UPDATE public.profiles\nSET role = 'admin'\nWHERE email = '${email}';`}</pre>
        </div>
        <Button onClick={onSignOut} variant="outline" fullWidth>Sign out</Button>
      </div>
    </div>
  );
}
