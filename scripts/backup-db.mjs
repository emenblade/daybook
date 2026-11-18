#!/usr/bin/env node
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3-multiple-ciphers';

const MAGIC = Buffer.from('DAYBOOK-BACKUP-1');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const KDF = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const [input, output] = process.argv.slice(2);
const passphrase = process.env.DAYBOOK_BACKUP_PASSPHRASE ?? '';
const keyValue =
	process.env.DAYBOOK_DB_KEY?.trim() ||
	(process.env.DAYBOOK_DB_KEY_FILE && existsSync(process.env.DAYBOOK_DB_KEY_FILE)
		? readFileSync(process.env.DAYBOOK_DB_KEY_FILE, 'utf8').trim()
		: '');

if (!input || !output) {
	console.error(
		'Usage: DAYBOOK_DB_KEY=... DAYBOOK_BACKUP_PASSPHRASE="..." node scripts/backup-db.mjs /data/daybook.db /backups/daybook.db.enc'
	);
	process.exit(1);
}
if (passphrase.length < 12) {
	console.error('Set DAYBOOK_BACKUP_PASSPHRASE to at least 12 characters.');
	process.exit(1);
}
if (!/^[0-9a-fA-F]{64}$/.test(keyValue)) {
	console.error('Set DAYBOOK_DB_KEY or DAYBOOK_DB_KEY_FILE to the 64-hex database key.');
	process.exit(1);
}

const key = Buffer.from(keyValue, 'hex');
const db = new Database(input);
try {
	db.key(key);
	db.pragma('wal_checkpoint(TRUNCATE)');
	const plaintext = Buffer.from(db.serialize());
	const salt = randomBytes(SALT_LEN);
	const iv = randomBytes(IV_LEN);
	const cipher = createCipheriv('aes-256-gcm', scryptSync(passphrase, salt, KEY_LEN, KDF), iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const payload = Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ciphertext]);
	mkdirSync(dirname(output), { recursive: true });
	const temp = `${output}.tmp`;
	writeFileSync(temp, payload, { mode: 0o600 });
	renameSync(temp, output);
	console.log(`Wrote ${output} (${plaintext.length} bytes).`);
} finally {
	db.close();
}
