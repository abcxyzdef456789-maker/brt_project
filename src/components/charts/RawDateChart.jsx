import React from 'react';
import { Scatter } from 'recharts';
import ScatterShell, { withIdx } from './ScatterShell';

export default function RawDateChart({ points, title }) {
  if (!points || !points.length) {
    return <div className="text-center text-gray-500 text-sm py-8">No data available</div>;
  }
const data = withIdx(points);
  return (
    <div>
<h4 className="chart-title">{title || 'Raw Travel Time'}</h4>
      <ScatterShell countLabel={`${data.length} runs`}>
<Scatter name={`Raw (n=${data.length})`} data={data} fill="#3b82f6" isAnimationActive={false} r={6} />
      </ScatterShell>
    </div>
  );
}
