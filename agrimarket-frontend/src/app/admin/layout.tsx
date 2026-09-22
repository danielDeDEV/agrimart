'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';

/**
 * The admin console is a separate application surface: its own auth realm
 * (separate token, separate login endpoint), its own layout, and no shared
 * navigation with the public site. /admin/login renders bare; everything else
 * is wrapped in the guarded shell.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  return (
    <AuthProvider realm="admin">
      {isLogin ? children : <AdminShell>{children}</AdminShell>}
    </AuthProvider>
  );
}
