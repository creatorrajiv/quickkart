import { useState, useEffect, useRef } from 'react';
import AdminShell from '../../components/admin/AdminShell';
import { useAppSettings } from '../../context/AppSettingsContext';
import { notify } from '../../lib/notify';
import { Button, Input, Field } from '../../ui';

export default function AppSettingsPage() {
  const { app_name, app_tagline, app_logo_url, update, reload } = useAppSettings();

  const [name,       setName]       = useState('');
  const [tagline,    setTagline]    = useState('');
  const [logoUrl,    setLogoUrl]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef();

  // Sync fields once context loads
  useEffect(() => {
    setName(app_name);
    setTagline(app_tagline);
    setLogoUrl(app_logo_url);
  }, [app_name, app_tagline, app_logo_url]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const results = await Promise.all([
      update('app_name',    name.trim()    || 'QuickKart'),
      update('app_tagline', tagline.trim() || 'Hyperlocal Delivery'),
    ]);
    setSaving(false);
    const err = results.find(r => r.error)?.error;
    if (err) notify.error('Save failed', err.message);
    else notify.success('Settings saved!');
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) { notify.error('Logo must be under 1 MB'); return; }

    setUploading(true);

    // Convert to base64 data URL — no storage bucket needed
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      const { error } = await update('app_logo_url', dataUrl);
      setUploading(false);
      if (error) notify.error('Failed to save logo', error.message);
      else { setLogoUrl(dataUrl); notify.success('Logo updated!'); }
    };
    reader.onerror = () => { setUploading(false); notify.error('Could not read file'); };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    const { error } = await update('app_logo_url', '');
    if (error) notify.error('Failed to remove logo', error.message);
    else { setLogoUrl(''); notify.success('Logo removed'); }
  };

  return (
    <AdminShell title="App Settings" subtitle="Customize branding shown across the app">
      <div className="max-w-lg space-y-6">

        {/* ── Name & tagline ── */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-ink-100 shadow-card p-6 space-y-5">
          <h2 className="font-display font-bold text-ink-900">App name & tagline</h2>

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

          <div className="flex items-center gap-3">
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

        {/* ── Logo upload ── */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-card p-6 space-y-4">
          <h2 className="font-display font-bold text-ink-900">Shop / App logo</h2>
          <p className="text-xs text-ink-500">PNG or JPG, max 2 MB. Shown instead of the ⚡ icon in the header and login screen.</p>

          {logoUrl ? (
            <div className="flex items-center gap-4">
              <img
                src={logoUrl}
                alt="App logo"
                className="h-16 w-16 rounded-xl object-cover border border-ink-100 shadow-sm"
              />
              <div className="space-y-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="block text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  Replace logo
                </button>
                <button
                  onClick={handleRemoveLogo}
                  className="block text-sm text-red-500 hover:text-red-700"
                >
                  Remove logo
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-ink-200 hover:border-brand-400 hover:bg-brand-50 transition text-ink-400 hover:text-brand-600 disabled:opacity-50"
            >
              {uploading ? (
                <span className="text-sm">Uploading…</span>
              ) : (
                <>
                  <span className="text-3xl mb-1">🖼️</span>
                  <span className="text-sm font-medium">Click to upload logo</span>
                  <span className="text-xs mt-0.5">PNG, JPG up to 2 MB</span>
                </>
              )}
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>

        {/* ── Live preview ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">Live preview</p>
          <div className="flex items-center gap-3 bg-brand-gradient text-white rounded-2xl px-5 py-4 shadow-pop w-fit">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="h-10 w-10 rounded-xl object-cover shadow" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-500 text-xl shadow">⚡</span>
            )}
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
