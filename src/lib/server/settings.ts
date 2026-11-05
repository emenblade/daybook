import { randomUUID } from 'node:crypto';
import type {
	AdditionalCalendar,
	CalendarConfig,
	ParseRules,
	ReminderSettings
} from '#lib/types.ts';
import { db } from './db.ts';
import { DEFAULT_PARSE_RULES, isLegacyDefaultParseRules } from './parse.ts';

export function getSetting(key: string): string | null {
	const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
		| { value: string }
		| undefined;
	return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
	db.prepare(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	).run(key, value);
}

export function deleteSetting(key: string): void {
	db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

function getJson(key: string): unknown {
	const raw = getSetting(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function getParseRules(): ParseRules {
	const stored = getJson('parse_rules') as Partial<ParseRules> | null;
	if (!stored || isLegacyDefaultParseRules(stored)) return DEFAULT_PARSE_RULES;
	return {
		summaryPatterns: Array.isArray(stored.summaryPatterns)
			? stored.summaryPatterns
			: DEFAULT_PARSE_RULES.summaryPatterns,
		descriptionPatterns: Array.isArray(stored.descriptionPatterns)
			? stored.descriptionPatterns
			: DEFAULT_PARSE_RULES.descriptionPatterns,
		excludePatterns: Array.isArray(stored.excludePatterns)
			? stored.excludePatterns
			: DEFAULT_PARSE_RULES.excludePatterns,
		defaultDurationMin:
			typeof stored.defaultDurationMin === 'number'
				? stored.defaultDurationMin
				: DEFAULT_PARSE_RULES.defaultDurationMin
	};
}

export function saveParseRules(rules: ParseRules): void {
	setSetting('parse_rules', JSON.stringify(rules));
}

export function getCalendarConfig(): CalendarConfig {
	const stored = getJson('calendar_config') as Partial<CalendarConfig> | null;
	return {
		source: stored?.source === 'ics' || stored?.source === 'caldav' ? stored.source : 'none',
		icsUrl: stored?.icsUrl ?? '',
		caldavServer: stored?.caldavServer ?? 'https://caldav.icloud.com',
		caldavUsername: stored?.caldavUsername ?? '',
		caldavPassword: stored?.caldavPassword ?? '',
		caldavCalendar: stored?.caldavCalendar ?? '',
		providerName: stored?.providerName ?? 'Jane',
		syncTime: stored?.syncTime ?? '03:30'
	};
}

export function saveCalendarConfig(config: CalendarConfig): void {
	setSetting('calendar_config', JSON.stringify(config));
}

export function getAdditionalCalendars(): AdditionalCalendar[] {
	const stored = getJson('additional_calendars');
	if (!Array.isArray(stored)) return [];
	return stored
		.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
		.map((item) => ({
			id: String(item.id ?? ''),
			name: String(item.name ?? 'Calendar'),
			icsUrl: String(item.icsUrl ?? ''),
			createdAt: String(item.createdAt ?? ''),
			lastSyncAt: item.lastSyncAt ? String(item.lastSyncAt) : null,
			lastSyncStatus: (item.lastSyncStatus === 'ok' || item.lastSyncStatus === 'error'
				? item.lastSyncStatus
				: null) as AdditionalCalendar['lastSyncStatus'],
			lastSyncError: item.lastSyncError ? String(item.lastSyncError) : null
		}))
		.filter((item) => item.id && item.icsUrl);
}

export function saveAdditionalCalendars(calendars: AdditionalCalendar[]): void {
	setSetting('additional_calendars', JSON.stringify(calendars));
}

export function addAdditionalCalendar(name: string, icsUrl: string): AdditionalCalendar {
	const calendars = getAdditionalCalendars();
	const calendar: AdditionalCalendar = {
		id: randomUUID(),
		name: name.trim(),
		icsUrl: icsUrl.trim(),
		createdAt: new Date().toISOString(),
		lastSyncAt: null,
		lastSyncStatus: null,
		lastSyncError: null
	};
	calendars.push(calendar);
	saveAdditionalCalendars(calendars);
	return calendar;
}

export function removeAdditionalCalendar(id: string): AdditionalCalendar | null {
	const calendars = getAdditionalCalendars();
	const found = calendars.find((calendar) => calendar.id === id) ?? null;
	if (!found) return null;
	saveAdditionalCalendars(calendars.filter((calendar) => calendar.id !== id));
	return found;
}

export function updateAdditionalCalendarSync(
	id: string,
	status: 'ok' | 'error',
	error: string | null
): void {
	const calendars = getAdditionalCalendars();
	const calendar = calendars.find((item) => item.id === id);
	if (!calendar) return;
	calendar.lastSyncAt = new Date().toISOString();
	calendar.lastSyncStatus = status;
	calendar.lastSyncError = error;
	saveAdditionalCalendars(calendars);
}

export function getReminderSettings(): ReminderSettings {
	const stored = getJson('reminder_settings') as Partial<ReminderSettings> | null;
	const delayDays = Number(stored?.delayDays);
	const staleDays = Number(stored?.staleDays);
	const time = typeof stored?.time === 'string' && /^\d{1,2}:\d{2}$/.test(stored.time)
		? stored.time
		: '17:00';
	return {
		delayDays: Number.isFinite(delayDays) && delayDays >= 0 ? Math.min(30, delayDays) : 3,
		time,
		staleDays: Number.isFinite(staleDays) && staleDays >= 1 ? Math.min(365, staleDays) : 30
	};
}

export function saveReminderSettings(settings: ReminderSettings): void {
	setSetting('reminder_settings', JSON.stringify(settings));
}
