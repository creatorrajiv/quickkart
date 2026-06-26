import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const DEFAULTS = {
  app_name:    'QuickKart',
  app_tagline: 'Hyperlocal Delivery',
  app_logo_url: '',
};

const CACHE_KEY = 'qk_app_settings';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function writeCache(settings) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(settings)); } catch {}
}

const AppSettingsContext = createContext({ ...DEFAULTS, update: async () => ({}), reload: async () => {} });

export function AppSettingsProvider({ children }) {
  // Start from localStorage cache instantly — no flicker on PWA restart
  const [settings, setSettings] = useState(readCache);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('app_settings').select('key, value');
    if (error || !data) return; // keep cache on network failure
    const map = Object.fromEntries(data.map(r => [r.key, r.value]));
    const next = { ...DEFAULTS, ...map };
    setSettings(next);
    writeCache(next);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (key, value) => {
    const { error } = await supabase.rpc('set_app_setting', { p_key: key, p_value: value });
    if (!error) {
      setSettings(prev => {
        const next = { ...prev, [key]: value };
        writeCache(next);
        return next;
      });
    }
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
