import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        sans:    ['Hanken Grotesk', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        /* Map to CSS variables so tailwind utilities pick up the design tokens */
        paper:    'var(--paper)',
        surface:  'var(--surface)',
        ink:      'var(--ink)',
        accent:   'var(--accent)',
        border:   'var(--line)',
        /* Keep neutral gray for text utilities that aren't being redesigned */
        gray: {
          50:  '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius-sm)',
        card:    'var(--radius)',
        pill:    'var(--radius-pill)',
        xl:      'var(--radius-lg)',
      },
      boxShadow: {
        sm:  'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg:  'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}

export default config
