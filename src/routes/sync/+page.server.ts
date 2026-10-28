import { fail } from '@sveltejs/kit';
import type { CalendarConfig, ParseRules } from '#lib/types.ts';
import { sharedActions } from '#lib/server/actions.ts';
import { extractClient, validateRules } from '#lib/server/parse.ts';
import { listRecentEvents, listSyncRuns } from '#lib/server/repo.ts';
import {
	getCalendarConfig,
	getParseRules,
	getSetting,
	saveCalendarConfig,
	saveParseRules
} from '#lib/server/settings.ts';
import { syncCalendar } from '#lib/server/sync.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		config: getCalendarConfig(),
		rules: getParseRules(),
		runs: listSyncRuns(12),
		events: listRecentEvents(40),
		lastSyncAt: getSetting('last_sync_at'),
		lastSyncStatus: getSetting('last_sync_status'),
		lastSyncError: getSetting('last_sync_error'),
		trackingStart: getSetting('tracking_start_date')
	};
};

export const actions: Actions = {
	...sharedActions,

	saveSource: async ({ request }) => {
		const form = await request.formData();
		const source = String(form.get('source') ?? 'none');
		if (!['none', 'ics', 'caldav'].includes(source)) {
			return fail(400, { sourceError: 'Choose a valid calendar source.' });
		}
		const syncTime = String(form.get('syncTime') ?? '03:30');
		if (!/^\d{1,2}:\d{2}$/.test(syncTime)) {
			return fail(400, { sourceError: 'Daily sync time must look like 03:30.' });
		}

		const config: CalendarConfig = {
			source: source as CalendarConfig['source'],
			icsUrl: String(form.get('icsUrl') ?? '').trim(),
			caldavServer:
				String(form.get('caldavServer') ?? '').trim() || 'https://caldav.icloud.com',
			caldavUsername: String(form.get('caldavUsername') ?? '').trim(),
			caldavPassword: String(form.get('caldavPassword') ?? ''),
			caldavCalendar: String(form.get('caldavCalendar') ?? '').trim(),
			syncTime
		};

		if (config.source === 'ics' && !config.icsUrl) {
			return fail(400, { sourceError: 'Paste the ICS feed URL for the calendar.' });
		}
		if (config.source === 'caldav' && (!config.caldavUsername || !config.caldavPassword)) {
			return fail(400, { sourceError: 'CalDAV needs the Apple ID and an app-specific password.' });
		}

		saveCalendarConfig(config);
		return { sourceSaved: true as const };
	},

	saveRules: async ({ request }) => {
		const form = await request.formData();
		const raw = String(form.get('rules') ?? '');
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return fail(400, { rulesError: 'Rules must be valid JSON.' });
		}
		const result = validateRules(parsed);
		if (!result.ok) return fail(400, { rulesError: result.error });
		saveParseRules(result.rules as ParseRules);
		return { rulesSaved: true as const };
	},

	testParse: async ({ request }) => {
		const form = await request.formData();
		const summary = String(form.get('summary') ?? '');
		const description = String(form.get('description') ?? '');
		const result = extractClient(summary, description, getParseRules());
		return { test: result };
	},

	uploadIcs: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { uploadError: 'Choose an .ics file first.' });
		}
		if (file.size > 10 * 1024 * 1024) {
			return fail(400, { uploadError: 'That file is larger than 10 MB.' });
		}
		try {
			const result = await syncCalendar({
				source: 'upload',
				icsText: await file.text(),
				fileName: file.name
			});
			return { uploadMessage: result.message };
		} catch (error) {
			return fail(400, {
				uploadError: error instanceof Error ? error.message : String(error)
			});
		}
	}
};
