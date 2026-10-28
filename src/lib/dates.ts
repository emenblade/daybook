export function toISO(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function parseISO(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function todayISO(): string {
	return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
	const d = parseISO(iso);
	d.setDate(d.getDate() + n);
	return toISO(d);
}

export function addMonths(ym: string, n: number): string {
	const [y, m] = ym.split('-').map(Number);
	const d = new Date(y, m - 1 + n, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtTime(min: number | null): string {
	if (min === null || min === undefined) return '';
	const h24 = Math.floor(min / 60) % 24;
	const m = min % 60;
	const ampm = h24 >= 12 ? 'PM' : 'AM';
	const h = h24 % 12 === 0 ? 12 : h24 % 12;
	return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function parseTimeToMin(value: string): number | null {
	const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (h > 23 || min > 59) return null;
	return h * 60 + min;
}

export function toTimeInput(min: number | null): string {
	if (min === null || min === undefined) return '';
	const h = Math.floor(min / 60) % 24;
	const m = min % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtDuration(min: number): string {
	if (min < 60) return `${min}m`;
	const h = Math.floor(min / 60);
	const m = min % 60;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function fmtHours(min: number): string {
	const h = min / 60;
	return h === Math.round(h) ? `${h}` : h.toFixed(1);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

export function fmtDateLong(iso: string): string {
	const d = parseISO(iso);
	return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function fmtDateShort(iso: string): string {
	const d = parseISO(iso);
	return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

/** Month/day for the current year, with the year appended for other years. */
export function fmtDateSmart(iso: string): string {
	const d = parseISO(iso);
	const short = fmtDateShort(iso);
	return d.getFullYear() === new Date().getFullYear() ? short : `${short}, ${d.getFullYear()}`;
}

export function fmtWeekday(iso: string): string {
	return DAY_NAMES[parseISO(iso).getDay()].slice(0, 3);
}

export function isWeekend(iso: string): boolean {
	const day = parseISO(iso).getDay();
	return day === 0 || day === 6;
}

export function monthLabel(ym: string): string {
	const [y, m] = ym.split('-').map(Number);
	return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function currentMonth(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Monday-start week containing the given date. */
export function weekStart(iso: string): string {
	const d = parseISO(iso);
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	return toISO(d);
}

export function weekLabel(iso: string): string {
	const start = weekStart(iso);
	const end = addDays(start, 6);
	return `${fmtDateShort(start)} – ${fmtDateShort(end)}`;
}

export function monthDays(ym: string): string[] {
	const [y, m] = ym.split('-').map(Number);
	const days: string[] = [];
	const d = new Date(y, m - 1, 1);
	while (d.getMonth() === m - 1) {
		days.push(toISO(d));
		d.setDate(d.getDate() + 1);
	}
	return days;
}

/** 6x7 grid of ISO dates covering the month (Monday-start, padded with adjacent days). */
export function monthGrid(ym: string): string[][] {
	const first = `${ym}-01`;
	const start = weekStart(first);
	const weeks: string[][] = [];
	let cursor = start;
	for (let w = 0; w < 6; w++) {
		const week: string[] = [];
		for (let i = 0; i < 7; i++) {
			week.push(cursor);
			cursor = addDays(cursor, 1);
		}
		weeks.push(week);
	}
	return weeks;
}

export function daysBetween(a: string, b: string): number {
	const ms = parseISO(b).getTime() - parseISO(a).getTime();
	return Math.round(ms / 86400000);
}

export function relativeAge(iso: string): string {
	const days = daysBetween(iso, todayISO());
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	return `${days} days ago`;
}

/** Local date (YYYY-MM-DD) of an ISO timestamp. */
export function tsToDate(ts: string): string {
	return toISO(new Date(ts));
}

/** Local wall-clock time of an ISO timestamp, e.g. "9:30 AM". */
export function fmtTsTime(ts: string): string {
	const d = new Date(ts);
	return fmtTime(d.getHours() * 60 + d.getMinutes());
}

export function fmtTsDate(ts: string): string {
	return fmtDateShort(tsToDate(ts));
}

export function fmtTsDateTime(ts: string): string {
	return `${fmtTsDate(ts)} · ${fmtTsTime(ts)}`;
}

/** Days since the local calendar date of an ISO timestamp (0 = today). */
export function daysSinceTs(ts: string): number {
	return Math.max(0, daysBetween(tsToDate(ts), todayISO()));
}

export function relativeDaysText(days: number): string {
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	return `${days} days ago`;
}

/** UTC ISO range covering a local calendar day. */
export function dayRangeISO(dateISO: string): { from: string; to: string } {
	const start = parseISO(dateISO);
	const end = new Date(start);
	end.setDate(end.getDate() + 1);
	return { from: start.toISOString(), to: end.toISOString() };
}

/** UTC ISO range covering a local calendar month (YYYY-MM). */
export function monthRangeISO(ym: string): { from: string; to: string } {
	const [y, m] = ym.split('-').map(Number);
	const start = new Date(y, m - 1, 1);
	const end = new Date(y, m, 1);
	return { from: start.toISOString(), to: end.toISOString() };
}

export function lastNWeekStarts(n: number): string[] {
	const current = weekStart(todayISO());
	const weeks: string[] = [];
	for (let i = 0; i < n; i++) {
		weeks.push(addDays(current, -7 * i));
	}
	return weeks;
}

/** Minutes from midnight for a local Date. */
export function minutesOfDay(d: Date): number {
	return d.getHours() * 60 + d.getMinutes();
}

export function nowIso(): string {
	return new Date().toISOString();
}
