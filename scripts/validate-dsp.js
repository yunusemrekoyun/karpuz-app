'use strict';

/*
 * Correctness checks for the watermelon DSP pipeline (src/audio).
 *
 * These verify that each formula matches Zeng et al. (2013) on inputs whose
 * answer is known analytically, and that the segmentation reproduces the
 * paper's thump-length behaviour. Run: `npm run validate`.
 *
 * They do NOT check against the paper's Table 2 means directly - that needs
 * the authors' raw recordings, which are not published (see Faz 3).
 */

const {
  fft,
  zcr,
  ste,
  subBandSteRatios,
  butterworthLowpass,
  noiseRmsThreshold,
  segmentThumps,
  extractFeatures,
  watermelon,
} = require('../src/audio');

const { classifyThump, majorityVote, REFERENCE_MEANS, watermelonFeatureVector } = watermelon;

let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

const near = (a, b, tol) => Math.abs(a - b) <= tol;

function sine(freq, rate, n, amp = 1) {
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate);
  return s;
}

// --- FFT --------------------------------------------------------------------
{
  const N = 8;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  re[0] = 1; // unit impulse -> flat magnitude spectrum
  fft(re, im);
  let flat = true;
  for (let k = 0; k < N; k++) flat = flat && near(Math.hypot(re[k], im[k]), 1, 1e-9);
  ok('fft: impulse -> flat spectrum', flat);

  const re2 = new Float64Array(16);
  const im2 = new Float64Array(16);
  for (let i = 0; i < 16; i++) re2[i] = Math.cos((2 * Math.PI * 2 * i) / 16); // bin 2
  fft(re2, im2);
  const mags = Array.from(re2, (v, k) => Math.hypot(v, im2[k]));
  const peak = mags.indexOf(Math.max(...mags));
  ok('fft: pure tone peaks in the right bin', peak === 2 || peak === 14, `peak bin ${peak}`);
}

// --- ZCR -------------------------------------------------------------------
{
  const alt = new Float32Array(1000);
  for (let i = 0; i < alt.length; i++) alt[i] = i % 2 ? 1 : -1;
  ok('zcr: full alternation -> ~1.0', near(zcr(alt), 1, 0.01), zcr(alt).toFixed(4));

  const rate = 44100;
  const f = 1000;
  const s = sine(f, rate, 44100);
  ok('zcr: sine ~= 2f/rate', near(zcr(s), (2 * f) / rate, 0.005), zcr(s).toFixed(5));

  ok('zcr: DC signal -> 0', zcr(new Float32Array(500).fill(0.7)) === 0);
}

// --- STE ------------------------------------------------------------------
{
  const c = new Float32Array(2000).fill(0.5);
  ok('ste: constant 0.5 over 2000 -> 500', near(ste(c), 0.25 * 2000, 1e-6), ste(c));
}

// --- Sub-band STE ratio -------------------------------------------------
{
  const rate = 44100; // bands: 0-2756, 2756-5512, 5512-11025, 11025-22050 Hz
  const n = 2048;
  const r1 = subBandSteRatios(sine(1500, rate, n), rate);
  ok('sub-band: 1.5 kHz tone lands in band 1', r1[0] > 0.9, JSON.stringify(r1.map((x) => +x.toFixed(3))));

  const r3 = subBandSteRatios(sine(8000, rate, n), rate);
  ok('sub-band: 8 kHz tone lands in band 3', r3[2] > 0.9, JSON.stringify(r3.map((x) => +x.toFixed(3))));

  const r4 = subBandSteRatios(sine(15000, rate, n), rate);
  ok('sub-band: 15 kHz tone lands in band 4', r4[3] > 0.9, JSON.stringify(r4.map((x) => +x.toFixed(3))));

  const sum = r1.reduce((a, b) => a + b, 0);
  ok('sub-band: ratios sum to ~1', near(sum, 1, 1e-6), sum);
}

