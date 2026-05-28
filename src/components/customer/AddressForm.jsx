/**
 * AddressForm
 * ──────────────────────────────────────────────────────────────────────────
 * Inline-editable delivery address.
 *
 * Two modes:
 *   • Display — shows the saved address, with an "Edit" pencil button.
 *   • Edit    — textarea + Save / Cancel.
 *
 * Doesn't talk to Supabase directly. The parent passes the current value
 * and a save handler; the parent decides whether to persist to the
 * profiles table or only use for the current checkout.
 *
 * Props:
 *   value       string         — current address (controlled)
 *   onSave      (next:string) => Promise<{error?:Error}>
 *                                Called when user clicks Save in edit mode.
 *                                Return an error to keep the form open.
 *   savingLabel string         — optional override for save button label
 */

import { useEffect, useState } from 'react';

export default function AddressForm({ value, onSave, savingLabel }) {
  const [editing, setEditing] = useState(!value);   // auto-open if empty
  const [draft,   setDraft]   = useState(value ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  // Keep draft in sync if the parent value changes externally
  useEffect(() => { if (!editing) setDraft(value ?? ''); }, [value, editing]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Please enter your full delivery address.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = (await onSave?.(trimmed)) ?? {};
    setSaving(false);
    if (result.error) {
      setError(result.error.message ?? 'Could not save address.');
      return;
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value ?? '');
    setError(null);
    setEditing(false);
  };

  // ── Edit mode ────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600">
          Delivery Address
        </label>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          placeholder="House / flat, street, area, city, pincode…"
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5
            text-sm placeholder-gray-400
            focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white
              hover:bg-orange-600 active:scale-95 disabled:opacity-60 transition-all"
          >
            {saving ? (savingLabel ?? 'Saving…') : 'Save Address'}
          </button>
          {value && (
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700
                hover:bg-gray-50 active:scale-95 disabled:opacity-60 transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Display mode ─────────────────────────────────────────────────────────
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500">Delivering to</p>
        <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap break-words">
          {value}
        </p>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-orange-600
          hover:bg-orange-50 active:scale-95 transition-all"
      >
        Change
      </button>
    </div>
  );
}
