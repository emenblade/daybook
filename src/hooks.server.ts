import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { getSessionUser } from '#lib/server/auth.ts';
import { startScheduler } from '#lib/server/scheduler.ts';

startScheduler();

const PUBLIC_PREFIXES = ['/icons/'];

function isPublic(pathname: string): boolean {
	return (
		pathname === '/login' ||
		pathname === '/manifest.webmanifest' ||
		pathname === '/sw.js' ||
		pathname === '/favicon.ico' ||
		PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = getSessionUser(event.cookies);
	const path = event.url.pathname;

	if (!event.locals.user && !isPublic(path)) {
		const next = encodeURIComponent(path + event.url.search);
		throw redirect(303, `/login?next=${next}`);
	}

	if (
		event.locals.user?.must_change_credentials &&
		path !== '/setup' &&
		path !== '/logout'
	) {
		throw redirect(303, '/setup');
	}

	if (event.locals.user && !event.locals.user.must_change_credentials && path === '/setup') {
		throw redirect(303, '/');
	}

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	response.headers.set(
		'Content-Security-Policy',
		"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws: wss:; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
	);
	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
	if ((response.headers.get('content-type') ?? '').startsWith('text/html')) {
		response.headers.set('Cache-Control', 'no-store');
	}
	return response;
};
