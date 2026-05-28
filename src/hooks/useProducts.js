/**
 * useProducts — Customer-facing live product list
 * ──────────────────────────────────────────────────────────────────────────
 *  • Fetches `is_available = true` products with category join
 *  • Realtime: applies INSERT/UPDATE/DELETE to local state
 *  • In-memory filter by category (slug) + text search
 *
 *  The category filter accepts the slug of a product_categories row —
 *  e.g. 'grocery', 'meat', 'food' — or the special value 'all'.
 *  We match against the joined category.slug (or legacy enum column
 *  for older rows that haven't been backfilled).
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const SELECT_QUERY = `
  *,
  category:product_categories!products_category_id_fkey ( id, name, slug, icon )
`;

export function useProducts({ category = 'all', search = '' } = {}) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Fetch full row (with join) for a given id — used after realtime UPDATE
  // because the payload doesn't include the joined category data.
  const refetchOne = async (id) => {
    const { data } = await supabase.from('products').select(SELECT_QUERY).eq('id', id).maybeSingle();
    return data;
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(SELECT_QUERY)
        .eq('is_available', true)
        .order('name', { ascending: true });
      if (!mounted) return;
      if (error) setError(error);
      else       setProducts(data ?? []);
      setLoading(false);
    })();

    const channel = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload) => {
        if (!mounted) return;
        const { eventType, new: newRow, old: oldRow } = payload;

        if (eventType === 'DELETE') {
          setProducts(prev => prev.filter(p => p.id !== oldRow.id));
          return;
        }

        // For INSERT/UPDATE we need the joined category — re-fetch the row.
        const full = await refetchOne(newRow.id);
        if (!mounted || !full) return;

        setProducts(prev => {
          const exists = prev.some(p => p.id === full.id);
          if (!full.is_available) {
            return exists ? prev.filter(p => p.id !== full.id) : prev;
          }
          if (!exists) return [...prev, full].sort(byName);
          return prev.map(p => (p.id === full.id ? full : p));
        });
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(p => {
      if (category !== 'all') {
        // Match either the joined slug or the legacy enum string
        const slug = p.category?.slug ?? p.category;
        if (slug !== category) return false;
      }
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        (p.description ?? '').toLowerCase().includes(term)
      );
    });
  }, [products, category, search]);

  return { products: visible, loading, error };
}

function byName(a, b) { return a.name.localeCompare(b.name); }
