<script lang="ts">
	import { fmtTsTime, fmtTsDate } from '#lib/dates.ts';
	import type { EventCategory, OtherEvent } from '#lib/types.ts';

	let {
		events,
		showDate = false,
		title = 'Other schedule'
	}: {
		events: OtherEvent[];
		showDate?: boolean;
		title?: string;
	} = $props();

	const labels: Partial<Record<EventCategory, string>> = {
		work: 'Work',
		personal: 'Personal',
		vacation: 'Vacation',
		other: 'Other',
		break: 'Break'
	};

	function cleanSummary(summary: string): string {
		return summary.replace(/^Break\s*-\s*/i, '').trim() || 'Break';
	}
</script>

{#if events.length > 0}
	<div>
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
		<ul class="mt-1 space-y-1">
			{#each events as event (event.id)}
				<li class="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500 dark:text-slate-400">
					<span class="font-semibold"
						>{fmtTsTime(event.start_ts)}–{fmtTsTime(event.end_ts)}</span
					>
					{#if showDate}<span>{fmtTsDate(event.start_ts)}</span>{/if}
					<span class="text-slate-700 dark:text-slate-300">{cleanSummary(event.summary)}</span>
					{#if labels[event.category]}
						<span
							class="rounded-full border border-slate-300 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-600 dark:text-slate-500"
							>{labels[event.category]}</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
