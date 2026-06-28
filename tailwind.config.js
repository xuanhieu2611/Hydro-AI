/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Hydro AI palette — calm, water-forward.
        hydro: {
          50: '#E6F4FE',
          100: '#CDE9FD',
          200: '#A9D9FB',
          300: '#7CC6F8',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          950: '#082F49',
        },
        // Aqua accent for the liquid fill — a touch greener than hydro for depth.
        aqua: {
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
        },
      },
    },
  },
  plugins: [],
};
