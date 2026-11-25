import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  Loader,
  ChevronRight,
  Activity,
  BarChart3,
  Train,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { computeSection, computeSectionBlockChart } from '../lib/engine';
import { formatMinutes, formatPct } from '../utils';
import { recordRecent } from '../lib/recent';
import { RawDateChart, OutlierChart, ComboClusterChart, DomClusterChart } from './Charts';
import SectionTotalsCard from './SectionTotalsCard';

const METRIC_LABELS = ['Exist.', 'Raw', 'Accel', 'Decel', 'AccelM', 'DecelM', 'Net', 'Round'];
const METRIC_FIELDS = ['existing', 'raw', 'accel', 'decel', 'accel_mean', 'decel_mean', 'net_brt', 'round_ad'];

const METRIC_COLORS = {
  existing: '#64748b',
  raw: '#94a3b8',
  accel: '#fb923c',
  decel: '#f87171',
  accel_mean: '#fdba74',
  decel_mean: '#fca5a5',
  net_brt: '#34d399',
  round_ad: '#38bdf8',
};

function SectionInfo({ sections = [], initialSection = '' }) {
  const [sectionName, setSectionName] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [chartCache, setChartCache] = useState({});
  const [chartLoading, setChartLoading] = useState({});
  const [speedFilter, setSpeedFilter] = useState('all');
  const [notes, setNotes] = useState({});

  const analyzeSection = useCallback((selectedSection) => {
    const section = String(selectedSection || '').trim();
    if (!section) {
      setError('Please select a section first.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setExpanded({});
    setChartCache({});
    try {
      const res = computeSection(section);
      if (res.error) {
        setError(res.error);
      } else {
        setData(res);
        recordRecent('section', { key: res.section_name, label: res.section_name });
        setSpeedFilter('all');
      }
    } catch (e) {
      setError(e.message || 'Section not found');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialSection) return;
    setSectionName(String(initialSection));
    analyzeSection(initialSection);
  }, [initialSection, analyzeSection]);

  const analyze = () => analyzeSection(sectionName);

  const toggleChart = (index, leg) => {
    const key = `${leg.station}->${leg.next_station}`;
    const next = { ...expanded, [index]: !expanded[index] };
    setExpanded(next);

    if (next[index] && !chartCache[key]) {
      setChartLoading((s) => ({ ...s, [index]: true }));
      try {
        const chart = computeSectionBlockChart(data.section_name, leg.station, leg.next_station);
        setChartCache((s) => ({ ...s, [key]: chart }));
      } catch (e) {
        console.error(e);
      }
      setChartLoading((s) => ({ ...s, [index]: false }));
    }
  };

  const renderMetricCells = (metrics, mps) => {
    if (!metrics) {
      return METRIC_FIELDS.map((_, k) => (
        <td key={k} style={cellStyle}>
          <span style={{ color: '#334155', fontFamily: 'monospace', fontSize: 11 }}>—</span>
        </td>
      ));
    }
    return METRIC_FIELDS.map((field, k) => (
      <td key={k} style={cellStyle}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 11.5,
            fontWeight: field === 'net_brt' || field === 'round_ad' ? 700 : 400,
            color: METRIC_COLORS[field] || '#94a3b8',
          }}
        >
          {formatMinutes(metrics[field])}
        </span>
      </td>
    ));
  };

  const visibleSpeedClasses = data
    ? speedFilter === 'all'
      ? data.speed_classes
      : data.speed_classes.filter((m) => m === speedFilter)
    : [];

  const setNote = (key, value) => {
    setNotes((s) => ({ ...s, [key]: value }));
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ═══ Control Bar ═══ */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #080f1e 0%, #0b1629 100%)',
          border: '1px solid #1e3a5f',
          borderRadius: 16,
          marginBottom: 20,
        }}
      >
        {/* Section Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 1 }}>
            Section
          </label>
          <select
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select a section...</option>
            {sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Speed Class Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
            Speed Class (MPS)
          </label>
          <select
            value={speedFilter}
            onChange={(e) => setSpeedFilter(e.target.value)}
            style={{ ...selectStyle, minWidth: 130 }}
          >
            <option value="all">All Classes</option>
            {data && data.speed_classes.map((m) => (
              <option key={m} value={m}>{m} MPS</option>
            ))}
          </select>
        </div>

        {/* Analyze Button */}
        <button
          onClick={analyze}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 22px',
            background: loading ? '#1e3a5f' : 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 0 18px #1d4ed840',
            transition: 'all 0.2s ease',
            letterSpacing: 0.3,
          }}
        >
          {loading ? (
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Search size={16} />
          )}
          {loading ? 'Analyzing...' : 'Analyze Section'}
        </button>
      </div>

      {/* ═══ Error Banner ═══ */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: '#200a0a',
            border: '1px solid #7f1d1d',
            borderRadius: 12,
            marginBottom: 16,
            color: '#fca5a5',
            fontSize: 13,
          }}
        >
          <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* ═══ Loading State ═══ */}
      {loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 20px',
            background: '#0b1629',
            border: '1px solid #1e3a5f',
            borderRadius: 12,
            marginBottom: 16,
            color: '#7dd3fc',
            fontSize: 13,
          }}
        >
          <Loader size={16} style={{ animation: 'spin 1s linear infinite', color: '#38bdf8' }} />
          Computing BRT section metrics...
        </div>
      )}

      {/* ═══ Results ═══ */}
      {data && (
        <>
          {/* Section Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #0c1a2e 0%, #0f1f3d 100%)',
              border: '1px solid #1e3a5f',
              borderRadius: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: '#0ea5e920',
                  border: '1px solid #0ea5e950',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Activity size={18} style={{ color: '#38bdf8' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Section Analysis
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginTop: 1 }}>
                  {data.section_name}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={14} style={{ color: '#34d399' }} />
              <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                {data.legs?.length ?? 0} Block Sets · {data.speed_classes?.length ?? 0} Speed Classes
              </span>
            </div>
          </div>

          {/* Trains Info */}
          {data.trains && data.trains.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                background: '#0a1426',
                border: '1px solid #1e3a5f',
                borderRadius: 10,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <Train size={13} style={{ color: '#7dd3fc', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Trains on section:</span>
              {data.trains.map((t) => (
                <span
                  key={t.train}
                  style={{
                    padding: '2px 10px',
                    borderRadius: 99,
                    background: '#0f2040',
                    border: '1px solid #2d4a6f',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#93c5fd',
                    fontFamily: 'monospace',
                  }}
                >
                  {t.train}{t.mps ? ` · ${t.mps} MPS` : ''}
                </span>
              ))}
            </div>
          )}

          {/* Totals Card */}
          <SectionTotalsCard
            speedClasses={data.speed_classes}
            totals={data.totals}
            variancePct={data.variance_pct}
          />

          {/* ═══ Block Set Table ═══ */}
          <div
            style={{
              background: '#080f1e',
              border: '1px solid #1e3a5f',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {/* Table header bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 18px',
                borderBottom: '1px solid #1e3a5f',
                background: '#0b1629',
              }}
            >
              <BarChart3 size={14} style={{ color: '#38bdf8' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 1 }}>
                Block Set Analysis
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '2px 10px',
                  borderRadius: 99,
                  background: '#0f2040',
                  border: '1px solid #2d4a6f',
                  fontSize: 10,
                  color: '#7dd3fc',
                  fontWeight: 600,
                }}
              >
                {visibleSpeedClasses.length > 0 ? `${visibleSpeedClasses.join(', ')} MPS` : 'No classes'}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0a1426' }}>
                    <th style={thStyle}></th>
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: 160 }}>Block Set</th>
                    {visibleSpeedClasses.map((mps) => (
                      <React.Fragment key={mps}>
                        {METRIC_LABELS.map((label, li) => (
                          <th
                            key={label + mps}
                            style={{
                              ...thStyle,
                              color: METRIC_COLORS[METRIC_FIELDS[li]] || '#94a3b8',
                            }}
                          >
                            {label}
                          </th>
                        ))}
                      </React.Fragment>
                    ))}
                    <th style={{ ...thStyle, textAlign: 'left' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.legs.map((leg, i) => {
                    const isExp = expanded[i];
                    const bgColor = i % 2 === 0 ? '#080f1e' : '#090f1c';
                    return (
                      <React.Fragment key={i}>
                        <tr
                          style={{
                            background: isExp ? '#0c1f3f' : bgColor,
                            borderBottom: '1px solid #111f38',
                            transition: 'background 0.15s',
                          }}
                        >
                          {/* Expand toggle */}
                          <td style={{ ...cellStyle, width: 40, textAlign: 'center' }}>
                            <button
                              onClick={() => toggleChart(i, leg)}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 7,
                                border: '1px solid',
                                borderColor: isExp ? '#0ea5e9' : '#1e3a5f',
                                background: isExp ? '#0ea5e920' : 'transparent',
                                color: isExp ? '#38bdf8' : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                              title="Toggle charts"
                            >
                              {isExp ? <Minus size={13} /> : <Plus size={13} />}
                            </button>
                          </td>

                          {/* Block Set badge */}
                          <td style={{ ...cellStyle, textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ChevronRight
                                size={11}
                                style={{
                                  color: isExp ? '#38bdf8' : '#334155',
                                  transition: 'transform 0.15s',
                                  transform: isExp ? 'rotate(90deg)' : 'none',
                                }}
                              />
                              <span
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: 6,
                                  background: isExp ? '#0c2a4a' : '#0f1f38',
                                  border: `1px solid ${isExp ? '#2563eb' : '#1e3a5f'}`,
                                  color: isExp ? '#93c5fd' : '#7dd3fc',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {leg.station} → {leg.next_station}
                              </span>
                            </div>
                          </td>

                          {/* Metric Cells */}
                          {visibleSpeedClasses.map((mps) => (
                            <React.Fragment key={mps}>
                              {renderMetricCells(leg.speed_classes[mps], mps)}
                            </React.Fragment>
                          ))}

                          {visibleSpeedClasses.length === 0 && (
                            <td style={{ ...cellStyle, color: '#334155', fontSize: 11 }}>
                              No speed-class data
                            </td>
                          )}

                          {/* Notes cell */}
                          <td style={{ ...cellStyle, textAlign: 'left' }}>
                            <input
                              value={notes[`${leg.station}->${leg.next_station}`] || ''}
                              onChange={(e) =>
                                setNote(`${leg.station}->${leg.next_station}`, e.target.value)
                              }
                              placeholder="Note..."
                              style={{
                                background: '#0a1426',
                                border: '1px solid #1e3a5f',
                                borderRadius: 6,
                                padding: '4px 8px',
                                color: '#94a3b8',
                                fontSize: 11,
                                width: 110,
                                outline: 'none',
                              }}
                            />
                          </td>
                        </tr>

                        {/* Expanded Chart Row */}
                        {isExp && (
                          <tr>
                            <td
                              colSpan={3 + visibleSpeedClasses.length * 8}
                              style={{ background: '#060d1a', padding: 0 }}
                            >
                              <div
                                style={{
                                  borderTop: '1px solid #0ea5e930',
                                  borderBottom: '1px solid #1e3a5f',
                                  padding: 16,
                                }}
                              >
                                {chartLoading[i] ? (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: 12,
                                      color: '#64748b',
                                      fontSize: 12,
                                    }}
                                  >
                                    <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: '#38bdf8' }} />
                                    Loading block charts...
                                  </div>
                                ) : chartCache[`${leg.station}->${leg.next_station}`] ? (
                                  (() => {
                                    const chart = chartCache[`${leg.station}->${leg.next_station}`];
                                    if (chart.error) {
                                      return (
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            color: '#f87171',
                                            fontSize: 12,
                                            padding: 12,
                                          }}
                                        >
                                          <AlertCircle size={14} />
                                          {chart.message}
                                        </div>
                                      );
                                    }
                                    return (
                                      <div>
                                        {chart.trains && chart.trains.length > 0 && (
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 6,
                                              marginBottom: 12,
                                              flexWrap: 'wrap',
                                            }}
                                          >
                                            <Train size={11} style={{ color: '#7dd3fc' }} />
                                            <span style={{ fontSize: 10, color: '#64748b' }}>Trains on block:</span>
                                            {chart.trains.map((tr) => (
                                              <span
                                                key={tr}
                                                style={{
                                                  padding: '1px 8px',
                                                  borderRadius: 99,
                                                  background: '#0f2040',
                                                  border: '1px solid #2d4a6f',
                                                  fontSize: 10,
                                                  fontWeight: 700,
                                                  color: '#93c5fd',
                                                  fontFamily: 'monospace',
                                                }}
                                              >
                                                {tr}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        <div
                                          style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                            gap: 12,
                                          }}
                                        >
                                          {[
                                            {
                                              component: (
                                                <RawDateChart
                                                  points={chart.pooled_points}
                                                  title={`Raw — ${leg.station} → ${leg.next_station}`}
                                                />
                                              ),
                                              label: 'Raw Data',
                                            },
                                            {
                                              component: (
                                                <OutlierChart
                                                  points={chart.outlier_points || []}
                                                  title="Outliers Removal"
                                                />
                                              ),
                                              label: 'Outlier Filter',
                                            },
                                            {
                                              component: (
                                                <ComboClusterChart
                                                  points={chart.combo_points}
                                                  title={`${leg.station} → ${leg.next_station} — Combos`}
                                                />
                                              ),
                                              label: 'Combo Clusters',
                                            },
                                            {
                                              component: (
                                                <DomClusterChart
                                                  points={chart.dom_points}
                                                  lines={chart.dom_lines}
                                                  lowerSub={chart.lower_subcluster}
                                                  title={`KMeans Clusters — ${leg.station} → ${leg.next_station}`}
                                                />
                                              ),
                                              label: 'KMeans Clusters',
                                            },
                                          ].map(({ component, label }, idx) => (
                                            <div
                                              key={idx}
                                              style={{
                                                background: '#080f1e',
                                                border: '1px solid #1e3a5f',
                                                borderRadius: 12,
                                                padding: 12,
                                                overflow: 'hidden',
                                              }}
                                            >
                                              <div
                                                style={{
                                                  fontSize: 10,
                                                  fontWeight: 700,
                                                  color: '#38bdf8',
                                                  textTransform: 'uppercase',
                                                  letterSpacing: 0.8,
                                                  marginBottom: 8,
                                                }}
                                              >
                                                {label}
                                              </div>
                                              {component}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div style={{ color: '#334155', fontSize: 12, padding: 12 }}>
                                    No journey data available for this block.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Style constants ──────────────────────────────────────────
const selectStyle = {
  padding: '9px 14px',
  borderRadius: 10,
  background: '#0b1629',
  border: '1px solid #1e3a5f',
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
  minWidth: 200,
  cursor: 'pointer',
};

const thStyle = {
  padding: '10px 10px',
  textAlign: 'center',
  fontSize: 10.5,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: '1px solid #1e3a5f',
  whiteSpace: 'nowrap',
};

const cellStyle = {
  padding: '9px 10px',
  textAlign: 'center',
  borderBottom: '1px solid #0d1a2e',
};

export default SectionInfo;
