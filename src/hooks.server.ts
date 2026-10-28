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

	if (!event.locals.user && !isPublic(event.url.pathname)) {
		const next = encodeURIComponent(event.url.pathname + event.url.search);
		throw redirect(303, `/login?next=${next}`);
	}

	return resolve(event);
};
