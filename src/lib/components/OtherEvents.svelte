<script lang="ts">
	import { fmtTsTime, fmtTsDate } from '#lib/dates.ts';
	import type { EventCategory, OtherEvent } from '#lib/types.ts';

	let {
		events,
		showDate = false,
		title = 'Also on the calendar'
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
	const styles: Partial<Record<EventCategory, string>> = {
		break: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
		work: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
		personal: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
		vacation:
			'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
		other: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
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
						<span class="pill {styles[event.category]}">{labels[event.category]}</span>
					{/if}
					{#if event.location}
						<span class="w-full text-[11px] text-slate-400 dark:text-slate-500"
							>{event.location}</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
