/**
 * Admin CategoriesPage — Manage product categories
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin/categories
 *
 *   • List every category with product count, active/inactive badge
 *   • Add / edit / delete categories
 *   • Set icon (emoji), sort order, active toggle
 *   • Deleting a category sets its products' category_id to NULL
 *     (admin can reassign them from /admin/products)
 */

import { useEffect, useState } from 'react';

import { AdminShell } from '../../components/admin';
import {
  fetchAllCategories, createCategory, updateCategory, deleteCategory,
  countProductsPerCategory, slugify,
} from '../../services/categoriesService';
import { notify } from '../../lib/notify';
import { Button, Card, Input, Textarea, Field, Modal, Badge, EmptyState, Skeleton } from '../../ui';

export default function CategoriesPage() {
  const [list, setList]       = useState([]);
  const [counts, setCounts]   = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [acting,    setActing]    = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data, error: err }, { data: c }] = await Promise.all([
      fetchAllCategories(),
      countProductsPerCategory(),
    ]);
    if (err) setError(err); else setList(data ?? []);
    setCounts(c ?? {});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    const op = editing ? updateCategory(editing.id, form) : createCategory(form);
    const { error } = await op;
    if (error) { notify.error('Save failed', error.message); return false; }
    notify.success(editing ? 'Category updated' : 'Category added');
    setModalOpen(false); setEditing(null);
    await load();
    return true;
  };

  const handleToggleActive = async (cat) => {
    setActing(cat.id);
    const { error } = await updateCategory(cat.id, { is_active: !cat.is_active });
    setActing(null);
    if (error) { notify.error('Update failed', error.message); return; }
    setList(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c));
  };

  const handleDelete = async (cat) => {
    const n = counts[cat.id] ?? 0;
    if (!window.confirm(`Delete "${cat.name}"?\n\n${n} product${n === 1 ? '' : 's'} will be left UNCATEGORIZED — you'll need to reassign them from /admin/products.`)) return;
    setActing(cat.id);
    const { error } = await deleteCategory(cat.id);
    setActing(null);
    if (error) { notify.error('Delete failed', error.message); return; }
    setList(prev => prev.filter(c => c.id !== cat.id));
    notify.success('Category deleted');
  };

  return (
    <AdminShell
      title="Categories"
      subtitle={`${list.length} total · ${list.filter(c => c.is_active).length} active`}
      actions={<Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ New category</Button>}
    >
      {loading && (
        <ul className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20" rounded="rounded-2xl" />)}
        </ul>
      )}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

      {!loading && !error && list.length === 0 && (
        <EmptyState
          icon="📂"
          title="No categories yet"
          description="Add your first category to organise products."
          action={<Button onClick={() => setModalOpen(true)}>+ Create first category</Button>}
        />
      )}

      {!loading && !error && list.length > 0 && (
        <ul className="space-y-3">
          {list.map(cat => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              productCount={counts[cat.id] ?? 0}
              acting={acting === cat.id}
              onEdit={() => { setEditing(cat); setModalOpen(true); }}
              onToggle={() => handleToggleActive(cat)}
              onDelete={() => handleDelete(cat)}
            />
          ))}
        </ul>
      )}

      {modalOpen && (
        <CategoryModal
          initial={editing}
          existingSlugs={list.map(c => c.slug).filter(s => s !== editing?.slug)}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </AdminShell>
  );
}

function CategoryCard({ cat, productCount, acting, onEdit, onToggle, onDelete }) {
  return (
    <Card>
      <div className="flex items-center gap-4 p-4">
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 text-3xl">
          {cat.icon || '📦'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold text-ink-900">{cat.name}</h3>
            <Badge tone={cat.is_active ? 'success' : 'neutral'} size="sm">
              {cat.is_active ? '● Active' : '○ Hidden'}
            </Badge>
            <Badge tone="info" size="sm">{productCount} product{productCount === 1 ? '' : 's'}</Badge>
            <Badge tone="purple" size="sm">Order: {cat.sort_order}</Badge>
          </div>
          <p className="text-xs text-ink-500 mt-0.5 truncate">
            <span className="font-mono">{cat.slug}</span>
            {cat.description && <> · {cat.description}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} disabled={acting}>Edit</Button>
          <Button variant="secondary" size="sm" onClick={onToggle} disabled={acting}>
            {cat.is_active ? 'Hide' : 'Show'}
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete} disabled={acting}>Delete</Button>
        </div>
      </div>
    </Card>
  );
}

function CategoryModal({ initial, existingSlugs, onClose, onSave }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name:        initial?.name        ?? '',
    slug:        initial?.slug        ?? '',
    icon:        initial?.icon        ?? '',
    description: initial?.description ?? '',
    sort_order:  initial?.sort_order  ?? 0,
    is_active:   initial?.is_active   ?? true,
  });
  const [autoSlug,   setAutoSlug]   = useState(!isEdit);
  const [submitting, setSubmitting] = useState(false);

  const update = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked
      : e.target.type === 'number' ? Number(e.target.value)
      : e.target.value;
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'name' && autoSlug) next.slug = slugify(v);
      return next;
    });
  };

  const handleSlugManual = (e) => { setAutoSlug(false); setForm(f => ({ ...f, slug: e.target.value })); };

  const submit = async (e) => {
    e.preventDefault();
    const finalSlug = form.slug || slugify(form.name);
    if (!form.name.trim()) { notify.error('Name is required'); return; }
    if (existingSlugs.includes(finalSlug)) { notify.error('Slug already used', 'Pick a different slug.'); return; }
    setSubmitting(true);
    const ok = await onSave({ ...form, slug: finalSlug });
    if (!ok) setSubmitting(false);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${initial.name}` : 'New category'} size="md">
      <form onSubmit={submit} className="px-5 py-4 space-y-4">
        <Field label="Name" required>
          <Input value={form.name} onChange={update('name')} placeholder="Bakery, Beverages, Snacks…" required />
        </Field>

        <Field label="Slug" required hint="URL-safe identifier. Auto-generated from name.">
          <Input value={form.slug} onChange={handleSlugManual} placeholder="bakery" required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon (emoji)" hint="Used on customer storefront tiles.">
            <Input value={form.icon} onChange={update('icon')} placeholder="🍞" maxLength={4} />
          </Field>
          <Field label="Sort order" hint="Lower = shown first.">
            <Input type="number" value={form.sort_order} onChange={update('sort_order')} />
          </Field>
        </div>

        <Field label="Description (optional)">
          <Textarea rows={2} value={form.description} onChange={update('description')} placeholder="Fresh-baked breads, cakes, pastries" />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={update('is_active')} className="h-5 w-5 rounded text-brand-500" />
          Active (visible on customer storefront)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting}>{isEdit ? 'Save changes' : 'Create category'}</Button>
        </div>
      </form>
    </Modal>
  );
}
