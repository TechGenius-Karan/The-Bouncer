import type { Config } from 'tailwindcss'

const withOpacity = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Design-token layer, sourced from the "slip & tray" design
      // (The Bouncer.dc.html) — see planning.md §5.1 for the brief.
      // Values resolve through CSS custom properties (src/index.css) so the
      // same class names repaint for dark mode — see :root / .dark there.
      colors: {
        canvas: withOpacity('--color-canvas'),
        screen: withOpacity('--color-screen'),
        slip: withOpacity('--color-slip'),
        ink: {
          DEFAULT: withOpacity('--color-ink'),
          soft: withOpacity('--color-ink-soft'),
          faint: withOpacity('--color-ink-faint'),
        },
        line: withOpacity('--color-line'),
        bin: {
          in: withOpacity('--color-bin-in'),
          'in-text': withOpacity('--color-bin-in-text'),
          'in-chip': withOpacity('--color-bin-in-chip'),
          'in-tint': withOpacity('--color-bin-in-tint'),
          'in-active': withOpacity('--color-bin-in-active'),
          out: withOpacity('--color-bin-out'),
          'out-text': withOpacity('--color-bin-out-text'),
          'out-label': withOpacity('--color-bin-out-label'),
          'out-chip': withOpacity('--color-bin-out-chip'),
          'out-tint': withOpacity('--color-bin-out-tint'),
          'out-active': withOpacity('--color-bin-out-active'),
        },
        miss: {
          DEFAULT: withOpacity('--color-miss'),
          text: withOpacity('--color-miss-text'),
          tint: withOpacity('--color-miss-tint'),
          border: withOpacity('--color-miss-border'),
        },
        skip: {
          DEFAULT: withOpacity('--color-skip'),
          bg: withOpacity('--color-skip-bg'),
          chip: withOpacity('--color-skip-chip'),
          text: withOpacity('--color-skip-text'),
          faint: withOpacity('--color-skip-faint'),
        },
        // Colors specific to the home screen's door/notice-board
        // illustrations (DoorIllustration.tsx) — kept separate from the
        // bin/ink tokens above since they're one-off illustration accents,
        // not reused UI state colors.
        door: {
          'in-frame': withOpacity('--color-door-in-frame'),
          'in-threshold': withOpacity('--color-door-in-threshold'),
          'mark-1': withOpacity('--color-door-mark-1'),
          'mark-2': withOpacity('--color-door-mark-2'),
          'mark-3': withOpacity('--color-door-mark-3'),
          warn: withOpacity('--color-door-warn'),
          'warn-text': withOpacity('--color-door-warn-text'),
        },
      },
      borderRadius: {
        card: '16px',
        bin: '22px',
        screen: '32px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        pressed: 'var(--shadow-pressed)',
        screen: 'var(--shadow-screen)',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        slipIn: {
          from: { transform: 'translateY(10px) rotate(0deg)', opacity: '0' },
          to: { transform: 'none', opacity: '1' },
        },
        nudge: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-7px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        settle: {
          '0%': { transform: 'translateY(-26px) rotate(-6deg)' },
          '60%': { transform: 'translateY(3px) rotate(2deg)' },
          '100%': { transform: 'translateY(0) rotate(-1.5deg)' },
        },
      },
      animation: {
        slipIn: 'slipIn .3s ease both',
        nudge: 'nudge .5s ease 1',
        settle: 'settle .45s ease 1',
      },
    },
  },
  plugins: [],
}

export default config
