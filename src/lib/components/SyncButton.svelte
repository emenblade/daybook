<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onDestroy } from 'svelte';

	let syncing = $state(false);
	let notice = $state<{ ok: boolean; text: string } | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function showNotice(ok: boolean, text: string): void {
		notice = { ok, text };
		clearTimeout(timer);
		timer = setTimeout(() => (notice = null), 5000);
	}

	onDestroy(() => clearTimeout(timer));

	async function sync(): Promise<void> {
		if (syncing) return;
		syncing = true;
		notice = null;
		try {
			const response = await fetch('/api/sync', { method: 'POST' });
			const body = (await response.json().catch(() => ({}))) as {
				error?: string;
				message?: string;
			};
			if (response.ok) {
				showNotice(true, body.message ?? 'Calendar synced.');
			} else {
				showNotice(false, body.error ?? 'Sync failed.');
			}
			await invalidateAll();
		} catch (cause) {
			showNotice(false, cause instanceof Error ? cause.message : String(cause));
		} finally {
			syncing = false;
		}
	}
</script>

<button
	type="button"
	onclick={sync}
	disabled={syncing}
	class="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
	aria-label="Sync calendar"
	title="Sync calendar"
>
	<svg
		class="h-5 w-5 {syncing ? 'animate-spin' : ''}"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M21 12a9 9 0 0 1-15.3 6.4M3 12a9 9 0 0 1 15.3-6.4" />
		<path d="M21 3v5h-5M3 21v-5h5" />
	</svg>
</button>

{#if notice}
	<div
		class="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl px-4 py-2 text-center text-sm font-semibold text-white shadow-lg {notice.ok
			? 'bg-emerald-600'
			: 'bg-rose-600'}"
		role="status"
	>
		{notice.text}
	</div>
{/if}
