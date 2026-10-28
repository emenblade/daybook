import { randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import type { User } from '#lib/types.ts';
import { db } from './db.ts';
import { hashPin, hmac, verifyPin } from './crypto.ts';

const COOKIE = 'daybook_session';
const MAX_AGE = 60 * 60 * 24 * 90;

function getSecret(): string {
	const row = db
		.prepare("SELECT value FROM settings WHERE key = 'session_secret'")
		.get() as { value: string } | undefined;
	if (row) return row.value;
	const secret = randomBytes(32).toString('hex');
	db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('session_secret', ?)").run(secret);
	const created = db
		.prepare("SELECT value FROM settings WHERE key = 'session_secret'")
		.get() as { value: string };
	return created.value;
}

export function createSessionCookie(cookies: Cookies, userId: number, secure = false): void {
	const exp = Date.now() + MAX_AGE * 1000;
	const payload = `${userId}.${exp}`;
	const token = `${payload}.${hmac(payload, getSecret())}`;
	cookies.set(COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: MAX_AGE,
		// SvelteKit defaults this to true in production, which silently breaks
		// login over plain HTTP on a LAN address. Follow the request protocol.
		secure
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}

export function getSessionUser(cookies: Cookies): User | null {
	const token = cookies.get(COOKIE);
	if (!token) return null;
	const [uid, exp, sig] = token.split('.');
	if (!uid || !exp || !sig) return null;
	if (Number(exp) < Date.now()) return null;
	if (hmac(`${uid}.${exp}`, getSecret()) !== sig) return null;
	const row = db.prepare('SELECT id, name, color FROM users WHERE id = ?').get(Number(uid));
	return (row as User) ?? null;
}

export function authenticate(userId: number, pin: string): boolean {
	const row = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(userId) as
		| { pin_hash: string }
		| undefined;
	return row ? verifyPin(pin, row.pin_hash) : false;
}

export function setUserPin(userId: number, pin: string): void {
	db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), userId);
}
