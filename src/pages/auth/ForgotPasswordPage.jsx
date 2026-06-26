import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { notify } from '../../lib/notify';
import AuthShell from '../../components/auth/AuthShell';
import { Button, Input, Field } from '../../ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setSubmitting(false);
    if (err) {
      setError(err.message);
      notify.error('Failed to send reset email', err.message);
      return;
    }
    setSent(true);
    notify.success('Reset email sent!');
  };

  return (
    <AuthShell title="Forgot password?" tagline="Enter your email and we'll send a reset link.">
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            <p className="font-semibold">Check your inbox</p>
            <p className="mt-1 text-emerald-700">
              We sent a password reset link to <span className="font-medium">{email}</span>.
              It may take a minute — check your spam folder too.
            </p>
          </div>
          <p className="text-center text-sm text-ink-600">
            <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">Back to sign in</Link>
          </p>
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
              disabled={submitting}
              required
              leftIcon={<MailIcon />}
            />
          </Field>

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Send reset link
          </Button>

          <p className="text-center text-sm text-ink-600">
            Remembered it?{' '}
            <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">Sign in</Link>
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
