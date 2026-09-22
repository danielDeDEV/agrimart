'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell, Heart, HandCoins, LayoutDashboard, LifeBuoy, LineChart, Loader2, MessageSquare, Package,
  PlusCircle, Settings, ShoppingBag, Smartphone, User, Wallet,
} from 'lucide-react';
import { useRequireAuth } from '@/lib/auth';
import { cn, formatCurrency, initials } from '@/lib/utils';
import { SITE } from '@/lib/constants';
import { useSettings } from '@/components/settings-provider';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Trading',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/listings', label: 'My listings', icon: Package, roles: ['farmer', 'agent'] },
      { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/dashboard/offers', label: 'Offers', icon: HandCoins },
      { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      { href: '/dashboard/saved', label: 'Saved listings', icon: Heart },
    ],
  },
  {
    heading: 'Money & markets',
    items: [
      { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
      { href: '/dashboard/alerts', label: 'Price alerts', icon: LineChart },
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    heading: 'Account',
    items: [
      { href: '/dashboard/profile', label: 'Profile', icon: User },
      { href: '/dashboard/settings', label: 'Settings & PIN', icon: Settings },
      { href: '/dashboard/support', label: 'Support', icon: LifeBuoy },
    ],
  },
];

/**
 * Signed-in area for farmers and buyers. Guarded by the "user" realm — admin
 * accounts are rejected by the provider and belong in /admin.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const site = useSettings();
  const { user, ready } = useRequireAuth();
  const pathname = usePathname();

  if (!ready || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href));
  const visible = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(user.role)),
  }));

  return (
    <div className="container-wide grid gap-8 py-8 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
                <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.fullName}</p>
                <Badge variant="success" size="sm" className="capitalize">{user.role}</Badge>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Wallet balance</p>
              <p className="text-lg font-bold">{formatCurrency(user.walletBalance)}</p>
            </div>
            {user.role !== 'buyer' && (
              <Button variant="gradient" size="sm" className="mt-3 w-full" asChild>
                <Link href="/dashboard/listings/new"><PlusCircle /> New listing</Link>
              </Button>
            )}
          </div>

          <nav className="rounded-2xl border bg-card p-2 shadow-soft">
            {visible.map((group) => (
              <div key={group.heading} className="py-1">
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.heading}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary-50 text-primary-800 dark:bg-primary-950/60 dark:text-primary-200'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="rounded-2xl border border-dashed p-4 text-center">
            <Smartphone className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">On the move? Manage everything by dialling</p>
            <p className="font-mono font-bold">{site.ussdCode}</p>
          </div>
        </div>
      </aside>

      {/* Mobile section switcher */}
      <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
        {visible.flatMap((g) => g.items).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium',
              isActive(item.href) ? 'border-primary bg-primary text-white' : 'bg-card'
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
