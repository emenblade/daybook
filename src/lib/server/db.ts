import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DATABASE_PATH } from '$app/env/private';
import { addDays, parseISO, todayISO } from '#lib/dates.ts';
import { modalityFor } from '#lib/session.ts';
import type { SessionStatus, SessionType } from '#lib/types.ts';
import { hashPassword } from './crypto.ts';
import { isValidUsername, normalizeUsername, usernameFromName } from '#lib/username.ts';
import {
	DEFAULT_PARSE_RULES,
	normalizeName,
	normalizeService
} from './parse.ts';

const SCHEMA_VERSION = 7;

const SCHEMA = `
	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		color TEXT NOT NULL DEFAULT '#0d9488',
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		must_change_credentials INTEGER NOT NULL DEFAULT 1,
		session_version INTEGER NOT NULL DEFAULT 0
	);

	CREATE TABLE login_attempts (
		key TEXT PRIMARY KEY,
		attempts INTEGER NOT NULL DEFAULT 0,
		first_at INTEGER NOT NULL,
		last_at INTEGER NOT NULL,
		locked_until INTEGER
	);

	CREATE TABLE clients (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		normalized TEXT NOT NULL UNIQUE,
		status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','follow_up','discharged')),
		consent_signed_at TEXT,
		consent_signed_source TEXT,
		treatment_plan_completed_at TEXT,
		treatment_plan_reviewed_at TEXT,
		is_demo INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE appointments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_key TEXT NOT NULL UNIQUE,
		start_ts TEXT NOT NULL,
		end_ts TEXT NOT NULL,
		duration_min INTEGER NOT NULL,
		title TEXT NOT NULL,
		service TEXT NOT NULL DEFAULT '',
		session_type TEXT NOT NULL DEFAULT 'individual' CHECK (session_type IN ('individual','couples','family','group')),
		status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','no_show','canceled')),
		confirmed_at TEXT,
		confirmed_source TEXT,
		location TEXT,
		modality TEXT NOT NULL DEFAULT 'unknown' CHECK (modality IN ('in_person','remote','unknown')),
		provider TEXT,
		is_demo INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE INDEX idx_appointments_start ON appointments(start_ts);
	CREATE INDEX idx_appointments_status ON appointments(status);
	CREATE INDEX idx_appointments_type ON appointments(session_type);

	CREATE TABLE appointment_clients (
		appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
		client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
		PRIMARY KEY (appointment_id, client_id)
	);

	CREATE INDEX idx_appointment_clients_client ON appointment_clients(client_id);

	CREATE TABLE calendar_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		uid TEXT NOT NULL UNIQUE,
		source TEXT NOT NULL,
		calendar_name TEXT,
		summary TEXT,
		description TEXT,
		location TEXT,
		start_ts TEXT NOT NULL,
		end_ts TEXT NOT NULL,
		all_day INTEGER NOT NULL DEFAULT 0,
		recurring INTEGER NOT NULL DEFAULT 0,
		event_kind TEXT NOT NULL DEFAULT 'other' CHECK (event_kind IN ('client','other','duplicate')),
		category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('session','break','work','personal','vacation','other','duplicate')),
		service TEXT,
		parsed_client TEXT,
		group_key TEXT,
		removed INTEGER NOT NULL DEFAULT 0,
		first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
		last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE INDEX idx_events_start ON calendar_events(start_ts);
	CREATE INDEX idx_events_source ON calendar_events(source);
	CREATE INDEX idx_events_group ON calendar_events(group_key);

	CREATE TABLE sync_runs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		source TEXT NOT NULL,
		started_at TEXT NOT NULL,
		finished_at TEXT,
		ok INTEGER,
		message TEXT,
		events_seen INTEGER NOT NULL DEFAULT 0,
		appointments_created INTEGER NOT NULL DEFAULT 0,
		appointments_updated INTEGER NOT NULL DEFAULT 0
	);

	CREATE TABLE settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
`;

function open(): Database.Database {
	const path = DATABASE_PATH || 'data/daybook.db';
	if (path !== ':memory:') {
		mkdirSync(dirname(resolve(path)), { recursive: true });
	}
	const database = new Database(path);
	database.pragma('journal_mode = WAL');
	database.pragma('foreign_keys = ON');
	migrate(database);
	seed(database);
	ensureDefaults(database);
	return database;
}

