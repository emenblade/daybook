import { DATABASE_PATH } from '$app/env/private';
import { fail, type Actions } from '@sveltejs/kit';
import { authenticate, setUserPin } from '#lib/server/auth.ts';
import {
	getPrimaryUser,
	hasDemoData,
	removeDemoData,
	updateUserName
} from '#lib/server/repo.ts';
import { getReminderSettings, saveReminderSettings } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		user: getPrimaryUser(),
		reminder: getReminderSettings(),
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

	changePin: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { pinError: 'Not signed in.' });
		const form = await request.formData();
		const current = String(form.get('current_pin') ?? '');
		const next = String(form.get('new_pin') ?? '');
		const confirm = String(form.get('confirm_pin') ?? '');
		if (!authenticate(locals.user.id, current)) {
			return fail(400, { pinError: 'Current PIN is wrong.' });
		}
		if (!/^\d{4,8}$/.test(next)) {
			return fail(400, { pinError: 'New PIN must be 4–8 digits.' });
		}
		if (next !== confirm) {
			return fail(400, { pinError: 'New PINs do not match.' });
		}
		setUserPin(locals.user.id, next);
		return { pinSaved: true as const };
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
