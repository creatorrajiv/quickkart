import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const DEFAULTS = {
  app_name:    'QuickKart',
  app_tagline: 'Hyperlocal Delivery',
  app_logo_url: '',
};

const AppSettingsContext = createContext({ ...DEFAULTS, update: async () => ({}), reload: async () => {} });

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('app_settings').select('key, value');
    if (error || !data) return;
    const map = Object.fromEntries(data.map(r => [r.key, r.value]));
    setSettings(prev => ({ ...prev, ...map }));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Uses security-definer RPC to bypass RLS write restriction
  const update = useCallback(async (key, value) => {
    const { error } = await supabase.rpc('set_app_setting', { p_key: key, p_value: value });
    if (!error) setSettings(prev => ({ ...prev, [key]: value }));
    return { error };
  }, []);

  return (
    <AppSettingsContext.Provider value={{ ...settings, update, reload: load }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
