#!/usr/bin/env node
import { createDecipheriv, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const MAGIC = Buffer.from('DAYBOOK-BACKUP-1');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const KDF = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const [input, output] = process.argv.slice(2);
const passphrase = process.env.DAYBOOK_BACKUP_PASSPHRASE ?? '';

if (!input || !output) {
	console.error(
		'Usage: DAYBOOK_BACKUP_PASSPHRASE="your passphrase" node scripts/decrypt-backup.mjs backup.db.enc restored.db'
	);
	process.exit(1);
}
if (passphrase.length < 12) {
	console.error('Set DAYBOOK_BACKUP_PASSPHRASE to the passphrase used when the backup was created.');
	process.exit(1);
}

const payload = readFileSync(input);
if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
	console.error('Not a Daybook encrypted backup.');
	process.exit(1);
}

let offset = MAGIC.length;
const salt = payload.subarray(offset, offset + SALT_LEN);
offset += SALT_LEN;
const iv = payload.subarray(offset, offset + IV_LEN);
offset += IV_LEN;
const tag = payload.subarray(offset, offset + TAG_LEN);
offset += TAG_LEN;
const ciphertext = payload.subarray(offset);

try {
	const key = scryptSync(passphrase, salt, KEY_LEN, KDF);
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	if (plaintext.subarray(0, 16).toString('utf8') !== 'SQLite format 3\u0000') {
		console.error('Decrypted file is not a SQLite database.');
		process.exit(1);
	}
	writeFileSync(output, plaintext, { mode: 0o600 });
	console.log(`Wrote ${output}.`);
	console.log('Stop the container, back up the current /data/daybook.db, replace it with this file, then start the container.');
} catch {
	console.error('Wrong passphrase or corrupted backup.');
	process.exit(1);
}
