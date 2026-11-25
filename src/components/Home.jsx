import React, { useMemo, useState } from 'react';
import {
  TrainFront, GitBranch, Route, Database, Clock, Trash2, MapPin,
  Activity, Layers, TrendingUp, TrendingDown, Minus, ArrowRight,
  UploadCloud, ShieldCheck,
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <span style={{ color: accent }}>{icon}</span>
          {label}
        </h3>
        <span className="badge badge-indigo">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
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
                className="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors"
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

export default function Home({ trains, sections, onNavigate, onTabChange }) {
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
    <div className="space-y-6">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-kicker">
            <Activity size={15} aria-hidden="true" />
            <span>Operations workspace</span>
          </div>
          <h2>Understand your network runtime.</h2>
          <p>
            Explore trainwise and sectionwise Bare Runtime estimates across your rail network.
          </p>
          <div className="dashboard-actions">
            <button className="btn btn-primary" onClick={() => onTabChange('train')}>
              <TrainFront size={17} aria-hidden="true" />
              Trainwise analysis
              <ArrowRight size={15} aria-hidden="true" />
            </button>
            <button className="btn dashboard-secondary-action" onClick={() => onTabChange('section')}>
              <Route size={17} aria-hidden="true" />
              Sectionwise analysis
            </button>
            <button className="dashboard-upload-link" onClick={() => onTabChange('upload')}>
              <UploadCloud size={16} aria-hidden="true" />
              Upload files
            </button>
          </div>
        </div>
        <div className="dashboard-local-note">
          <span className="dashboard-local-icon"><ShieldCheck size={21} aria-hidden="true" /></span>
          <div>
            <strong>Local-first analysis</strong>
            <p>Calculations run in this browser. Uploaded files stay in your session.</p>
          </div>
        </div>
      </section>

      {/* Overview stats */}
      <div className="stat-grid">
        <Stat icon={<TrainFront size={18} />} label="Trains" value={overview.trains} sub="in master dataset" accent="#818cf8" />
        <Stat icon={<Route size={18} />} label="Sections" value={overview.sections} sub="corridor sections" accent="#38bdf8" />
        <Stat icon={<Layers size={18} />} label="Computed Runs" value={overview.runs.toLocaleString()} sub="journey data points" accent="#34d399" />
        <Stat icon={<GitBranch size={18} />} label="BRT Segments" value={overview.segments.toLocaleString()} sub="station→station blocks" accent="#fb7185" />
      </div>

      {highlights.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="font-semibold">Trainwise BRT Variance Highlights</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {highlights.map((highlight) => (
              <button
                key={highlight.train}
                onClick={() => onNavigate('train', highlight.train)}
                className="rounded-xl p-3 text-left transition-all hover:scale-[1.02]"
                style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Train {highlight.train}</span>
                  {highlight.variancePct == null ? (
                    <Minus size={16} style={{ color: 'var(--text-muted)' }} />
                  ) : highlight.variancePct >= 0 ? (
                    <span className="flex items-center gap-1 text-sm font-bold" style={{ color: '#22c55e' }}>
                      <TrendingUp size={14} /> {formatPct(highlight.variancePct)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm font-bold" style={{ color: '#ef4444' }}>
                      <TrendingDown size={14} /> {formatPct(highlight.variancePct)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock size={18} style={{ color: 'var(--accent)' }} />
          Recently Used
        </h3>
        <button
          className="btn btn-ghost text-xs"
          onClick={() => {
            clearRecent();
            setRecentVersion((version) => version + 1);
          }}
        >
          <Trash2 size={14} /> Clear
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RecentList kind="train" icon={<TrainFront size={16} />} label="Trains" accent="#818cf8" onNavigate={onNavigate} />
        <RecentList kind="section" icon={<Route size={16} />} label="Sections" accent="#38bdf8" onNavigate={onNavigate} />
        <RecentList kind="station" icon={<MapPin size={16} />} label="Stations" accent="#34d399" onNavigate={onNavigate} />
      </div>

      <div className="workspace-data-note">
        <div className="workspace-data-icon">
          <Database size={19} aria-hidden="true" />
        </div>
        <div>
          <h3>Dataset loaded and ready</h3>
          <p>
            The dashboard is using <strong>{overview.runs.toLocaleString()}</strong> journey records
            across <strong>{overview.segments.toLocaleString()}</strong> BRT segments.
          </p>
        </div>
      </div>
    </div>
    
  );
}