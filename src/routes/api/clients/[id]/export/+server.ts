import { error } from '@sveltejs/kit';
import { appointmentsForClient, clientAudit, clientStats, getClient, logAudit } from '#lib/server/repo.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const id = Number(params.id);
	const client = getClient(id);
	if (!client) throw error(404, 'Client not found');

	const appointments = appointmentsForClient(id, 1000).map((appointment) => ({
		...appointment,
		participants: appointment.participants
			.filter((participant) => participant.id === id)
			.map((participant) => ({ id: participant.id, name: participant.name })),
		group_size: appointment.participants.length
	}));
	const payload = {
		exported_at: new Date().toISOString(),
		client,
		stats: clientStats(id),
		appointments,
		audit: clientAudit(id)
	};
	logAudit(locals.user.id, 'export_client', 'client', id, null);

	const stamp = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(payload, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="daybook-client-${id}-${stamp}.json"`,
			'cache-control': 'no-store'
		}
	});
};
