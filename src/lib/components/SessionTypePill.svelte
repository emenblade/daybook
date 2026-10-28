<script lang="ts">
	import { typeLabel } from '#lib/format.ts';
	import type { SessionType } from '#lib/types.ts';

	let { type, count = 1 }: { type: SessionType; count?: number } = $props();

	const config = $derived(
		{
			couples: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
			family: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
			group: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
			individual: ''
		}[type]
	);
</script>

{#if type !== 'individual'}
	<span
		class="pill {config}"
		title={type === 'group' ? `Group session with ${count} attendees` : `${typeLabel(type)} session`}
		>{typeLabel(type)}{type === 'group' && count > 1 ? ` · ${count}` : ''}</span
	>
{/if}
