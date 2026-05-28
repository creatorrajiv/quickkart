/**
 * Products Service
 * ──────────────────────────────────────────────────────────────────────────
 *  Admin CRUD on products + image upload to the 'products' storage bucket.
 *  Customer-side reads still use the existing `useProducts` hook which we
 *  upgrade below to join the category row.
 */

import { supabase } from '../lib/supabaseClient';

/** Admin — full list with category join, newest first. */
export async function fetchAllProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:product_categories!products_category_id_fkey ( id, name, slug, icon )
    `)
    .order('updated_at', { ascending: false });
  return { data, error };
}

/** Image upload — returns { url, path } so the caller can save the path
 *  on products.image_path (needed to delete the storage file later). */
export async function uploadProductImage(file) {
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('products')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) return { url: null, path: null, error };
  const { data } = supabase.storage.from('products').getPublicUrl(path);
  return { url: data.publicUrl, path, error: null };
}

export async function deleteProductImage(path) {
  if (!path) return { error: null };
  const { error } = await supabase.storage.from('products').remove([path]);
  return { error };
}

export async function createProduct(input) {
  const { data, error } = await supabase
    .from('products')
    .insert(input)
    .select(`
      *,
      category:product_categories!products_category_id_fkey ( id, name, slug, icon )
    `)
    .single();
  return { data, error };
}

export async function updateProduct(id, updates) {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      category:product_categories!products_category_id_fkey ( id, name, slug, icon )
    `)
    .single();
  return { data, error };
}

export async function deleteProduct(id) {
  // Best-effort image cleanup happens in the page (it knows image_path)
  const { error } = await supabase.from('products').delete().eq('id', id);
  return { error };
}

/** Toggle product availability ("out of stock"). */
export async function setProductAvailability(id, isAvailable) {
  return updateProduct(id, { is_available: !!isAvailable });
}
