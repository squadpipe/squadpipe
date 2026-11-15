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
        mono: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'system-ui', 'sans-serif']
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

