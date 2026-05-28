/**
 * SearchBar — v3 with search history dropdown
 * ──────────────────────────────────────────────────────────────────────────
 *  Same debounced API as before, plus:
 *    • Stores last 5 unique searches in localStorage
 *    • When the input is focused AND empty, shows a dropdown of recent queries
 *    • Clicking a recent query fills the field and runs the search
 *    • Single trash icon clears all history
 */

import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'quickkart.search.history';
const MAX_ITEMS = 5;

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS))); }
  catch { /* ignore quota issues */ }
}

export default function SearchBar({
  value = '',
  onChange,
  placeholder = 'Search for groceries, meals, eggs…',
  delay = 250,
}) {
  const [local, setLocal] = useState(value);
  const [history, setHistory] = useState([]);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { setHistory(loadHistory()); }, []);

  // Debounce → push to parent + commit non-trivial query to history
  useEffect(() => {
    const id = setTimeout(() => {
      if (local === value) return;
      onChange?.(local);
      const trimmed = local.trim();
      if (trimmed.length >= 2) {
        const next = [trimmed, ...history.filter(h => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_ITEMS);
        setHistory(next);
        saveHistory(next);
      }
    }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, delay]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!focused) return;
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setFocused(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [focused]);

  const pickHistory = (term) => {
    setLocal(term);
    onChange?.(term);
    setFocused(false);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const showDropdown = focused && local.trim() === '' && history.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
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
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-white border border-ink-100 py-3.5 pl-12 pr-10
          text-sm font-medium placeholder-ink-400 shadow-card
          focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 focus:shadow-pop
          transition-all"
      />

      {local && (
        <button
          onClick={() => { setLocal(''); onChange?.(''); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
          aria-label="Clear"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {showDropdown && (
        <div className="absolute z-30 top-full mt-1.5 left-0 right-0 rounded-2xl bg-white border border-ink-100 shadow-pop overflow-hidden animate-slide-up">
          <div className="px-4 py-2 flex items-center justify-between border-b border-ink-100">
            <span className="text-[11px] uppercase tracking-wide font-bold text-ink-500">Recent searches</span>
            <button onClick={clearHistory} className="text-[11px] font-bold text-brand-600 hover:underline">
              Clear
            </button>
          </div>
          <ul>
            {history.map((term) => (
              <li key={term}>
                <button
                  onClick={() => pickHistory(term)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-ink-50 transition-colors"
                >
                  <svg className="h-4 w-4 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-ink-800">{term}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
