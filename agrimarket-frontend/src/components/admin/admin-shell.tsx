'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, BarChart3, BookOpen, ChevronDown, ClipboardList, ExternalLink, FileClock, LayoutDashboard, LifeBuoy,
  Loader2, LogOut, Menu, MessageSquare, Package, Search, Settings, ShieldCheck, ShoppingCart, Smartphone, Tags,
  TrendingUp, UserCog, Users, Wallet, X,
} from 'lucide-react';
import { useRequireAuth } from '@/lib/auth';
import { useSocketEvent } from '@/lib/socket';
import { cn, initials, timeAgo } from '@/lib/utils';
import { LogoMark } from '@/components/site/logo';
import { ThemeToggle } from '@/components/site/theme-toggle';
import {
  Avatar, AvatarFallback, Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, Input, Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui';

const NAV = [
  {
    heading: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/analytics', label: 'Impact analytics', icon: BarChart3 },
    ],
  },
  {
    heading: 'Marketplace',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/listings', label: 'Listings', icon: Package },
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/admin/transactions', label: 'Transactions', icon: Wallet },
    ],
  },
  {
    heading: 'Market data',
    items: [
      { href: '/admin/prices', label: 'Market prices', icon: TrendingUp },
      { href: '/admin/catalog', label: 'Produce & markets', icon: Tags },
    ],
  },
  {
    heading: 'Channels',
    items: [
      { href: '/admin/sms', label: 'SMS centre', icon: MessageSquare },
      { href: '/admin/ussd', label: 'USSD monitor', icon: Smartphone },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { href: '/admin/support', label: 'Support desk', icon: LifeBuoy },
      { href: '/admin/tips', label: 'Farm guides', icon: BookOpen },
      { href: '/admin/impact', label: 'Survey records', icon: ClipboardList },
    ],
  },
  {
    heading: 'System',
    items: [
      { href: '/admin/team', label: 'Admin team', icon: UserCog },
      { href: '/admin/audit', label: 'Audit log', icon: FileClock },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface ActivityEvent {
  type: string;
  message: string;
  at: string;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useRequireAuth({ roles: ['admin', 'superadmin'] });
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [activity, setActivity] = React.useState<ActivityEvent[]>([]);
  const [unseen, setUnseen] = React.useState(0);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => setMobileOpen(false), [pathname]);

  useSocketEvent<ActivityEvent>(
    'activity',
    (event) => {
      setActivity((prev) => [event, ...prev].slice(0, 30));
      setUnseen((n) => n + 1);
    },
    'admin'
  );

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-300">
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
        <LogoMark className="h-9 w-9" />
        <div className="leading-tight">
          <p className="font-display text-sm font-extrabold text-white">AgriMart</p>
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-400">
            <ShieldCheck className="h-3 w-3" /> Admin console
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {NAV.map((group) => (
          <div key={group.heading}>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{group.heading}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-primary-600/25 to-primary-600/5 text-white shadow-[inset_2px_0_0_0] shadow-primary-400'
                        : 'hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0', isActive(item.href) ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300')} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        <Link href="/" target="_blank" className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white">
          Open public website <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-72 animate-in slide-in-from-left">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            {mobileOpen ? <X /> : <Menu />}
          </Button>

          <form
            className="hidden max-w-md flex-1 md:block"
            onSubmit={(e) => {
              e.preventDefault();
              if (search.trim()) router.push(`/admin/users?search=${encodeURIComponent(search.trim())}`);
            }}
          >
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a user by name or phone…" icon={<Search />} className="h-9 bg-muted/60" />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="success" className="hidden sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Live
            </Badge>

            <Popover onOpenChange={(open) => open && setUnseen(0)}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="relative" aria-label="Live activity">
                  <Activity />
                  {unseen > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                      {unseen > 9 ? '9+' : unseen}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Live activity</p>
                  <p className="text-xs text-muted-foreground">Registrations, listings, orders and USSD sessions as they happen</p>
                </div>
                <ul className="max-h-80 divide-y overflow-y-auto">
                  {activity.length === 0 ? (
                    <li className="px-4 py-8 text-center text-sm text-muted-foreground">Waiting for platform activity…</li>
                  ) : (
                    activity.map((event, i) => (
                      <li key={`${event.at}-${i}`} className="px-4 py-2.5">
                        <p className="text-sm">{event.message}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <code className="font-mono">{event.type}</code> · {timeAgo(event.at)}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </PopoverContent>
            </Popover>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl border bg-card px-2 py-1.5 hover:bg-muted">
                  <Avatar className="h-7 w-7"><AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900">{initials(user.fullName)}</AvatarFallback></Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{user.fullName.split(' ')[0]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="normal-case">
                  <p className="text-sm font-semibold text-foreground">{user.fullName}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
                  <Badge variant="gold" size="sm" className="mt-1.5 capitalize">{user.role}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/admin/team"><UserCog /> Admin team &amp; my password</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/settings"><Settings /> Settings</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/audit"><FileClock /> Audit log</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={() => logout('/admin/login')}><LogOut /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
