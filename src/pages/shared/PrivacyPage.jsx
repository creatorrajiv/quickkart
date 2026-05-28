/**
 * PrivacyPage — public Privacy Policy stub
 * Replace placeholder text with content reviewed by a lawyer before launch.
 */

import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="2026-05-28">
      <Section title="1. Information We Collect">
        <p>We collect account info (name, email, phone), delivery addresses you save, order history, and (for agents) location data while you're online and delivering an order.</p>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To fulfil your orders and connect you with shops and agents.</li>
          <li>To send transactional notifications (order updates, delivery alerts).</li>
          <li>To improve the service and prevent fraud.</li>
        </ul>
      </Section>

      <Section title="3. Sharing">
        <p>We share your name and delivery address with the assigned shop and delivery agent so they can fulfil your order. We do not sell your data to third parties.</p>
      </Section>

      <Section title="4. Data Retention">
        <p>We keep your account and order history as long as your account is active. You can request deletion by emailing privacy@quickkart.app.</p>
      </Section>

      <Section title="5. Cookies & Storage">
        <p>We use local storage for the cart and your session. We do not use third-party advertising cookies.</p>
      </Section>

      <Section title="6. Your Rights">
        <p>You can access, update, or delete your data at any time from your profile page, or by contacting us.</p>
      </Section>

      <Section title="7. Children">
        <p>QuickKart is not intended for users under 16. We do not knowingly collect data from children.</p>
      </Section>

      <Section title="8. Contact">
        <p>Questions about privacy? Email <a href="mailto:privacy@quickkart.app" className="text-brand-600 font-bold hover:underline">privacy@quickkart.app</a>.</p>
      </Section>

      <p className="mt-8 text-xs text-ink-500">
        ⚠️ <strong>Template notice:</strong> This is a starter template, not legal advice.
        Have a lawyer review and customise it for your jurisdiction (and GDPR/India DPDP Act if applicable) before launching.
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
