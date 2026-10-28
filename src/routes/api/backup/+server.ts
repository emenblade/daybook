import { json } from '@sveltejs/kit';
import { encryptBackup } from '#lib/server/backup.ts';
import { db } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const form = await request.formData();
	const passphrase = String(form.get('passphrase') ?? '');
	if (passphrase.length < 12 || passphrase.length > 200) {
		return json({ error: 'Backup passphrase must be 12–200 characters.' }, { status: 400 });
	}

	db.pragma('wal_checkpoint(TRUNCATE)');
	const buffer = Buffer.from(db.serialize());
	const encrypted = encryptBackup(buffer, passphrase);
	const filename = `daybook-backup-${new Date().toISOString().slice(0, 10)}.db.enc`;

	return new Response(new Blob([new Uint8Array(encrypted)]), {
		headers: {
			'content-type': 'application/octet-stream',
			'content-disposition': `attachment; filename="${filename}"`,
			'cache-control': 'no-store'
		}
	});
};
