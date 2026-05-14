/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cooltra: {
          blue: '#008aff',
          dark: '#052f62',
          deep: '#063063',
          green: '#05e100',
          light: '#8ec8ff',
          orange: '#ec6e24',
          white: '#feffff',
        },
      },
      fontFamily: {
        sans: ['CooltraGilroy', 'Arial', 'sans-serif'],
        bold: ['"CooltraGilroy SemiBold"', 'CooltraGilroy', 'Arial', 'sans-serif'],
        extra: ['"CooltraGilroy ExtraBold"', 'CooltraGilroy', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        cooltra: '28px',
      },
      boxShadow: {
        cooltra: '0 24px 60px -24px rgba(5, 47, 98, 0.45)',
      },
    },
  },
  plugins: [],
};
