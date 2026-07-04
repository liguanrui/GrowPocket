/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F59E6B',
          light: '#FBBF8A',
          dark: '#D97B4F',
        },
        success: {
          DEFAULT: '#6DBF7B',
          light: '#8DD199',
          dark: '#4DA35E',
        },
        accent: {
          DEFAULT: '#5B9BD5',
          light: '#8BBDE5',
          dark: '#3D7EB8',
        },
        purple: {
          DEFAULT: '#B07CC6',
          light: '#C9A0D8',
          dark: '#8F5FAE',
        },
        danger: {
          DEFAULT: '#E87461',
          light: '#F09A8E',
          dark: '#C9554A',
        },
        bg: '#FFFAF4',
        'bg-secondary': '#FFF5ED',
        card: '#FFFFFF',
        'text-primary': '#2D2A26',
        'text-secondary': '#7A7168',
        'text-tertiary': '#A09589',
        warm: {
          DEFAULT: '#F5E6D3',
          light: '#FAF0E6',
          dark: '#E8D5BE',
        },
      },
      borderRadius: {
        'sm': '10px',
        'md': '14px',
        'lg': '18px',
        'xl': '22px',
        '2xl': '28px',
      },
      boxShadow: {
        'sm': '0 2px 12px rgba(45, 42, 38, 0.05)',
        'md': '0 4px 16px rgba(45, 42, 38, 0.07)',
        'lg': '0 8px 32px rgba(45, 42, 38, 0.10)',
      },
    },
  },
  plugins: [],
}