function addColumns(
	database: Database.Database,
	table: string,
	columns: Record<string, string>
): void {
	const existing = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
	const names = new Set(existing.map((column) => column.name));
	for (const [name, definition] of Object.entries(columns)) {
		if (!names.has(name)) {
			database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
		}
	}
}

function migrateReminderDefaults(database: Database.Database): void {
	const row = database
		.prepare("SELECT value FROM settings WHERE key = 'reminder_settings'")
		.get() as { value: string } | undefined;
	if (!row) return;
	try {
		const parsed = JSON.parse(row.value) as { staleDays?: number };
		if (parsed.staleDays === 60) {
			parsed.staleDays = 30;
			database
				.prepare("UPDATE settings SET value = ? WHERE key = 'reminder_settings'")
				.run(JSON.stringify(parsed));
		}
	} catch {
		// Leave malformed settings alone; getReminderSettings will fall back to defaults.
	}
}

function backfillAppointmentMetadata(database: Database.Database): void {
	const rows = database
		.prepare(
			`SELECT a.id, a.title, a.service,
				(SELECT location FROM calendar_events e
				 WHERE e.group_key = a.group_key AND e.removed = 0 ORDER BY e.id LIMIT 1) AS location,
				(SELECT calendar_name FROM calendar_events e
				 WHERE e.group_key = a.group_key AND e.removed = 0 ORDER BY e.id LIMIT 1) AS calendar_name,
				(SELECT source FROM calendar_events e
				 WHERE e.group_key = a.group_key AND e.removed = 0 ORDER BY e.id LIMIT 1) AS source
			 FROM appointments a`
		)
		.all() as {
		id: number;
		title: string;
		service: string;
		location: string | null;
		calendar_name: string | null;
		source: string | null;
	}[];
	const update = database.prepare(
		'UPDATE appointments SET location = ?, modality = ?, provider = ? WHERE id = ?'
	);
	for (const row of rows) {
		const location = row.location?.trim() || null;
		const provider = row.calendar_name?.trim() || row.source || null;
		update.run(location, modalityFor(row.service, location, row.title), provider, row.id);
	}
}

function migrateAuth(database: Database.Database): void {
	addColumns(database, 'users', {
		username: 'TEXT',
		password_hash: 'TEXT',
		must_change_credentials: 'INTEGER NOT NULL DEFAULT 1',
		session_version: 'INTEGER NOT NULL DEFAULT 0'
	});
	database.exec(`
		CREATE TABLE IF NOT EXISTS login_attempts (
			key TEXT PRIMARY KEY,
			attempts INTEGER NOT NULL DEFAULT 0,
			first_at INTEGER NOT NULL,
			last_at INTEGER NOT NULL,
			locked_until INTEGER
		);
	`);
	const users = database
		.prepare('SELECT id, name, pin_hash FROM users ORDER BY id')
		.all() as { id: number; name: string; pin_hash: string | null }[];
	const used = new Set<string>();
	const update = database.prepare(
		'UPDATE users SET username = ?, password_hash = ?, must_change_credentials = 1, session_version = 0 WHERE id = ?'
	);
	for (const user of users) {
		const base = usernameFromName(user.name);
		let username = base;
		let suffix = 2;
		while (used.has(username)) {
			username = `${base.slice(0, 28)}-${suffix}`;
			suffix++;
		}
		used.add(username);
		update.run(username, user.pin_hash ?? hashPassword('daybook-setup'), user.id);
	}
}

