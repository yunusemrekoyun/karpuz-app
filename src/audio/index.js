'use strict';

// Generic acoustic-analysis module: dynamic noise gating, impact-event
// segmentation, low-pass filtering and time/frequency feature extraction.
// Nothing here is tied to a particular application.
//
// Parameter defaults and feature formulas follow Zeng et al. (2013),
// "Classifying watermelon ripeness by analysing acoustic signals using
// mobile devices".

module.exports = {
  ...require('./fft'),
  ...require('./dsp'),
  ...require('./analyzer'),
  // watermelon-specific ripe/unripe mapping lives in its own namespace
  watermelon: require('./watermelon'),
};
