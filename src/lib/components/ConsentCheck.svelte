<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Participant } from '#lib/types.ts';

	let {
		participant,
		label = 'Consent form',
		compact = false,
		showName = false
	}: {
		participant: Pick<Participant, 'id' | 'name' | 'consent_signed_at'>;
		label?: string;
		compact?: boolean;
		showName?: boolean;
	} = $props();
</script>

{#if !participant.consent_signed_at}
	<form method="POST" action="?/setClientConsent" use:enhance>
		<input type="hidden" name="id" value={participant.id} />
		<input type="hidden" name="signed" value="1" />
		<button
			class="chip chip-amber {compact ? 'px-2 py-1 text-[10px]' : ''}"
			title="Mark {participant.name}'s consent form as signed"
		>
			<span
				class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border-2 border-current"
			></span>
			{showName ? participant.name : label}
		</button>
	</form>
{/if}
