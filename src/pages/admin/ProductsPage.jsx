/**
 * Admin ProductsPage — v3 redesign with image upload + dynamic categories
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin/products
 *
 *  • Lists every product with image, name, price, category, in-stock state
 *  • Filter pills by category (sourced from product_categories)
 *  • Search by name
 *  • + Add product modal: image upload, category select, price, description
 *  • Inline price + name + stock toggle per row
 *  • Edit / delete (with storage cleanup)
 */

import { useEffect, useMemo, useState } from 'react';

import { AdminShell } from '../../components/admin';
import {
  fetchAllProducts, uploadProductImage, uploadProductImages,
  deleteProductImage, deleteProductImages,
  createProduct, updateProduct, deleteProduct,
} from '../../services/productsService';
import { fetchAllCategories } from '../../services/categoriesService';
import { notify } from '../../lib/notify';
import { formatPrice } from '../../config/business';
import {
  Button, Card, Input, Textarea, Field, Select, Modal,
  Badge, EmptyState, Skeleton,
} from '../../ui';

export default function ProductsPage() {
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [acting,     setActing]     = useState(null);
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: prods, error: pErr }, { data: cats }] = await Promise.all([
      fetchAllProducts(),
      fetchAllCategories(),
    ]);
    if (pErr) setError(pErr); else setProducts(prods ?? []);
    setCategories((cats ?? []).filter(c => c.is_active));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form, newFiles, retainedUrls, retainedPaths) => {
    let payload = { ...form };

    // Upload any newly-added files
    let uploadedUrls = [];
    let uploadedPaths = [];
    if (newFiles?.length) {
      const { urls, paths, error } = await uploadProductImages(newFiles);
      if (error) { notify.error('Image upload failed', error.message); return false; }
      uploadedUrls = urls;
      uploadedPaths = paths;
    }

    const finalUrls  = [...(retainedUrls  ?? []), ...uploadedUrls];
    const finalPaths = [...(retainedPaths ?? []), ...uploadedPaths];

    payload.image_urls  = finalUrls;
    payload.image_paths = finalPaths;
    payload.image_url   = finalUrls[0]   ?? null;   // primary
    payload.image_path  = finalPaths[0]  ?? null;

    const op = editing ? updateProduct(editing.id, payload) : createProduct(payload);
    const { error } = await op;
    if (error) { notify.error('Save failed', error.message); return false; }

    // Clean up storage files that were removed during edit
    if (editing) {
      const removed = (editing.image_paths ?? []).filter(p => !finalPaths.includes(p));
      if (removed.length) await deleteProductImages(removed);
    }

    notify.success(editing ? 'Product updated' : 'Product added');
    setModalOpen(false); setEditing(null);
    await load();
    return true;
  };

  const handleToggleStock = async (p) => {
    setActing(p.id);
    const { error } = await updateProduct(p.id, { is_available: !p.is_available });
    setActing(null);
    if (error) { notify.error('Update failed', error.message); return; }
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: !p.is_available } : x));
    notify.success(!p.is_available ? 'Back in stock' : 'Marked out of stock');
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setActing(p.id);
    // Delete all gallery files + fall back to primary
    const allPaths = (p.image_paths?.length ? p.image_paths : (p.image_path ? [p.image_path] : []));
    if (allPaths.length) await deleteProductImages(allPaths);
    const { error } = await deleteProduct(p.id);
    setActing(null);
    if (error) { notify.error('Delete failed', error.message); return; }
    setProducts(prev => prev.filter(x => x.id !== p.id));
    notify.success('Product deleted');
  };

  // Filter + search
  const filtered = useMemo(() => {
    let out = products;
    if (filter !== 'all') out = out.filter(p => p.category_id === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(p => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
    }
    return out;
  }, [products, filter, search]);

  const counts = useMemo(() => {
    const c = { all: products.length };
    for (const p of products) if (p.category_id) c[p.category_id] = (c[p.category_id] ?? 0) + 1;
    return c;
  }, [products]);

  const inStock = products.filter(p => p.is_available).length;
  const outStock = products.length - inStock;

  return (
    <AdminShell
      title="Products"
      subtitle={`${products.length} total · ${inStock} in stock · ${outStock} out of stock`}
      actions={
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} disabled={categories.length === 0}>
          + Add product
        </Button>
      }
    >
      <div className="space-y-5">

        {categories.length === 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>No active categories yet.</strong> Add one from{' '}
            <a href="/admin/categories" className="underline font-bold">Categories</a> before creating products.
          </div>
        )}

        {/* Search + filter */}
        <Card>
          <div className="p-3 space-y-3">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products by name or description…"
              leftIcon={<SearchIcon />}
            />
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={counts.all}>
                <span className="text-base">🛒</span> All
              </FilterChip>
              {categories.map(cat => (
                <FilterChip
                  key={cat.id}
                  active={filter === cat.id}
                  onClick={() => setFilter(cat.id)}
                  count={counts[cat.id] ?? 0}
                >
                  <span className="text-base">{cat.icon || '📦'}</span> {cat.name}
                </FilterChip>
              ))}
            </div>
          </div>
        </Card>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32" rounded="rounded-2xl" />)}
          </div>
        )}

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon="📦"
            title={products.length === 0 ? 'No products yet' : 'No products match'}
            description={products.length === 0 ? 'Add your first product to start selling.' : 'Try a different filter or search term.'}
            action={products.length === 0 && categories.length > 0 && (
              <Button onClick={() => setModalOpen(true)}>+ Add first product</Button>
            )}
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                acting={acting === p.id}
                onEdit={() => { setEditing(p); setModalOpen(true); }}
                onToggleStock={() => handleToggleStock(p)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <ProductModal
          initial={editing}
          categories={categories}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </AdminShell>
  );
}

