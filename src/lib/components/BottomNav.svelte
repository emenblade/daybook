<script lang="ts">
	import { page } from '$app/state';

	let { attention = 0 }: { attention?: number } = $props();

	const items = [
		{ href: '/', label: 'Overview', match: (p: string) => p === '/' },
		{ href: '/calendar', label: 'Calendar', match: (p: string) => p.startsWith('/calendar') || p.startsWith('/day/') },
		{ href: '/clients', label: 'Clients', match: (p: string) => p.startsWith('/clients') },
		{ href: '/hours', label: 'Hours', match: (p: string) => p.startsWith('/hours') },
		{ href: '/kiosk', label: 'Desk', match: (p: string) => p.startsWith('/kiosk') }
	];
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
>
	<div class="mx-auto flex max-w-xl">
		{#each items as item (item.href)}
			{@const active = item.match(page.url.pathname)}
			<a
				href={item.href}
				class="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold {active
					? 'text-slate-900 dark:text-white'
					: 'text-slate-400 dark:text-slate-500'}"
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
					{#if item.label === 'Overview'}
						<path d="m3 10.5 9-7.5 9 7.5" />
						<path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
					{:else if item.label === 'Calendar'}
						<rect x="3" y="4.5" width="18" height="16" rx="2.5" />
						<path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
						<path d="M8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M8.5 17h.01M12 17h.01M15.5 17h.01" />
					{:else if item.label === 'Clients'}
						<circle cx="9" cy="8" r="3.5" />
						<path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
						<path d="M16 5a3.5 3.5 0 0 1 0 6.6M18.5 20a6.5 6.5 0 0 0-3.5-5.8" />
					{:else if item.label === 'Hours'}
						<circle cx="12" cy="12" r="8.5" />
						<path d="M12 7.5V12l3 2" />
					{:else}
						<rect x="2.5" y="4" width="19" height="13" rx="2" />
						<path d="M9 21h6M12 17v4" />
					{/if}
				</svg>
				<span>{item.label}</span>
				{#if item.label === 'Desk' && attention > 0}
					<span
						class="absolute right-[calc(50%-22px)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white"
						>{attention > 99 ? '99+' : attention}</span
					>
				{/if}
			</a>
		{/each}
	</div>
</nav>
