'use strict';

// Generic acoustic-analysis primitives for short impact ("thump") sounds:
// dynamic noise gating, event segmentation, low-pass filtering and
// time/frequency feature extraction. Nothing here is watermelon-specific;
// a downstream classifier decides what the features mean.
//
// The default constants and the feature formulas follow the method in:
//   Zeng, Huang, Muller Arisona, McLoughlin,
//   "Classifying watermelon ripeness by analysing acoustic signals using
//   mobile devices", Pers Ubiquit Comput (2013), section 4.
// They are provided at the paper's 44.1 kHz reference rate and rescaled to
// the device's actual sample rate at run time. Callers that analyse other
// impact sounds can pass their own segmentation options.

const { realPowerSpectrum, nextPow2 } = require('./fft');

const REF_RATE = 44100;

const RMS_FRAME_MS = 1;          // 1 ms RMS frame (44 samples @ 44.1 kHz)
const NOISE_PERIOD_S = 2;        // noise measured for 2 s before events start
const THRESHOLD_MULTIPLIER = 5;  // event threshold = 5 x mean noise RMS
const THUMP_MIN_SAMPLES = 1500;  // 34 ms @ 44.1 kHz (paper's observed thump min)
const THUMP_MAX_SAMPLES = 2500;  // 57 ms @ 44.1 kHz (paper's observed thump max)
const MERGE_MAX_SEG = 1000;      // merge candidates each shorter than 1000 samples
const MERGE_MAX_GAP = 500;       // ...and separated by less than 500 samples

const atRate = (samplesAtRef, rate) =>
  Math.max(1, Math.round((samplesAtRef * rate) / REF_RATE));

function rms(signal, start = 0, end = signal.length) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += signal[i] * signal[i];
  const n = end - start;
  return n > 0 ? Math.sqrt(sum / n) : 0;
}

// section 4.1.2: mean RMS of a noise-only recording over 1 ms frames,
// multiplied by 5 to get the dynamic start/end-point threshold.
function noiseRmsThreshold(noise, rate) {
  const f = atRate((RMS_FRAME_MS / 1000) * REF_RATE, rate);
  let acc = 0;
  let count = 0;
  for (let s = 0; s + f <= noise.length; s += f) {
    acc += rms(noise, s, s + f);
    count++;
  }
  const mean = count ? acc / count : 0;
  return mean * THRESHOLD_MULTIPLIER;
}

// sections 4.1.2 - 4.1.3: label 1 ms frames by RMS, take 0->1 / 1->0
// transitions as start/end points, then merge short close segments that
// belong to the same thump. Returns every candidate segment (no length
// filter yet) so callers can inspect what was found.
function findSegments(signal, threshold, rate) {
  const f = atRate((RMS_FRAME_MS / 1000) * REF_RATE, rate);

  const segs = [];
  let open = null;
  for (let s = 0; s + f <= signal.length; s += f) {
    const active = rms(signal, s, s + f) >= threshold;
    if (active && open === null) open = s;
    else if (!active && open !== null) {
      segs.push({ start: open, end: s });
      open = null;
    }
  }
  if (open !== null) segs.push({ start: open, end: signal.length });

  const maxSeg = atRate(MERGE_MAX_SEG, rate);
  const maxGap = atRate(MERGE_MAX_GAP, rate);
  const merged = [];
  for (const seg of segs) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.end - prev.start < maxSeg &&
      seg.end - seg.start < maxSeg &&
      seg.start - prev.end < maxGap
    ) {
      prev.end = seg.end;
    } else {
      merged.push({ start: seg.start, end: seg.end });
    }
  }
  return merged;
}

