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
          DEFAULT: '#FF9500',
          light: '#FFB84D',
          dark: '#E68600',
        },
        success: {
          DEFAULT: '#34C759',
          light: '#5DD579',
          dark: '#2AAF47',
        },
        accent: {
          DEFAULT: '#007AFF',
          light: '#4DA3FF',
          dark: '#0062CC',
        },
        purple: {
          DEFAULT: '#AF52DE',
          light: '#C47AE8',
          dark: '#9A3FC9',
        },
        danger: {
          DEFAULT: '#FF3B30',
          light: '#FF6B63',
          dark: '#E63329',
        },
        bg: '#FFF8F0',
        'bg-secondary': '#FFF1E6',
        card: '#FFFFFF',
        'text-primary': '#1C1C1E',
        'text-secondary': '#636366',
        'text-tertiary': '#8E8E93',
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'sm': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'lg': '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
