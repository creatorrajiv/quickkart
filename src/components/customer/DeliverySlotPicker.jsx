/**
 * DeliverySlotPicker — Choose ASAP or a specific time
 * ──────────────────────────────────────────────────────────────────────────
 *  Common slot options:
 *    • ASAP (default)
 *    • Next available 1-hour window today (only if within shop hours)
 *    • Tomorrow morning / afternoon / evening
 *    • Custom time picker
 *
 *  Calls onChange({ value: Date|null, label: string }).
 *  value === null means "deliver ASAP".
 */

import { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/I18nProvider';

const HOURS = {
  morning:   { from: 9,  to: 12, label: 'Morning (9 AM–12 PM)' },
  afternoon: { from: 14, to: 17, label: 'Afternoon (2 PM–5 PM)' },
  evening:   { from: 18, to: 21, label: 'Evening (6 PM–9 PM)' },
};

export default function DeliverySlotPicker({ value, onChange }) {
  const { t } = useTranslation();
  const [customOpen, setCustomOpen] = useState(false);

  const slots = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const buildSlot = (date, hour, label) => {
      const d = new Date(date);
      d.setHours(hour, 0, 0, 0);
      return { value: d, label };
    };

    return [
      { value: null, label: 'ASAP', sub: 'Delivered as soon as possible' },
      buildSlot(tomorrow, HOURS.morning.from,   `Tomorrow · ${HOURS.morning.label}`),
      buildSlot(tomorrow, HOURS.afternoon.from, `Tomorrow · ${HOURS.afternoon.label}`),
      buildSlot(tomorrow, HOURS.evening.from,   `Tomorrow · ${HOURS.evening.label}`),
    ];
  }, []);

  const isSelected = (slot) => {
    if (!value && !slot.value) return true;
    if (!value || !slot.value) return false;
    return new Date(value).getTime() === slot.value.getTime();
  };

  const pickCustom = (e) => {
    const v = e.target.value;
    if (!v) { onChange({ value: null, label: 'ASAP' }); return; }
    const d = new Date(v);
    onChange({
      value: d.toISOString(),
      label: d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
    });
  };

  // For custom min/max: from "now + 1 hour" to "7 days out"
  const minDate = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
  const maxDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <h3 className="font-display text-base font-bold text-ink-900 mb-3">When do you want it?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {slots.map(slot => {
          const selected = isSelected(slot) && !customOpen;
          return (
            <button
              key={slot.label}
              type="button"
              onClick={() => { setCustomOpen(false); onChange({ value: slot.value ? slot.value.toISOString() : null, label: slot.label }); }}
              className={`relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.99]
                ${selected
                  ? 'border-brand-500 bg-brand-50 shadow-brand'
                  : 'border-ink-100 bg-white hover:border-brand-200 hover:shadow-card'
                }`}
            >
              <span className="text-xl">{!slot.value ? '⚡' : '📅'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink-900 truncate">{slot.label}</p>
                {slot.sub && <p className="text-[11px] text-ink-500 truncate">{slot.sub}</p>}
              </div>
              {selected && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white flex-shrink-0">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom datetime */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setCustomOpen(o => !o)}
          className="w-full text-xs font-bold text-brand-600 hover:underline text-left"
        >
          {customOpen ? '× Pick custom time' : '+ Pick custom date/time'}
        </button>
        {customOpen && (
          <input
            type="datetime-local"
            min={minDate}
            max={maxDate}
            onChange={pickCustom}
            className="mt-2 w-full rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        )}
      </div>
    </section>
  );
}
