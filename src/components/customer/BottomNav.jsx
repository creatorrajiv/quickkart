/**
 * BottomNav — Mobile bottom navigation for customers
 * ──────────────────────────────────────────────────────────────────────────
 *   • Visible only on small screens (sm:hidden)
 *   • Sticky at bottom, safe-area aware
 *   • 4 tabs: Home / Orders / Profile / Sign out
 */

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { to: '/shop',     label: 'Home',    icon: HomeIcon },
  { to: '/orders',   label: 'Orders',  icon: BagIcon  },
  { to: '/profile',  label: 'Profile', icon: UserIcon },
];

export default function BottomNav() {
  const { signOut } = useAuth();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 sm:hidden bg-white/95 backdrop-blur border-t border-ink-100 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors
                ${isActive ? 'text-brand-500' : 'text-ink-500'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon active={isActive} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button onClick={signOut}
            className="w-full flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold text-ink-500 active:text-brand-500">
            <ExitIcon /> <span>Exit</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

// Tiny inline icons — keeps bundle slim, no extra lib needed for these.
function HomeIcon({ active }) {
  return (
    <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" />
    </svg>
  );
}
function BagIcon({ active }) {
  return (
    <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l-1 13H7L6 7zM9 7V5a3 3 0 016 0v2" />
    </svg>
  );
}
function UserIcon({ active }) {
  return (
    <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 14a4 4 0 10-8 0M12 14a8 8 0 00-8 8h16a8 8 0 00-8-8z" />
    </svg>
  );
}
function ExitIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H9m4 7H5a2 2 0 01-2-2V7a2 2 0 012-2h8" />
    </svg>
  );
}
