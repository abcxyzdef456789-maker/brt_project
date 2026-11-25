import React from 'react';
import { formatMinutes, formatPct } from '../utils';
import { TrendingUp, TrendingDown, Minus as MinusIcon } from 'lucide-react';

const SPEED_CLASS_COLORS = {
  '100': { bg: '#0c1f3f', border: '#1d4ed8', badge: '#3b82f6', text: '#93c5fd' },
  '110': { bg: '#0d1f35', border: '#0ea5e9', badge: '#0ea5e9', text: '#7dd3fc' },
  '120': { bg: '#0a1e35', border: '#06b6d4', badge: '#06b6d4', text: '#67e8f9' },
  '130': { bg: '#0f1e2e', border: '#6366f1', badge: '#6366f1', text: '#a5b4fc' },
  '160': { bg: '#0d1f2e', border: '#8b5cf6', badge: '#8b5cf6', text: '#c4b5fd' },
};

function getColorForMps(mps) {
  return SPEED_CLASS_COLORS[String(mps)] || {
    bg: '#111827',
    border: '#334155',
    badge: '#475569',
    text: '#94a3b8',
  };
}

/**
 */
export default function SectionTotalsCard({ speedClasses, totals, variancePct }) {
  if (!speedClasses || !speedClasses.length) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0b1629 0%, #0f1f3d 100%)',
        border: '1px solid #1e3a5f',
        borderRadius: 16,
        padding: '16px 20px',
        marginBottom: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            BRT SECTION SUMMARY
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginTop: 2 }}>
            Totals &amp; Variance by Speed Class (MPS)
          </div>
        </div>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: 99,
            background: '#162035',
            border: '1px solid #2d4a6f',
            fontSize: 11,
            fontWeight: 700,
            color: '#7dd3fc',
          }}
        >
          {speedClasses.length} Speed {speedClasses.length === 1 ? 'Class' : 'Classes'}
        </span>
      </div>

      {/* Speed Class Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {speedClasses.map((mps) => {
          const t = totals ? totals[mps] : null;
          const pct = variancePct ? variancePct[mps] : null;
          const hasVariance = pct !== null && pct !== undefined && !Number.isNaN(pct);
          const isPos = hasVariance && pct >= 0;
          const colors = getColorForMps(mps);

          return (
            <div
              key={mps}
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: '12px 16px',
                minWidth: 150,
                flex: '1 1 140px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Decorative accent top */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: `linear-gradient(90deg, ${colors.border}, transparent)`,
                  borderRadius: '12px 12px 0 0',
                }}
              />

              {/* Speed Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 10px',
                  borderRadius: 99,
                  background: `${colors.badge}25`,
                  border: `1px solid ${colors.badge}60`,
                  marginBottom: 10,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.badge, display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: colors.text, letterSpacing: 0.5 }}>
                  {mps} MPS
                </span>
              </div>

              {/* Metrics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <MetricRow label="Existing" value={formatMinutes(t?.existing)} color="#94a3b8" />
                <MetricRow label="Net BRT" value={formatMinutes(t?.net_brt)} color={colors.text} bold />
                <MetricRow label="Rounded" value={formatMinutes(t?.round_ad)} color="#e2e8f0" bold />
              </div>

              {/* Variance Badge */}
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px solid #1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {hasVariance ? (
                  isPos ? (
                    <TrendingUp size={12} style={{ color: '#f87171', flexShrink: 0 }} />
                  ) : (
                    <TrendingDown size={12} style={{ color: '#4ade80', flexShrink: 0 }} />
                  )
                ) : (
                  <MinusIcon size={12} style={{ color: '#475569', flexShrink: 0 }} />
                )}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: hasVariance ? (isPos ? '#f87171' : '#4ade80') : '#475569',
                  }}
                >
                  Variance: {hasVariance ? formatPct(pct) : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: 11.5,
          color: color || '#f1f5f9',
          fontWeight: bold ? 700 : 500,
          fontFamily: 'monospace',
        }}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}
