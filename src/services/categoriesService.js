/**
 * Categories Service
 * ──────────────────────────────────────────────────────────────────────────
 *  Public: fetchActiveCategories (anyone)
 *  Admin:  CRUD on product_categories
 */

import { supabase } from '../lib/supabaseClient';

/** Public — categories that customers/storefronts should see. */
export async function fetchActiveCategories() {
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, name, slug, icon, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true });
  return { data, error };
}

/** Admin — all categories including inactive, with product counts. */
export async function fetchAllCategories() {
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  return { data, error };
}

/** Slugify a name to produce a default slug. */
export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export async function createCategory({ name, slug, icon, description, sort_order = 0, is_active = true }) {
  const finalSlug = slug?.trim() || slugify(name);
  const { data, error } = await supabase
    .from('product_categories')
    .insert({ name: name.trim(), slug: finalSlug, icon: icon?.trim() || null, description: description?.trim() || null, sort_order, is_active })
    .select()
    .single();
  return { data, error };
}

export async function updateCategory(id, updates) {
  // Re-slugify if slug provided as empty
  if (updates.slug === '') updates.slug = slugify(updates.name ?? '');
  const { data, error } = await supabase
    .from('product_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

/**
 * Delete a category. Products that pointed to it will have their
 * category_id set to NULL (FK ON DELETE SET NULL). The admin should
 * reassign them, but we don't block deletion.
 */
export async function deleteCategory(id) {
  const { error } = await supabase
    .from('product_categories')
    .delete()
    .eq('id', id);
  return { error };
}

/** Count products per category — admin uses this on the category list. */
export async function countProductsPerCategory() {
  const { data, error } = await supabase
    .from('products')
    .select('category_id');
  if (error) return { data: {}, error };
  const counts = {};
  for (const row of data ?? []) {
    if (row.category_id) counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
  }
  return { data: counts, error: null };
}
