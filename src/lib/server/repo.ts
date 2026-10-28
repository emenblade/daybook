import {
	dayRangeISO,
	daysSinceTs,
	monthRangeISO,
	tsToDate
} from '#lib/dates.ts';
import type {
	Appointment,
	CalendarEvent,
	Client,
	ClientStatus,
	ClientSummary,
	DayCell,
	EventCategory,
	HoursSummary,
	Participant,
	SessionStatus,
	SessionType,
	SyncRun,
	TypeHours,
	User
} from '#lib/types.ts';
import { db } from './db.ts';

type AppointmentRow = Omit<Appointment, 'participants'>;

const APPT_COLS = `a.id, a.group_key, a.start_ts, a.end_ts, a.duration_min, a.title,
	a.service, a.session_type, a.status, a.confirmed_at, a.confirmed_source, a.is_demo`;

function attachParticipants(rows: AppointmentRow[]): Appointment[] {
	if (rows.length === 0) return [];
	const placeholders = rows.map(() => '?').join(',');
	const parts = db
		.prepare(
			`SELECT ac.appointment_id AS appointment_id, c.id, c.name
			 FROM appointment_clients ac JOIN clients c ON c.id = ac.client_id
			 WHERE ac.appointment_id IN (${placeholders})
			 ORDER BY c.name`
		)
		.all(...rows.map((row) => row.id)) as {
		appointment_id: number;
		id: number;
		name: string;
	}[];
	const map = new Map<number, Participant[]>();
	for (const part of parts) {
		const list = map.get(part.appointment_id) ?? [];
		list.push({ id: part.id, name: part.name });
		map.set(part.appointment_id, list);
	}
	return rows.map((row) => ({ ...row, participants: map.get(row.id) ?? [] }));
}

/* ---------------- users ---------------- */

export function getPrimaryUser(): User | undefined {
	return db.prepare('SELECT id, name, color FROM users ORDER BY id LIMIT 1').get() as
		| User
		| undefined;
}

export function updateUserName(id: number, name: string): void {
	db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
}

export function getPinHash(id: number): string | undefined {
	const row = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(id) as
		| { pin_hash: string }
		| undefined;
	return row?.pin_hash;
}

/* ---------------- clients ---------------- */

const CLIENT_SUMMARY_SELECT = `
	SELECT c.id, c.name, c.normalized, c.status, c.is_demo, c.created_at, c.updated_at,
		(SELECT max(a.start_ts) FROM appointment_clients ac JOIN appointments a ON a.id = ac.appointment_id
			WHERE ac.client_id = c.id AND a.status = 'completed') AS last_seen_at,
		(SELECT count(*) FROM appointment_clients ac JOIN appointments a ON a.id = ac.appointment_id
			WHERE ac.client_id = c.id AND a.status = 'completed') AS total_sessions,
		(SELECT COALESCE(SUM(a.duration_min), 0) FROM appointment_clients ac JOIN appointments a ON a.id = ac.appointment_id
			WHERE ac.client_id = c.id AND a.status = 'completed') AS total_minutes,
		(SELECT min(a.start_ts) FROM appointment_clients ac JOIN appointments a ON a.id = ac.appointment_id
			WHERE ac.client_id = c.id AND a.status = 'scheduled' AND a.start_ts > ?) AS next_session_at
	FROM clients c
`;

interface ClientRow extends Omit<ClientSummary, 'days_since_seen'> {
	last_seen_at: string | null;
}

function withDays(row: ClientRow): ClientSummary {
	return {
		...row,
		days_since_seen: row.last_seen_at ? daysSinceTs(row.last_seen_at) : null
	};
}

export function listClients(opts: { search?: string; status?: ClientStatus | 'all' } = {}): ClientSummary[] {
	const where: string[] = [];
	const params: (string | number)[] = [new Date().toISOString()];
	if (opts.status && opts.status !== 'all') {
		where.push('c.status = ?');
		params.push(opts.status);
	}
	if (opts.search) {
		where.push('c.name LIKE ?');
		params.push(`%${opts.search}%`);
	}
	const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const rows = db
		.prepare(`${CLIENT_SUMMARY_SELECT} ${clause} ORDER BY last_seen_at IS NULL, last_seen_at DESC, c.name`)
		.all(...params) as ClientRow[];
	return rows.map(withDays);
}

export function getClient(id: number): Client | undefined {
	return db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as Client | undefined;
}

