<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtDateSmart } from '#lib/dates.ts';
	import type { TreatmentAction } from '#lib/treatment.ts';

	let {
		clientId,
		action,
		name = '',
		compact = false,
		showName = false,
		label,
		variant = 'chip'
	}: {
		clientId: number;
		action: TreatmentAction;
		name?: string;
		compact?: boolean;
		showName?: boolean;
		label?: string;
		variant?: 'chip' | 'desk';
	} = $props();

	const text = $derived(showName ? `${name} · ${action.shortLabel}` : (label ?? action.label));
	const title = $derived(
		action.dueOn ? `${action.label} — due ${fmtDateSmart(action.dueOn)}` : action.label
	);
	const buttonClass = $derived(
		variant === 'desk'
			? `flex items-center justify-center gap-2 rounded-xl border-2 border-violet-400 bg-violet-50 px-3 font-bold text-violet-900 transition active:scale-95 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-200 ${
					compact ? 'min-h-10 text-sm' : 'min-h-12 text-sm'
				}`
			: `chip chip-violet ${compact ? 'px-2 py-1 text-[10px]' : ''}`
	);
	const boxClass = $derived(
		variant === 'desk'
			? compact
				? 'h-4 w-4'
				: 'h-5 w-5'
			: 'h-3.5 w-3.5'
	);
</script>

<form method="POST" action="?/setTreatmentPlan" use:enhance>
	<input type="hidden" name="id" value={clientId} />
	<input type="hidden" name="action" value={action.kind} />
	<button class={buttonClass} {title}>
		<span
			class="flex {boxClass} shrink-0 items-center justify-center rounded border-2 border-current"
		></span>
		{text}
	</button>
</form>