function migrate(database: Database.Database): void {
	let version = database.pragma('user_version', { simple: true }) as number;
	if (version === SCHEMA_VERSION) return;

	if (version === 3) {
		addColumns(database, 'clients', {
			consent_signed_at: 'TEXT',
			consent_signed_source: 'TEXT'
		});
		database.pragma('user_version = 4');
		version = 4;
	}

	if (version === 4) {
		addColumns(database, 'clients', {
			treatment_plan_completed_at: 'TEXT',
			treatment_plan_reviewed_at: 'TEXT'
		});
		migrateReminderDefaults(database);
		database.pragma('user_version = 5');
		version = 5;
	}

	if (version === 5) {
		addColumns(database, 'appointments', {
			location: 'TEXT',
			modality: "TEXT NOT NULL DEFAULT 'unknown'",
			provider: 'TEXT'
		});
		backfillAppointmentMetadata(database);
		database.pragma('user_version = 6');
		version = 6;
	}

	if (version === 6) {
		migrateAuth(database);
		database.pragma(`user_version = ${SCHEMA_VERSION}`);
		return;
	}

	if (version > SCHEMA_VERSION) {
		throw new Error(`Database schema ${version} is newer than this app (${SCHEMA_VERSION}).`);
	}

	database.exec(`
		DROP TABLE IF EXISTS appointment_clients;
		DROP TABLE IF EXISTS appointments;
		DROP TABLE IF EXISTS calendar_events;
		DROP TABLE IF EXISTS sync_runs;
		DROP TABLE IF EXISTS clients;
		DROP TABLE IF EXISTS sessions;
		DROP TABLE IF EXISTS entries;
		DROP TABLE IF EXISTS users;
		DROP TABLE IF EXISTS login_attempts;
		DROP TABLE IF EXISTS settings;
	`);
	database.exec(SCHEMA);
	database.pragma(`user_version = ${SCHEMA_VERSION}`);
}

function ensureDefaults(database: Database.Database): void {
	const defaults: [string, string][] = [
		['parse_rules', JSON.stringify(DEFAULT_PARSE_RULES)],
		[
			'calendar_config',
			JSON.stringify({
				source: 'none',
				icsUrl: '',
				caldavServer: 'https://caldav.icloud.com',
				caldavUsername: '',
				caldavPassword: '',
				caldavCalendar: '',
				providerName: 'Jane',
				syncTime: '03:30'
			})
		],
		['reminder_settings', JSON.stringify({ delayDays: 3, time: '17:00', staleDays: 30 })],
		['last_sync_at', ''],
		['last_sync_status', ''],
		['last_sync_error', ''],
		['last_daily_sync_date', ''],
		['tracking_start_date', '']
	];
	const insert = database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
	for (const [key, value] of defaults) insert.run(key, value);
}

function atLocal(dateISO: string, startMin: number): Date {
	const date = parseISO(dateISO);
	date.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
	return date;
}

function slug(value: string): string {
	return normalizeName(value).replace(/\s+/g, '-');
}

const CLINIC =
	'Edmonton In-Person Indigenous Psychological Services - Suite #104, 10335 172 St NW, Edmonton';

interface DemoSpec {
	name: string;
	interval: number;
	lastOffset: number;
	lastStatus: 'completed' | 'scheduled' | 'no_show';
	future: boolean;
	service: string;
}

