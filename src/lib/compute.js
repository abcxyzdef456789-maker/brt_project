// Core BRT computation engine (port of Python app.py logic to pure JS).

import {
  isNum,
  mean,
  median,
  robustMean,
  detectOutliersMAD,
  kmeans1D,
  effectiveK,
  roundToNearest15Sec,
  getCommonYrange,
  MIN_COMBO_SAMPLES,
  MIN_LEG_SAMPLES,
  MAX_ACCEL_DECEL_MIN,
  COMBOS,
} from './stats';
import { getLegSubset } from './journey';
import { resolveCorrectionFallbacks } from './correction';

// ---------- helpers ----------

export function minutesToMmss(minutes) {
  if (!isNum(minutes)) return '-';
  const totalSeconds = Math.round(Number(minutes) * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function comboCounts(subset) {
  const counts = {};
  for (const leg of subset) {
    const c = `${leg.flag_a}-${leg.flag_b}`;
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
}

function dominantCombo(subset) {
  const counts = comboCounts(subset);
  let best = 'N/A';
  let bestN = -1;
  for (const [c, n] of Object.entries(counts)) {
    if (n > bestN) { bestN = n; best = c; }
  }
  return best;
}

function robustComboMean(subset, combo, minSamples = MIN_COMBO_SAMPLES) {
  const vals = subset
    .filter((leg) => `${leg.flag_a}-${leg.flag_b}` === combo)
    .map((leg) => leg.travel_time)
    .filter(isNum);
  if (vals.length < minSamples) return { mean: NaN, n: vals.length, conf: false };
  return { mean: robustMean(vals, minSamples), n: vals.length, conf: true };
}

// ---------- Raw BRT ----------

/**
 * Compute leg raw BRT with MAD outlier removal + KMeans clustering.
 * subset: array of { travel_time, date }
 * Returns { raw, samples, outlier_data, cluster_df }
 *   outlier_data: { values, dates, outliers(bool) }
 *   cluster_df: array of { travel_time, date, cluster }
 */
export function computeLegRawBrt(subset, madThreshold = 3.5, nClusters = 3) {
  const data = subset
    .map((l) => ({ tt: l.travel_time, date: l.date }))
    .filter((d) => isNum(d.tt));

  if (data.length === 0) return { raw: NaN, samples: 0, outlier_data: null, cluster_df: null };

  const travelTimes = data.map((d) => Number(d.tt));
  const dates = data.map((d) => d.date);

  if (travelTimes.length < 5) {
    return { raw: mean(travelTimes), samples: travelTimes.length, outlier_data: null, cluster_df: null };
  }

  const outliers = detectOutliersMAD(travelTimes, madThreshold);
  const outlierData = { values: travelTimes, dates, outliers };

  let cleanTimes = travelTimes.filter((_, i) => !outliers[i]);
  let cleanDates = dates.filter((_, i) => !outliers[i]);

  if (cleanTimes.length < nClusters) {
    cleanTimes = travelTimes;
    cleanDates = dates;
  }

  const k = effectiveK(cleanTimes, nClusters);
  let labels;
  if (k <= 1) {
    labels = cleanTimes.map(() => 0);
  } else {
    labels = kmeans1D(cleanTimes, k);
  }

  const raw = robustMean(cleanTimes, MIN_LEG_SAMPLES);

  const clusterDf = cleanTimes.map((tt, i) => ({
    travel_time: tt,
    date: cleanDates[i],
    cluster: labels[i],
  }));

  return { raw, samples: cleanTimes.length, outlier_data: outlierData, cluster_df: clusterDf };
}

// ---------- Decompose leg estimate ----------

export function decomposeLegEstimate(subset, opts = {}) {
  const {
    distanceKm = null,
    mpsKmph = null,
    accelFallback = null,
    decelFallback = null,
    accelFallbackSource = 'none',
    decelFallbackSource = 'none',
    minSamples = MIN_COMBO_SAMPLES,
  } = opts;

  if (!subset || subset.length === 0) {
    return {
      baseline: NaN, accel: NaN, decel: NaN, accelLocal: NaN, decelLocal: NaN,
      dominant: 'N/A', lowConfidence: true, samples: 0, comboCounts: {},
      baselineSource: 'none', accelSource: 'none', decelSource: 'none',
    };
  }

  const counts = comboCounts(subset);
  const dominant = dominantCombo(subset);

  const tt = robustComboMean(subset, 'T-T', minSamples);
  const dt = robustComboMean(subset, 'D-T', minSamples);
  const ta = robustComboMean(subset, 'T-A', minSamples);

  let baseline = NaN;
  let baselineSource = 'none';
  if (isNum(distanceKm) && isNum(mpsKmph) && Number(mpsKmph) > 0) {
    baseline = (Number(distanceKm) / Number(mpsKmph)) * 60.0;
    baselineSource = 'physics_formula';
  } else if (tt.conf) {
    baseline = tt.mean;
    baselineSource = 'tt_fallback';
  }

  let accelLocal = NaN;
  let decelLocal = NaN;
  if (dt.conf && tt.conf) accelLocal = dt.mean - tt.mean;
  if (ta.conf && tt.conf) decelLocal = ta.mean - tt.mean;
  if (isNum(accelLocal)) accelLocal = Math.max(accelLocal, 0);
  if (isNum(decelLocal)) decelLocal = Math.max(decelLocal, 0);

  let accel = isNum(accelLocal) ? accelLocal : accelFallback;
  let accelSource = isNum(accelLocal) ? 'local' : accelFallbackSource;
  let decel = isNum(decelLocal) ? decelLocal : decelFallback;
  let decelSource = isNum(decelLocal) ? 'local' : decelFallbackSource;

if (isNum(accel)) accel = Math.min(Number(accel), MAX_ACCEL_DECEL_MIN);
  if (isNum(decel)) decel = Math.min(Number(decel), MAX_ACCEL_DECEL_MIN);

  // Enforce acceleration always >= deceleration (physical constraint).
  // If decel exceeds accel, clamp decel down to accel.
  if (isNum(accel) && isNum(decel) && Number(decel) > Number(accel)) {
    decel = Number(accel);
  }

  let lowConfidence = false;
  if ((dominant === 'D-T' || dominant === 'D-A') && !isNum(accel)) lowConfidence = true;
  if ((dominant === 'T-A' || dominant === 'D-A') && !isNum(decel)) lowConfidence = true;

  return {
    baseline, accel: isNum(accel) ? accel : NaN, decel: isNum(decel) ? decel : NaN,
    accelLocal: isNum(accelLocal) ? accelLocal : NaN,
    decelLocal: isNum(decelLocal) ? decelLocal : NaN,
    dominant, lowConfidence, samples: subset.length, comboCounts: counts,
    baselineSource, accelSource, decelSource,
  };
}

// ---------- Train leg chart data ----------

export function getTrainLegChartData(station, nextStation, trainNo, journeyIndex) {
  const subset = getLegSubset(journeyIndex, station, nextStation, [trainNo]);
  if (subset.length === 0) {
    return { subset: [], raw: NaN, samples: 0, outlier_data: null, cluster_df: null };
  }

  const counts = comboCounts(subset);
  const dominant = dominantCombo(subset);
  const dominantSubset = subset.filter((leg) => `${leg.flag_a}-${leg.flag_b}` === dominant);
  const chartSubset = dominantSubset.length >= MIN_LEG_SAMPLES ? dominantSubset : subset;

  const { raw, samples, outlier_data, cluster_df } = computeLegRawBrt(chartSubset);

  return { subset, raw, samples, outlier_data, cluster_df };
}

// ---------- Train-wise route legs ----------

export function buildRouteLegs(trainNo, masterRows, journeyIndex, sectionMap, correctionPools) {
  const trainNoStr = String(Number(trainNo));

  const routeMaster = masterRows
    .filter((r) => r.train === trainNoStr)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));

  if (routeMaster.length === 0) {
    return { legRows: [], error: `Train ${trainNo} not found in master data.` };
  }

  const legs = routeMaster
    .map((r) => ({
      station: r.station,
      nextStation: r.next,
      existingRuntimeSec: r.existing_sec,
      distanceKm: r.dist_km,
      mps: r.mps,
    }))
    .filter((l) => l.nextStation !== null && l.nextStation !== undefined);

  if (legs.length === 0) {
    return { legRows: [], error: `No valid route legs found for train ${trainNo}.` };
  }

  const legRows = [];

  for (const leg of legs) {
    const subset = getLegSubset(journeyIndex, leg.station, leg.nextStation, [trainNo]);

    const existingRuntime = isNum(leg.existingRuntimeSec) ? leg.existingRuntimeSec / 60.0 : NaN;
    const blockSet = `${leg.station}-${leg.nextStation}`;

    const fallback = resolveCorrectionFallbacks(
      trainNoStr, leg.station, leg.nextStation,
      sectionMap[blockSet] || '-', leg.mps, correctionPools, leg.distanceKm
    );

    if (subset.length === 0) {
      legRows.push({
        station: leg.station, nextStation: leg.nextStation,
        flag: 'N/A', dominant: 'N/A',
        existingRuntime: isNum(existingRuntime) ? Math.round(existingRuntime * 100) / 100 : NaN,
        samples: 0, rawBrt: NaN, roundedEstimate: NaN, lowConfidence: true,
        accel: NaN, decel: NaN, accelMean: NaN, decelMean: NaN, netBrt: NaN,
        distanceKm: leg.distanceKm, mps: leg.mps,
        accelSource: 'none', decelSource: 'none', baselineSource: 'none',
        subset: [],
      });
      continue;
    }

    const dominant = dominantCombo(subset);
    const chartData = getTrainLegChartData(leg.station, leg.nextStation, trainNo, journeyIndex);
    const rawBrt = chartData.raw;
    const rawSamples = chartData.samples;

    const decomp = decomposeLegEstimate(subset, {
      distanceKm: leg.distanceKm,
      mpsKmph: leg.mps,
      accelFallback: fallback.accel,
      decelFallback: fallback.decel,
      accelFallbackSource: fallback.accel_source,
      decelFallbackSource: fallback.decel_source,
    });

    legRows.push({
      station: leg.station, nextStation: leg.nextStation,
      flag: dominant, dominant,
      existingRuntime: isNum(existingRuntime) ? Math.round(existingRuntime * 100) / 100 : NaN,
      samples: rawSamples, rawBrt,
      roundedEstimate: NaN,
      lowConfidence: decomp.lowConfidence || rawSamples < MIN_LEG_SAMPLES,
      accel: (dominant === 'D-T' || dominant === 'D-A') && isNum(decomp.accel) ? decomp.accel : NaN,
      decel: (dominant === 'T-A' || dominant === 'D-A') && isNum(decomp.decel) ? decomp.decel : NaN,
      accelMean: NaN, decelMean: NaN, netBrt: NaN,
      distanceKm: leg.distanceKm, mps: leg.mps,
      accelSource: decomp.accelSource, decelSource: decomp.decelSource,
      baselineSource: decomp.baselineSource,
      subset,
    });
  }

  const accelVals = legRows.filter((l) => isNum(l.accel)).map((l) => Number(l.accel));
  const decelVals = legRows.filter((l) => isNum(l.decel)).map((l) => Number(l.decel));
  const accelM = accelVals.length ? mean(accelVals) : NaN;
  const decelM = decelVals.length ? mean(decelVals) : NaN;

  for (const leg of legRows) {
    leg.accelMean = accelM;
    leg.decelMean = decelM;

    const dominant = leg.dominant;
    if (isNum(leg.rawBrt)) {
      const needsAccel = dominant === 'D-T' || dominant === 'D-A';
      const needsDecel = dominant === 'T-A' || dominant === 'D-A';

      let aUse = needsAccel ? (isNum(leg.accel) ? leg.accel : accelM) : 0;
      let dUse = needsDecel ? (isNum(leg.decel) ? leg.decel : decelM) : 0;
      aUse = isNum(aUse) ? aUse : 0;
      dUse = isNum(dUse) ? dUse : 0;

      const netBrt = Math.max(Number(leg.rawBrt) - aUse - dUse, 0);
      leg.netBrt = netBrt;
      leg.roundedEstimate = roundToNearest15Sec(netBrt);

      if (needsAccel && !isNum(leg.accel) && !isNum(accelM)) leg.lowConfidence = true;
      if (needsDecel && !isNum(leg.decel) && !isNum(decelM)) leg.lowConfidence = true;
    } else {
      leg.netBrt = NaN;
      leg.roundedEstimate = NaN;
    }
  }

  return { legRows, error: null };
}

// ---------- Section helpers ----------

export function getAvailableSections(masterRows, sectionMap) {
  const sections = new Set();
  for (const r of masterRows) {
    if (r.next === null || r.next === undefined) continue;
    const name = sectionMap[`${r.station}-${r.next}`];
    if (name) sections.add(name);
  }
  return [...sections].sort();
}

export function computeMultiTrainOutliers(subset, madThreshold = 3.5) {
  const byTrain = {};
  for (const leg of subset) {
    if (!byTrain[leg.train]) byTrain[leg.train] = [];
    byTrain[leg.train].push({ tt: leg.travel_time, date: leg.date, train: leg.train });
  }
  const result = [];
  for (const [train, rows] of Object.entries(byTrain)) {
    const vals = rows.map((r) => Number(r.tt)).filter(isNum);
    const outliers = detectOutliersMAD(vals, madThreshold);
    rows.forEach((r, i) => {
      result.push({ ...r, outlier: outliers[i] === true });
    });
  }
  return result;
}

export function deriveLowerClusterFromComboDf(comboDf) {
  if (!comboDf || comboDf.length === 0) return null;
  const counts = {};
  for (const r of comboDf) counts[r.combo] = (counts[r.combo] || 0) + 1;
  let majority = null;
  let bestN = -1;
  for (const [c, n] of Object.entries(counts)) {
    if (n > bestN) { bestN = n; majority = c; }
  }
  const domData = comboDf.filter((r) => r.combo === majority);
  const subMeans = {};
  for (const r of domData) {
    subMeans[r.subcluster] = (subMeans[r.subcluster] || 0) + r.travel_time;
  }
  const subCounts = {};
  for (const r of domData) subCounts[r.subcluster] = (subCounts[r.subcluster] || 0) + 1;
  for (const c of Object.keys(subMeans)) subMeans[c] /= subCounts[c];

  if (Object.keys(subMeans).length === 0) return null;
  let lowerSub = null;
  let lowVal = Infinity;
  for (const [c, v] of Object.entries(subMeans)) {
    if (v < lowVal) { lowVal = v; lowerSub = Number(c); }
  }
  return domData.map((r) => ({
    ...r,
    islower: r.combo === majority && Number(r.subcluster) === Number(lowerSub),
  }));
}

export function getLegChartData(station, nextStation, trains, journeyIndex) {
  const trainList = [...trains];

  const pooledSubset = getLegSubset(journeyIndex, station, nextStation, trainList);
  let pooled = null;
  if (pooledSubset.length > 0) {
    const { raw, samples, cluster_df } = computeLegRawBrt(pooledSubset);
    pooled = { subset: pooledSubset, raw, samples, cluster_df };
  }

  const perTrainCombo = {};
  for (const trainNo of trainList) {
    const tSubset = getLegSubset(journeyIndex, station, nextStation, [trainNo]);
    if (tSubset.length === 0) { perTrainCombo[trainNo] = null; continue; }

    const valid = tSubset.filter((leg) => COMBOS.includes(`${leg.flag_a}-${leg.flag_b}`));
    if (valid.length === 0 || valid.length < MIN_LEG_SAMPLES) {
      perTrainCombo[trainNo] = null; continue;
    }

    const frames = [];
    const byCombo = {};
    for (const leg of valid) {
      const c = `${leg.flag_a}-${leg.flag_b}`;
      if (!byCombo[c]) byCombo[c] = [];
      byCombo[c].push(leg);
    }
    for (const [combo, cs] of Object.entries(byCombo)) {
      if (!COMBOS.includes(combo)) continue;
      if (cs.length < MIN_COMBO_SAMPLES) continue;
      const { cluster_df } = computeLegRawBrt(cs);
      if (cluster_df) {
        for (const row of cluster_df) {
          frames.push({
            ...row,
            subcluster: row.cluster,
            combo,
            train: trainNo,
          });
        }
      }
    }
    perTrainCombo[trainNo] = frames.length ? frames : null;
  }

  return { pooled, perTrainCombo };
}

export function computeDominantClusterRawBrt(station, nextStation, trains, journeyIndex) {
  const chartData = getLegChartData(station, nextStation, [...trains], journeyIndex);
  const comboFrames = Object.values(chartData.perTrainCombo).filter((x) => x !== null);
  const combinedComboDf = comboFrames.length ? comboFrames.flat() : null;

  const domClusterDf = deriveLowerClusterFromComboDf(combinedComboDf);
  if (!domClusterDf || domClusterDf.length === 0) return { raw: NaN, samples: 0, domClusterDf: null };

  const dominant = domClusterDf[0].combo;
  const raw = robustMean(domClusterDf.map((r) => r.travel_time), MIN_LEG_SAMPLES);
  return { raw, samples: domClusterDf.length, domClusterDf };
}

export function computeLegSpeedClassMetrics(
  station, nextStation, trains, existingRuntime, distanceKm, mpsKmph,
  sectionName, journeyIndex, correctionPools
) {
  const subset = getLegSubset(journeyIndex, station, nextStation, trains);

  if (subset.length === 0) {
    return {
      existing: existingRuntime, raw: NaN, rawSamples: 0, brt: NaN,
      accel: NaN, decel: NaN, netBrt: NaN, roundAd: NaN,
      accelMean: NaN, decelMean: NaN, accelLowConf: true, decelLowConf: true,
      lowConfidence: true, dominant: 'N/A', baselineSource: 'none',
      nTrains: 0, nSamples: 0, subset: [], accelSource: 'none', decelSource: 'none',
    };
  }

  const fallback = resolveCorrectionFallbacks(
    trains.length === 1 ? trains[0] : '__POOLED__',
    station, nextStation, sectionName, mpsKmph, correctionPools, distanceKm
  );

  const result = decomposeLegEstimate(subset, {
    distanceKm, mpsKmph,
    accelFallback: fallback.accel, decelFallback: fallback.decel,
    accelFallbackSource: fallback.accel_source, decelFallbackSource: fallback.decel_source,
  });

  const { raw, samples, domClusterDf } = computeDominantClusterRawBrt(
    station, nextStation, trains, journeyIndex
  );

  const dominant = result.dominant;
  const accelGated = (dominant === 'D-T' || dominant === 'D-A') && isNum(result.accel) ? result.accel : NaN;
  const decelGated = (dominant === 'T-A' || dominant === 'D-A') && isNum(result.decel) ? result.decel : NaN;

  const nTrains = new Set(subset.map((l) => String(l.train))).size;

  return {
    existing: existingRuntime, raw, rawSamples: samples,
    yrange: getCommonYrange(subset.map((l) => l.travel_time)),
    brt: result.baseline,
    accel: accelGated, decel: decelGated,
    netBrt: NaN, roundAd: NaN, accelMean: NaN, decelMean: NaN,
    accelLowConf: result.lowConfidence, decelLowConf: result.lowConfidence,
    lowConfidence: result.lowConfidence || samples < MIN_LEG_SAMPLES,
    dominant, baselineSource: result.baselineSource,
    nTrains, nSamples: subset.length, subset,
    accelSource: result.accelSource, decelSource: result.decelSource,
  };
}

export function buildOneLeg(station, nextStation, masterRows, sectionMap, journeyIndex, correctionPools) {
  const legMaster = masterRows.filter((r) => r.station === station && r.next === nextStation);
  const blockSet = `${station}-${nextStation}`;
  const sectionName = sectionMap[blockSet] || '-';

  if (legMaster.length === 0) {
    return { station, nextStation, blockSet, sectionName, speedClasses: {}, trains: [], noMpsTrains: [] };
  }

  const speedClasses = {};
  const byMps = {};
  for (const r of legMaster) {
    const key = isNum(r.mps) ? String(r.mps) : '__NA__';
    if (!byMps[key]) byMps[key] = [];
    byMps[key].push(r);
  }

  for (const [mpsKey, grp] of Object.entries(byMps)) {
    if (mpsKey === '__NA__') continue;
    const mpsVal = Number(mpsKey);
    const classTrains = [...new Set(grp.map((r) => r.train))];
    const existingRuntime = mean(grp.map((r) => (isNum(r.existing_sec) ? r.existing_sec / 60.0 : NaN)).filter(isNum));
    const distanceKm = mean(grp.map((r) => r.dist_km).filter(isNum));

    const metrics = computeLegSpeedClassMetrics(
      station, nextStation, classTrains, existingRuntime, distanceKm, mpsVal,
      sectionName, journeyIndex, correctionPools
    );
    speedClasses[mpsVal] = metrics;
  }

  const noMpsTrains = [...new Set(legMaster.filter((r) => !isNum(r.mps)).map((r) => r.train))];
  const allLegTrains = [...new Set(legMaster.map((r) => r.train))];

  return { station, nextStation, blockSet, sectionName, speedClasses, trains: allLegTrains, noMpsTrains };
}

export function buildSectionLegs(sectionName, masterRows, sectionMap, journeyIndex, correctionPools) {
  const legsWithSection = masterRows
    .filter((r) => r.next !== null && r.next !== undefined)
    .map((r) => ({ ...r, sectionName: sectionMap[`${r.station}-${r.next}`] }))
    .filter((r) => r.sectionName === sectionName);

  // Order by min seq per block
  const blockMinSeq = {};
  for (const r of legsWithSection) {
    const key = `${r.station}-${r.next}`;
    if (!blockMinSeq[key] || r.seq < blockMinSeq[key]) blockMinSeq[key] = r.seq;
  }
  const orderedBlocks = Object.entries(blockMinSeq)
    .sort((a, b) => (a[1] || 0) - (b[1] || 0))
    .map(([key]) => key.split('-'));

  const legRows = orderedBlocks.map(([st, nx]) =>
    buildOneLeg(st, nx, masterRows, sectionMap, journeyIndex, correctionPools)
  );

  const allMps = [...new Set(legRows.flatMap((leg) => Object.keys(leg.speedClasses).map(Number)))].sort((a, b) => a - b);

  for (const mps of allMps) {
    const accelVals = [];
    const decelVals = [];
    for (const leg of legRows) {
      const metrics = leg.speedClasses[mps];
      if (!metrics) continue;
      if (isNum(metrics.accel)) accelVals.push(Number(metrics.accel));
      if (isNum(metrics.decel)) decelVals.push(Number(metrics.decel));
    }
    const accelM = accelVals.length ? mean(accelVals) : NaN;
    const decelM = decelVals.length ? mean(decelVals) : NaN;

    for (const leg of legRows) {
      const metrics = leg.speedClasses[mps];
      if (!metrics) continue;
      metrics.accelMean = accelM;
      metrics.decelMean = decelM;

      const dominant = metrics.dominant;
      if (isNum(metrics.raw)) {
        const needsAccel = dominant === 'D-T' || dominant === 'D-A';
        const needsDecel = dominant === 'T-A' || dominant === 'D-A';

        let aUse = needsAccel ? (isNum(metrics.accel) ? metrics.accel : accelM) : 0;
        let dUse = needsDecel ? (isNum(metrics.decel) ? metrics.decel : decelM) : 0;
        aUse = isNum(aUse) ? aUse : 0;
        dUse = isNum(dUse) ? dUse : 0;

        const netBrt = Math.max(Number(metrics.raw) - aUse - dUse, 0);
        metrics.netBrt = netBrt;
        metrics.roundAd = roundToNearest15Sec(netBrt);

        if (needsAccel && !isNum(metrics.accel) && !isNum(accelM)) metrics.lowConfidence = true;
        if (needsDecel && !isNum(metrics.decel) && !isNum(decelM)) metrics.lowConfidence = true;
      } else {
        metrics.netBrt = NaN;
        metrics.roundAd = NaN;
      }
    }
  }

  return legRows;
}

export function sectionTrainsSummary(sectionName, masterRows, sectionMap) {
  const result = [];
  const seen = new Set();
  for (const r of masterRows) {
    if (r.next === null || r.next === undefined) continue;
    const name = sectionMap[`${r.station}-${r.next}`];
    if (name !== sectionName) continue;
    const key = `${r.train}|${r.mps}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ train: r.train, mps: isNum(r.mps) ? Number(r.mps) : null });
  }
  result.sort((a, b) => {
    if (a.mps === null && b.mps === null) return String(a.train).localeCompare(String(b.train));
    if (a.mps === null) return 1;
    if (b.mps === null) return -1;
    if (a.mps !== b.mps) return a.mps - b.mps;
    return String(a.train).localeCompare(String(b.train));
  });
  return result;
}

export function computeSectionTotals(legRows) {
  const speedClasses = [...new Set(legRows.flatMap((leg) => Object.keys(leg.speedClasses).map(Number)))].sort((a, b) => a - b);
  const fields = ['existing', 'raw', 'accel', 'decel', 'accelMean', 'decelMean', 'netBrt', 'roundAd'];
  const totals = {};
  const counts = {};
  for (const mps of speedClasses) {
    totals[mps] = { existing: 0, raw: 0, accel: 0, decel: 0, accelMean: 0, decelMean: 0, netBrt: 0, roundAd: 0 };
    counts[mps] = { existing: 0, raw: 0, accel: 0, decel: 0, accelMean: 0, decelMean: 0, netBrt: 0, roundAd: 0 };
  }

  for (const leg of legRows) {
    for (const mps of speedClasses) {
      const metrics = leg.speedClasses[mps];
      if (!metrics) continue;
      const skipLowSample = metrics.nSamples < MIN_LEG_SAMPLES;
      for (const field of fields) {
        let val = metrics[field];
        if (field === 'roundAd') val = metrics.roundAd;
        else if (field === 'accelMean') val = metrics.accelMean;
        else if (field === 'decelMean') val = metrics.decelMean;
        else if (field === 'netBrt') val = metrics.netBrt;

        if ((field === 'roundAd' || field === 'existing' || field === 'netBrt') && skipLowSample) continue;
        if (isNum(val)) {
          totals[mps][field] += Number(val);
          counts[mps][field] += 1;
        }
      }
    }
  }

  const variancePct = {};
  for (const mps of speedClasses) {
    const existingTotal = totals[mps].existing;
    const netTotal = totals[mps].netBrt;
    if (counts[mps].existing > 0 && counts[mps].netBrt > 0 && existingTotal > 0) {
      variancePct[mps] = ((netTotal - existingTotal) / existingTotal) * 100.0;
    } else {
      variancePct[mps] = NaN;
    }
  }

  return { speedClasses, totals, counts, variancePct };
}
