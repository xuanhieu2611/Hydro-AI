/** Local-calendar date helpers. Keys are 'YYYY-MM-DD' in device-local time. */

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Date key `daysAgo` days before today (0 = today). */
export function dateKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toDateKey(d);
}

/** Whether an ISO timestamp falls on the given local date key. */
export function isOnDate(isoTimestamp: string, dateKey: string): boolean {
  return toDateKey(new Date(isoTimestamp)) === dateKey;
}

/** Local clock time for a log row, e.g. "8:30 AM". */
export function formatTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
