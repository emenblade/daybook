import { addDays, parseISO, todayISO } from '#lib/dates.ts';
import type { CalendarConfig, EventKind, SessionStatus, SessionType } from '#lib/types.ts';
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
import {
	getAdditionalCalendars,
	getCalendarConfig,
	getParseRules,
	getSetting,
	setSetting,
	updateAdditionalCalendarSync
} from './settings.ts';
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

interface SyncJob {
	key: string;
	label: string;
	kind: 'ics' | 'caldav' | 'upload';
	icsUrl?: string;
	caldav?: CalendarConfig;
	uidPrefix: string;
	groupPrefix: string;
	extraId?: string;
	isUpload: boolean;
	fileName?: string;
}

interface JobResult extends SyncResult {
	removed: number;
}

let syncing = false;

export function isSyncing(): boolean {
	return syncing;
}

function blankService(summary: string): string | null {
	const match = summary.trim().match(/^\((.*)\)$/);
	return match ? match[1].trim() : null;
}

function primaryJob(config: CalendarConfig): SyncJob | null {
	if (config.source === 'none') return null;
	if (config.source === 'ics' && !config.icsUrl.trim()) {
		throw new Error('No ICS feed URL is configured for the main calendar.');
	}
	if (config.source === 'caldav' && (!config.caldavUsername || !config.caldavPassword)) {
		throw new Error('CalDAV credentials are missing for the main calendar.');
	}
	return {
		key: config.source,
		label: config.providerName || 'Main calendar',
		kind: config.source,
		icsUrl: config.icsUrl,
		caldav: config,
		uidPrefix: '',
		groupPrefix: '',
		isUpload: false
	};
}

function additionalJobs(): SyncJob[] {
	return getAdditionalCalendars().map((calendar) => {
		const key = `extra:${calendar.id}`;
		return {
			key,
			label: calendar.name,
			kind: 'ics',
			icsUrl: calendar.icsUrl,
			uidPrefix: `${key}:`,
			groupPrefix: `${key}:`,
			extraId: calendar.id,
			isUpload: false
		};
	});
}

async function syncJob(
	job: SyncJob,
	opts: { icsText?: string; fileName?: string }
): Promise<JobResult> {
	const today = todayISO();
	const fromDate = addDays(today, -HISTORY_DAYS);
	const toDate = addDays(today, FUTURE_DAYS);
	const fromTs = parseISO(fromDate).toISOString();
	const toTs = parseISO(addDays(toDate, 1)).toISOString();
	const runId = repo.startSyncRun(job.key);

	try {
		let rawEvents: RawCalendarEvent[];
		if (job.kind === 'upload') {
			if (!opts.icsText) throw new Error('No calendar data was uploaded.');
			rawEvents = parseICS(opts.icsText, opts.fileName ?? 'Upload');
		} else if (job.kind === 'ics') {
			if (!job.icsUrl) throw new Error('No ICS feed URL is configured.');
			rawEvents = parseICS(await fetchIcsFeed(job.icsUrl), job.label);
		} else {
			if (!job.caldav) throw new Error('CalDAV configuration is missing.');
			rawEvents = await fetchCalDavEvents(job.caldav, fromTs, toTs);
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

			const storedUid = `${job.uidPrefix}${raw.uid}`;
			seen.add(storedUid);
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
					groupKey = `${job.groupPrefix}grp:${startIso}|${endIso}|${normalizeService(service)}`;
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
							? `${job.groupPrefix}evt:${raw.uid}`
							: `${job.groupPrefix}grp:${startIso}|${endIso}|${normalizeService(service)}`;
				} else {
					kind = 'other';
					category = parsed.excluded ? 'break' : classifyNonClient(summary);
					notClient++;
				}
			}

			repo.upsertCalendarEvent({
				uid: storedUid,
				source: job.key,
				calendarName: job.isUpload ? raw.calendarName : job.label,
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
				status = 'completed';
				confirmedSource = 'import';
			} else {
				status = 'scheduled';
			}

			const location = raw.location?.trim() || null;
			const provider = job.isUpload ? (job.fileName ?? 'Upload') : job.label;
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
			const reconcile = !job.isUpload && appointment.status === 'scheduled';
			repo.setAppointmentParticipants(appointment.id, [...participants], reconcile);
		}

		let removed = 0;
		if (!job.isUpload) {
			const removalFrom = parseISO(addDays(today, -14)).toISOString();
			removed = repo.markMissingEvents(job.key, removalFrom, toTs, seen);
		}

		const bits = [`Read ${eventsSeen} events`];
		if (created) bits.push(`${created} new appointment${created === 1 ? '' : 's'}`);
		if (updated) bits.push(`${updated} updated`);
		if (notClient) bits.push(`${notClient} non-client`);
		if (duplicates) bits.push(`${duplicates} placeholder${duplicates === 1 ? '' : 's'}`);
		if (removed) bits.push(`${removed} removed`);
		const message = bits.join(' · ');

		repo.finishSyncRun(runId, true, message, eventsSeen, created, updated);
		return {
			ok: true,
			source: job.key,
			eventsSeen,
			appointmentsCreated: created,
			appointmentsUpdated: updated,
			notClient,
			duplicates,
			eventsRemoved: removed,
			appointmentsCanceled: 0,
			message,
			removed
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		repo.finishSyncRun(runId, false, message, 0, 0, 0);
		throw error;
	}
}

