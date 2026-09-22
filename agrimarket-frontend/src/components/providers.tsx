'use client';

import * as React from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui';
import { SettingsProvider } from '@/components/settings-provider';
import type { SiteSettings } from '@/lib/settings';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'agrimarket_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('light');
  const [resolved, setResolved] = React.useState<'light' | 'dark'>('light');

  const apply = React.useCallback((next: Theme) => {
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effective = next === 'system' ? (prefersDark ? 'dark' : 'light') : next;

    document.documentElement.classList.toggle('dark', effective === 'dark');
    document.documentElement.style.colorScheme = effective;
    setResolved(effective);
  }, []);

  React.useEffect(() => {
    let stored: Theme = 'light';
    try {
      stored = (window.localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
    } catch {
      /* private browsing — fall back to light */
    }
    setThemeState(stored);
    apply(stored);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (stored === 'system') apply('system');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [apply]);

  const setTheme = React.useCallback(
    (next: Theme) => {
      setThemeState(next);
      apply(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [apply]
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolved,
      setTheme,
      toggle: () => setTheme(resolved === 'dark' ? 'light' : 'dark'),
    }),
    [theme, resolved, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx;
}

export function Providers({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings: SiteSettings;
}) {
  return (
    <SettingsProvider value={settings}>
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ className: 'rounded-xl border shadow-lift' }}
        />
      </TooltipProvider>
    </ThemeProvider>
    </SettingsProvider>
  );
}
