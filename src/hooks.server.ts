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

	return resolve(event);
};
