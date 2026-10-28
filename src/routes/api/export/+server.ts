import { error } from '@sveltejs/kit';
import { fmtTsTime, tsToDate } from '#lib/dates.ts';
import { participantNames } from '#lib/format.ts';
import { appointmentsExport } from '#lib/server/repo.ts';
import type { RequestHandler } from './$types';

function csvEscape(value: unknown): string {
	if (value === null || value === undefined) return '';
	const text = String(value);
	return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const from = url.searchParams.get('from') || new Date('2000-01-01T00:00:00Z').toISOString();
	const to = url.searchParams.get('to') || new Date('2100-01-01T00:00:00Z').toISOString();
	const rows = appointmentsExport(from, to);

	const header = [
		'date',
		'time',
		'clients',
		'session_type',
		'service',
		'duration_min',
		'hours',
		'status',
		'confirmed_at',
		'location',
		'modality',
		'provider'
	];
	const lines = rows.map((appointment) =>
		[
			tsToDate(appointment.start_ts),
			fmtTsTime(appointment.start_ts),
			participantNames(appointment.participants),
			appointment.session_type,
			appointment.service,
			appointment.duration_min,
			(appointment.duration_min / 60).toFixed(2),
			appointment.status,
			appointment.confirmed_at ?? '',
			appointment.location ?? '',
			appointment.modality,
			appointment.provider ?? ''
		]
			.map(csvEscape)
			.join(',')
	);

	const csv = '\uFEFF' + [header.join(','), ...lines].join('\n');
	const stamp = new Date().toISOString().slice(0, 10);
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="daybook-appointments-${stamp}.csv"`
		}
	});
};
