'use client';

/**
 * The last line of defence: a failure in the root layout itself, where no
 * provider, font or stylesheet from the app is available. Everything here is
 * inline on purpose so it renders even when the rest of the app cannot.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '26rem' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto',
              borderRadius: 16,
              background: 'linear-gradient(135deg,#22c55e,#14532d)',
            }}
          />
          <h1 style={{ marginTop: 24, fontSize: '1.5rem', fontWeight: 800 }}>AgriMart is temporarily unavailable</h1>
          <p style={{ marginTop: 12, lineHeight: 1.6, color: '#475569' }}>
            We hit an unexpected problem. Please try again in a moment — the USSD and SMS service is unaffected and
            still works from any phone.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 20, fontSize: '0.7rem', color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
