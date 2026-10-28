import { countNeedsAttention } from '#lib/server/repo.ts';
import { getReminderSettings } from '#lib/server/settings.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		needsAttention: locals.user ? countNeedsAttention(getReminderSettings().delayDays) : 0
	};
};
