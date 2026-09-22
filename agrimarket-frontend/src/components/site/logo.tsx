import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The mark: a sprouting leaf over a signal arc — produce plus connectivity,
 * which is the whole idea of the platform. Drawn inline so it is crisp at any
 * size and needs no network request.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800 shadow-soft',
        className
      )}
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6" aria-hidden="true">
        <path
          d="M16 27V14.5"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M16 15.5c0-4.4 3.2-8 7.5-8.6.5 5-2.6 9.2-7.5 8.6Z"
          fill="#fde68a"
        />
        <path
          d="M15.6 19.2c-3.6-.4-6.4-3.2-6.6-6.8 3.9-.2 6.8 2.7 6.6 6.8Z"
          fill="white"
          fillOpacity="0.92"
        />
        <path
          d="M7 24.5c2.6-2 5.7-3 9-3s6.4 1 9 3"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.9"
        />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  href = '/',
  showText = true,
  variant = 'default',
}: {
  className?: string;
  href?: string;
  showText?: boolean;
  variant?: 'default' | 'light';
}) {
  return (
    <Link href={href} className={cn('group flex items-center gap-2.5', className)} aria-label="AgriMart Ghana home">
      <LogoMark className="transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3" />
      {showText && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'font-display text-lg font-extrabold tracking-tight',
              variant === 'light' ? 'text-white' : 'text-foreground'
            )}
          >
            Agri<span className="text-primary-600 dark:text-primary-400">Mart</span>
          </span>
          <span
            className={cn(
              'mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]',
              variant === 'light' ? 'text-white/60' : 'text-muted-foreground'
            )}
          >
            Ghana
          </span>
        </span>
      )}
    </Link>
  );
}
