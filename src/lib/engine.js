// Data loading + orchestration engine. Loads static JSON from public/data and
// exposes client-side computation functions (no backend required).

import { buildJourneyIndex } from './journey';
import { buildRouteMeta, buildCorrectionPools } from './correction';
import {
  buildRouteLegs,
  getAvailableSections,
  buildSectionLegs,
  sectionTrainsSummary,
  computeSectionTotals,
} from './compute';
import { legDecompChartData, sectionBlockChartData } from './chartData';
import { minutesToMmss } from './compute';
import { isNum } from './stats';

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
const DATA_BASE = `${BASE}/data/`;

let _data = null;

export function getDataState() {
  return _data;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

/**
 * Load all data and build indices. Returns a promise resolving to the engine.
 * Accepts an optional onProgress callback.
 */
export async function loadEngine(onProgress = () => {}) {
  if (_data) return _data;

  onProgress('Loading master data...', 0.1);
  const masterRows = await fetchJSON(`${DATA_BASE}master.json`);

  onProgress('Loading sections...', 0.2);
  const sectionMap = await fetchJSON(`${DATA_BASE}sections.json`);

onProgress('Loading journey data (this may take a moment)...', 0.3);
  const journeyRows = await fetchJSON(`${DATA_BASE}journey.json`);

  onProgress('Building journey index...', 0.6);
  const journeyIndex = buildJourneyIndex(journeyRows);

  onProgress('Building route metadata...', 0.7);
  const routeMeta = buildRouteMeta(masterRows, sectionMap);

  onProgress('Building correction pools...', 0.8);
  const correctionPools = buildCorrectionPools(journeyRows, routeMeta);

  onProgress('Ready.', 1.0);

  _data = { masterRows, sectionMap, journeyIndex, journeyRows, routeMeta, correctionPools };
  return _data;
}

export async function loadMeta() {
  const meta = await fetchJSON(`${DATA_BASE}meta.json`);
  return meta;
}

// ---------- Public compute API ----------

export function computeTrain(trainNo) {
  if (!_data) return { error: 'Engine not loaded.' };
  const { masterRows, journeyIndex, sectionMap, correctionPools } = _data;

  const route = buildRouteLegs(trainNo, masterRows, journeyIndex, sectionMap, correctionPools);
  if (route.error) return { error: route.error };

  const legRows = route.legRows;

  const paired = legRows
    .filter((l) => isNum(l.existingRuntime) && isNum(l.netBrt))
    .map((l) => ({ station: l.station, next: l.nextStation, existing: l.existingRuntime, rounded: l.roundedEstimate, samples: l.samples, net: l.netBrt }));

  const usable = paired.filter((p) => p.samples >= 5);

  const existingSum = usable.reduce((s, p) => s + p.existing, 0);
  const roundedSum = usable.reduce((s, p) => s + (isNum(p.rounded) ? p.rounded : 0), 0);
  const netTerms = usable.filter((p) => isNum(p.net)).map((p) => p.net);
  const netSum = netTerms.length ? netTerms.reduce((a, b) => a + b, 0) : NaN;

  let variancePct = null;
  if (usable.length && existingSum > 0 && netTerms.length) {
    variancePct = ((netSum - existingSum) / existingSum) * 100.0;
  }

  const rows = legRows.map((leg) => ({
    station: leg.station,
    next_station: leg.nextStation,
    flag: leg.flag,
    existing_runtime: isNum(leg.existingRuntime) ? leg.existingRuntime : null,
    samples: leg.samples,
    raw_brt: isNum(leg.rawBrt) ? leg.rawBrt : null,
    accel: isNum(leg.accel) ? leg.accel : null,
    decel: isNum(leg.decel) ? leg.decel : null,
    accel_mean: isNum(leg.accelMean) ? leg.accelMean : null,
    decel_mean: isNum(leg.decelMean) ? leg.decelMean : null,
    net_brt: isNum(leg.netBrt) ? leg.netBrt : null,
    rounded_estimate: isNum(leg.roundedEstimate) ? leg.roundedEstimate : null,
    low_confidence: leg.lowConfidence,
    distance_km: leg.distanceKm,
    mps: leg.mps,
    accel_source: leg.accelSource,
    decel_source: leg.decelSource,
    baseline_source: leg.baselineSource,
    existing_mmss: minutesToMmss(leg.existingRuntime),
    raw_mmss: minutesToMmss(leg.rawBrt),
    net_mmss: minutesToMmss(leg.netBrt),
    rounded_mmss: minutesToMmss(leg.roundedEstimate),
  }));

  return {
    train_no: String(Number(trainNo)),
    leg_rows: rows,
    totals: {
      existing_mmss: usable.length ? minutesToMmss(existingSum) : '-',
      net_mmss: netTerms.length ? minutesToMmss(netSum) : '-',
      rounded_mmss: usable.length ? minutesToMmss(roundedSum) : '-',
    },
    variance_pct: isNum(variancePct) ? variancePct : null,
  };
}

export function computeTrainLegChart(trainNo, station, nextStation) {
  if (!_data) return { error: 'Engine not loaded.' };
  return legDecompChartData(station, nextStation, trainNo, _data.journeyIndex);
}

export function computeSection(sectionName) {
  if (!_data) return { error: 'Engine not loaded.' };
  const { masterRows, journeyIndex, sectionMap, correctionPools } = _data;

  const available = getAvailableSections(masterRows, sectionMap);
  if (!available.includes(sectionName)) {
    return { error: `Section '${sectionName}' not found.` };
  }

  const trainSummary = sectionTrainsSummary(sectionName, masterRows, sectionMap);
  const legRows = buildSectionLegs(sectionName, masterRows, sectionMap, journeyIndex, correctionPools);
  const { speedClasses, totals, counts, variancePct } = computeSectionTotals(legRows);

  const legList = legRows.map((leg) => {
    const sc = {};
    for (const [mps, metrics] of Object.entries(leg.speedClasses)) {
      sc[String(Math.round(Number(mps)))] = {
        existing: isNum(metrics.existing) ? metrics.existing : null,
        raw: isNum(metrics.raw) ? metrics.raw : null,
        accel: isNum(metrics.accel) ? metrics.accel : null,
        decel: isNum(metrics.decel) ? metrics.decel : null,
        accel_mean: isNum(metrics.accelMean) ? metrics.accelMean : null,
        decel_mean: isNum(metrics.decelMean) ? metrics.decelMean : null,
        net_brt: isNum(metrics.netBrt) ? metrics.netBrt : null,
        round_ad: isNum(metrics.roundAd) ? metrics.roundAd : null,
        samples: metrics.rawSamples,
        n_samples: metrics.nSamples,
        dominant: metrics.dominant,
        low_confidence: metrics.lowConfidence,
      };
    }
    return {
      station: leg.station,
      next_station: leg.nextStation,
      block_set: leg.blockSet,
      section_name: leg.sectionName,
      speed_classes: sc,
      trains: leg.trains,
    };
  });

  return {
    section_name: sectionName,
    speed_classes: speedClasses.map((m) => String(Math.round(m))),
    metrics_fields: ['existing', 'raw', 'accel', 'decel', 'accel_mean', 'decel_mean', 'net_brt', 'round_ad'],
    legs: legList,
    trains: trainSummary.map((t) => ({ train: t.train, mps: isNum(t.mps) ? t.mps : null })),
totals: Object.fromEntries(
      speedClasses.map((m) => [
        String(Math.round(m)),
        {
          existing: isNum(totals[m].existing) ? totals[m].existing : null,
          raw: isNum(totals[m].raw) ? totals[m].raw : null,
          accel: isNum(totals[m].accel) ? totals[m].accel : null,
          decel: isNum(totals[m].decel) ? totals[m].decel : null,
          accel_mean: isNum(totals[m].accelMean) ? totals[m].accelMean : null,
          decel_mean: isNum(totals[m].decelMean) ? totals[m].decelMean : null,
          net_brt: isNum(totals[m].netBrt) ? totals[m].netBrt : null,
          round_ad: isNum(totals[m].roundAd) ? totals[m].roundAd : null,
        },
      ])
    ),
    variance_pct: Object.fromEntries(
      speedClasses.map((m) => [String(Math.round(m)), isNum(variancePct[m]) ? variancePct[m] : null])
    ),
  };
}

export function computeSectionBlockChart(sectionName, station, nextStation) {
  if (!_data) return { error: 'Engine not loaded.' };
  const { masterRows, journeyIndex, sectionMap } = _data;

  const leg = masterRows.filter((r) => r.station === station && r.next === nextStation);
  const trains = [...new Set(leg.map((r) => r.train))];
  if (trains.length === 0) {
    return { error: 'no-data', message: `No trains found on block ${station} → ${nextStation}.` };
  }
  const data = sectionBlockChartData(station, nextStation, trains, journeyIndex);
  data.trains = trains;
  return data;
}

export function getTrains() {
  return _data ? _data.masterRows.map((r) => r.train).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => Number(a) - Number(b)) : [];
}

export function getSections() {
  if (!_data) return [];
  return getAvailableSections(_data.masterRows, _data.sectionMap);
}
