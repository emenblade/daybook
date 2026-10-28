<script lang="ts">
	let { class: className = 'h-5 w-5' }: { class?: string } = $props();
</script>

<svg
	class={className}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.9"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	<rect x="3" y="4.5" width="18" height="17" rx="3" />
	<path d="M8 2.5v4M16 2.5v4M3 10h18" />
	<path d="m8.75 15.5 2.25 2.25L15.5 13.25" />
</svg>
