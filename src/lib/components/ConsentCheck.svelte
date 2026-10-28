<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Participant } from '#lib/types.ts';

	let {
		participant,
		label = 'Consent form',
		compact = false,
		showName = false,
		variant = 'chip'
	}: {
		participant: Pick<Participant, 'id' | 'name' | 'consent_signed_at'>;
		label?: string;
		compact?: boolean;
		showName?: boolean;
		variant?: 'chip' | 'desk';
	} = $props();

	const text = $derived(
		showName ? (variant === 'desk' ? `${participant.name} · Consent` : participant.name) : label
	);
	const buttonClass = $derived(
		variant === 'desk'
			? `flex items-center justify-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 font-bold text-amber-900 transition active:scale-95 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200 ${
					compact ? 'min-h-10 text-sm' : 'min-h-12 text-sm'
				}`
			: `chip chip-amber ${compact ? 'px-2 py-1 text-[10px]' : ''}`
	);
	const boxClass = $derived(
		variant === 'desk'
			? compact
				? 'h-4 w-4'
				: 'h-5 w-5'
			: 'h-3.5 w-3.5'
	);
</script>

{#if !participant.consent_signed_at}
	<form method="POST" action="?/setClientConsent" use:enhance>
		<input type="hidden" name="id" value={participant.id} />
		<input type="hidden" name="signed" value="1" />
		<button
			class={buttonClass}
			title="Mark {participant.name}'s consent form as signed"
		>
			<span
				class="flex {boxClass} shrink-0 items-center justify-center rounded border-2 border-current"
			></span>
			{text}
		</button>
	</form>
{/if}
