<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { url } from "@utils/url-utils.ts";
import { onMount } from "svelte";
import type { SearchResult } from "@/global";

let keyword = "";
let result: SearchResult[] = [];
let pagefindLoaded = false;
let initialized = false;
let searchRequestId = 0;

const fakeResult: SearchResult[] = [
	{
		url: url("/"),
		meta: { title: "This Is a Fake Search Result" },
		excerpt: "Because the search cannot work in the <mark>dev</mark> environment.",
	},
	{
		url: url("/"),
		meta: { title: "If You Want to Test the Search" },
		excerpt: "Try running <mark>pnpm build && pnpm preview</mark> instead.",
	},
];

const search = async (kw: string): Promise<void> => {
	const requestId = ++searchRequestId;
	if (!kw) {
		result = [];
		return;
	}

	if (!initialized) return;

	try {
		let searchResults: SearchResult[] = [];

		if (import.meta.env.PROD && pagefindLoaded && window.pagefind) {
			const response = await window.pagefind.search(kw);
			searchResults = await Promise.all(
				response.results.map((item) => item.data()),
			);
		} else if (import.meta.env.DEV) {
			searchResults = fakeResult;
		} else {
			searchResults = [];
			console.error("Pagefind is not available in production environment.");
		}

		if (requestId === searchRequestId) result = searchResults;
	} catch (error) {
		console.error("Search error:", error);
		if (requestId === searchRequestId) result = [];
	}
};

onMount(() => {
	// 把搜索面板移到 body 下，避免父元素 transform 影响 fixed 定位
	const panel = document.getElementById("search-panel");
	if (panel) {
		document.body.appendChild(panel);
	}

	const initializeSearch = () => {
		initialized = true;
		pagefindLoaded =
			typeof window !== "undefined" &&
			!!window.pagefind &&
			typeof window.pagefind.search === "function";
	};

	if (import.meta.env.DEV) {
		initializeSearch();
	} else {
		document.addEventListener("pagefindready", initializeSearch);
		document.addEventListener("pagefindloaderror", initializeSearch);
		const fallbackTimer = window.setTimeout(() => {
			if (!initialized) initializeSearch();
		}, 2000);

		return () => {
			window.clearTimeout(fallbackTimer);
			document.removeEventListener("pagefindready", initializeSearch);
			document.removeEventListener("pagefindloaderror", initializeSearch);
		};
	}
});

$: if (initialized) {
	(async () => {
		await search(keyword);
	})();
}
</script>

<!-- search panel -->
<div id="search-panel" class="float-panel float-panel-closed search-panel fixed w-[calc(100%-2rem)] md:w-[30rem]
left-1/2 -translate-x-1/2 shadow-xl rounded-2xl p-2 z-50"
style="top: 5rem;">

    <!-- search bar inside panel -->
    <div id="search-bar-inside" class="flex relative transition-all items-center h-11 rounded-xl
      bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-black/[0.06]
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
  ">
        <Icon icon="material-symbols:search" class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
        <input placeholder="{i18n(I18nKey.search)}" bind:value={keyword}
               class="pl-10 absolute inset-0 text-sm bg-transparent outline-0
               focus:w-full text-black/50 dark:text-white/50"
        >
    </div>

    <!-- search results -->
    {#each result as item}
        <a href={item.url}
           class="transition mt-2 group block
       rounded-xl text-lg px-3 py-2 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]">
            <div class="transition text-90 inline-flex font-bold group-hover:text-[var(--primary)]">
                {item.meta.title}<Icon icon="fa6-solid:chevron-right" class="transition text-[0.75rem] translate-x-1 my-auto text-[var(--primary)]"></Icon>
            </div>
            <div class="transition text-sm text-50">
                {@html item.excerpt}
            </div>
        </a>
    {/each}
</div>

<style>
  input:focus {
    outline: 0;
  }
  .search-panel {
    max-height: calc(100vh - 100px);
    overflow-y: auto;
  }
</style>
