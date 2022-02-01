const config = require('@apideck/components/tailwind-config');

module.exports = config({
  content: [
    './src/**/*.{html,js,jsx,ts,tsx}',
    './node_modules/@apideck/components/dist/*.js',
    './stories/*',
  ],
});
