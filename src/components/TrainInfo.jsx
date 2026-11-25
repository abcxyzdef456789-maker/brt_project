import React, { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Minus, Loader } from 'lucide-react';
import { computeTrain, computeTrainLegChart } from '../lib/engine';
import { formatMinutes } from '../utils';
import { recordRecent } from '../lib/recent';
import { RawDateChart, OutlierChart, ClusterChart } from './Charts';
import TotalsBar from './TotalsBar';

const HEADERS = [
  'Route', 'Flag', 'Existing Runtime', 'Samples', 'Raw BRT',
  'Accel', 'Decel', 'Accel Mean', 'Decel Mean', 'Net BRT (Mean)', 'Rounded Est. Runtime',
];

function TrainInfo({ trains = [], initialTrain = '' }) {
  const [trainNo, setTrainNo] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [chartCache, setChartCache] = useState({});
  const [chartLoading, setChartLoading] = useState({});

  const analyzeTrain = useCallback((selectedTrain) => {
    const train = String(selectedTrain || '').trim();
    if (!train) {
      setError('Select the train no first.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setExpanded({});
    setChartCache({});
    try {
      const res = computeTrain(train);
      if (res.error) {
        setError(res.error);
      } else {
        setData(res);
        recordRecent('train', { key: res.train_no, label: `Train ${res.train_no}` });
      }
    } catch (e) {
      setError(e.message || 'Train not found');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialTrain) return;
    setTrainNo(String(initialTrain));
    analyzeTrain(initialTrain);
  }, [initialTrain, analyzeTrain]);

  const analyze = () => analyzeTrain(trainNo);

  const toggleChart = (index, leg) => {
    const key = `${leg.station}->${leg.next_station}`;
    const next = { ...expanded, [index]: !expanded[index] };
    setExpanded(next);

    if (next[index] && !chartCache[key]) {
      setChartLoading((s) => ({ ...s, [index]: true }));
      try {
        const chart = computeTrainLegChart(data.train_no, leg.station, leg.next_station);
        setChartCache((s) => ({ ...s, [key]: chart }));
      } catch (e) {
        console.error(e);
      }
      setChartLoading((s) => ({ ...s, [index]: false }));
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap items-end">
        <div className="flex flex-col">
          <label className="text-xs text-gray-400 mb-1">Select Train Number</label>
          <select
            value={trainNo}
            onChange={(e) => setTrainNo(e.target.value)}
            className="p-3 rounded-lg bg-gray-800 border border-gray-700 text-white w-48"
          >
            <option value="">Type or select a train number...</option>
            {trains.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
<button
          onClick={analyze}
          className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg flex items-center gap-2"
        >
          {loading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
          Analyze
        </button>
      </div>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-lg mb-4">{error}</div>}
      {loading && <p className="text-gray-400">Loading...</p>}

      {data && (
        <>
<h3 className="text-xl font-bold mb-4">Route Details for Train {data.train_no}</h3>

          <TotalsBar totals={data.totals} variancePct={data.variance_pct} />

<div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  {HEADERS.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.leg_rows.map((leg, i) => {
                  const key = `${leg.station}->${leg.next_station}`;
                  return (
                    <React.Fragment key={i}>
                      <tr>
                        <td>
                          <button
                            onClick={() => toggleChart(i, leg)}
                            style={{ color: 'var(--accent)' }}
                            title="Toggle charts"
                          >
                            {expanded[i] ? <Minus size={16} /> : <Plus size={16} />}
                          </button>
                        </td>
                        <td>
                          <span className="badge badge-indigo">
                            {leg.station} <span aria-hidden>→</span> {leg.next_station}
                          </span>
                        </td>
                        <td>{leg.flag}</td>
                        <td>{leg.existing_mmss}</td>
                        <td>{leg.samples}</td>
                        <td>{leg.raw_mmss}</td>
                        <td>{formatMinutes(leg.accel)}</td>
                        <td>{formatMinutes(leg.decel)}</td>
                        <td>{formatMinutes(leg.accel_mean)}</td>
                        <td>{formatMinutes(leg.decel_mean)}</td>
                        <td>{leg.net_mmss}</td>
                        <td>
                          {leg.rounded_mmss}
                          {leg.low_confidence ? ' *' : ''}
                        </td>
                      </tr>
                      {expanded[i] && (
                        <tr>
                          <td colSpan={12}>
                            {chartLoading[i] ? (
                              <p className="p-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                <Loader className="animate-spin" size={16} /> Loading charts...
                              </p>
                            ) : chartCache[key] ? (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3">
                                <div className="card">
                                  <RawDateChart
                                    points={chartCache[key].raw_points}
                                    title={`Raw Travel Time @ ${leg.station}`}
                                  />
                                </div>
                                <div className="card">
                                  <OutlierChart
                                    points={chartCache[key].outlier_points}
                                    title="Outliers Removal"
                                  />
                                </div>
                                <div className="card">
                                  <ClusterChart
                                    points={chartCache[key].cluster_points}
                                    lines={chartCache[key].cluster_lines}
                                    lowerCluster={chartCache[key].lower_cluster}
                                    title="KMeans Clusters"
                                  />
                                </div>
                              </div>
                            ) : (
                              <p className="p-3" style={{ color: 'var(--text-muted)' }}>No journey data available</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default TrainInfo;
