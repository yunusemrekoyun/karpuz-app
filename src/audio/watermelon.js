'use strict';

// WATERMELON-SPECIFIC layer. Not part of the generic audio-analysis module -
// it maps the feature vectors produced by `ThumpAnalyzer` onto a ripe/unripe
// decision, following Zeng et al. (2013), section 6.4.
//
// The real classifier is a linear SVM trained on our own labelled dataset
// (proje-tahtasi.html, Faz 3 + Faz 4). Until those weights exist,
// `classifyThump` uses a PROVISIONAL nearest-centroid rule from the paper's
// Table 2 means, on the scale-invariant features only.

// section 6.4: final feature vector kept by the paper.
function watermelonFeatureVector(features) {
  return [features.zcr, features.ste, features.subBand[0], features.subBand[2], features.subBand[3]];
}

const REFERENCE_MEANS = {
  // Zeng et al. (2013), Table 2, training set.
  ripe: { zcr: 0.0138, ste: 5.6, subBand: [0.317, 0.29, 0.24, 0.156] },
  unripe: { zcr: 0.0202, ste: 8.2, subBand: [0.669, 0.21, 0.0595, 0.0632] },
};

const RIPE = 1;
const UNRIPE = -1;

const PROVISIONAL_AXES = [
  { get: (f) => f.zcr, r: REFERENCE_MEANS.ripe.zcr, u: REFERENCE_MEANS.unripe.zcr },
  { get: (f) => f.subBand[0], r: REFERENCE_MEANS.ripe.subBand[0], u: REFERENCE_MEANS.unripe.subBand[0] },
  { get: (f) => f.subBand[2], r: REFERENCE_MEANS.ripe.subBand[2], u: REFERENCE_MEANS.unripe.subBand[2] },
  { get: (f) => f.subBand[3], r: REFERENCE_MEANS.ripe.subBand[3], u: REFERENCE_MEANS.unripe.subBand[3] },
];

function classifyThump(features) {
  let dRipe = 0;
  let dUnripe = 0;
  for (const ax of PROVISIONAL_AXES) {
    const span = Math.abs(ax.r - ax.u) || 1;
    const v = ax.get(features);
    dRipe += ((v - ax.r) / span) ** 2;
    dUnripe += ((v - ax.u) / span) ** 2;
  }
  const label = dRipe <= dUnripe ? RIPE : UNRIPE;
  const confidence = Math.abs(dUnripe - dRipe) / (dUnripe + dRipe || 1);
  return { label, confidence, provisional: true };
}

// section 6.4: linear SVM decision. Use once Faz 4 produces weights/bias for
// the 5-element vector from `watermelonFeatureVector`.
function classifyThumpSVM(vector, weights, bias = 0) {
  let score = bias;
  for (let i = 0; i < vector.length; i++) score += vector[i] * weights[i];
  return { label: score >= 0 ? RIPE : UNRIPE, score, provisional: false };
}

// section 5.1: majority vote over all thumps.
function majorityVote(labels) {
  const ripe = labels.filter((l) => l === RIPE).length;
  const unripe = labels.length - ripe;
  let label = 0;
  if (ripe > unripe) label = RIPE;
  else if (unripe > ripe) label = UNRIPE;
  return { label, ripe, unripe };
}

module.exports = {
  RIPE,
  UNRIPE,
  REFERENCE_MEANS,
  watermelonFeatureVector,
  classifyThump,
  classifyThumpSVM,
  majorityVote,
};
