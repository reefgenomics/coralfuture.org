/** Human-readable counters for UI (English locale grouping). */
export function formatViewCount(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-US').format(Math.max(0, Number(value)));
}
