/**
 * LoginPage — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 *  Split-screen brand hero + form (AuthShell).
 *  Wires to supabase auth via useAuth().signIn.
 *  Redirects on successful sign-in based on the user's role.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { consumeIntendedUrl } from '../../hooks/useAuthGuard';
import { notify }  from '../../lib/notify';
import AuthShell   from '../../components/auth/AuthShell';
import { Button, Input, Field } from '../../ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signOut, loading, session, profile } = useAuth();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPwd,    setShowPwd]    = useState(false);
  const [error,      setError]      = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) return;
    // If the user got bounced to /login from a deep URL, take them back there.
    const intended = consumeIntendedUrl();
    if (intended) { navigate(intended, { replace: true }); return; }
    // Otherwise, role-based default landing.
    if (profile?.role === 'admin')           navigate('/admin',                { replace: true });
    else if (profile?.role === 'agent')      navigate('/agent/active-orders',  { replace: true });
    else if (profile?.role === 'shopkeeper') navigate('/shopkeeper/dashboard', { replace: true });
    else if (profile?.role === 'customer')   navigate('/shop',                 { replace: true });
  }, [loading, session, profile, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn({ email: email.trim(), password });
    setSubmitting(false);
    if (err) { setError(err.message); notify.error('Sign in failed', err.message); return; }
    notify.success('Welcome back!');
  };

  const knownRoles = ['admin','agent','customer','shopkeeper'];
  const wrongRole = !loading && session && profile && !knownRoles.includes(profile.role);

  return (
    <AuthShell title="Welcome back" tagline="Sign in to your QuickKart account">
      {wrongRole ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
          <h2 className="font-display text-lg font-bold text-amber-900">
            Unknown role: <code className="rounded bg-amber-100 px-2 font-mono text-sm">{profile.role}</code>
          </h2>
          <p className="text-sm text-amber-700">Your account exists but its role is unrecognised. Ask an admin to fix it.</p>
          <Button onClick={signOut} variant="outline" fullWidth>Sign out</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex items-start gap-2">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}

          <Field label="Email" required>
            <Input
              type="email"
              size="lg"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading || submitting}
              required
              leftIcon={<MailIcon />}
            />
          </Field>

          <Field label="Password" required>
            <Input
              type={showPwd ? 'text' : 'password'}
              size="lg"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading || submitting}
              required
              leftIcon={<LockIcon />}
              rightIcon={
                <button type="button" onClick={() => setShowPwd(s => !s)} className="text-xs font-bold text-brand-600 hover:underline focus:outline-none">
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              }
            />
          </Field>

          <Button type="submit" size="lg" fullWidth loading={loading || submitting}>
            Sign in
          </Button>

          <p className="text-center text-sm text-ink-600">
            <Link to="/forgot-password" className="font-bold text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          </p>

          <p className="text-center text-sm text-ink-600">
            New here?{' '}
            <Link to="/register" className="font-bold text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c.8 0 1.5-.7 1.5-1.5S12.8 8 12 8s-1.5.7-1.5 1.5S11.2 11 12 11zm6-3V6a6 6 0 10-12 0v2a3 3 0 00-3 3v8a3 3 0 003 3h12a3 3 0 003-3v-8a3 3 0 00-3-3zM8 8V6a4 4 0 118 0v2H8z" />
    </svg>
  );
}
