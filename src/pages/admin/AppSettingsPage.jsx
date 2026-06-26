import { useState } from 'react';
import AdminShell from '../../components/admin/AdminShell';
import { useAppSettings } from '../../context/AppSettingsContext';
import { notify } from '../../lib/notify';
import { Button, Input, Field } from '../../ui';

export default function AppSettingsPage() {
  const { app_name, app_tagline, update } = useAppSettings();
  const [name,    setName]    = useState(app_name);
  const [tagline, setTagline] = useState(app_tagline);
  const [saving,  setSaving]  = useState(false);

  // Keep fields in sync if context loads after first render
  useState(() => { setName(app_name); setTagline(app_tagline); });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const [r1, r2] = await Promise.all([
      update('app_name',    name.trim()    || 'QuickKart'),
      update('app_tagline', tagline.trim() || 'Hyperlocal Delivery'),
    ]);
    setSaving(false);
    if (r1.error || r2.error) {
      notify.error('Save failed', (r1.error || r2.error).message);
    } else {
      notify.success('App name updated!');
    }
  };

  return (
    <AdminShell title="App Settings" subtitle="Customize the name shown across the app">
      <div className="max-w-lg">
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-ink-100 shadow-card p-6 space-y-5">
          <Field label="App name" required>
            <Input
              size="lg"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Proyojoni QuickKart"
              required
            />
            <p className="mt-1 text-xs text-ink-500">Shown in the header, login screen, and PWA install prompt.</p>
          </Field>

          <Field label="Tagline">
            <Input
              size="lg"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="e.g. Hyperlocal Delivery"
            />
            <p className="mt-1 text-xs text-ink-500">Small text shown below the app name.</p>
          </Field>

          <div className="pt-2 flex items-center gap-3">
            <Button type="submit" loading={saving}>Save changes</Button>
            <button
              type="button"
              onClick={() => { setName('QuickKart'); setTagline('Hyperlocal Delivery'); }}
              className="text-sm text-ink-500 hover:text-ink-700"
            >
              Reset to default
            </button>
          </div>
        </form>

        {/* Live preview */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">Preview</p>
          <div className="flex items-center gap-2 bg-brand-gradient text-white rounded-2xl px-5 py-4 shadow-pop w-fit">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-500 text-xl shadow">⚡</span>
            <div>
              <p className="font-display text-lg font-extrabold leading-none">{name || 'QuickKart'}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/80 mt-0.5">{tagline || 'Hyperlocal Delivery'}</p>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
