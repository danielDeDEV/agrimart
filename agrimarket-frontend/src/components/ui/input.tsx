'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, suffix, error, ...props }, ref) => {
    const field = (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-xl border-2 border-input bg-background px-4 py-2 text-sm transition-colors',
          'placeholder:text-muted-foreground/70',
          'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          icon && 'pl-10',
          suffix && 'pr-14',
          error && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/10',
          className
        )}
        ref={ref}
        {...props}
      />
    );

    if (!icon && !suffix) return field;

    return (
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        )}
        {field}
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

/**
 * The one password field used across the site and the admin console: a single
 * show/hide toggle that is always visible, rather than a browser-specific button
 * that only appears once typing starts (those are hidden in globals.css).
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'type' | 'suffix'> & { toggleClassName?: string }
>(({ className, toggleClassName, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className={cn(
          'absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          toggleClassName
        )}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

export { Input, PasswordInput };
