module.exports = {
  content: [
    './src/**/*.{html,js,jsx,ts,tsx}',
    './node_modules/@apideck/wayfinder/**/*.js',
    './node_modules/@apideck/components/**/*.js',
    './stories/*',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f6f7fe',
          100: '#f2f3fd',
          200: '#e0e1fa',
          300: '#c9c8f4',
          400: '#aba4ea',
          500: '#9182de',
          600: '#775ad8',
          700: '#6434d5',
          800: '#5922b9',
          900: '#5a1aa8',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/line-clamp')],
  important: '#react-vault',
};
