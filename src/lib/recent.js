// Simple localStorage-backed "recently used" tracker for the Home dashboard.
// Tracks recently viewed trains, sections (lines), and stations.

const KEY = 'brt-recent';
const MAX = 8;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function push(list, item) {
  const arr = list.filter((x) => x && x.key !== item.key);
  arr.unshift({ ...item, at: Date.now() });
  return arr.slice(0, MAX);
}

/**
 * Record a view. kind: 'train' | 'section' | 'station'.
 * item: { key, label, meta? }
 */
export function recordRecent(kind, item) {
  const data = read();
  data[kind] = push(data[kind] || [], item);
  write(data);
}

export function getRecent(kind) {
  return read()[kind] || [];
}

export function getRecentAll() {
  return read();
}

export function clearRecent() {
  write({});
}
