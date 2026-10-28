<script lang="ts">
	import type { ClientStatus } from '#lib/types.ts';

	let { status }: { status: ClientStatus } = $props();

	const config = $derived(
		{
			active: {
				label: 'Active',
				cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
			},
			follow_up: {
				label: 'Follow up',
				cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
			},
			discharged: {
				label: 'Discharged',
				cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
			}
		}[status]
	);
</script>

<span class="pill {config.cls}">{config.label}</span>
