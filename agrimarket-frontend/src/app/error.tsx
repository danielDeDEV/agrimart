'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { SITE } from '@/lib/constants';

/**
 * Shown when a page throws in the browser or while rendering.
 *
 * A farmer who hits this should still know what to do next, so the fallback
 * keeps the brand, offers a retry and names the USSD code — the service works
 * from any handset even when the website is having a bad day.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // The digest is what ties this screen to the server log entry
    console.error('Page error:', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight">Something went wrong</h1>
        <p className="mt-3 text-muted-foreground">
          This page could not be loaded. It is usually temporary — try again, and if it keeps happening let us know.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5"
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold shadow-soft transition-transform hover:-translate-y-0.5"
          >
            <Home className="h-4 w-4" /> Go home
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-[11px] text-muted-foreground">Reference: {error.digest}</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          The service also works without the website — dial {SITE.ussdCode} on any phone.
        </p>
      </div>
    </div>
  );
}
