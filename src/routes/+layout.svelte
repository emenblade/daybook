<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import SyncButton from '#lib/components/SyncButton.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const isKiosk = $derived(page.url.pathname.startsWith('/kiosk'));
	const isSetup = $derived(page.url.pathname === '/setup');
	const initial = $derived(data.user?.name?.trim().charAt(0).toUpperCase() ?? '?');

	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js').catch(() => {});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Daybook</title>
</svelte:head>

{#if data.user}
	{#if isKiosk || isSetup}
		{@render children()}
	{:else}
		<div class="min-h-dvh bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
			<header
				class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"
			>
				<div class="mx-auto flex max-w-xl items-center justify-between px-4 py-2.5">
					<a href="/" class="flex items-center gap-2 font-bold tracking-tight">
						<Logo class="h-6 w-6 text-teal-600 dark:text-teal-400" />
						Daybook
					</a>
					<div class="flex items-center gap-1">
						<SyncButton />
						<a
							href="/settings"
							class="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
							aria-label="Settings"
						>
							<svg
								class="h-5 w-5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="3" />
								<path
									d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"
								/>
							</svg>
						</a>
						<form method="POST" action="/logout">
							<button
								type="submit"
								class="flex items-center gap-1.5 rounded-full border border-slate-200 py-1 pl-1 pr-2.5 text-xs font-semibold text-slate-600 transition active:scale-95 dark:border-slate-700 dark:text-slate-300"
								title="Switch profile"
							>
								<span
									class="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white"
									>{initial}</span
								>
								Switch
							</button>
						</form>
					</div>
				</div>
			</header>
			<main class="mx-auto max-w-xl px-4 pb-28 pt-4">
				{@render children()}
			</main>
			<BottomNav attention={data.needsAttention} />
		</div>
	{/if}
{:else}
	{@render children()}
{/if}
