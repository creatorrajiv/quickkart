/**
 * ErrorBoundary — catches React render errors in any subtree
 * ──────────────────────────────────────────────────────────────────────────
 * Class component (the only way to use componentDidCatch / getDerivedStateFromError).
 *
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * Shows a friendly "something broke" screen instead of a white page when a
 * deep child throws. Logs to console (hook up Sentry here later).
 */

import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
    this.setState({ info });
    // Optional Sentry hook — uncomment after you wire up Sentry:
    // if (window.Sentry) window.Sentry.captureException(error, { contexts: { react: info } });
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
    // Hard reload so any broken module state clears
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white shadow-pop p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-red-400 to-red-600 shadow-pop mb-4">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            The app hit an unexpected error. Try going back to the home screen.
            If the problem persists, please contact support.
          </p>

          {/* Dev-only details */}
          {import.meta.env.DEV && (
            <details className="mt-5 text-left rounded-xl bg-red-50 border border-red-100 p-3">
              <summary className="cursor-pointer text-xs font-bold text-red-700">Error details (dev only)</summary>
              <pre className="mt-2 text-[10px] text-red-700 overflow-x-auto whitespace-pre-wrap">
                {String(this.state.error?.message ?? this.state.error)}
                {'\n\n'}
                {this.state.info?.componentStack ?? ''}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReset}
            className="mt-6 w-full rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 shadow-brand active:scale-[0.98] transition-all"
          >
            Go back to home
          </button>
        </div>
      </div>
    );
  }
}
