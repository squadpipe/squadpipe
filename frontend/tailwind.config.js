/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: '0.125rem', // 2px (inline tags)
        md: '0.1875rem',     // 3px (chips, tabs, icon boxes)
        lg: '0.25rem',       // 4px (buttons, inputs, selects, nav items)
        xl: '0.375rem',      // 6px (cards, tables, modals)
        '2xl': '0.5rem',     // 8px
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Inter Variable"',
          '"Inter"',
          'system-ui',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Inter Variable"',
          '"Inter"',
          'system-ui',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.875rem', { lineHeight: '1.35rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.25rem', { lineHeight: '1.75rem' }],
        xl: ['1.375rem', { lineHeight: '1.875rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      colors: {
        brand: {
          50: '#F0F7F5',
          100: '#DCECE7',
          200: '#B8D9CF',
          300: '#8ABFB1',
          400: '#4DA89C',
          500: '#17756D',
          600: '#0F5C56', // Deep Spruce Pine primary accent
          700: '#0B4641',
          800: '#093632',
          900: '#082A27',
          950: '#041816'
        },
        sidebar: {
          DEFAULT: '#141615',
          dark: '#101211',
          active: '#1F2422',
          hover: 'rgba(255, 255, 255, 0.04)',
          border: 'rgba(255, 255, 255, 0.08)'
        }
      }
    },
  },
  plugins: [],
}

