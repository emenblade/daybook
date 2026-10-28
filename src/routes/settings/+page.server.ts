import { DATABASE_PATH } from '$app/env/private';
import { fail, type Actions } from '@sveltejs/kit';
import {
	authenticate,
	createSessionCookie,
	setUserCredentials,
	usernameTaken
} from '#lib/server/auth.ts';
import { isValidUsername } from '#lib/username.ts';
import {
	getPrimaryUser,
	hasDemoData,
	removeDemoData,
	updateUserName
} from '#lib/server/repo.ts';
import {
	getCalendarConfig,
	getReminderSettings,
	getSetting,
	saveReminderSettings
} from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const calendar = getCalendarConfig();
	return {
		user: getPrimaryUser(),
		reminder: getReminderSettings(),
		calendarSource: calendar.source,
		calendarProvider: calendar.providerName,
		calendarSyncTime: calendar.syncTime,
		lastSyncAt: getSetting('last_sync_at'),
		lastSyncStatus: getSetting('last_sync_status'),
		dbPath: DATABASE_PATH || 'data/daybook.db',
		hasDemo: hasDemoData()
	};
};

export const actions: Actions = {
	saveName: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { nameError: 'Not signed in.' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { nameError: 'Name cannot be empty.' });
		updateUserName(locals.user.id, name);
		return { nameSaved: true as const };
	},

	changeCredentials: async ({ request, locals, cookies, url }) => {
		if (!locals.user) return fail(401, { credentialsError: 'Not signed in.' });
		const form = await request.formData();
		const current = String(form.get('current_password') ?? '');
		const username = String(form.get('username') ?? '').trim();
		const next = String(form.get('new_password') ?? '');
		const confirm = String(form.get('confirm_password') ?? '');
		if (!authenticate(locals.user.username, current)) {
			return fail(400, { credentialsError: 'Current password is wrong.' });
		}
		if (!isValidUsername(username)) {
			return fail(400, {
				credentialsError: 'Username must be 3–32 characters: letters, numbers, dots, dashes, underscores.'
			});
		}
		if (usernameTaken(username, locals.user.id)) {
			return fail(400, { credentialsError: 'That username is already taken.' });
		}
		if (next.length < 12 || next.length > 200) {
			return fail(400, { credentialsError: 'Password must be 12–200 characters.' });
		}
		if (next !== confirm) {
			return fail(400, { credentialsError: 'New passwords do not match.' });
		}
		const user = setUserCredentials(locals.user.id, username, next);
		createSessionCookie(cookies, user, url.protocol === 'https:');
		return { credentialsSaved: true as const };
	},

	saveReminders: async ({ request }) => {
		const form = await request.formData();
		const delayDays = Number(form.get('delayDays'));
		const staleDays = Number(form.get('staleDays'));
		const time = String(form.get('time') ?? '17:00');
		if (!Number.isFinite(delayDays) || delayDays < 0 || delayDays > 30) {
			return fail(400, { reminderError: 'Note reminder delay must be 0–30 days.' });
		}
		if (!Number.isFinite(staleDays) || staleDays < 1 || staleDays > 365) {
			return fail(400, { reminderError: 'Follow-up threshold must be 1–365 days.' });
		}
		if (!/^\d{1,2}:\d{2}$/.test(time)) {
			return fail(400, { reminderError: 'Reminder time must look like 17:00.' });
		}
		saveReminderSettings({
			delayDays: Math.round(delayDays),
			time,
			staleDays: Math.round(staleDays)
		});
		return { reminderSaved: true as const };
	},

	removeDemo: async () => {
		removeDemoData();
		return { demoRemoved: true as const };
	}
};
