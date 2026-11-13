/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#dbe4fe',
          300: '#bfd0fd',
          400: '#94b1fc',
          500: '#638cf9',
          600: '#4361ee', // Refined Modern SaaS Blue from prototype
          700: '#3448d4',
          800: '#2c3ab0',
          900: '#28348c',
          950: '#1a2056'
        },
        sidebar: {
          DEFAULT: '#0B0F17',
          dark: '#080C13',
          hover: 'rgba(255, 255, 255, 0.04)',
          active: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.07)'
        }
      }
    },
  },
  plugins: [],
}

