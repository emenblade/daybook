import { error } from '@sveltejs/kit';
import { addDays, todayISO } from '#lib/dates.ts';
import { sharedActions } from '#lib/server/actions.ts';
import { appointmentsForDay, otherEventsForDay } from '#lib/server/repo.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const date = params.date === 'today' ? todayISO() : params.date;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw error(404, 'Invalid date');
	return {
		date,
		prev: addDays(date, -1),
		next: addDays(date, 1),
		today: todayISO(),
		appointments: appointmentsForDay(date),
		other: otherEventsForDay(date, ['work', 'personal', 'vacation', 'other'])
	};
};

export const actions = sharedActions;
