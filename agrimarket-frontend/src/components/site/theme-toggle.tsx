'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      className={cn('relative overflow-hidden', className)}
      aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Sun
        className={cn(
          'h-4 w-4 transition-all duration-300',
          resolved === 'dark' ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
        )}
      />
      <Moon
        className={cn(
          'absolute h-4 w-4 transition-all duration-300',
          resolved === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        )}
      />
    </Button>
  );
}
