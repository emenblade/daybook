import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const MAGIC = Buffer.from('DAYBOOK-BACKUP-1');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const KDF = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(passphrase: string, salt: Buffer): Buffer {
	return scryptSync(passphrase, salt, KEY_LEN, KDF);
}

export function encryptBackup(data: Buffer, passphrase: string): Buffer {
	const salt = randomBytes(SALT_LEN);
	const iv = randomBytes(IV_LEN);
	const key = deriveKey(passphrase, salt);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([MAGIC, salt, iv, tag, ciphertext]);
}

export function decryptBackup(payload: Buffer, passphrase: string): Buffer {
	if (payload.length < MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN) {
		throw new Error('Backup file is too short.');
	}
	if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
		throw new Error('Not a Daybook encrypted backup.');
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
		const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
		decipher.setAuthTag(tag);
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	} catch {
		throw new Error('Wrong passphrase or corrupted backup.');
	}
}
