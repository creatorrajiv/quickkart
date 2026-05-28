/**
 * Admin AgentsPage — Delivery Agent Onboarding & Management
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin/agents
 *
 * Responsibilities:
 *  • List every delivery agent with KYC + live online/offline status.
 *  • Onboard a new agent (creates auth user + profile via Edge Function).
 *  • Edit KYC details. Activate / deactivate.
 *
 * Why an Edge Function:
 *   Creating an auth.users row requires the service role key, which can't
 *   ship to the browser. The admin-create-user function does it server-side
 *   after verifying the caller is an admin. See:
 *     supabase/functions/admin-create-user/index.ts
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import {
  fetchAgents,
  createAgent,
  updateAgent,
  deactivateAgent,
  activateAgent,
} from '../../services/agentsService';
import { AdminShell } from '../../components/admin';
import { Button } from '../../ui';

const VEHICLE_OPTIONS = [
  { value: '',        label: '— Select —' },
  { value: 'bike',    label: 'Bike (motorcycle)' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'cycle',   label: 'Bicycle' },
  { value: 'car',     label: 'Car' },
];

export default function AgentsPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, signOut } = useAuth();

  const [agents,       setAgents]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [actingId,     setActingId]     = useState(null);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const isAdmin = profile?.role === 'admin';

  // ── Data load ────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    const { data, error: err } = await fetchAgents();
    if (err) setError(err);
    else     setAgents(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
  }, [isAdmin]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const handleSave = async (form) => {
    if (editingAgent) {
      // Edit — only updates editable profile fields. Email/password edits
      // are not exposed here (require service role + password-reset flow).
      const { error: err } = await updateAgent(editingAgent.id, {
        full_name:      form.full_name,
        phone:          form.phone,
        vehicle_type:   form.vehicle_type || null,
        vehicle_number: form.vehicle_number || null,
      });
      if (err) { alert(`Save failed: ${err.message}`); return false; }
    } else {
      // Create — calls the edge function.
      const { error: err } = await createAgent(form);
      if (err) { alert(`Could not create agent: ${err.message}`); return false; }
    }

    setModalOpen(false);
    setEditingAgent(null);
    await loadAll();
    return true;
  };

  const handleToggleActive = async (agent) => {
    setActingId(agent.id);
    const { error: err } = agent.is_active
      ? await deactivateAgent(agent.id)
      : await activateAgent(agent.id);
    setActingId(null);
    if (err) { alert(err.message); return; }
    setAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, is_active: !agent.is_active } : a,
    ));
  };

  // ── Role mismatch ────────────────────────────────────────────────────────
  if (!authLoading && session && profile && !isAdmin) {
    return <RoleMismatch role={profile.role} email={session.user.email} onSignOut={signOut} />;
  }

  const activeCount = agents.filter(a => a.is_active).length;
  const onlineCount = agents.filter(a => a.is_active && a.is_online).length;

  return (
    <AdminShell
      title="Delivery Agents"
      subtitle={`${agents.length} total · ${activeCount} active · ${onlineCount} online now`}
      actions={
        <Button onClick={() => { setEditingAgent(null); setModalOpen(true); }} size="md">+ Add Agent</Button>
      }
    >
      <div className="space-y-4">
        {loading && <SkeletonList />}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load agents. {error.message}
          </div>
        )}

        {!loading && !error && agents.length === 0 && <EmptyState onAdd={() => setModalOpen(true)} />}

        {!loading && !error && agents.length > 0 && (
          <ul className="space-y-3">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                acting={actingId === agent.id}
                onEdit={() => { setEditingAgent(agent); setModalOpen(true); }}
                onToggleActive={() => handleToggleActive(agent)}
              />
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <AgentFormModal
          initial={editingAgent}
          onCancel={() => { setModalOpen(false); setEditingAgent(null); }}
          onSave={handleSave}
        />
      )}
    </AdminShell>
  );
}

// ─── Sub-views ──────────────────────────────────────────────────────────────

function AgentCard({ agent, acting, onEdit, onToggleActive }) {
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">
              {agent.full_name || '(no name)'}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              agent.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {agent.is_active ? 'Active' : 'Deactivated'}
            </span>
            {agent.is_active && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                agent.is_online ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {agent.is_online ? '● Online' : '○ Offline'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">{agent.email}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {agent.phone || 'No phone'}
            {agent.vehicle_type && (
              <> · {agent.vehicle_type}
                {agent.vehicle_number && <> ({agent.vehicle_number})</>}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={onEdit} disabled={acting}
            className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 active:scale-95 disabled:opacity-60 transition-all">
            Edit
          </button>
          <button onClick={onToggleActive} disabled={acting}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium active:scale-95 disabled:opacity-60 transition-all ${
              agent.is_active
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
            }`}>
            {agent.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      </div>
    </li>
  );
}

function AgentFormModal({ initial, onCancel, onSave }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(() => ({
    email:          initial?.email          ?? '',
    password:       '',
    full_name:      initial?.full_name      ?? '',
    phone:          initial?.phone          ?? '',
    vehicle_type:   initial?.vehicle_type   ?? '',
    vehicle_number: initial?.vehicle_number ?? '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [showPwd,    setShowPwd]    = useState(false);

  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!isEdit && form.password.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    const ok = await onSave(form);
    if (!ok) setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-gray-900">
          {isEdit ? `Edit agent: ${initial.full_name || initial.email}` : 'Onboard new delivery agent'}
        </h2>

        <Field label="Email" required>
          <input type="email" className={INPUT} value={form.email}
            onChange={update('email')} required disabled={isEdit}
            placeholder="agent@example.com" />
          {isEdit && <p className="mt-1 text-[10px] text-gray-500">Email changes require a password-reset flow (not exposed here yet).</p>}
        </Field>

        {!isEdit && (
          <Field label="Temporary password" required hint="Min 6 characters. Share with the agent — they can change it after first login.">
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} className={INPUT} value={form.password}
                onChange={update('password')} required minLength={6} />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700">
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
        )}

        <Field label="Full name" required>
          <input className={INPUT} value={form.full_name} onChange={update('full_name')} required />
        </Field>

        <Field label="Phone" required>
          <input className={INPUT} value={form.phone} onChange={update('phone')} required placeholder="10-digit" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vehicle">
            <select className={INPUT} value={form.vehicle_type} onChange={update('vehicle_type')}>
              {VEHICLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Vehicle number">
            <input className={INPUT} value={form.vehicle_number} onChange={update('vehicle_number')} placeholder="e.g. DL01AB1234" />
          </Field>
        </div>

        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <strong>Heads-up:</strong> the agent will be created with email pre-confirmed.
          They can sign in immediately at <code className="rounded bg-amber-100 px-1 font-mono">/login</code> and will land on
          <code className="rounded bg-amber-100 px-1 font-mono">/agent/active-orders</code>.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 active:scale-95 disabled:opacity-60 transition-all">
            {submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Create agent')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const INPUT = `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
  disabled:bg-gray-100 disabled:text-gray-500`;

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-0.5 text-[10px] text-gray-500">{hint}</p>}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[1, 2, 3].map(i => (
        <li key={i} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white" />
      ))}
    </ul>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-6xl">🛵</p>
      <h2 className="mt-4 text-lg font-bold text-gray-900">No agents yet</h2>
      <p className="mt-1 max-w-md text-sm text-gray-500">
        Onboard your first delivery agent. They'll receive credentials from you and can sign in to
        accept deliveries right away.
      </p>
      <button onClick={onAdd}
        className="mt-5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 active:scale-95 transition-all">
        + Onboard first agent
      </button>
    </div>
  );
}

function RoleMismatch({ role, email, onSignOut }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-amber-900">Access Denied</h2>
          <p className="mt-1 text-sm text-amber-700">
            This dashboard requires the <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">admin</code> role.
            Your current role is <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">{role}</code>.
          </p>
        </div>
        <div className="rounded-lg bg-white border border-amber-200 p-3 text-xs text-gray-700 font-mono leading-relaxed">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all">
{`UPDATE public.profiles
SET role = 'admin'
WHERE email = '${email}';`}
          </pre>
        </div>
        <button onClick={onSignOut}
          className="w-full rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">
          Sign out
        </button>
      </div>
    </div>
  );
}
