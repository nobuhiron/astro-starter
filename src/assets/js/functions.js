// public/js/functions.js
export default {
  fz: (minSize, maxSize, minViewport = 375, maxViewport = 1440) => {
    minSize = parseFloat(minSize);
    maxSize = parseFloat(maxSize);
    minViewport = parseFloat(minViewport);
    maxViewport = parseFloat(maxViewport);

    const slope = (maxSize - minSize) / (maxViewport - minViewport);
    const intercept = minSize - slope * minViewport;

    const vwPart = slope * 100;
    const remPart = intercept / 16;

    return `clamp(${minSize / 16}rem, calc(${vwPart}vw + ${remPart}rem), ${
      maxSize / 16
    }rem)`;
  },
};
