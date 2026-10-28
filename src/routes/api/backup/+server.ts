import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	db.pragma('wal_checkpoint(TRUNCATE)');
	const buffer = db.serialize();
	const filename = `daybook-backup-${new Date().toISOString().slice(0, 10)}.db`;

	return new Response(new Blob([new Uint8Array(buffer)]), {
		headers: {
			'content-type': 'application/vnd.sqlite3',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};
