<script lang="ts">
	import { onMount } from "svelte";
	import { getBirthdayState } from "../utils/birthday";
	import { url } from "../utils/url-utils";
	let birthday = false;
	onMount(() => {
		const update = () => {
			try { birthday = getBirthdayState().isBirthday; } catch { birthday = false; }
		};
		update();
		const timer = window.setInterval(update, 1000);
		window.addEventListener("pageshow", update);
		document.addEventListener("visibilitychange", update);
		return () => {
			clearInterval(timer);
			window.removeEventListener("pageshow", update);
			document.removeEventListener("visibilitychange", update);
		};
	});
</script>

{#if birthday}
	<a class="birthday-invitation" href={url("/birthday/")}>
		<span class="invitation-icon" aria-hidden="true">🎂</span>
		<span class="invitation-copy"><strong>今天，给生活加一点甜。</strong><span>农历九月十三 · 来陪 Yaron 许个愿吧</span></span>
		<span class="invitation-link">打开生日小屋 <span aria-hidden="true">↗</span></span>
	</a>
{/if}

<style>
	.birthday-invitation { display: flex; align-items: center; gap: 1rem; padding: 1.3rem 1.5rem; margin-bottom: 1.25rem; border: 1px solid var(--glass-border); border-radius: var(--radius-large); color: var(--text-strong); background: linear-gradient(115deg, color-mix(in srgb, var(--sakura) 16%, var(--cream-base)), var(--cream-soft)); }
	.invitation-icon { font-size: 2rem; }
	.invitation-copy { display: grid; gap: .3rem; }
	.invitation-copy strong { font-size: 1.05rem; font-weight: 600; }
	.invitation-copy > span { font-size: .8rem; color: var(--text-body); }
	.invitation-link { margin-left: auto; color: var(--tea); font-size: .85rem; white-space: nowrap; }
	.birthday-invitation:hover { border-color: var(--sakura); }
	.birthday-invitation:focus-visible { outline: 2px solid var(--sakura); outline-offset: 4px; }
	@media (max-width: 600px) { .birthday-invitation { flex-wrap: wrap; padding: 1.2rem; gap: .8rem; } .invitation-link { margin-left: 2.8rem; } }
</style>
