'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell, ChevronDown, LayoutDashboard, LogOut, Menu, Package, Phone, Search,
  Settings, ShoppingBag, Sprout, TrendingUp, User as UserIcon, X, BookOpen, HelpCircle,
} from 'lucide-react';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { cn, initials } from '@/lib/utils';
import { SITE } from '@/lib/constants';
import { formatPhone, telHref } from '@/lib/settings';
import { useSettings } from '@/components/settings-provider';
import {
  Avatar, AvatarFallback, AvatarImage, Badge, Button,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, Input,
} from '@/components/ui';

const NAV_LINKS = [
  { href: '/marketplace', label: 'Marketplace', icon: ShoppingBag, description: 'Browse produce from verified farms' },
  { href: '/prices', label: 'Market Prices', icon: TrendingUp, description: 'Live wholesale prices nationwide' },
  { href: '/ussd', label: 'USSD Demo', icon: Phone, description: 'Try the feature-phone service' },
  { href: '/how-it-works', label: 'How it works', icon: BookOpen, description: 'From dialling to delivery' },
  { href: '/tips', label: 'Farm Guides', icon: Sprout, description: 'Practical agronomy and market advice' },
];

export function Navbar() {
  const site = useSettings();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, ready } = useAuth();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api
      .get<{ count: number }>('/notifications/unread-count')
      .then((res) => !cancelled && setUnread(res.data.count))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* The USSD code is the product's front door for most users, so it lives
          above everything else on the page. */}
      <div className="relative z-50 bg-gradient-to-r from-primary-800 via-primary-700 to-primary-800 text-white">
        <div className="container-wide flex h-9 items-center justify-between gap-4 text-xs">
          <p className="flex items-center gap-2 font-medium">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">No internet? Dial</span>
            <code className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold tracking-wide">
              {site.ussdCode}
            </code>
            <span className="hidden md:inline text-white/70">on any phone to sell or check prices</span>
          </p>
          <div className="flex items-center gap-4">
            <a href={telHref(site.supportPhone)} className="hidden font-medium hover:underline sm:inline">
              Support {formatPhone(site.supportPhone)}
            </a>
            <Link href="/contact" className="font-medium text-white/80 hover:text-white hover:underline">
              Contact
            </Link>
          </div>
        </div>
      </div>

      <header
        className={cn(
          'sticky top-0 z-40 w-full transition-all duration-300',
          scrolled
            ? 'border-b bg-background/85 shadow-soft backdrop-blur-xl'
            : 'border-b border-transparent bg-background/60 backdrop-blur-sm'
        )}
      >
        <div className="container-wide flex h-16 items-center gap-3 lg:h-[70px]">
          <Logo />

          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive(link.href)
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            ))}
          </nav>

          <form
            className="ml-auto hidden max-w-xs flex-1 xl:block"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) window.location.href = `/marketplace?search=${encodeURIComponent(query.trim())}`;
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search maize, tomato, yam…"
              icon={<Search />}
              className="h-10 bg-muted/50"
              aria-label="Search the marketplace"
            />
          </form>

          <div className={cn('flex items-center gap-2', 'ml-auto xl:ml-3')}>
            <ThemeToggle className="hidden sm:inline-flex" />

            {!ready ? (
              <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
            ) : isAuthenticated && user ? (
              <>
                <Link href="/dashboard/notifications" className="relative hidden sm:block">
                  <Button variant="ghost" size="icon-sm" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                  </Button>
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-xl border bg-card px-2 py-1.5 transition-colors hover:bg-muted">
                      <Avatar className="h-7 w-7">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
                        <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-[100px] truncate text-sm font-medium md:inline">
                        {user.fullName.split(' ')[0]}
                      </span>
                      <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:inline" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="normal-case">
                      <p className="truncate text-sm font-semibold text-foreground">{user.fullName}</p>
                      <p className="truncate text-xs font-normal text-muted-foreground">{user.phone}</p>
                      <Badge variant="success" size="sm" className="mt-1.5 capitalize">
                        {user.role}
                      </Badge>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">
                        <LayoutDashboard /> Dashboard
                      </Link>
                    </DropdownMenuItem>
                    {user.role === 'farmer' && (
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/listings">
                          <Package /> My listings
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/orders">
                        <ShoppingBag /> My orders
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/profile">
                        <UserIcon /> Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings">
                        <Settings /> Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onClick={() => logout()}>
                      <LogOut /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button variant="gradient" size="sm" asChild>
                  <Link href="/register">Join free</Link>
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div
          className={cn(
            'overflow-hidden border-t bg-background transition-[max-height,opacity] duration-300 lg:hidden',
            mobileOpen ? 'max-h-[36rem] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <nav className="container-wide space-y-1 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-3 py-3 transition-colors',
                  isActive(link.href) ? 'bg-primary-50 dark:bg-primary-950/50' : 'hover:bg-muted'
                )}
              >
                <link.icon
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0',
                    isActive(link.href) ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <span>
                  <span className="block text-sm font-semibold">{link.label}</span>
                  <span className="block text-xs text-muted-foreground">{link.description}</span>
                </span>
              </Link>
            ))}

            <div className="flex items-center justify-between gap-2 pt-3">
              <ThemeToggle />
              {!isAuthenticated && (
                <div className="flex flex-1 gap-2">
                  <Button variant="outline" className="flex-1" asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button variant="gradient" className="flex-1" asChild>
                    <Link href="/register">Join free</Link>
                  </Button>
                </div>
              )}
            </div>

            <Link
              href="/contact"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground hover:bg-muted"
            >
              <HelpCircle className="h-5 w-5" /> Help &amp; support
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
