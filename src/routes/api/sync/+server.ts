import { json } from '@sveltejs/kit';
import { syncCalendar } from '#lib/server/sync.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	try {
		const result = await syncCalendar({ source: 'manual' });
		return json({ ok: true, message: result.message });
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 400 }
		);
	}
};