export async function syncCalendar(opts: {
	source: 'auto' | 'manual' | 'upload';
	icsText?: string;
	fileName?: string;
}): Promise<SyncResult> {
	if (syncing) throw new Error('A calendar sync is already running.');
	syncing = true;

	try {
		if (opts.source === 'upload') {
			const job: SyncJob = {
				key: 'upload',
				label: opts.fileName ?? 'Upload',
				kind: 'upload',
				uidPrefix: '',
				groupPrefix: '',
				isUpload: true,
				fileName: opts.fileName
			};
			const result = await syncJob(job, opts);
			finishGlobalSync([result], [], false);
			return result;
		}

		const config = getCalendarConfig();
		const jobs: SyncJob[] = [];
		const primary = primaryJob(config);
		if (primary) jobs.push(primary);
		jobs.push(...additionalJobs());
		if (jobs.length === 0) throw new Error('No calendar source is configured yet.');

		const results: JobResult[] = [];
		const errors: string[] = [];
		for (const job of jobs) {
			try {
				const result = await syncJob(job, opts);
				results.push(result);
				if (job.extraId) updateAdditionalCalendarSync(job.extraId, 'ok', null);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(`${job.label}: ${message}`);
				if (job.extraId) updateAdditionalCalendarSync(job.extraId, 'error', message);
			}
		}

		const today = todayISO();
		const removalFrom = parseISO(addDays(today, -14)).toISOString();
		const toTs = parseISO(addDays(addDays(today, FUTURE_DAYS), 1)).toISOString();
		const canceled = results.length ? repo.cancelOrphanedAppointments(removalFrom, toTs) : 0;
		const totals = results.reduce(
			(acc, result) => ({
				eventsSeen: acc.eventsSeen + result.eventsSeen,
				appointmentsCreated: acc.appointmentsCreated + result.appointmentsCreated,
				appointmentsUpdated: acc.appointmentsUpdated + result.appointmentsUpdated,
				notClient: acc.notClient + result.notClient,
				duplicates: acc.duplicates + result.duplicates,
				eventsRemoved: acc.eventsRemoved + result.eventsRemoved
			}),
			{
				eventsSeen: 0,
				appointmentsCreated: 0,
				appointmentsUpdated: 0,
				notClient: 0,
				duplicates: 0,
				eventsRemoved: 0
			}
		);
		const bits = [
			`Read ${totals.eventsSeen} events from ${results.length} calendar${results.length === 1 ? '' : 's'}`
		];
		if (totals.appointmentsCreated)
			bits.push(`${totals.appointmentsCreated} new appointment${totals.appointmentsCreated === 1 ? '' : 's'}`);
		if (totals.appointmentsUpdated) bits.push(`${totals.appointmentsUpdated} updated`);
		if (totals.notClient) bits.push(`${totals.notClient} non-client`);
		if (totals.duplicates)
			bits.push(`${totals.duplicates} placeholder${totals.duplicates === 1 ? '' : 's'}`);
		if (totals.eventsRemoved) bits.push(`${totals.eventsRemoved} removed`);
		if (canceled) bits.push(`${canceled} canceled`);
		if (errors.length) bits.push(`${errors.length} source${errors.length === 1 ? '' : 's'} failed`);
		const message = bits.join(' · ');

		finishGlobalSync(results, errors, true);
		if (errors.length && results.length === 0) throw new Error(errors.join(' · '));
		return {
			ok: errors.length === 0,
			source: jobs.length > 1 ? 'multi' : jobs[0].key,
			eventsSeen: totals.eventsSeen,
			appointmentsCreated: totals.appointmentsCreated,
			appointmentsUpdated: totals.appointmentsUpdated,
			notClient: totals.notClient,
			duplicates: totals.duplicates,
			eventsRemoved: totals.eventsRemoved,
			appointmentsCanceled: canceled,
			message
		};
	} finally {
		syncing = false;
	}
}

function finishGlobalSync(results: JobResult[], errors: string[], daily: boolean): void {
	const now = new Date().toISOString();
	setSetting('last_sync_at', now);
	setSetting('last_sync_status', errors.length ? 'error' : 'ok');
	setSetting('last_sync_error', errors.join(' · '));
	setSetting(
		'last_sync_source',
		results.length > 1 ? 'multi' : results[0]?.source ?? 'none'
	);
	if (daily) setSetting('last_daily_sync_date', todayISO());
}
