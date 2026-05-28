/**
 * TermsPage — public Terms of Service stub
 * ──────────────────────────────────────────────────────────────────────────
 * Replace the placeholder text with content reviewed by a lawyer before launch.
 * Wired so it's reachable from the footer / register page without auth.
 */

import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="2026-05-28">
      <Section title="1. Acceptance of Terms">
        <p>By using QuickKart (the "Service") you agree to these Terms of Service. If you do not agree, please do not use the Service.</p>
      </Section>

      <Section title="2. Accounts">
        <p>You are responsible for safeguarding your password and for any activity under your account. You must provide accurate information when registering.</p>
      </Section>

      <Section title="3. Orders & Payment">
        <p>All orders are subject to availability at the assigned shop. Prices shown at checkout are final. Cash on Delivery is accepted at the discretion of each shop.</p>
      </Section>

      <Section title="4. Cancellation & Refunds">
        <p>You may cancel an order before it goes Out for Delivery. Refunds for prepaid online orders are processed within 5–7 business days.</p>
      </Section>

      <Section title="5. Delivery Agents & Shops">
        <p>QuickKart connects you with independent shops and delivery agents. We are not responsible for the quality of goods or the conduct of agents/shops, though we may remove parties that repeatedly violate platform policies.</p>
      </Section>

      <Section title="6. Prohibited Use">
        <p>You may not use the Service for any illegal purpose, harass others, or attempt to disrupt the platform.</p>
      </Section>

      <Section title="7. Limitation of Liability">
        <p>QuickKart is provided "as is" without warranty. We are not liable for indirect or consequential damages.</p>
      </Section>

      <Section title="8. Changes">
        <p>We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance.</p>
      </Section>

      <Section title="9. Contact">
        <p>Questions? Email <a href="mailto:support@quickkart.app" className="text-brand-600 font-bold hover:underline">support@quickkart.app</a>.</p>
      </Section>

      <p className="mt-8 text-xs text-ink-500">
        ⚠️ <strong>Template notice:</strong> This is a starter template, not legal advice.
        Have a lawyer review and customise it for your jurisdiction before launching.
      </p>
    </LegalPage>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold text-ink-900 mt-6 mb-2">{title}</h2>
      <div className="text-sm text-ink-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function LegalPage({ title, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-brand-gradient text-white px-4 sm:px-6 pt-6 pb-12 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="mx-auto max-w-3xl relative">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-white/90 hover:text-white">
            ← Back to QuickKart
          </Link>
          <h1 className="mt-3 font-display text-3xl font-extrabold">{title}</h1>
          <p className="mt-1 text-xs text-white/80">Last updated: {lastUpdated}</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 -mt-6">
        <article className="rounded-2xl border border-ink-100 bg-white shadow-card p-6 sm:p-8 mb-10">
          {children}
        </article>
      </main>
    </div>
  );
}
