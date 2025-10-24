import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#030712',
          900: '#050b1a',
          800: '#071022',
          700: '#0c1733',
        },
        accent: {
          gold: '#d4af37',
          ice: '#8ecae6',
          coral: '#ff9f1c',
          lime: '#80ed99',
        },
      },
      boxShadow: {
        card: '0 10px 40px -15px rgba(10, 18, 40, 0.75)',
        glow: '0 0 0 1px rgba(212, 175, 55, 0.35)',
      },
      borderRadius: {
        '2xl': '1.5rem',
      },
      backgroundImage: {
        'grid-overlay':
          'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(142, 202, 230, 0.08) 100%)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  safelist: ['border-accent-gold'],
  plugins: [],
};

export default config;
