<script lang="ts">
	let passphrase = $state('');
	let confirm = $state('');
	let error = $state('');
	let success = $state('');
	let busy = $state(false);

	async function download(event: Event): Promise<void> {
		event.preventDefault();
		error = '';
		success = '';
		if (passphrase.length < 12) {
			error = 'Use at least 12 characters.';
			return;
		}
		if (passphrase !== confirm) {
			error = 'Passphrases do not match.';
			return;
		}
		busy = true;
		try {
			const body = new FormData();
			body.set('passphrase', passphrase);
			const response = await fetch('/api/backup', { method: 'POST', body });
			if (!response.ok) {
				const result = (await response.json().catch(() => ({}))) as { error?: string };
				error = result.error ?? 'Backup failed.';
				return;
			}
			const blob = await response.blob();
			const disposition = response.headers.get('content-disposition') ?? '';
			const filename =
				/daybook-backup-[0-9-]+\.db\.enc/.exec(disposition)?.[0] ?? 'daybook-backup.db.enc';
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.click();
			URL.revokeObjectURL(url);
			passphrase = '';
			confirm = '';
			success = 'Encrypted backup downloaded.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
		}
	}
</script>

<form class="space-y-2">
	<div class="grid grid-cols-2 gap-2">
		<div>
			<label class="label" for="backup-passphrase">Backup passphrase</label>
			<input
				id="backup-passphrase"
				class="input"
				type="password"
				bind:value={passphrase}
				autocomplete="new-password"
				minlength="12"
				required
			/>
		</div>
		<div>
			<label class="label" for="backup-confirm">Confirm</label>
			<input
				id="backup-confirm"
				class="input"
				type="password"
				bind:value={confirm}
				autocomplete="new-password"
				minlength="12"
				required
			/>
		</div>
	</div>
	<p class="text-[11px] text-slate-400 dark:text-slate-500">
		The passphrase is not stored. If you lose it, the backup cannot be restored. Restore with
		<code class="rounded bg-slate-100 px-1 dark:bg-slate-800">scripts/decrypt-backup.mjs</code>.
	</p>
	{#if error}
		<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
	{/if}
	{#if success}
		<p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">{success}</p>
	{/if}
	<button class="chip chip-sky" type="button" onclick={download} disabled={busy}>
		{busy ? 'Encrypting…' : 'Download encrypted backup'}
	</button>
</form>
