import { AlertTriangle } from 'lucide-react';
import { getSettings } from '@/lib/settings.server';
import { formatPhone, telHref } from '@/lib/settings';

/**
 * Shown while an administrator has maintenance mode on. The website keeps
 * working — people can still read prices and reach support — but USSD is
 * paused, so saying so beats leaving farmers wondering why the code fails.
 */
export async function MaintenanceBanner() {
  const site = await getSettings();
  if (!site.maintenanceMode) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-900 dark:bg-amber-950/70 dark:text-amber-100">
      <div className="container-wide flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="font-semibold">Maintenance in progress.</span>
        <span>
          Dialling {site.ussdCode} is paused while we work. Browsing and prices still work here.
        </span>
        <a href={telHref(site.supportPhone)} className="font-semibold underline underline-offset-2">
          Call {formatPhone(site.supportPhone)}
        </a>
      </div>
    </div>
  );
}
