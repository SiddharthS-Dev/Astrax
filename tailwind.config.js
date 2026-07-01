/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dashboard-bg': '#0B0F1A',
        'dashboard-card': '#111827',
        'neon-blue': '#00F0FF',
        'neon-blue-hover': '#00D1DF',
      },
      boxShadow: {
        'neon': '0 0 10px rgba(0, 240, 255, 0.5)',
      }
    },
  },
  plugins: [],
}