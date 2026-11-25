// Build chart-ready data structures from the compute engine (port of Python serialization).

import { isNum } from './stats';
import {
  getTrainLegChartData,
  getLegChartData,
  computeMultiTrainOutliers,
  deriveLowerClusterFromComboDf,
} from './compute';

function nativeDate(d) {
  return d === null || d === undefined ? null : String(d);
}

export function legDecompChartData(station, nextStation, trainNo, journeyIndex) {
  const cd = getTrainLegChartData(station, nextStation, trainNo, journeyIndex);
  const subset = cd.subset;
  const outlier = cd.outlier_data;
  const cluster = cd.cluster_df;

  const rawPoints = subset.map((r) => ({ date: nativeDate(r.date), value: Number(r.travel_time) }));

  let outlierPoints = null;
  if (outlier) {
    outlierPoints = outlier.values.map((t, i) => ({
      date: nativeDate(outlier.dates[i]),
      value: t,
      outlier: outlier.outliers[i] === true,
    }));
  }

let clusterPoints = null;
  let clusterLines = null;
  let lowerCluster = null;
  if (cluster && cluster.length) {
    clusterPoints = [];
    const sum = {};
    const count = {};
    for (const r of cluster) {
      const c = Number(r.cluster);
      const v = Number(r.travel_time);
      sum[c] = (sum[c] || 0) + v;
      count[c] = (count[c] || 0) + 1;
      clusterPoints.push({ date: nativeDate(r.date), value: v, cluster: c });
    }
    const means = {};
    for (const c of Object.keys(sum)) {
      means[Number(c)] = sum[Number(c)] / count[Number(c)];
    }
    clusterLines = Object.keys(means).sort((a, b) => Number(a) - Number(b)).map((c) => ({ cluster: Number(c), value: means[c] }));
    if (Object.keys(means).length) {
      lowerCluster = Number(Object.keys(means).reduce((a, b) => (means[a] < means[b] ? a : b)));
    }
  }

  return {
    raw_points: rawPoints,
    raw: isNum(cd.raw) ? cd.raw : null,
    samples: cd.samples,
    outlier_points: outlierPoints,
    cluster_points: clusterPoints,
    cluster_lines: clusterLines,
    lower_cluster: lowerCluster,
  };
}

export function sectionBlockChartData(station, nextStation, trains, journeyIndex) {
  const cd = getLegChartData(station, nextStation, [...trains], journeyIndex);

  const pooled = cd.pooled;
  const pooledPoints = [];
  let pooledCluster = null;
  let pooledLines = null;
  const outlierPoints = [];

  if (pooled && pooled.subset && pooled.subset.length) {
    const subset = pooled.subset;
    const outlierDf = computeMultiTrainOutliers(subset);
    const outlierMap = {};
    for (const r of outlierDf) {
      const key = `${r.train}|${r.date}|${r.tt}`;
      outlierMap[key] = r.outlier === true;
    }
    for (const r of subset) {
      const key = `${r.train}|${r.date}|${r.travel_time}`;
      pooledPoints.push({ date: nativeDate(r.date), value: Number(r.travel_time) });
      outlierPoints.push({
        date: nativeDate(r.date),
        value: Number(r.travel_time),
        outlier: outlierMap[key] === true,
      });
    }
if (pooled.cluster_df && pooled.cluster_df.length) {
      const sum = {};
      const count = {};
      pooledCluster = [];
      for (const r of pooled.cluster_df) {
        const c = Number(r.cluster);
        const v = Number(r.travel_time);
        sum[c] = (sum[c] || 0) + v;
        count[c] = (count[c] || 0) + 1;
        pooledCluster.push({ date: nativeDate(r.date), value: v, cluster: c });
      }
      const means = {};
      for (const c of Object.keys(sum)) means[Number(c)] = sum[Number(c)] / count[Number(c)];
      pooledLines = Object.keys(means).sort((a, b) => Number(a) - Number(b)).map((c) => ({ cluster: Number(c), value: means[c] }));
    }
  }

  const comboFrames = Object.values(cd.perTrainCombo).filter((x) => x !== null);
  const combinedComboDf = comboFrames.length ? comboFrames.flat() : null;

  const comboPoints = [];
  if (combinedComboDf && combinedComboDf.length) {
    for (const r of combinedComboDf) {
      comboPoints.push({
        date: nativeDate(r.date),
        value: Number(r.travel_time),
        combo: r.combo,
        subcluster: Number(r.subcluster),
      });
    }
  }

  const domClusterDf = deriveLowerClusterFromComboDf(combinedComboDf);
  const domPoints = [];
  let domLines = null;
  let lowerSub = null;

  if (domClusterDf && domClusterDf.length) {
    const subMeans = {};
    const subCounts = {};
    for (const r of domClusterDf) {
      subMeans[r.subcluster] = (subMeans[r.subcluster] || 0) + Number(r.travel_time);
      subCounts[r.subcluster] = (subCounts[r.subcluster] || 0) + 1;
    }
    for (const c of Object.keys(subMeans)) subMeans[c] /= subCounts[c];
    if (Object.keys(subMeans).length) {
      lowerSub = Number(Object.keys(subMeans).reduce((a, b) => (subMeans[a] < subMeans[b] ? a : b)));
    }
    for (const r of domClusterDf) {
      domPoints.push({
        date: nativeDate(r.date),
        value: Number(r.travel_time),
        subcluster: Number(r.subcluster),
        islower: r.islower === true,
      });
    }
    domLines = Object.keys(subMeans).sort((a, b) => Number(a) - Number(b)).map((c) => ({ cluster: Number(c), value: subMeans[c] }));
  }

  return {
    pooled_points: pooledPoints,
    pooled_raw: pooled && isNum(pooled.raw) ? pooled.raw : null,
    pooled_samples: pooled ? pooled.samples : null,
    pooled_cluster_points: pooledCluster,
    pooled_cluster_lines: pooledLines,
    outlier_points: outlierPoints,
    combo_points: comboPoints,
    dom_points: domPoints,
    dom_lines: domLines,
    lower_subcluster: lowerSub,
  };
}