export function setClientStatus(id: number, status: ClientStatus): void {
	db.prepare("UPDATE clients SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
		status,
		id
	);
}

export function findOrCreateClient(name: string, normalized: string, isDemo = false): number {
	const existing = db.prepare('SELECT id FROM clients WHERE normalized = ?').get(normalized) as
		| { id: number }
		| undefined;
	if (existing) return existing.id;
	const result = db
		.prepare('INSERT INTO clients (name, normalized, is_demo) VALUES (?, ?, ?)')
		.run(name, normalized, isDemo ? 1 : 0);
	return Number(result.lastInsertRowid);
}

export function staleClients(days = 60, limit = 25): ClientSummary[] {
	return listClients({ status: 'active' })
		.filter(
			(client) =>
				client.days_since_seen !== null &&
				client.days_since_seen > days &&
				client.next_session_at === null
		)
		.sort((a, b) => (b.days_since_seen ?? 0) - (a.days_since_seen ?? 0))
		.slice(0, limit);
}

export interface ClientStats {
	totalSessions: number;
	totalMinutes: number;
	avgIntervalDays: number | null;
	lastSeenAt: string | null;
	nextSessionAt: string | null;
	noShows: number;
}

export function clientStats(clientId: number): ClientStats {
	const agg = db
		.prepare(
			`SELECT
				COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed,
				COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.duration_min END), 0) AS minutes,
				COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) AS no_shows,
				MAX(CASE WHEN a.status = 'completed' THEN a.start_ts END) AS last_seen
			 FROM appointments a JOIN appointment_clients ac ON ac.appointment_id = a.id
			 WHERE ac.client_id = ?`
		)
		.get(clientId) as {
		completed: number;
		minutes: number;
		no_shows: number;
		last_seen: string | null;
	};
	const next = db
		.prepare(
			`SELECT min(a.start_ts) AS next FROM appointments a JOIN appointment_clients ac ON ac.appointment_id = a.id
			 WHERE ac.client_id = ? AND a.status = 'scheduled' AND a.start_ts > ?`
		)
		.get(clientId, new Date().toISOString()) as { next: string | null };

	const completedDates = db
		.prepare(
			`SELECT a.start_ts FROM appointments a JOIN appointment_clients ac ON ac.appointment_id = a.id
			 WHERE ac.client_id = ? AND a.status = 'completed' ORDER BY a.start_ts ASC`
		)
		.all(clientId) as { start_ts: string }[];
	let avg: number | null = null;
	if (completedDates.length >= 2) {
		const first = new Date(completedDates[0].start_ts).getTime();
		const last = new Date(completedDates[completedDates.length - 1].start_ts).getTime();
		avg = Math.round((last - first) / 86400000 / (completedDates.length - 1));
	}

	return {
		totalSessions: agg.completed,
		totalMinutes: agg.minutes,
		avgIntervalDays: avg,
		lastSeenAt: agg.last_seen,
		nextSessionAt: next.next,
		noShows: agg.no_shows
	};
}

export function hasDemoData(): boolean {
	const row = db.prepare('SELECT count(*) AS c FROM clients WHERE is_demo = 1').get() as {
		c: number;
	};
	return row.c > 0;
}

export function removeDemoData(): void {
	db.transaction(() => {
		db.prepare('DELETE FROM appointments WHERE is_demo = 1').run();
		db.prepare('DELETE FROM calendar_events WHERE source = ?').run('demo');
		db.prepare(
			'DELETE FROM clients WHERE is_demo = 1 AND id NOT IN (SELECT client_id FROM appointment_clients)'
		).run();
		db.prepare('DELETE FROM sync_runs WHERE source = ?').run('demo');
	})();
}

/* ---------------- appointments ---------------- */

export function getAppointmentByGroupKey(groupKey: string): Appointment | undefined {
	const row = db.prepare(`SELECT ${APPT_COLS} FROM appointments a WHERE a.group_key = ?`).get(groupKey) as
		| AppointmentRow
		| undefined;
	return row ? attachParticipants([row])[0] : undefined;
}

export function appointmentById(id: number): Appointment | undefined {
	const row = db.prepare(`SELECT ${APPT_COLS} FROM appointments a WHERE a.id = ?`).get(id) as
		| AppointmentRow
		| undefined;
	return row ? attachParticipants([row])[0] : undefined;
}

