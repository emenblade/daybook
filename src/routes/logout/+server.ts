import { redirect } from '@sveltejs/kit';
import { clearSessionCookie } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	clearSessionCookie(cookies);
	throw redirect(303, '/login');
};
