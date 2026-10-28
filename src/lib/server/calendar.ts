import ICAL from 'ical.js';
import { createDAVClient } from 'tsdav';
import type { CalendarConfig } from '#lib/types.ts';

export interface RawCalendarEvent {
	uid: string;
	summary: string;
	description: string;
	location: string | null;
	start: Date;
	end: Date;
	allDay: boolean;
	recurring: boolean;
	calendarName: string | null;
}

const MAX_EVENTS = 5000;

function calendarDisplayName(value: unknown): string | null {
	if (typeof value === 'string') return value;
	return null;
}

/** Parse an iCalendar document into flat VEVENT records (no recurrence expansion). */
export function parseICS(text: string, calendarName: string | null = null): RawCalendarEvent[] {
	const jcal = ICAL.parse(text);
	const root = new ICAL.Component(jcal);
	const components = root.getAllSubcomponents('vevent');
	const events: RawCalendarEvent[] = [];
	let synthetic = 0;

	for (const component of components) {
		const event = new ICAL.Event(component);
		const rawStatus = component.getFirstPropertyValue('status');
		if (typeof rawStatus === 'string' && rawStatus.toUpperCase() === 'CANCELLED') continue;

		const startDate = event.startDate;
		if (!startDate) continue;

		let start: Date;
		try {
			start = startDate.toJSDate();
		} catch {
			continue;
		}

		const allDay = Boolean(startDate.isDate);
		let end: Date;
		try {
			end = event.endDate?.toJSDate() ?? new Date(start.getTime() + 60 * 60000);
		} catch {
			end = new Date(start.getTime() + 60 * 60000);
		}
		if (!(end.getTime() > start.getTime())) {
			end = new Date(start.getTime() + 60 * 60000);
		}

		let uid = event.uid;
		if (!uid) {
			synthetic++;
			uid = `no-uid-${start.toISOString()}-${synthetic}`;
		}

		events.push({
			uid,
			summary: event.summary ?? '',
			description: event.description ?? '',
			location: event.location || null,
			start,
			end,
			allDay,
			recurring: event.isRecurring(),
			calendarName
		});

		if (events.length >= MAX_EVENTS) break;
	}

	return events;
}

export async function fetchIcsFeed(url: string): Promise<string> {
	const normalized = url.trim().replace(/^webcal:\/\//i, 'https://');
	if (!/^https?:\/\//i.test(normalized)) {
		throw new Error('ICS URL must start with https:// or webcal://');
	}

	const response = await fetch(normalized, {
		headers: {
			accept: 'text/calendar, text/plain, */*',
			'user-agent': 'Daybook/1.0'
		},
		redirect: 'follow',
		signal: AbortSignal.timeout(30_000)
	});

	if (!response.ok) {
		throw new Error(`Calendar feed returned HTTP ${response.status} ${response.statusText}`);
	}

	const text = await response.text();
	if (!/BEGIN:VCALENDAR/i.test(text)) {
		throw new Error('That URL did not return an iCalendar feed.');
	}
	return text;
}

export async function fetchCalDavEvents(
	config: CalendarConfig,
	fromIso: string,
	toIso: string
): Promise<RawCalendarEvent[]> {
	const serverUrl = config.caldavServer.trim() || 'https://caldav.icloud.com';
	if (!config.caldavUsername || !config.caldavPassword) {
		throw new Error('CalDAV username and app-specific password are required.');
	}

	const client = await createDAVClient({
		serverUrl,
		credentials: { username: config.caldavUsername, password: config.caldavPassword },
		authMethod: 'Basic',
		defaultAccountType: 'caldav'
	});

	const calendars = await client.fetchCalendars();
	if (!calendars.length) {
		throw new Error('No calendars were found for that account.');
	}

	let calendar = calendars[0];
	if (config.caldavCalendar.trim()) {
		const wanted = config.caldavCalendar.trim().toLowerCase();
		const match = calendars.find((candidate) => {
			const name = calendarDisplayName(candidate.displayName)?.toLowerCase();
			return name === wanted || candidate.url.toLowerCase().endsWith(wanted);
		});
		if (!match) {
			const available = calendars
				.map((candidate) => calendarDisplayName(candidate.displayName) ?? candidate.url)
				.join(', ');
			throw new Error(`Calendar "${config.caldavCalendar}" not found. Available: ${available}`);
		}
		calendar = match;
	}

	const objects = await client.fetchCalendarObjects({
		calendar,
		timeRange: { start: fromIso, end: toIso }
	});

	const calendarName = calendarDisplayName(calendar.displayName) ?? 'CalDAV';
	const events: RawCalendarEvent[] = [];
	for (const object of objects) {
		if (!object.data) continue;
		try {
			events.push(...parseICS(String(object.data), calendarName));
		} catch {
			// Skip malformed calendar objects; the sync summary reports the count.
		}
	}
	return events;
}
