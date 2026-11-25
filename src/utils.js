export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '-';
  const totalSeconds = Math.round(Number(minutes) * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatNumber(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return '-';
  return String(val);
}

export function formatPct(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return '-';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

const CLUSTER_COLORS = ['#6366f1', '#3b82f6', '#14b8a6', '#8b5cf6', '#0ea5e9'];
export function clusterColor(c) {
  return CLUSTER_COLORS[(c + 10000) % CLUSTER_COLORS.length];
}

export const COMBO_COLORS = {
  'T-T': '#3b82f6',
  'D-T': '#8b5cf6',
  'T-A': '#14b8a6',
  'D-A': '#f43f5e',
};