export function appointmentsForDay(dateISO: string): Appointment[] {
	const { from, to } = dayRangeISO(dateISO);
	const rows = db
		.prepare(
			`SELECT ${APPT_COLS} FROM appointments a WHERE a.start_ts >= ? AND a.start_ts < ? ORDER BY a.start_ts`
		)
		.all(from, to) as AppointmentRow[];
	return attachParticipants(rows);
}

export function appointmentsForClient(clientId: number, limit = 250): Appointment[] {
	const rows = db
		.prepare(
			`SELECT ${APPT_COLS} FROM appointments a JOIN appointment_clients ac ON ac.appointment_id = a.id
			 WHERE ac.client_id = ? ORDER BY a.start_ts DESC LIMIT ?`
		)
		.all(clientId, limit) as AppointmentRow[];
	return attachParticipants(rows);
}

export function setAppointmentStatus(id: number, status: SessionStatus, source: string): void {
	const confirmed = status === 'completed' || status === 'no_show';
	db.prepare(
		`UPDATE appointments SET status = ?, confirmed_at = ?, confirmed_source = ?, updated_at = datetime('now') WHERE id = ?`
	).run(status, confirmed ? new Date().toISOString() : null, confirmed ? source : null, id);
}

export function appointmentsNeedingAttention(delayDays: number, limit = 40): Appointment[] {
	const cutoff = new Date(Date.now() - delayDays * 86400000).toISOString();
	const rows = db
		.prepare(
			`SELECT ${APPT_COLS} FROM appointments a
			 WHERE a.status = 'scheduled' AND a.start_ts < ?
			 ORDER BY a.start_ts ASC LIMIT ?`
		)
		.all(cutoff, limit) as AppointmentRow[];
	return attachParticipants(rows);
}

export function countNeedsAttention(delayDays: number): number {
	const cutoff = new Date(Date.now() - delayDays * 86400000).toISOString();
	const row = db
		.prepare("SELECT count(*) AS c FROM appointments WHERE status = 'scheduled' AND start_ts < ?")
		.get(cutoff) as { c: number };
	return row.c;
}

const VISIBLE_OTHER_CATEGORIES: EventCategory[] = ['work', 'personal', 'vacation', 'other'];

export function monthCells(ym: string, delayDays: number): Map<string, DayCell> {
	const { from, to } = monthRangeISO(ym);
	const rows = db
		.prepare(
			"SELECT start_ts, status FROM appointments WHERE start_ts >= ? AND start_ts < ?"
		)
		.all(from, to) as { start_ts: string; status: SessionStatus }[];
	const otherRows = db
		.prepare(
			`SELECT start_ts FROM calendar_events
			 WHERE event_kind = 'other' AND removed = 0 AND start_ts >= ? AND start_ts < ?
			 AND category IN (${VISIBLE_OTHER_CATEGORIES.map(() => '?').join(',')})`
		)
		.all(from, to, ...VISIBLE_OTHER_CATEGORIES) as { start_ts: string }[];

	const cutoff = new Date(Date.now() - delayDays * 86400000).toISOString();
	const map = new Map<string, DayCell>();
	const cellFor = (date: string): DayCell => {
		let cell = map.get(date);
		if (!cell) {
			cell = {
				date,
				total: 0,
				completed: 0,
				no_show: 0,
				scheduled: 0,
				needsAttention: 0,
				canceled: 0,
				other: 0
			};
			map.set(date, cell);
		}
		return cell;
	};
	for (const row of rows) {
		const cell = cellFor(tsToDate(row.start_ts));
		cell.total++;
		if (row.status === 'completed') cell.completed++;
		else if (row.status === 'no_show') cell.no_show++;
		else if (row.status === 'canceled') cell.canceled++;
		else {
			cell.scheduled++;
			if (row.start_ts < cutoff) cell.needsAttention++;
		}
	}
	for (const row of otherRows) {
		cellFor(tsToDate(row.start_ts)).other++;
	}
	return map;
}

/* ---------------- hours ---------------- */

