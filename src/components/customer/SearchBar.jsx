/**
 * SearchBar — v2 Bigger, rounder search input
 * ──────────────────────────────────────────────────────────────────────────
 * Debounced. Tall pill shape, prominent search icon, soft shadow.
 * Props identical to v1.
 */

import { useEffect, useState } from 'react';

export default function SearchBar({
  value = '',
  onChange,
  placeholder = 'Search for groceries, meals, eggs…',
  delay = 250,
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => {
    const id = setTimeout(() => { if (local !== value) onChange?.(local); }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, delay]);

  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-500"
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
      </svg>

      <input
        type="search"
        value={local}
        onChange={e => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-white border border-ink-100 py-3.5 pl-12 pr-10
          text-sm font-medium placeholder-ink-400 shadow-card
          focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 focus:shadow-pop
          transition-all"
      />

      {local && (
        <button
          onClick={() => setLocal('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5
            text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
          aria-label="Clear"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
