import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        /** Warm gold — Ghana's flag and the colour of harvested grain. */
        gold: {
          DEFAULT: '#f59e0b',
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        /** Earth tones for surfaces that should feel agricultural, not corporate. */
        clay: {
          50: '#fdf8f6',
          100: '#f2e8e5',
          200: '#eaddd7',
          300: '#e0cec7',
          400: '#d2bab0',
          500: '#bfa094',
          600: '#a18072',
          700: '#977669',
          800: '#846358',
          900: '#43302b',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgb(16 24 40 / 0.06), 0 4px 16px -4px rgb(16 24 40 / 0.08)',
        lift: '0 12px 32px -8px rgb(16 24 40 / 0.14), 0 4px 12px -4px rgb(16 24 40 / 0.08)',
        glow: '0 0 0 1px rgb(22 163 74 / 0.12), 0 8px 32px -8px rgb(22 163 74 / 0.35)',
        'glow-gold': '0 0 0 1px rgb(245 158 11 / 0.15), 0 8px 32px -8px rgb(245 158 11 / 0.4)',
        inner_soft: 'inset 0 1px 2px 0 rgb(16 24 40 / 0.05)',
      },
      backgroundImage: {
        'grain-gradient': 'linear-gradient(135deg, #15803d 0%, #22c55e 45%, #f59e0b 100%)',
        'field-gradient': 'linear-gradient(160deg, #052e16 0%, #14532d 40%, #166534 100%)',
        'sun-gradient': 'linear-gradient(120deg, #f59e0b 0%, #fbbf24 50%, #fde68a 100%)',
        'mesh-light':
          'radial-gradient(at 15% 10%, rgb(34 197 94 / 0.16) 0px, transparent 55%), radial-gradient(at 85% 5%, rgb(245 158 11 / 0.14) 0px, transparent 50%), radial-gradient(at 70% 85%, rgb(21 128 61 / 0.10) 0px, transparent 55%)',
        'mesh-dark':
          'radial-gradient(at 15% 10%, rgb(34 197 94 / 0.18) 0px, transparent 55%), radial-gradient(at 85% 5%, rgb(245 158 11 / 0.12) 0px, transparent 50%), radial-gradient(at 70% 85%, rgb(20 83 45 / 0.35) 0px, transparent 55%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        marquee: 'marquee 40s linear infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
        blink: 'blink 1.1s step-end infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
