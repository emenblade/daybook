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
		label
	}: {
		clientId: number;
		action: TreatmentAction;
		name?: string;
		compact?: boolean;
		showName?: boolean;
		label?: string;
	} = $props();

	const text = $derived(showName ? `${name} · ${action.shortLabel}` : (label ?? action.label));
	const title = $derived(
		action.dueOn ? `${action.label} — due ${fmtDateSmart(action.dueOn)}` : action.label
	);
</script>

<form method="POST" action="?/setTreatmentPlan" use:enhance>
	<input type="hidden" name="id" value={clientId} />
	<input type="hidden" name="action" value={action.kind} />
	<button class="chip chip-violet {compact ? 'px-2 py-1 text-[10px]' : ''}" {title}>
		<span
			class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border-2 border-current"
		></span>
		{text}
	</button>
</form>
