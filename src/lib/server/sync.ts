import { addDays, parseISO, todayISO } from '#lib/dates.ts';
import type { EventKind, SessionStatus, SessionType } from '#lib/types.ts';
import {
	fetchCalDavEvents,
	fetchIcsFeed,
	parseICS,
	type RawCalendarEvent
} from './calendar.ts';
import {
	classifyNonClient,
	extractClient,
	normalizeName,
	normalizeService,
	sessionTypeForService
} from './parse.ts';
import * as repo from './repo.ts';
import { getCalendarConfig, getParseRules, getSetting, setSetting } from './settings.ts';
import { modalityFor } from '#lib/session.ts';

const HISTORY_DAYS = 180;
const FUTURE_DAYS = 120;

export interface SyncResult {
	ok: boolean;
	source: string;
	eventsSeen: number;
	appointmentsCreated: number;
	appointmentsUpdated: number;
	notClient: number;
	duplicates: number;
	eventsRemoved: number;
	appointmentsCanceled: number;
	message: string;
}

let syncing = false;

export function isSyncing(): boolean {
	return syncing;
}

function blankService(summary: string): string | null {
	const match = summary.trim().match(/^\((.*)\)$/);
	return match ? match[1].trim() : null;
}

export async function syncCalendar(opts: {
	source: 'auto' | 'manual' | 'upload';
	icsText?: string;
	fileName?: string;
}): Promise<SyncResult> {
	if (syncing) throw new Error('A calendar sync is already running.');

	const config = getCalendarConfig();
	const isUpload = opts.source === 'upload';
	const effectiveSource = isUpload ? 'upload' : config.source;

	if (!isUpload) {
		if (config.source === 'none') throw new Error('No calendar source is configured yet.');
		if (config.source === 'ics' && !config.icsUrl.trim()) {
			throw new Error('No ICS feed URL is configured.');
		}
		if (config.source === 'caldav' && (!config.caldavUsername || !config.caldavPassword)) {
			throw new Error('CalDAV credentials are missing.');
		}
	}

	syncing = true;
	const runId = repo.startSyncRun(effectiveSource);

	try {
		const today = todayISO();
		const fromDate = addDays(today, -HISTORY_DAYS);
		const toDate = addDays(today, FUTURE_DAYS);
		const fromTs = parseISO(fromDate).toISOString();
		const toTs = parseISO(addDays(toDate, 1)).toISOString();

		let rawEvents: RawCalendarEvent[];
		if (isUpload) {
			if (!opts.icsText) throw new Error('No calendar data was uploaded.');
			rawEvents = parseICS(opts.icsText, opts.fileName ?? 'Upload');
		} else if (config.source === 'ics') {
			rawEvents = parseICS(await fetchIcsFeed(config.icsUrl), config.providerName || 'Jane');
		} else {
			rawEvents = await fetchCalDavEvents(config, fromTs, toTs);
		}

		const rules = getParseRules();
		let trackingStart = getSetting('tracking_start_date') ?? '';
		if (!trackingStart) {
			trackingStart = today;
			setSetting('tracking_start_date', trackingStart);
		}
		const trackingStartMs = parseISO(trackingStart).getTime();
		const nowMs = Date.now();

		const seen = new Set<string>();
		const groupParticipants = new Map<string, Set<number>>();
		let eventsSeen = 0;
		let created = 0;
		let updated = 0;
		let notClient = 0;
		let duplicates = 0;

		for (const raw of rawEvents) {
			const startIso = raw.start.toISOString();
			const endIso = raw.end.toISOString();
			if (startIso < fromTs || startIso >= toTs || raw.allDay || raw.end <= raw.start) continue;

			seen.add(raw.uid);
			eventsSeen++;
			const summary = raw.summary.trim();
			const duration = Math.max(
				5,
				Math.round((raw.end.getTime() - raw.start.getTime()) / 60000)
			);

			let kind: EventKind = 'other';
			let category: 'session' | 'break' | 'work' | 'personal' | 'vacation' | 'other' | 'duplicate' =
				'other';
			let service: string | null = null;
			let parsedClient: string | null = null;
			let groupKey: string | null = null;
			let sessionType: SessionType = 'individual';

			if (/^Break\b/i.test(summary)) {
				category = classifyNonClient(summary);
				kind = 'other';
			} else if (/^\(/.test(summary)) {
				service = blankService(summary);
				kind = 'duplicate';
				category = 'duplicate';
				duplicates++;
				if (service) {
					groupKey = `grp:${startIso}|${endIso}|${normalizeService(service)}`;
				}
			} else {
				const parsed = extractClient(summary, raw.description, rules);
				if (parsed.name) {
					kind = 'client';
					category = 'session';
					service = parsed.service ?? '';
					parsedClient = parsed.name;
					sessionType = sessionTypeForService(service);
					groupKey =
						sessionType === 'individual'
							? `evt:${raw.uid}`
							: `grp:${startIso}|${endIso}|${normalizeService(service)}`;
				} else {
					kind = 'other';
					category = parsed.excluded ? 'break' : classifyNonClient(summary);
					notClient++;
				}
			}

			repo.upsertCalendarEvent({
				uid: raw.uid,
				source: effectiveSource,
				calendarName: raw.calendarName,
				summary: raw.summary,
				description: raw.description,
				location: raw.location,
				startTs: startIso,
				endTs: endIso,
				allDay: raw.allDay,
				recurring: raw.recurring,
				eventKind: kind,
				category,
				service,
				parsedClient,
				groupKey
			});

			if (kind !== 'client' || !parsedClient || !groupKey) continue;

			const clientId = repo.findOrCreateClient(parsedClient, normalizeName(parsedClient));
			let participants = groupParticipants.get(groupKey);
			if (!participants) {
				participants = new Set();
				groupParticipants.set(groupKey, participants);
			}
			participants.add(clientId);

			const existing = repo.getAppointmentByGroupKey(groupKey);
			let status: SessionStatus;
			let confirmedSource: string | null = null;
			if (existing) {
				status = existing.status;
			} else if (
				raw.start.getTime() < trackingStartMs &&
				raw.start.getTime() < nowMs
			) {
				// First import: history is recorded as completed so it feeds client
				// history and hours without creating a backlog of fake reminders.
				status = 'completed';
				confirmedSource = 'import';
			} else {
				status = 'scheduled';
			}

			const location = raw.location?.trim() || null;
			const provider = isUpload
				? (opts.fileName ?? 'Upload')
				: config.providerName?.trim() || raw.calendarName?.trim() || effectiveSource;
			const result = repo.upsertAppointment({
				groupKey,
				startTs: startIso,
				endTs: endIso,
				durationMin: duration,
				title: service || parsedClient,
				service: service ?? '',
				sessionType,
				status,
				location,
				modality: modalityFor(service, location, raw.summary),
				provider,
				isDemo: false,
				confirmedSource
			});
			if (result.created) created++;
			else updated++;
		}

		for (const [groupKey, participants] of groupParticipants) {
			const appointment = repo.getAppointmentByGroupKey(groupKey);
			if (!appointment) continue;
			const reconcile = !isUpload && appointment.status === 'scheduled';
			repo.setAppointmentParticipants(appointment.id, [...participants], reconcile);
		}

		let removed = 0;
		let canceled = 0;
		if (!isUpload) {
			const removalFrom = parseISO(addDays(today, -14)).toISOString();
			removed = repo.markMissingEvents(effectiveSource, removalFrom, toTs, seen);
			canceled = repo.cancelOrphanedAppointments(removalFrom, toTs);
		}

		const bits = [`Read ${eventsSeen} events`];
		if (created) bits.push(`${created} new appointment${created === 1 ? '' : 's'}`);
		if (updated) bits.push(`${updated} updated`);
		if (notClient) bits.push(`${notClient} non-client`);
		if (duplicates) bits.push(`${duplicates} placeholder${duplicates === 1 ? '' : 's'}`);
		if (removed) bits.push(`${removed} removed`);
		if (canceled) bits.push(`${canceled} canceled`);
		const message = bits.join(' · ');

		repo.finishSyncRun(runId, true, message, eventsSeen, created, updated);
		setSetting('last_sync_at', new Date().toISOString());
		setSetting('last_sync_status', 'ok');
		setSetting('last_sync_error', '');
		setSetting('last_sync_source', effectiveSource);
		if (!isUpload) setSetting('last_daily_sync_date', today);

		return {
			ok: true,
			source: effectiveSource,
			eventsSeen,
			appointmentsCreated: created,
			appointmentsUpdated: updated,
			notClient,
			duplicates,
			eventsRemoved: removed,
			appointmentsCanceled: canceled,
			message
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		repo.finishSyncRun(runId, false, message, 0, 0, 0);
		setSetting('last_sync_status', 'error');
		setSetting('last_sync_error', message);
		setSetting('last_sync_source', effectiveSource);
		throw error;
	} finally {
		syncing = false;
	}
}
