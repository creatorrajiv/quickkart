/**
 * AssignmentModeToggle
 * ──────────────────────────────────────────────────────────────────────────
 * A header-sized chip that lets the admin flip the platform-wide order
 * assignment mode between 'auto' and 'manual'.
 *
 * Reads + writes `platform_settings.order_assignment_mode` directly.
 * Lives on the admin shell pages (Orders, Shops) so the admin always sees
 * which mode is active.
 *
 * Props:
 *   onChanged   (optional) — callback fired after a successful write.
 *                            Lets the parent refetch dependent data.
 *
 * Behaviour:
 *   • Click while in 'auto'   → confirms, flips to 'manual'
 *   • Click while in 'manual' → confirms, flips to 'auto'
 *   • Errors surface inline via setError; no global toast assumed yet.
 *
 * Adaptability:
 *   Want more modes (e.g. 'auto-with-fallback')? Extend `MODE_META` —
 *   the rendering logic is data-driven.
 */

import { useEffect, useState } from 'react';
import {
  getSetting,
  setSetting,
  SETTING_KEYS,
} from '../../services/platformSettingsService';

const MODE_META = {
  auto: {
    label:    'Auto',
    sub:      'Orders are assigned by the fairness allocator',
    chip:     'bg-green-100 text-green-700 border-green-200',
    dot:      'bg-green-500',
  },
  manual: {
    label:    'Manual',
    sub:      'Orders arrive unassigned — pick a shop yourself',
    chip:     'bg-amber-100 text-amber-700 border-amber-200',
    dot:      'bg-amber-500',
  },
};

export default function AssignmentModeToggle({ onChanged }) {
  const [mode,    setMode]    = useState(null);   // null = loading
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  // ── Initial load ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { value, error: err } = await getSetting(SETTING_KEYS.ORDER_ASSIGNMENT_MODE);
      if (cancelled) return;
      if (err) setError(err);
      else     setMode(value === 'manual' ? 'manual' : 'auto');   // default auto
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Toggle handler ────────────────────────────────────────────────
  const handleToggle = async () => {
    if (saving || mode === null) return;

    const next = mode === 'auto' ? 'manual' : 'auto';
    const human = next === 'auto'
      ? 'Switch to AUTO? New orders will be auto-assigned to a fair shop.'
      : 'Switch to MANUAL? New orders will arrive unassigned — you must pick a shop for each one.';

    if (!window.confirm(human)) return;

    setSaving(true);
    setError(null);
    const { error: err } = await setSetting(SETTING_KEYS.ORDER_ASSIGNMENT_MODE, next);
    setSaving(false);

    if (err) {
      setError(err);
      return;
    }
    setMode(next);
    onChanged?.(next);
  };

  // ── Render ────────────────────────────────────────────────────────
  if (mode === null) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        <span className="text-xs font-medium text-gray-500">Loading…</span>
      </div>
    );
  }

  const meta = MODE_META[mode];

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleToggle}
        disabled={saving}
        title={meta.sub}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold
          transition-all hover:shadow-sm active:scale-95 disabled:opacity-60 ${meta.chip}`}
      >
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span>Assignment: {meta.label}</span>
        {saving && <span className="text-[10px] opacity-70">saving…</span>}
        <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m-4 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </button>
      {error && (
        <p className="text-[10px] text-red-600">{error.message}</p>
      )}
    </div>
  );
}
