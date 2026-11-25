import React from 'react';
import { formatPct } from '../utils';

// Shared Totals + Variance summary bar, rendered as stat cards above the table.
export default function TotalsBar({ totals, variancePct }) {
  const cards = [];

  if (totals) {
    if (totals.existing_mmss !== undefined) cards.push({ label: 'Total Existing', value: totals.existing_mmss });
    if (totals.net_mmss !== undefined) cards.push({ label: 'Total Net BRT', value: totals.net_mmss });
    if (totals.rounded_mmss !== undefined) cards.push({ label: 'Total Rounded', value: totals.rounded_mmss });
  }

  const hasVariance = variancePct !== null && variancePct !== undefined && !Number.isNaN(variancePct);

  return (
    <div className="stat-grid">
      {cards.map((c) => (
        <div key={c.label} className="stat-card">
          <div className="stat-label">{c.label}</div>
          <div className="stat-value">{c.value || '-'}</div>
        </div>
      ))}
      <div className={`stat-card ${hasVariance ? 'highlight' : ''}`}>
        <div className="stat-label">Variance</div>
        <div
          className="stat-value"
          style={{ color: hasVariance ? (variancePct >= 0 ? '#22c55e' : '#ef4444') : undefined }}
        >
          {hasVariance ? formatPct(variancePct) : '-'}
        </div>
        <div className="stat-sub">
          {hasVariance ? 'Net BRT vs Existing' : 'Insufficient paired data'}
        </div>
      </div>
    </div>
  );
}
