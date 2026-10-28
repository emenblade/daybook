import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string): string {
	const salt = randomBytes(16);
	const hash = scryptSync(password, salt, 64);
	return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [scheme, saltHex, hashHex] = stored.split(':');
	if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
	const salt = Buffer.from(saltHex, 'hex');
	const expected = Buffer.from(hashHex, 'hex');
	const actual = scryptSync(password, salt, expected.length);
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hmac(data: string, secret: string): string {
	return createHmac('sha256', secret).update(data).digest('hex');
}
