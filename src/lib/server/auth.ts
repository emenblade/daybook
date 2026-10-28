import { randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import type { User } from '#lib/types.ts';
import { normalizeUsername } from '#lib/username.ts';
import { db } from './db.ts';
import { hashPassword, hmac, verifyPassword } from './crypto.ts';

const COOKIE = 'daybook_session';
const MAX_AGE = 60 * 60 * 24 * 90;
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const DUMMY_HASH = hashPassword('daybook-dummy-password');

type UserRow = User & { password_hash: string };

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

function userById(id: number): User | null {
	const row = db
		.prepare(
			'SELECT id, name, color, username, must_change_credentials, session_version FROM users WHERE id = ?'
		)
		.get(id) as User | undefined;
	return row ?? null;
}

export function createSessionCookie(cookies: Cookies, user: User, secure = false): void {
	const exp = Date.now() + MAX_AGE * 1000;
	const payload = `${user.id}.${exp}.${user.session_version}`;
	const token = `${payload}.${hmac(payload, getSecret())}`;
	cookies.set(COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: MAX_AGE,
		secure
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}

export function getSessionUser(cookies: Cookies): User | null {
	const token = cookies.get(COOKIE);
	if (!token) return null;
	const [uid, exp, version, sig] = token.split('.');
	if (!uid || !exp || !version || !sig) return null;
	if (Number(exp) < Date.now()) return null;
	if (hmac(`${uid}.${exp}.${version}`, getSecret()) !== sig) return null;
	const user = userById(Number(uid));
	if (!user || user.session_version !== Number(version)) return null;
	return user;
}

/** Returns the user only when both username and password are valid. */
export function authenticate(username: string, password: string): User | null {
	const normalized = normalizeUsername(username);
	const row = db
		.prepare(
			'SELECT id, name, color, username, password_hash, must_change_credentials, session_version FROM users WHERE username = ?'
		)
		.get(normalized) as UserRow | undefined;
	const ok = verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
	if (!row || !ok) return null;
	const { password_hash: _passwordHash, ...user } = row;
	return user;
}

export function usernameTaken(username: string, excludeId?: number): boolean {
	const row = db
		.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
		.get(normalizeUsername(username), excludeId ?? -1) as { id: number } | undefined;
	return Boolean(row);
}

export function setUserCredentials(id: number, username: string, password: string): User {
	const current = db
		.prepare('SELECT session_version FROM users WHERE id = ?')
		.get(id) as { session_version: number } | undefined;
	if (!current) throw new Error('User not found.');
	const nextVersion = current.session_version + 1;
	db.prepare(
		'UPDATE users SET username = ?, password_hash = ?, must_change_credentials = 0, session_version = ? WHERE id = ?'
	).run(normalizeUsername(username), hashPassword(password), nextVersion, id);
	const user = userById(id);
	if (!user) throw new Error('User not found after update.');
	return user;
}

export function loginLockSeconds(key: string): number {
	const now = Date.now();
	const row = db
		.prepare('SELECT first_at, locked_until FROM login_attempts WHERE key = ?')
		.get(key) as { first_at: number; locked_until: number | null } | undefined;
	if (!row) return 0;
	if (row.locked_until && row.locked_until > now) {
		return Math.ceil((row.locked_until - now) / 1000);
	}
	if (now - row.first_at > ATTEMPT_WINDOW_MS) {
		db.prepare('DELETE FROM login_attempts WHERE key = ?').run(key);
	}
	return 0;
}

export function recordLoginFailure(key: string): void {
	const now = Date.now();
	const row = db
		.prepare('SELECT attempts, first_at FROM login_attempts WHERE key = ?')
		.get(key) as { attempts: number; first_at: number } | undefined;
	if (!row || now - row.first_at > ATTEMPT_WINDOW_MS) {
		db.prepare(
			`INSERT INTO login_attempts (key, attempts, first_at, last_at, locked_until)
			 VALUES (?, 1, ?, ?, NULL)
			 ON CONFLICT(key) DO UPDATE SET
				attempts = 1, first_at = excluded.first_at, last_at = excluded.last_at, locked_until = NULL`
		).run(key, now, now);
		return;
	}
	const attempts = row.attempts + 1;
	const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCK_MS : null;
	db.prepare(
		'UPDATE login_attempts SET attempts = ?, last_at = ?, locked_until = COALESCE(?, locked_until) WHERE key = ?'
	).run(attempts, now, lockedUntil, key);
}

export function clearLoginFailures(key: string): void {
	db.prepare('DELETE FROM login_attempts WHERE key = ?').run(key);
}