// --- Butterworth low-pass (cut-off = rate/4) --------------------------
{
  const rate = 44100;
  const low = sine(2000, rate, 8192, 1);
  const high = sine(20000, rate, 8192, 1);
  const lowOut = butterworthLowpass(low, rate);
  const highOut = butterworthLowpass(high, rate);
  const energy = (a, from) => {
    let e = 0;
    for (let i = from; i < a.length; i++) e += a[i] * a[i];
    return e;
  };
  const lowKept = energy(lowOut, 2000) / energy(low, 2000);
  const highKept = energy(highOut, 2000) / energy(high, 2000);
  ok('butterworth: passes 2 kHz', lowKept > 0.7, lowKept.toFixed(3));
  ok('butterworth: rejects 20 kHz', highKept < 0.15, highKept.toFixed(3));
}

// --- Noise threshold + segmentation ----------------------------------
{
  const rate = 44100;
  const noise = new Float32Array(rate * 2);
  for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() - 0.5) * 0.01;
  const threshold = noiseRmsThreshold(noise, rate);
  ok('threshold: > 0 and small', threshold > 0 && threshold < 0.02, threshold.toExponential(2));

  // room noise, one 1800-sample thump, more noise
  const sig = new Float32Array(rate); // 1 s
  for (let i = 0; i < sig.length; i++) sig[i] = (Math.random() - 0.5) * 0.01;
  const t0 = 10000;
  const thumpLen = 1900; // ~43 ms, like the paper's observed thump length
  for (let i = 0; i < thumpLen; i++) {
    const env = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / thumpLen); // smooth on/off
    sig[t0 + i] += 0.4 * (0.3 + 0.7 * env) * Math.sin((2 * Math.PI * 3000 * i) / rate);
  }
  const segs = segmentThumps(sig, threshold, rate);
  ok('segment: finds exactly one thump', segs.length === 1, `got ${segs.length}`);
  if (segs.length === 1) {
    const len = segs[0].end - segs[0].start;
    ok('segment: length within 1500-2500 samples', len >= 1500 && len <= 2500, `${len}`);
    ok('segment: starts near the burst', Math.abs(segs[0].start - t0) < 200, `${segs[0].start} vs ${t0}`);
  }

  // too-short blip must be rejected
  const blip = new Float32Array(rate);
  for (let i = 0; i < blip.length; i++) blip[i] = (Math.random() - 0.5) * 0.01;
  for (let i = 0; i < 300; i++) blip[5000 + i] += 0.4;
  ok('segment: rejects a 300-sample blip', segmentThumps(blip, threshold, rate).length === 0);
}

// --- Classifier sanity ------------------------------------------------
{
  const asFeatures = (m) => ({ zcr: m.zcr, ste: m.ste, subBand: m.subBand.slice() });
  ok('classify: ripe reference means -> ripe', classifyThump(asFeatures(REFERENCE_MEANS.ripe)).label === 1);
  ok('classify: unripe reference means -> unripe', classifyThump(asFeatures(REFERENCE_MEANS.unripe)).label === -1);

  const v = majorityVote([1, 1, -1]);
  ok('vote: 2 ripe / 1 unripe -> ripe', v.label === 1 && v.ripe === 2 && v.unripe === 1);
  ok('vote: tie -> undecided', majorityVote([1, -1]).label === 0);
}

// --- extractFeatures shape ---------------------------------------------
{
  const f = extractFeatures(sine(3000, 44100, 1800, 0.3), 44100);
  ok('extractFeatures: { zcr, ste, subBand[4] }',
    typeof f.zcr === 'number' && typeof f.ste === 'number' &&
    Array.isArray(f.subBand) && f.subBand.length === 4);

  const v = watermelonFeatureVector(f);
  ok('watermelonFeatureVector: [zcr, ste, s1, s3, s4]',
    v.length === 5 && v[0] === f.zcr && v[1] === f.ste &&
    v[2] === f.subBand[0] && v[3] === f.subBand[2] && v[4] === f.subBand[3]);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