function seed(database: Database.Database): void {
	const count = database.prepare('SELECT count(*) AS c FROM users').get() as { c: number };
	if (count.c > 0) return;

	const setupUsername = normalizeUsername(process.env.DAYBOOK_SETUP_USERNAME || 'admin');
	const setupPassword = process.env.DAYBOOK_SETUP_PASSWORD || 'daybook-setup';
	const displayName = process.env.DAYBOOK_USER_NAME?.trim() || 'Sara';
	database
		.prepare(
			'INSERT INTO users (name, color, username, password_hash, must_change_credentials, session_version) VALUES (?, ?, ?, ?, 1, 0)'
		)
		.run(
			displayName,
			'#0d9488',
			isValidUsername(setupUsername) ? setupUsername : 'admin',
			hashPassword(setupPassword)
		);

	const today = todayISO();
	const used = new Map<string, [number, number][]>();
	const intervalsFor = (date: string) => {
		let list = used.get(date);
		if (!list) {
			list = [];
			used.set(date, list);
		}
		return list;
	};
	const markUsed = (date: string, startMin: number, duration: number) => {
		intervalsFor(date).push([startMin, startMin + duration]);
	};
	const isFree = (date: string, startMin: number, duration: number) => {
		const end = startMin + duration;
		return !intervalsFor(date).some(([start, finish]) => startMin < finish && end > start);
	};

	const clientIds = new Map<string, number>();
	const ensureClient = (name: string): number => {
		const existing = clientIds.get(name);
		if (existing) return existing;
		const row = database
			.prepare('SELECT id FROM clients WHERE normalized = ?')
			.get(normalizeName(name)) as { id: number } | undefined;
		if (row) {
			clientIds.set(name, row.id);
			return row.id;
		}
		const result = database
			.prepare('INSERT INTO clients (name, normalized, status, is_demo) VALUES (?, ?, ?, 1)')
			.run(name, normalizeName(name), 'active');
		const id = Number(result.lastInsertRowid);
		clientIds.set(name, id);
		return id;
	};

	const insertEvent = database.prepare(`
		INSERT INTO calendar_events
			(uid, source, calendar_name, summary, description, location, start_ts, end_ts, all_day,
			 recurring, event_kind, category, service, parsed_client, group_key, removed)
		VALUES (?, 'demo', 'Jane', ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, 0)
	`);
	const insertAppointment = database.prepare(`
		INSERT INTO appointments
			(group_key, start_ts, end_ts, duration_min, title, service, session_type, status,
			 confirmed_at, confirmed_source, location, modality, provider, is_demo)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
	`);
	const insertParticipant = database.prepare(
		'INSERT OR IGNORE INTO appointment_clients (appointment_id, client_id) VALUES (?, ?)'
	);
	const insertOther = database.prepare(`
		INSERT INTO calendar_events
			(uid, source, calendar_name, summary, description, location, start_ts, end_ts, all_day,
			 recurring, event_kind, category, removed)
		VALUES (?, 'demo', 'Jane', ?, ?, ?, ?, ?, 0, 0, 'other', ?, 0)
	`);

	function addAppointment(opts: {
		date: string;
		startMin: number;
		duration: number;
		service: string;
		type: SessionType;
		participants: string[];
		status: SessionStatus;
	}) {
		const start = atLocal(opts.date, opts.startMin);
		const end = new Date(start.getTime() + opts.duration * 60000);
		const groupKey = `demo:${opts.type}:${opts.date}:${opts.startMin}:${slug(opts.service)}`;
		const confirmed =
			opts.status === 'completed' || opts.status === 'no_show'
				? new Date(end.getTime() + 2 * 3600_000).toISOString()
				: null;
		const modality = modalityFor(opts.service, CLINIC, opts.service);
		const location = modality === 'in_person' ? CLINIC : null;
		const result = insertAppointment.run(
			groupKey,
			start.toISOString(),
			end.toISOString(),
			opts.duration,
			opts.service,
			opts.service,
			opts.type,
			opts.status,
			confirmed,
			confirmed ? 'demo' : null,
			location,
			modality,
			'Jane'
		);
		const appointmentId = Number(result.lastInsertRowid);
		for (const name of opts.participants) {
			const clientId = ensureClient(name);
			insertParticipant.run(appointmentId, clientId);
			insertEvent.run(
				`demo-${opts.date}-${opts.startMin}-${slug(name)}`,
				`${name} (${opts.service})`,
				opts.status === 'completed' || opts.status === 'no_show' ? 'confirmed' : '',
				location,
				start.toISOString(),
				end.toISOString(),
				'client',
				'session',
				opts.service,
				name,
				groupKey
			);
		}
		markUsed(opts.date, opts.startMin, opts.duration);
	}

	function addOther(date: string, startMin: number, duration: number, summary: string, category: string) {
		markUsed(date, startMin, duration);
		const start = atLocal(date, startMin);
		const end = new Date(start.getTime() + duration * 60000);
		insertOther.run(
			`demo-other-${date}-${startMin}`,
			summary,
			category === 'break' ? 'Lunch' : '',
			CLINIC,
			start.toISOString(),
			end.toISOString(),
			category
		);
	}

	// ---- couples + DBT group (seeded first so their slots are reserved) ----
	const coupleNames = ['Riya P.', 'Diego R.'];
	const couplesService = 'Couples Counselling In-Person';
	for (const offset of [0, 14, 28, 42]) {
		const date = addDays(today, -offset);
		addAppointment({
			date,
			startMin: 13 * 60,
			duration: 60,
			service: couplesService,
			type: 'couples',
			participants: coupleNames,
			status: offset === 0 ? 'scheduled' : 'completed'
		});
	}
	addAppointment({
		date: addDays(today, 14),
		startMin: 13 * 60,
		duration: 60,
		service: couplesService,
		type: 'couples',
		participants: coupleNames,
		status: 'scheduled'
	});

	const groupNames = ['Avery N.', 'Samir A.', 'Priya S.', 'Elena R.'];
	const groupService = 'DBT Group (Online Through Zoom)';
	for (const offset of [0, 7, 14, 21]) {
		const date = addDays(today, -offset);
		addAppointment({
			date,
			startMin: 15 * 60,
			duration: 120,
			service: groupService,
			type: 'group',
			participants: groupNames,
			status: offset === 0 ? 'scheduled' : 'completed'
		});
		if (offset > 0) addOther(date, 8 * 60, 45, 'Break - Prep for the group', 'work');
	}
	addAppointment({
		date: addDays(today, 7),
		startMin: 15 * 60,
		duration: 120,
		service: groupService,
		type: 'group',
		participants: groupNames,
		status: 'scheduled'
	});

	// ---- non-client blocks ----
	for (let offset = -21; offset <= 60; offset++) {
		const date = addDays(today, offset);
		const dow = parseISO(date).getDay();
		if (dow >= 1 && dow <= 5) {
			addOther(date, 12 * 60, 60, 'Break - Lunch', 'break');
		}
	}
	addOther(today, 8 * 60, 30, 'Break - Case Consult', 'work');
	addOther(addDays(today, 3), 10 * 60, 30, 'Break - Meeting with colleague', 'work');
	addOther(addDays(today, 10), 10 * 60, 30, 'Break - Case Consult', 'work');
	addOther(addDays(today, 5), 9 * 60, 60, 'Break - Yoga', 'personal');
	addOther(addDays(today, 30), 9 * 60, 60, 'Break - Vacation', 'vacation');

	// ---- individual clients ----
	const specs: DemoSpec[] = [
		{ name: 'Avery N.', interval: 7, lastOffset: 2, lastStatus: 'completed', future: true, service: 'In-Person FNIHB/IRS/Bigstone' },
		{ name: 'Samir A.', interval: 7, lastOffset: 1, lastStatus: 'completed', future: true, service: 'Video FNIHB/IRS/Bigstone' },
		{ name: 'Kira W.', interval: 14, lastOffset: 20, lastStatus: 'completed', future: true, service: 'In-Person FNIHB/IRS/Bigstone' },
		{ name: 'Nora E.', interval: 30, lastOffset: 40, lastStatus: 'completed', future: true, service: 'Phone FNIHB/IRS/Bigstone' },
		{ name: 'Maya B.', interval: 7, lastOffset: 9, lastStatus: 'scheduled', future: false, service: 'In-Person FNIHB/IRS/Bigstone' },
		{ name: 'Owen F.', interval: 14, lastOffset: 6, lastStatus: 'scheduled', future: false, service: 'In-Person FNIHB/IRS/Bigstone' },
		{ name: 'Priya S.', interval: 7, lastOffset: 10, lastStatus: 'scheduled', future: false, service: 'Pro Bono Session - In Person' },
		{ name: 'Jordan O.', interval: 14, lastOffset: 70, lastStatus: 'completed', future: false, service: 'In-Person FNIHB/IRS/Bigstone' },
		{ name: 'Tessa L.', interval: 30, lastOffset: 65, lastStatus: 'completed', future: false, service: 'In Person WCB - Worker Counselling' },
		{ name: 'Elena R.', interval: 14, lastOffset: 12, lastStatus: 'no_show', future: false, service: 'In-Person FNIHB/IRS/Bigstone' }
	];
	const startTimes = [9 * 60, 10 * 60 + 30, 11 * 60 + 45, 14 * 60, 16 * 60 + 30];
	const freeSlot = (date: string, preferred: number, duration: number): number | null => {
		const ordered = [preferred, ...startTimes.filter((time) => time !== preferred)];
		for (const time of ordered) {
			if (isFree(date, time, duration)) return time;
		}
		return null;
	};

	specs.forEach((spec, specIndex) => {
		ensureClient(spec.name);
		let index = 0;
		for (let offset = spec.lastOffset; offset <= 120; offset += spec.interval) {
			const date = addDays(today, -offset);
			const preferred = startTimes[(specIndex + index) % startTimes.length];
			const duration = index % 7 === 3 ? 45 : 60;
			const startMin = freeSlot(date, preferred, duration);
			if (startMin === null) continue;
			const status: SessionStatus =
				offset === spec.lastOffset
					? spec.lastStatus
					: index % 17 === 0
						? 'no_show'
						: 'completed';
			addAppointment({
				date,
				startMin,
				duration,
				service: spec.service,
				type: 'individual',
				participants: [spec.name],
				status
			});
			index++;
		}
		if (spec.future) {
			let ahead = spec.interval - (spec.lastOffset % spec.interval);
			if (ahead <= 0) ahead += spec.interval;
			for (let offset = ahead; offset <= 21; offset += spec.interval) {
				const date = addDays(today, offset);
				const preferred = startTimes[(specIndex + offset) % startTimes.length];
				const startMin = freeSlot(date, preferred, 60);
				if (startMin === null) continue;
				addAppointment({
					date,
					startMin,
					duration: 60,
					service: spec.service,
					type: 'individual',
					participants: [spec.name],
					status: 'scheduled'
				});
			}
		}
	});

	// ---- today's board (individual rows, one couples, one group already added) ----
	const todayPlan: { name: string; startMin: number; duration: number; status: SessionStatus; service: string }[] = [
		{ name: 'Avery N.', startMin: 9 * 60, duration: 60, status: 'completed', service: 'In-Person FNIHB/IRS/Bigstone' },
		{ name: 'Samir A.', startMin: 10 * 60, duration: 45, status: 'no_show', service: 'Video FNIHB/IRS/Bigstone' },
		{ name: 'Kira W.', startMin: 11 * 60, duration: 60, status: 'scheduled', service: 'In-Person FNIHB/IRS/Bigstone' },
		{ name: 'Nora E.', startMin: 14 * 60, duration: 60, status: 'scheduled', service: 'Phone FNIHB/IRS/Bigstone' }
	];
	for (const item of todayPlan) {
		if (!isFree(today, item.startMin, item.duration)) continue;
		addAppointment({
			date: today,
			startMin: item.startMin,
			duration: item.duration,
			service: item.service,
			type: 'individual',
			participants: [item.name],
			status: item.status
		});
	}

	// Demo variety: most clients already have consent, a few still need it.
	const consentSigned = [
		'Avery N.',
		'Samir A.',
		'Kira W.',
		'Nora E.',
		'Riya P.',
		'Diego R.',
		'Jordan O.',
		'Tessa L.'
	];
	const markConsent = database.prepare(
		"UPDATE clients SET consent_signed_at = datetime('now','-30 days'), consent_signed_source = 'demo' WHERE normalized = ?"
	);
	for (const name of consentSigned) markConsent.run(normalizeName(name));

	// Demo treatment plans: most are active; a few show missing, quarterly, and annual states.
	const planDone: { name: string; completedDays: number; reviewedDays: number }[] = [
		{ name: 'Avery N.', completedDays: 100, reviewedDays: 100 },
		{ name: 'Samir A.', completedDays: 370, reviewedDays: 370 },
		{ name: 'Kira W.', completedDays: 30, reviewedDays: 30 },
		{ name: 'Nora E.', completedDays: 80, reviewedDays: 80 },
		{ name: 'Priya S.', completedDays: 30, reviewedDays: 30 },
		{ name: 'Jordan O.', completedDays: 10, reviewedDays: 10 },
		{ name: 'Tessa L.', completedDays: 10, reviewedDays: 10 },
		{ name: 'Riya P.', completedDays: 30, reviewedDays: 30 },
		{ name: 'Diego R.', completedDays: 30, reviewedDays: 30 }
	];
	const markPlan = database.prepare(
		'UPDATE clients SET treatment_plan_completed_at = ?, treatment_plan_reviewed_at = ? WHERE normalized = ?'
	);
	for (const plan of planDone) {
		const completed = new Date(Date.now() - plan.completedDays * 86400000).toISOString();
		const reviewed = new Date(Date.now() - plan.reviewedDays * 86400000).toISOString();
		markPlan.run(completed, reviewed, normalizeName(plan.name));
	}
}

const globalRef = globalThis as unknown as { __daybook_db?: Database.Database };

export const db: Database.Database = (globalRef.__daybook_db ??= open());