// ─── Filter chip ───────────────────────────────────────────────────────────
function FilterChip({ active, onClick, count, children }) {
  return (
    <button onClick={onClick}
      className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 h-9 text-xs font-bold transition-all
        ${active ? 'bg-brand-500 text-white shadow-brand' : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'}`}>
      {children}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-ink-100 text-ink-500'}`}>{count ?? 0}</span>
    </button>
  );
}

// ─── Product card ──────────────────────────────────────────────────────────
function ProductCard({ product: p, acting, onEdit, onToggleStock, onDelete }) {
  return (
    <li>
      <Card>
        <div className="p-3 flex gap-3">
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-ink-100 to-ink-200">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover"
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl">📦</div>
            )}
            {!p.is_available && (
              <div className="absolute inset-0 bg-ink-900/60 flex items-center justify-center">
                <span className="rounded-md bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider">Out of stock</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 flex flex-col">
            <div className="flex items-start gap-2 mb-1">
              <h3 className="text-sm font-bold text-ink-900 line-clamp-2 flex-1">{p.name}</h3>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {p.category && (
                <Badge tone="brand" size="sm">{p.category.icon} {p.category.name}</Badge>
              )}
              {!p.category && p.category_id === null && (
                <Badge tone="warning" size="sm">⚠ Uncategorized</Badge>
              )}
            </div>
            <p className="font-display text-lg font-extrabold text-ink-900 leading-tight">{formatPrice(p.price)}</p>

            <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" onClick={onEdit} disabled={acting}>Edit</Button>
              <Button variant={p.is_available ? 'secondary' : 'primary'} size="sm" onClick={onToggleStock} disabled={acting}>
                {p.is_available ? 'Out of stock' : 'Back in stock'}
              </Button>
              <Button variant="danger" size="sm" onClick={onDelete} disabled={acting}>🗑</Button>
            </div>
          </div>
        </div>
      </Card>
    </li>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────
function ProductModal({ initial, categories, onClose, onSave }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name:         initial?.name         ?? '',
    description:  initial?.description  ?? '',
    price:        initial?.price        ?? '',
    category_id:  initial?.category_id  ?? (categories[0]?.id ?? ''),
    is_available: initial?.is_available ?? true,
  });

  // Image gallery state — separated into "kept" (existing) vs "new" (just-picked) files
  const [keptUrls,  setKeptUrls]  = useState(initial?.image_urls?.length  ? initial.image_urls  : (initial?.image_url  ? [initial.image_url]  : []));
  const [keptPaths, setKeptPaths] = useState(initial?.image_paths?.length ? initial.image_paths : (initial?.image_path ? [initial.image_path] : []));
  const [newFiles,    setNewFiles]    = useState([]);   // File[]
  const [newPreviews, setNewPreviews] = useState([]);   // dataURL[]
  const [saving, setSaving] = useState(false);

  const update = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked
      : e.target.type === 'number' ? e.target.value
      : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };

  const totalImages = keptUrls.length + newFiles.length;
  const MAX_IMAGES = 5;

  const handleFile = (e) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const room = MAX_IMAGES - totalImages;
    if (room <= 0) { notify.error(`Max ${MAX_IMAGES} images`); return; }
    const toAdd = files.slice(0, room);
    for (const f of toAdd) {
      if (!f.type.startsWith('image/'))      { notify.error('Pick image files only'); continue; }
      if (f.size > 5 * 1024 * 1024)          { notify.error(`${f.name} is over 5 MB`); continue; }
    }
    const valid = toAdd.filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    setNewFiles(prev => [...prev, ...valid]);
    valid.forEach(f => {
      const r = new FileReader();
      r.onload = () => setNewPreviews(prev => [...prev, r.result]);
      r.readAsDataURL(f);
    });
    // Reset input so same file can be re-picked
    e.target.value = '';
  };

  const removeKept = (idx) => {
    setKeptUrls(prev => prev.filter((_, i) => i !== idx));
    setKeptPaths(prev => prev.filter((_, i) => i !== idx));
  };
  const removeNew = (idx) => {
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
    setNewPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const moveKept = (from, to) => {
    if (to < 0 || to >= keptUrls.length) return;
    const u = [...keptUrls];
    const p = [...keptPaths];
    [u[from], u[to]] = [u[to], u[from]];
    [p[from], p[to]] = [p[to], p[from]];
    setKeptUrls(u); setKeptPaths(p);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())   { notify.error('Name is required'); return; }
    if (!form.category_id)   { notify.error('Pick a category'); return; }
    if (totalImages === 0)   { notify.error('Add at least one image'); return; }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) { notify.error('Invalid price'); return; }

    setSaving(true);
    const ok = await onSave({
      name:         form.name.trim(),
      description:  form.description.trim() || null,
      price:        priceNum,
      category_id:  form.category_id,
      is_available: form.is_available,
      category:     categories.find(c => c.id === form.category_id)?.slug ?? null,
    }, newFiles, keptUrls, keptPaths);
    if (!ok) setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit product' : 'Add product'} size="lg">
      <form onSubmit={submit} className="px-5 py-4 space-y-4">

        {/* Image gallery picker */}
        <Field label={`Images (${totalImages}/${MAX_IMAGES})`} hint="Up to 5 images. First image is the primary (shown in product cards). Drag the arrows to reorder.">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {/* Existing kept images */}
            {keptUrls.map((url, idx) => (
              <div key={`k-${url}`} className="relative aspect-square overflow-hidden rounded-xl border-2 border-ink-100 bg-ink-50 group">
                <img src={url} alt="" className="h-full w-full object-cover" />
                {idx === 0 && (
                  <span className="absolute top-1 left-1 rounded-md bg-brand-500 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider shadow">Primary</span>
                )}
                <div className="absolute inset-0 flex flex-col justify-between p-1 opacity-0 group-hover:opacity-100 bg-ink-900/40 transition-opacity">
                  <div className="flex justify-end">
                    <button type="button" onClick={() => removeKept(idx)}
                      className="h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600 shadow">×</button>
                  </div>
                  <div className="flex justify-between">
                    <button type="button" disabled={idx === 0} onClick={() => moveKept(idx, idx - 1)}
                      className="h-6 w-6 rounded-full bg-white text-ink-700 text-xs hover:bg-ink-100 disabled:opacity-40 shadow">←</button>
                    <button type="button" disabled={idx === keptUrls.length - 1} onClick={() => moveKept(idx, idx + 1)}
                      className="h-6 w-6 rounded-full bg-white text-ink-700 text-xs hover:bg-ink-100 disabled:opacity-40 shadow">→</button>
                  </div>
                </div>
              </div>
            ))}
            {/* Newly-picked previews */}
            {newPreviews.map((src, idx) => (
              <div key={`n-${idx}`} className="relative aspect-square overflow-hidden rounded-xl border-2 border-brand-200 bg-brand-50 group">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <span className="absolute top-1 left-1 rounded-md bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider shadow">New</span>
                <button type="button" onClick={() => removeNew(idx)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600 shadow">×</button>
              </div>
            ))}
            {/* Add tile */}
            {totalImages < MAX_IMAGES && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-ink-300 bg-white flex flex-col items-center justify-center cursor-pointer text-ink-500 hover:border-brand-400 hover:bg-brand-50 transition-all">
                <span className="text-3xl mb-1">📷</span>
                <span className="text-[11px] font-bold">Add</span>
                <input type="file" accept="image/*" multiple onChange={handleFile} className="hidden" />
              </label>
            )}
          </div>
        </Field>

        <Field label="Name" required>
          <Input value={form.name} onChange={update('name')} placeholder="Basmati Rice 5kg" required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₹)" required>
            <Input type="number" step="0.01" min="0" value={form.price} onChange={update('price')} placeholder="0.00" required />
          </Field>
          <Field label="Category" required>
            <Select value={form.category_id} onChange={update('category_id')} required>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon ?? ''} {c.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={update('description')} placeholder="Optional — shown on the product card." />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
          <input type="checkbox" checked={form.is_available} onChange={update('is_available')} className="h-5 w-5 rounded text-brand-500" />
          In stock (uncheck to mark as Out of Stock)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Save changes' : 'Add product'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
    </svg>
  );
}
