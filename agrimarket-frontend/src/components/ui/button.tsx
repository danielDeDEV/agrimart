'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-soft hover:bg-primary-700 hover:shadow-glow dark:hover:bg-primary-400',
        gradient:
          'bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 bg-[length:200%_auto] text-white shadow-soft hover:bg-right hover:shadow-glow',
        gold:
          'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-soft hover:from-gold-600 hover:to-gold-700 hover:shadow-glow-gold',
        destructive:
          'bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90',
        outline:
          'border-2 border-border bg-background hover:border-primary/50 hover:bg-primary-50 hover:text-primary-800 dark:hover:bg-primary-950/50 dark:hover:text-primary-200',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        subtle:
          'bg-primary-50 text-primary-800 hover:bg-primary-100 dark:bg-primary-950/60 dark:text-primary-200 dark:hover:bg-primary-900/60',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-lg px-3.5 text-xs',
        lg: 'h-12 rounded-2xl px-8 text-base',
        xl: 'h-14 rounded-2xl px-9 text-base',
        icon: 'h-11 w-11',
        'icon-sm': 'h-9 w-9 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
