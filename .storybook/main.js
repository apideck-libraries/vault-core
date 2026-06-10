const path = require('path');

module.exports = {
  stories: ['../stories/**/*.stories.@(ts|tsx|js|jsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    {
      name: '@storybook/addon-postcss',
      options: {
        postcssLoaderOptions: {
          implementation: require('postcss'),
        },
      },
    },
  ],
  // https://storybook.js.org/docs/react/configure/typescript#mainjs-configuration
  typescript: {
    check: true, // type-check stories during Storybook build
  },
  // markdown-to-jsx v9 ships modern ESM (nullish coalescing, etc.) in its
  // published bundle. Storybook's webpack excludes node_modules from Babel, so
  // its parser chokes on the syntax. Transpile just this package to fix it.
  webpackFinal: async (config) => {
    config.module.rules.push({
      test: /\.[cm]?js$/,
      include: path.resolve(__dirname, '../node_modules/markdown-to-jsx'),
      use: {
        loader: require.resolve('babel-loader'),
        options: {
          presets: [require.resolve('@babel/preset-env')],
        },
      },
    });
    // webpack 4 predates package.json "exports", so it can't resolve the
    // "markdown-to-jsx/entities" subpath the bundle imports. Point it straight
    // at the file, matching the jest moduleNameMapper in package.json.
    config.resolve.alias = {
      ...config.resolve.alias,
      'markdown-to-jsx/entities$': path.resolve(
        __dirname,
        '../node_modules/markdown-to-jsx/dist/entities.browser.cjs'
      ),
    };
    return config;
  },
};
