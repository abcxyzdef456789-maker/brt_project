import React from 'react';
import { Scatter, ReferenceLine } from 'recharts';
import ScatterShell, { withIdx } from './ScatterShell';
import { clusterColor } from '../../utils';

export default function ClusterChart({ points, lines, lowerCluster, title }) {
  if (!points || !points.length) {
    return <div className="text-center text-gray-500 text-sm py-8">Not enough data</div>;
  }
  const data = withIdx(points);
  const uniqueClusters = [...new Set(data.map((d) => d.cluster))].sort((a, b) => a - b);
  const linesData = lines || [];
  const nPoints = data.length;
  const nClusters = uniqueClusters.length;

  return (
    <div>
<h4 className="chart-title">{title || 'KMeans Clusters'}</h4>
      <ScatterShell
        legendAlign="bottom"
        countLabel={`${nClusters} clusters • ${nPoints} pts`}
      >
        {uniqueClusters.map((c) => {
          const n = data.filter((d) => d.cluster === c).length;
          const mean = linesData.find((l) => l.cluster === c)?.value;
          const label =
            `Cluster ${c}` +
            (mean !== undefined && mean !== null ? ` (${mean.toFixed(2)}, n=${n})` : ` (n=${n})`) +
            (c === lowerCluster ? ' — Lower' : '');
          return (
<Scatter
              key={c}
              name={label}
              data={data.filter((d) => d.cluster === c)}
              fill={clusterColor(c)}
              isAnimationActive={false}
              r={6}
            />
          );
        })}
        {linesData.map((l) => (
          <ReferenceLine
            key={l.cluster}
            y={l.value}
            stroke={clusterColor(l.cluster)}
            strokeDasharray="4 4"
            strokeWidth={l.cluster === lowerCluster ? 2 : 1}
          />
        ))}
      </ScatterShell>
    </div>
  );
}
