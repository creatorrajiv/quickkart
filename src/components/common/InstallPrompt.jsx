/**
 * InstallPrompt — PWA "Add to home screen" banner
 * ──────────────────────────────────────────────────────────────────────────
 *  Chrome/Edge/Samsung Internet fire `beforeinstallprompt` when the site
 *  is installable. We capture it, show our own friendly banner, and call
 *  prompt() when the user taps Install.
 *
 *  iOS Safari doesn't fire that event — we show a one-time hint there too.
 *
 *  The banner is dismissable. Dismiss state lives in localStorage so we
 *  don't nag users on every visit.
 */

import { useEffect, useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext';

const DISMISS_KEY = 'quickkart.install.dismissedAt';
const NAG_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const { app_name } = useAppSettings();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible,        setVisible]        = useState(false);
  const [isIOS,          setIsIOS]          = useState(false);

  useEffect(() => {
    // Already installed? Don't show.
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;

    // Recently dismissed?
    const at = Number(localStorage.getItem(DISMISS_KEY));
    if (at && Date.now() - at < NAG_AFTER_MS) return;

    // iOS Safari path — no beforeinstallprompt available.
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (ios) {
      setIsIOS(true);
      setVisible(true);
      return;
    }

    // Android/desktop Chrome
    const onBefore = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBefore);
    return () => window.removeEventListener('beforeinstallprompt', onBefore);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-40 animate-slide-up">
      <div className="rounded-2xl bg-white shadow-pop border border-ink-100 p-4 flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white text-xl">⚡</span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-sm font-bold text-ink-900">Install {app_name}</p>
          <p className="text-xs text-ink-600 mt-0.5">
            {isIOS
              ? 'Tap Share → "Add to Home Screen" for the full app experience.'
              : 'Add to your home screen for one-tap ordering.'}
          </p>
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 text-white px-3 h-9 text-xs font-bold shadow-brand hover:bg-brand-600 active:scale-95 transition-all">
              Install
            </button>
          )}
        </div>
        <button onClick={handleDismiss}
          className="flex-shrink-0 rounded-full p-1 text-ink-400 hover:bg-ink-100" aria-label="Dismiss">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
