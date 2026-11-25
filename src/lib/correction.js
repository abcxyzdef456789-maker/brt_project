// Correction pools for accel/decel fallbacks (port of Python _build_correction_pools).

import {
  mean,
  robustMean,
  isNum,
  DISTANCE_BAND_KM,
  MIN_CORR_SAMPLES,
  BROAD_POOL_MIN_CORR_SAMPLES,
  MIN_BLOCKS_FOR_POOL,
  COMBOS,
} from './stats';

// Build a lookup of route metadata enriched with section_name, distance_band, MPS.
// masterRows: [{ train, seq, station, next, existing_sec, dist_km, mps }]
// Returns routeMeta array (only rows with a next station).
export function buildRouteMeta(masterRows, sectionMap) {
  const out = [];
  for (const r of masterRows) {
    if (r.next === null || r.next === undefined) continue;
    const blockSet = `${r.station}-${r.next}`;
    out.push({
      train: r.train,
      station: r.station,
      next: r.next,
      mps: r.mps,
      dist_km: r.dist_km,
      section_name: sectionMap[blockSet] || null,
      distance_band: distanceBand(r.dist_km),
    });
  }
  return out;
}

export function distanceBand(distanceKm) {
  if (!isNum(distanceKm)) return NaN;
  return Math.floor(Number(distanceKm) / DISTANCE_BAND_KM) * DISTANCE_BAND_KM;
}

// Enrich journey rows with route meta (inner join on train/station/next).
// journeyRows: [{ train, from, to, travel_time, flag_a, flag_b }]
// routeMeta: array from buildRouteMeta
function enrichJourney(journeyRows, routeMeta) {
  const metaKeyed = {};
  for (const rm of routeMeta) {
    const key = `${rm.train}|${rm.station}|${rm.next}`;
    metaKeyed[key] = rm;
  }
  const enriched = [];
  for (const j of journeyRows) {
    const key = `${j.train}|${j.from}|${j.to}`;
    const rm = metaKeyed[key];
    if (!rm) continue;
    const combo = `${j.flag_a}-${j.flag_b}`;
    if (!COMBOS.includes(combo)) continue;
    enriched.push({
      ...j,
      combo,
      mps: rm.mps,
      section_name: rm.section_name,
      distance_band: rm.distance_band,
    });
  }
  return enriched;
}

// Compute pool stats grouped by a list of key accessors.
// enriched: array of enriched journey rows
// keyFns: array of functions taking a row -> key component
// minCorrSamples: min samples for accel/decel
// Returns a Map: keyString -> { accel, decel, accel_n, decel_n, tt_n, block_n }
function poolStatsMap(enriched, keyFns, minCorrSamples = MIN_CORR_SAMPLES) {
  const groups = new Map();

  for (const row of enriched) {
    const key = keyFns.map((fn) => {
      const v = fn(row);
      return v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))
        ? '__NA__'
        : String(v);
    }).join('|');

    if (!groups.has(key)) {
      groups.set(key, { tt: [], dt: [], ta: [], blocks: new Set() });
    }
    const g = groups.get(key);
    if (row.combo === 'T-T') g.tt.push(row.travel_time);
    else if (row.combo === 'D-T') g.dt.push(row.travel_time);
    else if (row.combo === 'T-A') g.ta.push(row.travel_time);
    g.blocks.add(`${row.from}-${row.to}`);
  }

  const out = new Map();
  for (const [key, g] of groups) {
    const ttMean = mean(g.tt);
    const dtMean = mean(g.dt);
    const taMean = mean(g.ta);
    const ttN = g.tt.length;
    const dtN = g.dt.length;
    const taN = g.ta.length;

    let accel = NaN;
    let decel = NaN;
    if (ttN >= minCorrSamples && dtN >= minCorrSamples) accel = Math.max(dtMean - ttMean, 0);
    if (ttN >= minCorrSamples && taN >= minCorrSamples) decel = Math.max(taMean - ttMean, 0);

    out.set(key, {
      accel: Number.isNaN(accel) ? null : accel,
      decel: Number.isNaN(decel) ? null : decel,
      accel_n: dtN,
      decel_n: taN,
      tt_n: ttN,
      block_n: g.blocks.size,
    });
  }
  return out;
}

function keyToString(keyArr) {
  return keyArr.map((v) =>
    v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))
      ? '__NA__'
      : String(v)
  ).join('|');
}

/**
 * Build the full correction pools object.
 * Returns:
 *   {
 *     exact, block_mps, distance_mps, train_mps, mps
 *   }
 * where each is a Map keyed by a joined key string.
 */
export function buildCorrectionPools(journeyRows, routeMeta) {
  const empty = { exact: new Map(), block_mps: new Map(), distance_mps: new Map(), train_mps: new Map(), mps: new Map() };
  if (journeyRows.length === 0 || routeMeta.length === 0) return empty;

  const enriched = enrichJourney(journeyRows, routeMeta);
  if (enriched.length === 0) return empty;

  return {
    exact: poolStatsMap(
      enriched,
      [(r) => r.train, (r) => r.from, (r) => r.to]
    ),
    block_mps: poolStatsMap(
      enriched,
      [(r) => r.from, (r) => r.to, (r) => r.mps]
    ),
    distance_mps: poolStatsMap(
      enriched,
      [(r) => r.section_name, (r) => r.distance_band, (r) => r.mps],
      BROAD_POOL_MIN_CORR_SAMPLES
    ),
    train_mps: poolStatsMap(
      enriched,
      [(r) => r.train, (r) => r.mps],
      BROAD_POOL_MIN_CORR_SAMPLES
    ),
    mps: poolStatsMap(
      enriched,
      [(r) => r.mps],
      BROAD_POOL_MIN_CORR_SAMPLES
    ),
  };
}

/**
 * Resolve accel/decel fallbacks by trying candidate pools in order.
 * Returns { accel, decel, accel_source, decel_source } (null when unavailable).
 */
export function resolveCorrectionFallbacks(
  trainNo, station, nextStation, sectionName, mps, correctionPools, distanceKm
) {
  const candidates = [];
  const mpsKey = isNum(mps) ? Number(mps) : null;

  candidates.push(['exact', [String(trainNo), station, nextStation]]);

  if (mpsKey !== null) {
    candidates.push(['block_mps', [station, nextStation, mpsKey]]);
    if (
      isNum(distanceKm) &&
      sectionName !== null && sectionName !== undefined &&
      sectionName !== '-' && sectionName !== ''
    ) {
      candidates.push(['distance_mps', [sectionName, distanceBand(distanceKm), mpsKey]]);
    }
    candidates.push(['train_mps', [String(trainNo), mpsKey]]);
    candidates.push(['mps', [mpsKey]]);
  }

  let accel = null;
  let decel = null;
  let accelSource = 'none';
  let decelSource = 'none';

  for (const [poolName, key] of candidates) {
    const pool = correctionPools[poolName];
    if (!pool || !(pool instanceof Map)) continue;
    const stats = pool.get(keyToString(key));
    if (!stats) continue;

    if (poolName === 'distance_mps' || poolName === 'train_mps' || poolName === 'mps') {
      if (stats.block_n < MIN_BLOCKS_FOR_POOL) continue;
    }

    if (accel === null && isNum(stats.accel)) {
      accel = Number(stats.accel);
      accelSource = poolName;
    }
    if (decel === null && isNum(stats.decel)) {
      decel = Number(stats.decel);
      decelSource = poolName;
    }
    if (accel !== null && decel !== null) break;
  }

  return { accel, decel, accel_source: accelSource, decel_source: decelSource };
}
