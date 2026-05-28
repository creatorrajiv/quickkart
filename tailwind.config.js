/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand — Swiggy-inspired orange/red gradient anchor
        brand: {
          50:  '#fff5f2',
          100: '#ffe8e1',
          200: '#ffc7b8',
          300: '#ff9c85',
          400: '#fc6f4f',
          500: '#fc4a1a',   // ★ primary
          600: '#e63d12',
          700: '#bf2f0c',
          800: '#992409',
          900: '#7a1d08',
        },
        // Accent — secondary CTA, sale badges
        accent: {
          50:  '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',   // gold for ratings, deals
          500: '#f59e0b',
        },
        // Neutral — body text, borders, surfaces
        ink: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl':   '14px',
        '2xl':  '18px',
        '3xl':  '24px',
      },
      boxShadow: {
        // Subtle elevation system — Material-ish but warmer
        'sm':       '0 1px 2px rgba(15, 23, 42, 0.04)',
        'card':     '0 1px 3px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.04)',
        'pop':      '0 4px 16px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.06)',
        'brand':    '0 6px 16px rgba(252, 74, 26, 0.28)',
        'brand-lg': '0 12px 28px rgba(252, 74, 26, 0.32)',
      },
      animation: {
        'fade-in':       'fadeIn .2s ease-out',
        'slide-up':      'slideUp .25s ease-out',
        'pulse-soft':    'pulseSoft 2s ease-in-out infinite',
        'bounce-once':   'bounceOnce .5s ease-out',
      },
      keyframes: {
        fadeIn:     { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp:    { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulseSoft:  { '0%,100%': { opacity: 1 }, '50%': { opacity: .55 } },
        bounceOnce: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      backgroundImage: {
        'brand-gradient':  'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)',
        'brand-radial':    'radial-gradient(circle at top right, #fc4a1a 0%, #bf2f0c 100%)',
        'sunset':          'linear-gradient(135deg, #fc4a1a 0%, #f7b733 50%, #fc4a1a 100%)',
      },
    },
  },
  plugins: [],
};
