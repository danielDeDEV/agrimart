'use client';

import * as React from 'react';
import { DEFAULT_SETTINGS, type SiteSettings } from '@/lib/settings';

/**
 * Live platform settings for interactive pages. The root layout reads them on
 * the server and hands them down, so the contact details and codes on screen
 * are whatever the admin console last saved.
 */
const SettingsContext = React.createContext<SiteSettings>(DEFAULT_SETTINGS);

export function SettingsProvider({
  value,
  children,
}: {
  value: SiteSettings;
  children: React.ReactNode;
}) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** The platform settings: support line, USSD code, limits and switches. */
export const useSettings = () => React.useContext(SettingsContext);