export function hoursSummary(fromISO: string, toISO: string): HoursSummary {
	const row = db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_min END), 0) AS minutes,
				COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
				COUNT(CASE WHEN status = 'no_show' THEN 1 END) AS no_shows,
				COUNT(DISTINCT CASE WHEN status = 'completed' THEN id END) AS appointments
			 FROM appointments WHERE start_ts >= ? AND start_ts < ?`
		)
		.get(fromISO, toISO) as {
		minutes: number;
		completed: number;
		no_shows: number;
		appointments: number;
	};
	return {
		totalMinutes: row.minutes,
		completedCount: row.completed,
		noShowCount: row.no_shows,
		clientCount: 0
	};
}

export function hoursByType(fromISO: string, toISO: string): TypeHours[] {
	const rows = db
		.prepare(
			`SELECT session_type AS type, SUM(duration_min) AS minutes, COUNT(*) AS count
			 FROM appointments
			 WHERE status = 'completed' AND start_ts >= ? AND start_ts < ?
			 GROUP BY session_type`
		)
		.all(fromISO, toISO) as { type: SessionType; minutes: number; count: number }[];
	return rows;
}

export function hoursForWeeks(weekStarts: string[]): Map<string, HoursSummary> {
	const map = new Map<string, HoursSummary>();
	const stmt = db.prepare(
		`SELECT
			COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_min END), 0) AS minutes,
			COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
			COUNT(CASE WHEN status = 'no_show' THEN 1 END) AS no_shows
		 FROM appointments WHERE start_ts >= ? AND start_ts < ?`
	);
	for (const start of weekStarts) {
		const from = new Date(`${start}T00:00:00`).toISOString();
		const endDate = new Date(`${start}T00:00:00`);
		endDate.setDate(endDate.getDate() + 7);
		const row = stmt.get(from, endDate.toISOString()) as {
			minutes: number;
			completed: number;
			no_shows: number;
		};
		map.set(start, {
			totalMinutes: row.minutes,
			completedCount: row.completed,
			noShowCount: row.no_shows,
			clientCount: 0
		});
	}
	return map;
}

export function appointmentsExport(fromISO: string, toISO: string): Appointment[] {
	const rows = db
		.prepare(
			`SELECT ${APPT_COLS} FROM appointments a
			 WHERE a.start_ts >= ? AND a.start_ts < ? ORDER BY a.start_ts`
		)
		.all(fromISO, toISO) as AppointmentRow[];
	return attachParticipants(rows);
}

/* ---------------- non-client events ---------------- */

export function otherEventsForDay(dateISO: string, categories: EventCategory[]): {
	id: number;
	summary: string;
	start_ts: string;
	end_ts: string;
	category: EventCategory;
}[] {
	if (categories.length === 0) return [];
	const { from, to } = dayRangeISO(dateISO);
	return db
		.prepare(
			`SELECT id, summary, start_ts, end_ts, category FROM calendar_events
			 WHERE event_kind = 'other' AND removed = 0 AND start_ts >= ? AND start_ts < ?
			 AND category IN (${categories.map(() => '?').join(',')})
			 ORDER BY start_ts`
		)
		.all(from, to, ...categories) as {
		id: number;
		summary: string;
		start_ts: string;
		end_ts: string;
		category: EventCategory;
	}[];
}

/* ---------------- sync ---------------- */

export function startSyncRun(source: string): number {
	const result = db
		.prepare("INSERT INTO sync_runs (source, started_at) VALUES (?, datetime('now'))")
		.run(source);
	return Number(result.lastInsertRowid);
}

export function finishSyncRun(
	id: number,
	ok: boolean,
	message: string,
	seen: number,
	created: number,
	updated: number
): void {
	db.prepare(
		`UPDATE sync_runs SET finished_at = datetime('now'), ok = ?, message = ?, events_seen = ?,
			appointments_created = ?, appointments_updated = ? WHERE id = ?`
	).run(ok ? 1 : 0, message, seen, created, updated, id);
}

export function listSyncRuns(limit = 15): SyncRun[] {
	return db
		.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?')
		.all(limit) as SyncRun[];
}

export interface CalendarEventInput {
	uid: string;
	source: string;
	calendarName: string | null;
	summary: string;
	description: string;
	location: string | null;
	startTs: string;
	endTs: string;
	allDay: boolean;
	recurring: boolean;
	eventKind: 'client' | 'other' | 'duplicate';
	category: EventCategory;
	service: string | null;
	parsedClient: string | null;
	groupKey: string | null;
}

export function upsertCalendarEvent(input: CalendarEventInput): void {
	db.prepare(
		`INSERT INTO calendar_events
			(uid, source, calendar_name, summary, description, location, start_ts, end_ts, all_day,
			 recurring, event_kind, category, service, parsed_client, group_key, removed)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
		 ON CONFLICT(uid) DO UPDATE SET
			source = excluded.source,
			calendar_name = excluded.calendar_name,
			summary = excluded.summary,
			description = excluded.description,
			location = excluded.location,
			start_ts = excluded.start_ts,
			end_ts = excluded.end_ts,
			all_day = excluded.all_day,
			recurring = excluded.recurring,
			event_kind = excluded.event_kind,
			category = excluded.category,
			service = excluded.service,
			parsed_client = excluded.parsed_client,
			group_key = excluded.group_key,
			removed = 0,
			last_seen_at = datetime('now')`
	).run(
		input.uid,
		input.source,
		input.calendarName,
		input.summary,
		input.description,
		input.location,
		input.startTs,
		input.endTs,
		input.allDay ? 1 : 0,
		input.recurring ? 1 : 0,
		input.eventKind,
		input.category,
		input.service,
		input.parsedClient,
		input.groupKey
	);
}

export interface AppointmentInput {
	groupKey: string;
	startTs: string;
	endTs: string;
	durationMin: number;
	title: string;
	service: string;
	sessionType: SessionType;
	status: SessionStatus;
	isDemo: boolean;
	confirmedSource?: string | null;
}

export function upsertAppointment(input: AppointmentInput): { id: number; created: boolean } {
	const existing = db
		.prepare('SELECT id FROM appointments WHERE group_key = ?')
		.get(input.groupKey) as { id: number } | undefined;
	if (existing) {
		db.prepare(
			`UPDATE appointments SET start_ts = ?, end_ts = ?, duration_min = ?, title = ?, service = ?,
				session_type = ?, updated_at = datetime('now') WHERE id = ?`
		).run(
			input.startTs,
			input.endTs,
			input.durationMin,
			input.title,
			input.service,
			input.sessionType,
			existing.id
		);
		return { id: existing.id, created: false };
	}
	const confirmed = input.status === 'completed' || input.status === 'no_show';
	const result = db
		.prepare(
			`INSERT INTO appointments
				(group_key, start_ts, end_ts, duration_min, title, service, session_type, status,
				 confirmed_at, confirmed_source, is_demo)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			input.groupKey,
			input.startTs,
			input.endTs,
			input.durationMin,
			input.title,
			input.service,
			input.sessionType,
			input.status,
			confirmed ? new Date().toISOString() : null,
			confirmed ? (input.confirmedSource ?? 'import') : null,
			input.isDemo ? 1 : 0
		);
	return { id: Number(result.lastInsertRowid), created: true };
}

