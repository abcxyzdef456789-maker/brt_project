import React, { useMemo, useState } from 'react';
import {
  TrainFront, GitBranch, Route, Database, Clock, Trash2, MapPin,
  Activity, Layers, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { getDataState, computeTrain } from '../lib/engine';
import { getRecent, clearRecent } from '../lib/recent';
import { formatPct } from '../utils';

function Stat({ icon, label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: accent }}>{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value" style={{ color: accent }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function RecentList({ kind, icon, label, accent, onNavigate }) {
  const items = getRecent(kind);
  const canNavigate = kind !== 'station';
  return (
    <div className="card">
      <div className="recent-list-heading">
        <h3 className="font-semibold flex items-center gap-2">
          <span style={{ color: accent }}>{icon}</span>
          {label}
        </h3>
        <span className="badge badge-indigo">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="recent-empty" style={{ color: 'var(--text-muted)' }}>
          No recent {label.toLowerCase()} yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => {
            const content = (
              <>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{it.key}</div>
                  {it.label && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{it.label}</div>}
                </div>
                <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </>
            );
            const itemStyle = { background: 'var(--bg-soft)', border: '1px solid var(--border)' };

            return canNavigate ? (
              <button
                key={it.key}
                onClick={() => onNavigate(kind, it.key)}
                className="recent-list-item w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors"
                style={itemStyle}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {content}
              </button>
            ) : (
              <div
                key={it.key}
                className="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2"
                style={itemStyle}
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Home({ trains, sections, onNavigate }) {
  const data = getDataState();
  const [, setRecentVersion] = useState(0);

  const overview = useMemo(() => {
    let computedRuns = 0;
    let brtSegments = 0;
    if (data && data.journeyIndex) {
      computedRuns = Object.values(data.journeyIndex).reduce((s, sub) => s + (sub.length || 0), 0);
      brtSegments = Object.keys(data.journeyIndex).length;
    }
    return {
      trains: trains.length,
      sections: sections.length,
      runs: computedRuns,
      segments: brtSegments,
    };
  }, [data, trains, sections]);

  const highlights = useMemo(() => trains.slice(0, 5).flatMap((train) => {
    try {
      const result = computeTrain(train);
      return result && !result.error
        ? [{ train, variancePct: result.variance_pct }]
        : [];
    } catch (error) {
      console.error(`Could not calculate Home variance for train ${train}.`, error);
      return [];
    }
  }), [trains]);

  return (
    <div className="dashboard-home">
      <section className="dashboard-intro">
        <Activity size={20} aria-hidden="true" />
        <div>
          <h2>Dashboard</h2>
          <p>Overall dataset report — quick overview of the BRT network.</p>
        </div>
      </section>

      <div className="stat-grid dashboard-overview">
        <Stat icon={<TrainFront size={17} />} label="Trains" value={overview.trains} sub="in master dataset" accent="#818cf8" />
        <Stat icon={<Route size={17} />} label="Sections" value={overview.sections} sub="corridor sections" accent="#38bdf8" />
        <Stat icon={<Layers size={17} />} label="Computed Runs" value={overview.runs.toLocaleString()} sub="journey data points" accent="#34d399" />
        <Stat icon={<GitBranch size={17} />} label="BRT Segments" value={overview.segments.toLocaleString()} sub="station→station blocks" accent="#fb7185" />
      </div>

      {highlights.length > 0 && (
        <section className="card variance-panel">
          <h3 className="dashboard-section-title">
            <TrendingUp size={16} aria-hidden="true" />
            Trainwise BRT Variance Highlights
          </h3>
          <div className="variance-grid">
            {highlights.map((highlight) => (
              <button
                key={highlight.train}
                onClick={() => onNavigate('train', highlight.train)}
                className="variance-item"
              >
                <span>Train {highlight.train}</span>
                {highlight.variancePct == null ? (
                  <span className="variance-value is-neutral"><Minus size={14} /> —</span>
                ) : highlight.variancePct >= 0 ? (
                  <span className="variance-value is-positive">
                    <TrendingUp size={14} /> {formatPct(highlight.variancePct)}
                  </span>
                ) : (
                  <span className="variance-value is-negative">
                    <TrendingDown size={14} /> {formatPct(highlight.variancePct)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="recent-section">
        <div className="recent-heading">
          <h3 className="dashboard-section-title">
            <Clock size={16} aria-hidden="true" />
            Recently Used
          </h3>
          <button
            className="btn btn-ghost recent-clear"
            onClick={() => {
              clearRecent();
              setRecentVersion((version) => version + 1);
            }}
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>
        <div className="recent-grid">
          <RecentList kind="train" icon={<TrainFront size={15} />} label="Trains" accent="#818cf8" onNavigate={onNavigate} />
          <RecentList kind="section" icon={<Route size={15} />} label="Sections" accent="#38bdf8" onNavigate={onNavigate} />
          <RecentList kind="station" icon={<MapPin size={15} />} label="Stations" accent="#34d399" onNavigate={onNavigate} />
        </div>
      </section>

      <section className="card dataset-report">
        <h3 className="dashboard-section-title">
          <Database size={16} aria-hidden="true" />
          Dataset Report
        </h3>
        <div className="dataset-report-grid">
          <Stat label="Trains" value={overview.trains} />
          <Stat label="Sections" value={overview.sections} />
          <Stat label="Journey rows" value={overview.runs.toLocaleString()} />
          <Stat label="BRT segments" value={overview.segments.toLocaleString()} />
        </div>
      </section>
    </div>
  );
}