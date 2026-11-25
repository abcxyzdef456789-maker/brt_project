// Pure-JS statistics helpers mirroring the Python BRT logic.

export const MIN_COMBO_SAMPLES = 5;
export const MIN_LEG_SAMPLES = 5;
export const MIN_CORR_SAMPLES = 5;
export const MAX_ACCEL_DECEL_MIN = 3.0;
export const MAD_OUTLIER_THRESHOLD = 3.5;
export const DISTANCE_BAND_KM = 2.0;
export const MIN_BLOCKS_FOR_POOL = 3;
export const BROAD_POOL_MIN_CORR_SAMPLES = 30;
export const COMBOS = ['T-T', 'D-T', 'T-A', 'D-A'];

export function isNum(v) {
  return v !== null && v !== undefined && !Number.isNaN(Number(v));
}

export function median(arr) {
  const a = [...arr].filter(isNum).map(Number).sort((x, y) => x - y);
  if (a.length === 0) return NaN;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export function mean(arr) {
  const a = [...arr].filter(isNum).map(Number);
  if (a.length === 0) return NaN;
  return a.reduce((s, v) => s + v, 0) / a.length;
}

export function quantile(arr, q) {
  const a = [...arr].filter(isNum).map(Number).sort((x, y) => x - y);
  if (a.length === 0) return NaN;
  const pos = q * (a.length - 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  return a[base + 1] !== undefined ? a[base] + rest * (a[base + 1] - a[base]) : a[base];
}

// Python numpy.median for even-length includes the two middle values.
export function numpyMedian(arr) {
  const a = [...arr].filter(isNum).map(Number).sort((x, y) => x - y);
  if (a.length === 0) return NaN;
  const mid = Math.floor(a.length / 2);
  if (a.length % 2) return a[mid];
  return (a[mid - 1] + a[mid]) / 2;
}

/** Robust mean: MAD-based outlier clipping, matching _robust_mean_1d. */
export function robustMean(values, minSamples = MIN_COMBO_SAMPLES) {
  const x = [...values].filter(isNum).map(Number);
  if (x.length === 0) return NaN;
  if (x.length < minSamples) return mean(x);

  const med = median(x);
  const mad = median(x.map((v) => Math.abs(v - med)));
  if (mad === 0) return mean(x);

  const robustZ = x.map((v) => Math.abs(v - med) / (1.4826 * mad));
  let clean = x.filter((_, i) => robustZ[i] <= 3.5);

  if (clean.length < minSamples) clean = x;
  return mean(clean);
}

/** MAD outlier detection returning boolean array (true = outlier). Python returns -1/1. */
export function detectOutliersMAD(values, threshold = MAD_OUTLIER_THRESHOLD) {
  const x = [...values].filter(isNum).map(Number);
  if (x.length < 5) return x.map(() => false);

  const med = median(x);
  const mad = median(x.map((v) => Math.abs(v - med)));
  if (mad === 0) return x.map(() => false);

  const robustZ = x.map((v) => 0.6745 * (v - med) / mad);
  return x.map((v, i) => Math.abs(robustZ[i]) > threshold);
}

/** KMeans clustering (k-means++) on 1D values. Returns labels array. */
export function kmeans1D(values, k, maxIter = 100, seed = 42) {
  const x = [...values].filter(isNum).map(Number);
  const n = x.length;
  if (n === 0) return [];
  if (k <= 1) return x.map(() => 0);
  k = Math.min(k, n);

  // Deterministic seeded RNG (mulberry32) for reproducibility.
  let s = seed >>> 0;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // k-means++ init
  const centers = [];
  centers.push(x[Math.floor(rand() * n)]);
  for (let c = 1; c < k; c++) {
    const dists = x.map((v) => {
      let d = Infinity;
      for (const cent of centers) d = Math.min(d, (v - cent) ** 2);
      return d;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    if (total === 0) {
      centers.push(x[Math.floor(rand() * n)]);
      continue;
    }
    let r = rand() * total;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { idx = i; break; }
    }
    centers.push(x[Math.max(0, Math.min(n - 1, idx))]);
  }

  let labels = new Array(n).fill(0);
  let prevCenters = centers.map(() => NaN);
  for (let iter = 0; iter < maxIter; iter++) {
    // assign
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (x[i] - centers[c]) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true; }
    }
    // recompute centers
    for (let c = 0; c < k; c++) {
      const members = [];
      for (let i = 0; i < n; i++) if (labels[i] === c) members.push(x[i]);
      prevCenters[c] = centers[c];
      centers[c] = members.length ? members.reduce((a, b) => a + b, 0) / members.length : centers[c];
    }
    if (!changed) break;
  }
  return labels;
}

/** Effective k like Python: min(n_clusters, nunique), clamped >=1. */
export function effectiveK(values, nClusters = 3) {
  const unique = new Set([...values].filter(isNum).map(Number));
  return Math.max(1, Math.min(nClusters, unique.size));
}

/** Round minutes to nearest 15 seconds. */
export function roundToNearest15Sec(minutes) {
  if (!isNum(minutes)) return NaN;
  const totalSeconds = Number(minutes) * 60;
  const rounded = Math.round(totalSeconds / 15.0) * 15.0;
  return rounded / 60.0;
}

/** Common y-range from 1st/99th percentile with padding. */
export function getCommonYrange(values, padFrac = 0.08) {
  const a = [...values].filter(isNum).map(Number);
  if (a.length === 0) return [0, 1];
  let lo = quantile(a, 0.01);
  let hi = quantile(a, 0.99);
  if (lo === hi) { lo = a.reduce((acc, v) => Math.min(acc, v), a[0]); hi = a.reduce((acc, v) => Math.max(acc, v), a[0]); }
  if (lo === hi) { lo = lo - 1; hi = hi + 1; }
  const pad = (hi - lo) * padFrac;
  return [Math.max(0, lo - pad), hi + pad];
}
