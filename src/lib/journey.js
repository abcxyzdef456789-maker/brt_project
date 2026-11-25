// Journey index building + leg subsetting (port of Python journey logic).

/**
 * Build a journey index map: key `${station}->${nextStation}` -> array of legs:
 *   { train, date, travel_time, flag_a, flag_b }
 */
export function buildJourneyIndex(journeyRows) {
  const index = {};
  for (const r of journeyRows) {
    const key = `${r.from}-${r.to}`;
    if (!index[key]) index[key] = [];
    index[key].push({
      train: r.train,
      date: r.date,
      travel_time: r.travel_time,
      flag_a: r.flag_a,
      flag_b: r.flag_b,
    });
  }
  return index;
}

/**
 * Get leg subset for a station pair, optionally filtered by trains.
 * Returns array of { train, date, travel_time, flag_a, flag_b }.
 */
export function getLegSubset(journeyIndex, stationA, stationB, trains = null) {
  const key = `${stationA}-${stationB}`;
  const subset = journeyIndex[key];
  if (!subset || subset.length === 0) return [];

  if (trains && trains.length) {
    const trainSet = new Set(trains.map((t) => String(t)));
    return subset.filter((leg) => trainSet.has(String(leg.train)));
  }
  return subset;
}
