import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Design-token layer, sourced from the "slip & tray" design
      // (The Bouncer.dc.html) — see planning.md §5.1 for the brief.
      colors: {
        canvas: '#F1E7D5',
        screen: '#F7EFE0',
        slip: '#FFFDF7',
        ink: {
          DEFAULT: '#241F19',
          soft: '#6B6154',
          faint: '#8C8271',
        },
        line: '#E6DBC6',
        bin: {
          in: '#2F8F7C',
          'in-text': '#1F6B5C',
          'in-chip': '#DFEEE9',
          'in-tint': '#EAF4F0',
          'in-active': '#E4F1EC',
          out: '#E08A2E',
          'out-text': '#855012',
          'out-label': '#96590E',
          'out-chip': '#FAE7CC',
          'out-tint': '#FCF1E1',
          'out-active': '#FBEEDB',
        },
        miss: {
          DEFAULT: '#C9503F',
          text: '#8E3226',
          tint: '#FFF3F0',
          border: '#F0CDC5',
        },
        skip: {
          DEFAULT: '#D8CCB4',
          bg: '#F4EDDF',
          chip: '#EDE3D0',
          text: '#8C8271',
          faint: '#6F6446',
        },
      },
      borderRadius: {
        card: '16px',
        bin: '22px',
        screen: '32px',
      },
      boxShadow: {
        card: '0 5px 0 -1px #E9DEC9',
        'card-hover': '0 14px 22px -10px rgba(80,60,30,.5)',
        pressed: '0 6px 0 #0F0C09',
        screen: '0 30px 60px -26px rgba(80,60,30,.45)',
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
