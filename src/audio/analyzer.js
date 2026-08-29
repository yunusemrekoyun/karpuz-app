'use strict';

// Drives one acoustic-analysis session and produces feature vectors for the
// impact events it hears. Application-independent: it does not classify
// anything - a downstream model (e.g. the watermelon SVM) consumes
// `result.thumps[].features`.
//
// Runtime flow (Zeng et al. 2013, section 5.1):
//   1. measure `noisePeriodS` seconds of room noise  -> dynamic RMS threshold
//   2. buffer audio while the user produces impact events
//   3. on stop: segment events -> low-pass filter -> extract features
//
// Feed it Float32 PCM chunks normalised to [-1, 1] from expo-audio (mobile)
// or the Web Audio API (web).

const {
  rms,
  noiseRmsThreshold,
  findSegments,
  segmentThumps,
  butterworthLowpass,
  extractFeatures,
  NOISE_PERIOD_S,
} = require('./dsp');

const Phase = {
  IDLE: 'idle',
  MEASURING_NOISE: 'measuring-noise',
  LISTENING: 'listening',
  DONE: 'done',
};

class ThumpAnalyzer {
  // opts: { noisePeriodS, minMs, maxMs } - all optional, paper defaults used.
  constructor(opts = {}) {
    this._opts = opts;
    this.reset();
  }

  reset() {
    this.phase = Phase.IDLE;
    this.rate = 0;
    this.threshold = 0;
    this.result = null;
    this._noiseBuf = null;
    this._noiseFilled = 0;
    this._noiseTarget = 0;
    this._chunks = [];
  }

  begin(rate) {
    this.reset();
    this.rate = rate || 44100;
    const period = this._opts.noisePeriodS || NOISE_PERIOD_S;
    this._noiseTarget = Math.round(period * this.rate);
    this._noiseBuf = new Float32Array(this._noiseTarget);
    this._noiseFilled = 0;
    this.phase = Phase.MEASURING_NOISE;
  }

  push(chunk) {
    if (this.phase === Phase.MEASURING_NOISE) {
      const take = Math.min(this._noiseTarget - this._noiseFilled, chunk.length);
      this._noiseBuf.set(chunk.subarray(0, take), this._noiseFilled);
      this._noiseFilled += take;
      if (this._noiseFilled >= this._noiseTarget) {
        this.threshold = noiseRmsThreshold(this._noiseBuf, this.rate);
        this._noiseBuf = null;
        this.phase = Phase.LISTENING;
      }
    } else if (this.phase === Phase.LISTENING) {
      this._chunks.push(Float32Array.from(chunk));
    }
  }

  noiseProgress() {
    if (this.phase === Phase.MEASURING_NOISE && this._noiseTarget) {
      return this._noiseFilled / this._noiseTarget;
    }
    return this.phase === Phase.IDLE || this.phase === Phase.MEASURING_NOISE ? 0 : 1;
  }

  recordedSeconds() {
    if (!this.rate) return 0;
    let n = 0;
    for (const c of this._chunks) n += c.length;
    return n / this.rate;
  }

  // Run the pipeline on everything captured while LISTENING.
  finish() {
    let total = 0;
    for (const c of this._chunks) total += c.length;
    const buf = new Float32Array(total);
    let off = 0;
    for (const c of this._chunks) {
      buf.set(c, off);
      off += c.length;
    }
    this._chunks = [];

    const { minMs, maxMs } = this._opts;
    const frame = Math.max(1, Math.round(this.rate / 1000));
    let peakRms = 0;
    for (let s = 0; s + frame <= buf.length; s += frame) {
      const r = rms(buf, s, s + frame);
      if (r > peakRms) peakRms = r;
    }
    const rawSegments = findSegments(buf, this.threshold, this.rate).map((seg) => ({
      lengthMs: ((seg.end - seg.start) / this.rate) * 1000,
      lengthSamples: seg.end - seg.start,
    }));

    const segments = segmentThumps(buf, this.threshold, this.rate, { minMs, maxMs });
    const thumps = segments.map((seg, i) => {
      const filtered = butterworthLowpass(buf.subarray(seg.start, seg.end), this.rate);
      return {
        index: i + 1,
        startSec: seg.start / this.rate,
        lengthMs: ((seg.end - seg.start) / this.rate) * 1000,
        features: extractFeatures(filtered, this.rate),
      };
    });

    this.result = {
      rate: this.rate,
      threshold: this.threshold,
      thumpCount: thumps.length,
      thumps,
      diagnostics: {
        threshold: this.threshold,
        peakRms,
        recordedSec: buf.length / this.rate,
        rawSegments,
      },
    };
    this.phase = Phase.DONE;
    return this.result;
  }
}

module.exports = { ThumpAnalyzer, Phase };