export function setAppointmentParticipants(
	appointmentId: number,
	clientIds: number[],
	reconcile: boolean
): void {
	db.transaction(() => {
		if (reconcile) {
			db.prepare('DELETE FROM appointment_clients WHERE appointment_id = ?').run(appointmentId);
		}
		const insert = db.prepare(
			'INSERT OR IGNORE INTO appointment_clients (appointment_id, client_id) VALUES (?, ?)'
		);
		for (const clientId of clientIds) insert.run(appointmentId, clientId);
	})();
}

export function markMissingEvents(
	source: string,
	fromIso: string,
	toIso: string,
	seenUids: Set<string>
): number {
	const rows = db
		.prepare(
			`SELECT uid FROM calendar_events
			 WHERE source = ? AND removed = 0 AND start_ts >= ? AND start_ts < ?`
		)
		.all(source, fromIso, toIso) as { uid: string }[];
	const missing = rows.filter((row) => !seenUids.has(row.uid));
	if (missing.length === 0) return 0;
	const mark = db.prepare('UPDATE calendar_events SET removed = 1 WHERE uid = ?');
	db.transaction(() => {
		for (const row of missing) mark.run(row.uid);
	})();
	return missing.length;
}

export function cancelOrphanedAppointments(fromIso: string, toIso: string): number {
	const result = db
		.prepare(
			`UPDATE appointments SET status = 'canceled', updated_at = datetime('now')
			 WHERE status = 'scheduled' AND start_ts >= ? AND start_ts < ?
			 AND NOT EXISTS (
				SELECT 1 FROM calendar_events e
				WHERE e.group_key = appointments.group_key AND e.removed = 0
			 )`
		)
		.run(fromIso, toIso);
	return result.changes;
}

export function listRecentEvents(limit = 60): CalendarEvent[] {
	return db
		.prepare('SELECT * FROM calendar_events ORDER BY start_ts DESC LIMIT ?')
		.all(limit) as CalendarEvent[];
}
