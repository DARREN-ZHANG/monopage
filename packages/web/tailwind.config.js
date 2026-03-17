/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#111827',
        secondary: '#6B7280',
        tertiary: '#9CA3AF',
        border: '#E5E7EB',
        bg: {
          primary: '#FFFFFF',
          secondary: '#FAFAFA',
        },
      },
      maxWidth: {
        content: '672px',
      },
    },
  },
  plugins: [],
};
