'use strict';

// Minimal dependency-free radix-2 Cooley-Tukey FFT.
// Used for the sub-band STE ratio and any other frequency-domain feature.

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// In-place complex FFT. `re` and `im` are equal-length Float64Array whose
// length must be a power of two.
function fft(re, im) {
  const n = re.length;
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) throw new Error('fft: length must be a power of 2');

  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// Power spectrum |X(k)|^2 of a real frame, for bins 0..N/2 where
// N = nextPow2(frame.length). The frame is zero-padded to N.
function realPowerSpectrum(frame) {
  const N = nextPow2(frame.length);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < frame.length; i++) re[i] = frame[i];
  fft(re, im);
  const half = N >> 1;
  const power = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) power[k] = re[k] * re[k] + im[k] * im[k];
  return power;
}

module.exports = { nextPow2, fft, realPowerSpectrum };
