/**
 * Banners Service
 * ──────────────────────────────────────────────────────────────────────────
 * Customer reads active banners. Admin (Step 7) will also use the
 * upload/CRUD helpers here.
 */

import { supabase } from '../lib/supabaseClient';

/** Active banners visible on the customer storefront, sorted by display_order. */
export async function fetchActiveBanners(surface = 'storefront') {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('surface', surface)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at',    { ascending: false });
  return { data, error };
}

/** All banners (admin). */
export async function fetchAllBanners() {
  const { data, error } = await supabase
    .from('banners').select('*')
    .order('display_order', { ascending: true })
    .order('created_at',    { ascending: false });
  return { data, error };
}

/**
 * Upload a banner image to Supabase storage and return its public URL.
 *
 * @param {File} file
 * @returns {Promise<{ url: string|null, path: string|null, error: Error|null }>}
 */
export async function uploadBannerImage(file) {
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from('banners')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) return { url: null, path: null, error };

  const { data } = supabase.storage.from('banners').getPublicUrl(path);
  return { url: data.publicUrl, path, error: null };
}

export async function deleteBannerImage(path) {
  if (!path) return { error: null };
  const { error } = await supabase.storage.from('banners').remove([path]);
  return { error };
}

export async function createBanner(input) {
  const { data, error } = await supabase.from('banners').insert(input).select().single();
  return { data, error };
}

export async function updateBanner(id, updates) {
  const { data, error } = await supabase.from('banners').update(updates).eq('id', id).select().single();
  return { data, error };
}

export async function deleteBanner(id) {
  const { error } = await supabase.from('banners').delete().eq('id', id);
  return { error };
}
