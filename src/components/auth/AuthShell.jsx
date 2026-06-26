/**
 * AuthShell — Split-screen layout for /login and /register
 * ──────────────────────────────────────────────────────────────────────────
 *  Desktop: left brand panel (gradient hero) + right form panel
 *  Mobile:  collapses to single column, brand strip on top
 *
 *  Usage:
 *    <AuthShell title="Welcome back" tagline="Sign in to continue">
 *      <form>…</form>
 *    </AuthShell>
 */

import { useAppSettings } from '../../context/AppSettingsContext';

export default function AuthShell({ title, tagline, children }) {
  const { app_name, app_tagline } = useAppSettings();
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-ink-50">

      {/* ── Brand panel ── */}
      <aside className="relative lg:w-1/2 bg-brand-gradient text-white overflow-hidden lg:min-h-screen">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-accent-400/30 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />

        {/* Logo + tagline */}
        <div className="relative px-6 sm:px-10 lg:px-16 py-8 lg:py-16 flex flex-col h-full min-h-[260px] lg:min-h-screen">
          <div className="flex items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-500 text-2xl shadow-pop">
              ⚡
            </span>
            <div>
              <p className="font-display text-2xl font-extrabold leading-none">{app_name}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/80 mt-0.5">{app_tagline}</p>
            </div>
          </div>

          {/* Big hero text — desktop only */}
          <div className="hidden lg:flex flex-col justify-center flex-1 mt-12">
            <h2 className="font-display text-4xl xl:text-5xl font-extrabold leading-tight">
              Groceries, meats &<br />meals — delivered in<br />minutes.
            </h2>
            <p className="mt-6 text-white/85 text-lg max-w-md">
              From neighbourhood kiranas straight to your door. Fresh, fast, fair.
            </p>

            <ul className="mt-10 space-y-3 max-w-md">
              <FeatureItem icon="🛒" label="Live inventory" desc="Only see what's actually in stock at nearby shops." />
              <FeatureItem icon="🛵" label="Real-time tracking" desc="Watch your order move from kirana to door." />
              <FeatureItem icon="⭐" label="Rate & review" desc="Help us improve every shop and delivery." />
            </ul>
          </div>

          {/* Mobile tagline (visible on small screens only) */}
          <div className="lg:hidden mt-4">
            <h2 className="font-display text-2xl font-extrabold leading-tight">
              Groceries delivered in minutes
            </h2>
          </div>

          {/* Footer line */}
          <p className="hidden lg:block mt-auto pt-8 text-[11px] text-white/60">
            © {new Date().getFullYear()} {app_name} · Made with ❤️ for local shops
          </p>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="lg:w-1/2 flex items-center justify-center px-4 py-10 sm:py-14 lg:py-0">
        <div className="w-full max-w-md">
          <div className="mb-7">
            <h1 className="font-display text-3xl font-extrabold text-ink-900">{title}</h1>
            {tagline && <p className="mt-1.5 text-sm text-ink-600">{tagline}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function FeatureItem({ icon, label, desc }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur text-lg">
        {icon}
      </span>
      <div>
        <p className="font-bold text-sm">{label}</p>
        <p className="text-xs text-white/80 mt-0.5">{desc}</p>
      </div>
    </li>
  );
}
