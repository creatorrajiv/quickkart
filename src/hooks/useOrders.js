import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthProvider';

// Returns orders for the currently signed-in user (customer or agent).
export function useOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profile) return;

    const column = profile.role === 'agent' ? 'agent_id' : 'customer_id';

    supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .eq(column, profile.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error);
        else setOrders(data);
        setLoading(false);
      });
  }, [profile]);

  return { orders, loading, error };
}
