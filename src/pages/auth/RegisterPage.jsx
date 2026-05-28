/**
 * RegisterPage — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 *  Customer signup via supabase.auth.signUp(). Handles both flows:
 *   A) Email confirmation OFF → auto sign-in → redirect (handled by useEffect)
 *   B) Email confirmation ON  → "check your email" screen
 *
 *  All other roles (agent, shopkeeper) are created via /admin so this page
 *  is intentionally customer-only.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate }   from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { notify }  from '../../lib/notify';
import AuthShell   from '../../components/auth/AuthShell';
import { Button, Input, Field } from '../../ui';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, session, profile, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPwd,  setShowPwd]  = useState(false);

  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) return;
    if (awaitingEmail) return;
    if (profile?.role === 'admin')           navigate('/admin',                { replace: true });
    else if (profile?.role === 'agent')      navigate('/agent/active-orders',  { replace: true });
    else if (profile?.role === 'shopkeeper') navigate('/shopkeeper/dashboard', { replace: true });
    else                                     navigate('/shop',                 { replace: true });
  }, [authLoading, session, profile, navigate, awaitingEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setSubmitting(true);
    const { error: err } = await signUp({
      email: email.trim(), password,
      fullName: fullName.trim(), phone: phone.trim(),
    });
    setSubmitting(false);

    if (err) { setError(err.message); notify.error('Could not sign up', err.message); return; }

    notify.success('Account created!');
    setTimeout(() => setAwaitingEmail(true), 200);
  };

  // ── Email-confirmation pending state ─────────────────────────────────────
  if (awaitingEmail && !session) {
    return (
      <AuthShell title="Check your email" tagline="One more step to get started">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-green-400 to-green-600 shadow-pop">
            <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">We sent a confirmation link</h3>
            <p className="mt-2 text-sm text-ink-600">
              Click the link in <span className="font-bold text-ink-900">{email}</span> to activate your account, then come back to sign in.
            </p>
          </div>
          <p className="text-xs text-ink-500">
            Didn't get it? Check spam, or wait a minute and try again.
          </p>
          <Link to="/login">
            <Button variant="outline" size="lg" fullWidth>Back to Sign In</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" tagline="Sign up as a customer in 30 seconds">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex items-start gap-2">
            <span>⚠️</span><span>{error}</span>
          </div>
        )}

        <Field label="Full name" required>
          <Input
            size="lg"
            autoComplete="name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="John Doe"
            required
            leftIcon={<UserIcon />}
          />
        </Field>

        <Field label="Email" required>
          <Input
            type="email" size="lg" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" required
            leftIcon={<MailIcon />}
          />
        </Field>

        <Field label="Phone" hint="Used by delivery agents to contact you.">
          <Input
            type="tel" size="lg" autoComplete="tel"
            value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            leftIcon={<PhoneIcon />}
          />
        </Field>

        <Field label="Password" required>
          <Input
            type={showPwd ? 'text' : 'password'}
            size="lg" autoComplete="new-password" minLength={6}
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="At least 6 characters" required
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
            size="lg" autoComplete="new-password"
            value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Re-enter your password" required
            leftIcon={<LockIcon />}
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Create account
        </Button>

        <p className="text-center text-sm text-ink-600">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>

        <p className="text-center text-[11px] text-ink-400">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="font-bold text-ink-600 hover:underline">Terms of Service</Link>
          {' '}&{' '}
          <Link to="/privacy" className="font-bold text-ink-600 hover:underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}

function UserIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 14a4 4 0 10-8 0M12 14a8 8 0 00-8 8h16a8 8 0 00-8-8z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 010 1.414L9.414 8.586a11.042 11.042 0 005.657 5.657l1.464-1.464a1 1 0 011.414 0l2.414 2.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
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
