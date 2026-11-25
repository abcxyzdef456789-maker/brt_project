import React, { useState } from 'react';
import {
  ScatterChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { formatMinutes } from '../../utils';

const TICK = { fontSize: 12, fill: '#bbb' };
const AXIS_LABEL = { fontSize: 12, fill: '#9ca3af', fontWeight: 700 };

export function ScatterTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs">
      <div>Date: {p.date || 'N/A'}</div>
      <div>BRT: {formatMinutes(p.value)}</div>
      {p.cluster !== undefined && <div>Cluster: {p.cluster}</div>}
      {p.subcluster !== undefined && <div>SubCluster: {p.subcluster}</div>}
      {p.outlier !== undefined && (
        <div className={p.outlier ? 'text-red-400' : 'text-green-400'}>
          {p.outlier ? 'Outlier' : 'Inlier'}
        </div>
      )}
    </div>
  );
}

export function withIdx(points) {
  return points.map((p, i) => ({
    ...p,
    idx: i,
    date: p.date ? String(p.date).slice(0, 10) : '',
  }));
}

function LegendRow({ payloadRef, legendAlign = 'bottom' }) {
  const items = payloadRef || [];
  if (!items.length) return null;
  return (
    <div
      className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]"
      style={{
        justifyContent: 'center',
        marginTop: legendAlign === 'top' ? 0 : 8,
        marginBottom: legendAlign === 'top' ? 8 : 0,
        padding: '2px 4px',
        fontWeight: 600,
        color: 'var(--text)',
      }}
    >
      {items.map((entry, i) => (
        <span key={`legend-${i}`} className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full"
            style={{ width: 10, height: 10, backgroundColor: entry.color || entry.fill }}
          />
          <span style={{ color: 'var(--text)' }}>{entry.value}</span>
        </span>
      ))}
    </div>
  );
}

// Zoomable scatter chart wrapper with standardized scales
export default function ScatterShell({
  children,
  height = 280,
  legendAlign = 'bottom',
  countLabel,
  yLabel = 'Travel Time (min)',
  yAnchor = null,
  bottomMargin,
  xLabel = null,
  yDomainFixed = null,
  showXAxisLabel = true,
}) {
  const style = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const cssSide = style ? style.getPropertyValue('--chart-y-position').trim() : '';
  const side = yAnchor || cssSide || 'left';
  const yPos = side === 'right' ? 'insideRight' : 'insideLeft';
  const yOffset = side === 'right' ? -6 : 6;

  const resolvedBottomMargin = bottomMargin ?? (legendAlign === 'top' ? 16 : 40);
  const resolvedTopMargin = legendAlign === 'top' ? 56 : 12;

  // Zoom state: zoom factor 1..10 (1 = full view)
  const [zoom, setZoom] = useState(1);
  const zoomStep = 0.5;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 10;

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + zoomStep));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - zoomStep));
  const resetZoom = () => setZoom(MIN_ZOOM);

  // Compute visible fraction of the data window around the centre.
  const frac = 1 / zoom;
  const xDomain = frac >= 0.99 ? ['dataMin', 'dataMax'] : [0.5 - frac / 2, 0.5 + frac / 2];
  // Use fixed Y domain if provided for standardized scales, otherwise auto
  const yDomain = yDomainFixed || ['auto', 'auto'];

  return (
    <div>
      <div className="zoom-controls">
        <button onClick={zoomOut} title="Zoom out" aria-label="Zoom out">−</button>
        <span className="zoom-label">{zoom.toFixed(1)}×</span>
        <button onClick={zoomIn} title="Zoom in" aria-label="Zoom in">+</button>
        <button onClick={resetZoom} title="Reset zoom" aria-label="Reset zoom" style={{ fontSize: '0.7rem' }}>
          ⟲
        </button>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: resolvedTopMargin, right: 24, bottom: resolvedBottomMargin, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="idx"
            type="number"
            domain={xDomain}
            tick={false}
            tickLine={false}
            label={
              showXAxisLabel && xLabel
                ? {
                    value: xLabel,
                    position: 'insideBottom',
                    offset: -18,
                    ...AXIS_LABEL,
                  }
                : undefined
            }
          />
          <YAxis
            dataKey="value"
            type="number"
            tick={TICK}
            domain={yDomain}
            width={66}
            label={{
              value: yLabel,
              angle: -90,
              position: yPos,
              offset: yOffset,
              ...AXIS_LABEL,
              style: { textAnchor: 'middle' },
            }}
          />
          <Tooltip content={<ScatterTooltip />} />
          <Legend
            content={({ payload }) => (
              <LegendRow payloadRef={payload} legendAlign={legendAlign} />
            )}
            wrapperStyle={{ fontSize: 12 }}
          />
          {countLabel && (
            <text
              x="98%"
              y={legendAlign === 'top' ? 20 : 14}
              textAnchor="end"
              fill="#9ca3af"
              fontSize={12}
              fontWeight={800}
            >
              {countLabel}
            </text>
          )}
          {children}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartCard({ children, title }) {
  return (
    <div className="rounded p-3 bg-gray-800">
      {children}
    </div>
  );
}