// Keep only candidate segments whose length falls in an expected window.
// Defaults are the paper's observed watermelon-thump range (34-57 ms);
// pass { minMs, maxMs } to analyse other impact sounds.
function segmentThumps(signal, threshold, rate, opts = {}) {
  const lo = opts.minMs != null ? Math.round((opts.minMs / 1000) * rate) : atRate(THUMP_MIN_SAMPLES, rate);
  const hi = opts.maxMs != null ? Math.round((opts.maxMs / 1000) * rate) : atRate(THUMP_MAX_SAMPLES, rate);
  return findSegments(signal, threshold, rate).filter((s) => {
    const len = s.end - s.start;
    return len >= lo && len <= hi;
  });
}

// section 4.1.5: 2nd-order low-pass Butterworth, cut-off at half the Nyquist
// frequency (rate / 4). Applied forward then backward so the thump frame is
// not phase-shifted.
function butterworthLowpass(signal, rate) {
  const fc = rate / 4;
  const w0 = (2 * Math.PI * fc) / rate;
  const cos0 = Math.cos(w0);
  const sin0 = Math.sin(w0);
  const alpha = sin0 / Math.SQRT2; // Q = 1 / sqrt(2) -> Butterworth response

  const a0 = 1 + alpha;
  const b0 = ((1 - cos0) / 2) / a0;
  const b1 = (1 - cos0) / a0;
  const b2 = ((1 - cos0) / 2) / a0;
  const a1 = (-2 * cos0) / a0;
  const a2 = (1 - alpha) / a0;

  const biquad = (input) => {
    const out = new Float64Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < input.length; i++) {
      const x0 = input[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      out[i] = y0;
      x2 = x1; x1 = x0;
      y2 = y1; y1 = y0;
    }
    return out;
  };

  const fwd = biquad(signal);
  fwd.reverse();
  const back = biquad(fwd);
  back.reverse();
  return back;
}

// section 4.2.1, eq. (3)
function zcr(frame) {
  if (frame.length < 2) return 0;
  let crossings = 0;
  let prev = frame[0] >= 0 ? 1 : -1;
  for (let i = 1; i < frame.length; i++) {
    const s = frame[i] >= 0 ? 1 : -1;
    crossings += Math.abs(s - prev);
    prev = s;
  }
  return crossings / (2 * frame.length);
}

// section 4.2.2, eq. (4)
function ste(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return sum;
}

// section 4.2.3, eq. (5): sub-band STE ratio.
// Sub-bands are Nyquist * [0, 1/8], [1/8, 1/4], [1/4, 1/2], [1/2, 1].
// Returned as [r1, r2, r3, r4], summing to ~1.
function subBandSteRatios(frame, rate) {
  const power = realPowerSpectrum(frame);
  const N = nextPow2(frame.length);
  const nyq = rate / 2;
  const edges = [0, nyq / 8, nyq / 4, nyq / 2, nyq];
  const bands = [0, 0, 0, 0];
  let total = 0;
  for (let k = 0; k < power.length; k++) {
    const freq = (k * rate) / N;
    total += power[k];
    for (let b = 0; b < 4; b++) {
      if (freq >= edges[b] && (freq < edges[b + 1] || b === 3)) {
        bands[b] += power[k];
        break;
      }
    }
  }
  if (total === 0) return [0, 0, 0, 0];
  return bands.map((e) => e / total);
}

// section 4.2: generic time/frequency feature set for one filtered impact
// frame. Application-independent - which of these features (and which
// sub-bands) a classifier uses is decided downstream.
function extractFeatures(frame, rate) {
  return {
    zcr: zcr(frame),
    ste: ste(frame),
    subBand: subBandSteRatios(frame, rate), // [r1, r2, r3, r4]
  };
}

module.exports = {
  REF_RATE,
  RMS_FRAME_MS,
  NOISE_PERIOD_S,
  THRESHOLD_MULTIPLIER,
  THUMP_MIN_SAMPLES,
  THUMP_MAX_SAMPLES,
  rms,
  noiseRmsThreshold,
  findSegments,
  segmentThumps,
  butterworthLowpass,
  zcr,
  ste,
  subBandSteRatios,
  extractFeatures,
};
