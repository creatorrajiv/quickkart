/**
 * Admin BannersPage — Manage hero banners shown on the customer storefront
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin/banners
 *
 *   • Lists all banners (active + inactive)
 *   • Upload new banner with image, title, subtitle, optional link URL, schedule
 *   • Edit any field
 *   • Toggle active
 *   • Drag-free reorder via "display order" number input
 *   • Delete (also removes the underlying storage file)
 *
 * Image storage:
 *   Uses the public `banners` bucket created in migration 008.
 */

import { useEffect, useState } from 'react';

import { AdminShell } from '../../components/admin';
import {
  fetchAllBanners, uploadBannerImage, deleteBannerImage,
  createBanner, updateBanner, deleteBanner,
} from '../../services/bannersService';
import { notify } from '../../lib/notify';
import { Button, Card, Input, Textarea, Field, Modal, Badge, EmptyState, Skeleton } from '../../ui';

export default function BannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [acting, setActing] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await fetchAllBanners();
    if (err) setError(err); else setBanners(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleToggleActive = async (b) => {
    setActing(b.id);
    const { error: err } = await updateBanner(b.id, { is_active: !b.is_active });
    setActing(null);
    if (err) { notify.error('Update failed', err.message); return; }
    setBanners(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !b.is_active } : x));
    notify.success(b.is_active ? 'Banner disabled' : 'Banner enabled');
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete banner "${b.title}"? This also removes the image file.`)) return;
    setActing(b.id);
    // Best-effort delete file (image_url may not directly map to a path; try)
    try {
      const url = new URL(b.image_url);
      // public URL format: <project>/storage/v1/object/public/banners/<path>
      const parts = url.pathname.split('/banners/');
      if (parts[1]) await deleteBannerImage(parts[1]);
    } catch { /* not a parseable URL — skip */ }
    const { error: err } = await deleteBanner(b.id);
    setActing(null);
    if (err) { notify.error('Delete failed', err.message); return; }
    setBanners(prev => prev.filter(x => x.id !== b.id));
    notify.success('Banner deleted');
  };

  const handleSaved = async () => {
    setModalOpen(false); setEditing(null);
    await load();
  };

  return (
    <AdminShell
      title="Banners"
      subtitle={`${banners.length} total · ${banners.filter(b => b.is_active).length} active`}
      actions={
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} size="md">+ New banner</Button>
      }
    >
      {loading && (
        <ul className="space-y-3">
          {[1,2].map(i => <Skeleton key={i} className="h-40" rounded="rounded-2xl" />)}
        </ul>
      )}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

      {!loading && !error && banners.length === 0 && (
        <EmptyState
          icon="🖼️"
          title="No banners yet"
          description="Upload a hero banner so it shows on the customer storefront carousel."
          action={<Button onClick={() => setModalOpen(true)}>+ Upload first banner</Button>}
        />
      )}

      {!loading && !error && banners.length > 0 && (
        <ul className="space-y-4">
          {banners.map(b => (
            <BannerCard
              key={b.id}
              banner={b}
              acting={acting === b.id}
              onEdit={() => { setEditing(b); setModalOpen(true); }}
              onToggle={() => handleToggleActive(b)}
              onDelete={() => handleDelete(b)}
            />
          ))}
        </ul>
      )}

      {modalOpen && (
        <BannerModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
    </AdminShell>
  );
}

// ─── Banner card ───────────────────────────────────────────────────────────
function BannerCard({ banner, acting, onEdit, onToggle, onDelete }) {
  return (
    <Card>
      <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-4 p-4">
        <div className="aspect-[16/9] sm:aspect-auto sm:h-32 rounded-xl overflow-hidden bg-gradient-to-br from-ink-100 to-ink-200">
          <img src={banner.image_url} alt={banner.title} className="h-full w-full object-cover"
            onError={e => { e.currentTarget.style.display = 'none'; }} />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-lg font-bold text-ink-900 truncate">{banner.title}</h3>
                <Badge tone={banner.is_active ? 'success' : 'neutral'} size="sm">
                  {banner.is_active ? '● Active' : '○ Disabled'}
                </Badge>
                <Badge tone="info" size="sm">Order: {banner.display_order}</Badge>
              </div>
              {banner.subtitle && <p className="text-sm text-ink-600 mt-0.5 line-clamp-1">{banner.subtitle}</p>}
              {banner.link_url && (
                <p className="text-[11px] text-brand-600 mt-1 truncate">→ {banner.link_url}</p>
              )}
            </div>
          </div>

          <div className="mt-auto pt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onEdit} disabled={acting}>Edit</Button>
            <Button variant="secondary" size="sm" onClick={onToggle} disabled={acting}>
              {banner.is_active ? 'Disable' : 'Enable'}
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete} disabled={acting} className="ml-auto">Delete</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Modal: create / edit ──────────────────────────────────────────────────
function BannerModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title:         initial?.title         ?? '',
    subtitle:      initial?.subtitle      ?? '',
    image_url:     initial?.image_url     ?? '',
    link_url:      initial?.link_url      ?? '',
    display_order: initial?.display_order ?? 0,
    is_active:     initial?.is_active     ?? true,
  });
  const [file,       setFile]       = useState(null);
  const [preview,    setPreview]    = useState(initial?.image_url ?? null);
  const [uploading,  setUploading]  = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked
      : e.target.type === 'number' ? Number(e.target.value)
      : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { notify.error('Pick an image file'); return; }
    if (f.size > 5 * 1024 * 1024)    { notify.error('Image must be under 5 MB'); return; }
    setFile(f);
    // Local preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { notify.error('Title is required'); return; }

    let imageUrl = form.image_url;
    if (file) {
      setUploading(true);
      const { url, error } = await uploadBannerImage(file);
      setUploading(false);
      if (error) { notify.error('Image upload failed', error.message); return; }
      imageUrl = url;
    }
    if (!imageUrl) { notify.error('Pick an image'); return; }

    setSubmitting(true);
    const payload = { ...form, image_url: imageUrl };
    const { error } = isEdit
      ? await updateBanner(initial.id, payload)
      : await createBanner(payload);
    setSubmitting(false);
    if (error) { notify.error('Save failed', error.message); return; }
    notify.success(isEdit ? 'Banner updated' : 'Banner created');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit banner' : 'Upload new banner'} size="lg">
      <form onSubmit={submit} className="px-5 py-4 space-y-4">

        {/* Preview + uploader */}
        <Field label="Banner image" required hint="Recommended: 1600 × 700px. Max 5 MB.">
          <div className="rounded-2xl border-2 border-dashed border-ink-200 overflow-hidden bg-ink-50">
            {preview ? (
              <div className="relative">
                <img src={preview} alt="preview" className="w-full aspect-[16/7] object-cover" />
                <label className="absolute inset-0 bg-ink-900/40 opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <span className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink-900 shadow-pop">Change image</span>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
              </div>
            ) : (
              <label className="flex aspect-[16/7] w-full flex-col items-center justify-center cursor-pointer text-ink-500 hover:bg-ink-100 transition-colors">
                <span className="text-5xl mb-2">🖼️</span>
                <span className="text-sm font-bold">Click to upload</span>
                <span className="text-xs mt-1">PNG, JPG up to 5 MB</span>
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </label>
            )}
          </div>
          {uploading && <p className="text-xs text-brand-600 mt-1">Uploading…</p>}
        </Field>

        <Field label="Title" required>
          <Input value={form.title} onChange={update('title')} required placeholder="Mega Monsoon Deals" />
        </Field>

        <Field label="Subtitle" hint="Shown below the title on the banner.">
          <Input value={form.subtitle} onChange={update('subtitle')} placeholder="Up to 40% off groceries this week" />
        </Field>

        <Field label="Link URL" hint="Optional. Customer is sent here when they tap the banner.">
          <Input value={form.link_url} onChange={update('link_url')} placeholder="/shop or https://example.com" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Display order" hint="Lower = shown first.">
            <Input type="number" value={form.display_order} onChange={update('display_order')} />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer h-11">
              <input type="checkbox" checked={form.is_active} onChange={update('is_active')} className="h-5 w-5 rounded text-brand-500" />
              Active
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting || uploading}>
            {isEdit ? 'Save changes' : 'Create banner'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
