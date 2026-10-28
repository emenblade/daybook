import { addMonths, currentMonth, monthGrid, monthLabel, todayISO } from '#lib/dates.ts';
import { monthCells } from '#lib/server/repo.ts';
import { getReminderSettings } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const monthParam = url.searchParams.get('m');
	const month =
		monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth();
	const reminder = getReminderSettings();
	const cells = monthCells(month, reminder.delayDays);

	return {
		month,
		label: monthLabel(month),
		prev: addMonths(month, -1),
		next: addMonths(month, 1),
		grid: monthGrid(month),
		today: todayISO(),
		cells: Object.fromEntries(cells),
		delayDays: reminder.delayDays
	};
};
