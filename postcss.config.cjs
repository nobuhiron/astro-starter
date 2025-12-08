module.exports = {
  plugins: {
    'postcss-import': {},
    '@csstools/postcss-global-data': {
      files: ['src/styles/global/custom_media.css'],
    },
    'postcss-custom-media': {},
    'postcss-preset-env': { stage: 1 },
    autoprefixer: {},
  },
};
