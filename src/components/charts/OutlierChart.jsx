import React from 'react';
import { Scatter } from 'recharts';
import ScatterShell, { withIdx } from './ScatterShell';

export default function OutlierChart({ points, title }) {
  if (!points || !points.length) {
    return <div className="text-center text-gray-500 text-sm py-8">Not enough data</div>;
  }
  const data = withIdx(points);
  const inliers = data.filter((d) => !d.outlier);
  const outliers = data.filter((d) => d.outlier);
  return (
    <div>
<h4 className="chart-title">{title || 'Outliers Removal'}</h4>
<ScatterShell
        legendAlign="top"
        countLabel={`${inliers.length} inlier / ${outliers.length} outlier`}
        yLabel="Classification: Inlier vs. Outlier"
      >
<Scatter name={`Inlier (n=${inliers.length})`} data={inliers} fill="#22c55e" isAnimationActive={false} r={6} />
        {outliers.length > 0 && (
          <Scatter name={`Outlier (n=${outliers.length})`} data={outliers} fill="#ef4444" isAnimationActive={false} r={6} />
        )}
      </ScatterShell>
    </div>
  );
}
