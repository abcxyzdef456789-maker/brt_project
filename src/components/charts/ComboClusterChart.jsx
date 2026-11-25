import React, { useMemo } from 'react';
import { Scatter, ReferenceLine } from 'recharts';
import ScatterShell from './ScatterShell';

const PALETTE = { 'T-T': '#3b82f6', 'D-T': '#8b5cf6', 'T-A': '#14b8a6', 'D-A': '#f43f5e' };

export default function ComboClusterChart({ points, title }) {
  const data = useMemo(() => {
    if (!points || !points.length) return [];
    const grouped = {};
    points.forEach((p) => {
      const key = p.combo;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        ...p,
        idx: grouped[key].length,
        date: p.date ? String(p.date).slice(0, 10) : '',
      });
    });
    return grouped;
  }, [points]);

const combos = Object.keys(data);

  if (!combos.length) {
    return <div className="text-center text-gray-500 text-sm py-8">Not enough per-combination data</div>;
  }

  const totalPoints = combos.reduce((acc, c) => acc + data[c].length, 0);

  return (
    <div>
<h4 className="chart-title">{title || 'Clusters — Combos'}</h4>
      <ScatterShell
        legendAlign="top"
        countLabel={`${totalPoints} pts • ${combos.length} combos`}
      >
        {combos.map((combo) => {
          const mean = data[combo].reduce((acc, d) => acc + d.value, 0) / data[combo].length;
          return (
            <React.Fragment key={combo}>
<Scatter
                name={`${combo} (${mean.toFixed(2)}, n=${data[combo].length})`}
                data={data[combo]}
                fill={PALETTE[combo] || '#8884d8'}
                isAnimationActive={false}
                r={14}
              />
              <ReferenceLine y={mean} stroke={PALETTE[combo] || '#8884d8'} strokeDasharray="4 4" />
            </React.Fragment>
          );
        })}
      </ScatterShell>
    </div>
  );
}
