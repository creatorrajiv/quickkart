import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { notify } from '../../lib/notify';
import AuthShell from '../../components/auth/AuthShell';
import { Button, Input, Field } from '../../ui';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  // Supabase detects the recovery token in the URL (detectSessionInUrl: true)
  // and fires PASSWORD_RECOVERY. We wait for that event before showing the form.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    // Also handle case where session is already set (page refreshed after link click)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (err) {
      setError(err.message);
      notify.error('Could not update password', err.message);
      return;
    }

    notify.success('Password updated! Please sign in.');
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <AuthShell title="Set new password" tagline="Choose a strong password for your account.">
      {!ready ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">Invalid or expired link</p>
          <p className="text-amber-700">
            This reset link has already been used or has expired. Request a new one.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/forgot-password')}>
            Request new link
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex items-start gap-2">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}

          <Field label="New password" required>
            <Input
              type={showPwd ? 'text' : 'password'}
              size="lg"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={submitting}
              required
              leftIcon={<LockIcon />}
              rightIcon={
                <button type="button" onClick={() => setShowPwd(s => !s)} className="text-xs font-bold text-brand-600 hover:underline focus:outline-none">
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              }
            />
          </Field>

          <Field label="Confirm password" required>
            <Input
              type={showPwd ? 'text' : 'password'}
              size="lg"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              disabled={submitting}
              required
              leftIcon={<LockIcon />}
            />
          </Field>

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c.8 0 1.5-.7 1.5-1.5S12.8 8 12 8s-1.5.7-1.5 1.5S11.2 11 12 11zm6-3V6a6 6 0 10-12 0v2a3 3 0 00-3 3v8a3 3 0 003 3h12a3 3 0 003-3v-8a3 3 0 00-3-3zM8 8V6a4 4 0 118 0v2H8z" />
    </svg>
  );
}
