module.exports = {
  plugins: {
    'postcss-import': {},
    'postcss-custom-media': {
      importFrom:'src/styles/global/custom_media.css'
    },
    'postcss-preset-env': { stage: 1 },
    autoprefixer: { },
  },
};
