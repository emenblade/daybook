<script lang="ts">
	import type { SessionStatus } from '#lib/types.ts';

	let { status, future = false }: { status: SessionStatus; future?: boolean } = $props();

	const config = $derived(
		status === 'scheduled' && future
			? {
					label: 'Upcoming',
					cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300'
				}
			: {
					scheduled: {
						label: 'To confirm',
						cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
					},
					completed: {
						label: 'Notes in Jane',
						cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
					},
					no_show: {
						label: 'No-show',
						cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
					},
					canceled: {
						label: 'Canceled',
						cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
					}
				}[status]
	);
</script>

<span class="pill {config.cls}">{config.label}</span>
