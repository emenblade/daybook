import {
	addDays,
	addMonths,
	currentMonth,
	lastNWeekStarts,
	monthLabel,
	monthRangeISO,
	parseISO,
	todayISO,
	weekLabel,
	weekStart
} from '#lib/dates.ts';
import { hoursByType, hoursForWeeks, hoursSummary } from '#lib/server/repo.ts';
import type { SessionType } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

const TYPE_ORDER: SessionType[] = ['individual', 'couples', 'family', 'group'];

export const load: PageServerLoad = async ({ url }) => {
	const monthParam = url.searchParams.get('m');
	const month =
		monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth();
	const { from, to } = monthRangeISO(month);
	const year = month.slice(0, 4);
	const today = todayISO();
	const week = weekStart(today);
	const weekFrom = parseISO(week).toISOString();
	const weekTo = parseISO(addDays(week, 7)).toISOString();
	const yearFrom = new Date(Number(year), 0, 1).toISOString();
	const yearTo = new Date(Number(year) + 1, 0, 1).toISOString();

	const summary = hoursSummary(from, to);
	const weekSummary = hoursSummary(weekFrom, weekTo);
	const yearSummary = hoursSummary(yearFrom, yearTo);
	const typeRows = TYPE_ORDER.map((type) => {
		const found = hoursByType(from, to).find((row) => row.type === type);
		return {
			type,
			minutes: found?.minutes ?? 0,
			count: found?.count ?? 0
		};
	});

	const months = Array.from({ length: 12 }, (_, index) => {
		const ym = `${year}-${String(index + 1).padStart(2, '0')}`;
		const range = monthRangeISO(ym);
		const hours = hoursSummary(range.from, range.to);
		return {
			month: ym,
			label: new Date(Number(year), index, 1).toLocaleString('en-CA', { month: 'long' }),
			hours: hours.totalMinutes,
			count: hours.completedCount,
			current: ym === month
		};
	});

	const weeks = lastNWeekStarts(8);
	const weekHours = hoursForWeeks(weeks);

	return {
		month,
		year,
		label: monthLabel(month),
		prev: addMonths(month, -1),
		next: addMonths(month, 1),
		summary,
		weekSummary,
		yearSummary,
		typeRows,
		months,
		weeks: weeks.map((start, index) => ({
			start,
			label: weekLabel(start),
			current: index === 0,
			hours: weekHours.get(start) ?? {
				totalMinutes: 0,
				completedCount: 0,
				noShowCount: 0,
				clientCount: 0
			}
		})),
		exportFrom: from,
		exportTo: to,
		yearFrom,
		yearTo
	};
};
