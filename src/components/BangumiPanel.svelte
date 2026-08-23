<script lang="ts">
	import { onMount } from "svelte";

	let grid: HTMLElement | null = null;
	let items: NodeListOf<HTMLElement> | null = null;
	let tabs: NodeListOf<HTMLButtonElement> | null = null;
	let prevBtn: HTMLButtonElement | null = null;
	let nextBtn: HTMLButtonElement | null = null;
	let pageIndicator: HTMLElement | null = null;
	let paginationBar: HTMLElement | null = null;

	const DESKTOP_ITEMS_PER_PAGE = 9;
	const MOBILE_ITEMS_PER_PAGE = 8;
	let currentStatus = "all";
	let currentPage = 1;
	let totalPages = 1;
	let mobileQuery: MediaQueryList | null = null;

	const eventListeners: Array<() => void> = [];

	function render() {
		if (!items?.length) {
			if (paginationBar) paginationBar.hidden = true;
			return;
		}

		const filteredItems = Array.from(items).filter(
			(item) => currentStatus === "all" || item.dataset.type === currentStatus,
		);

		const itemsPerPage = mobileQuery?.matches ? MOBILE_ITEMS_PER_PAGE : DESKTOP_ITEMS_PER_PAGE;
		totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
		currentPage = Math.min(Math.max(currentPage, 1), totalPages);

		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;

		items.forEach((item) => {
			item.hidden = true;
		});
		filteredItems.forEach((item, index) => {
			item.hidden = index < start || index >= end;
		});

		if (prevBtn) prevBtn.disabled = currentPage === 1;
		if (nextBtn) nextBtn.disabled = currentPage === totalPages;
		if (pageIndicator) {
			pageIndicator.textContent = `${String(currentPage).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;
		}
		if (paginationBar) paginationBar.hidden = totalPages <= 1;
	}

	function handleTabClick(event: Event) {
		const target = event.currentTarget as HTMLButtonElement;
		currentStatus = target.dataset.status || "all";
		currentPage = 1;

		tabs?.forEach((tab) => {
			const isActive = tab === target;
			tab.classList.toggle("bangumi-tab-active", isActive);
			tab.classList.toggle("bangumi-tab-inactive", !isActive);
			tab.setAttribute("aria-pressed", String(isActive));
		});

		render();
	}

	function handlePrevClick() {
		if (currentPage <= 1) return;
		currentPage--;
		render();
		grid?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	function handleNextClick() {
		if (currentPage >= totalPages) return;
		currentPage++;
		render();
		grid?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	function handleViewportChange() {
		currentPage = 1;
		render();
	}

	onMount(() => {
		grid = document.getElementById("bangumi-grid");
		items = document.querySelectorAll<HTMLElement>(".bangumi-item");
		tabs = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
		prevBtn = document.querySelector<HTMLButtonElement>("#btn-prev");
		nextBtn = document.querySelector<HTMLButtonElement>("#btn-next");
		pageIndicator = document.getElementById("page-indicator");
		paginationBar = document.getElementById("bangumi-pagination");
		mobileQuery = window.matchMedia("(max-width: 640px)");

		if (!grid) {
			console.error("[BangumiPanel] 未找到 #bangumi-grid 元素");
			return;
		}
		if (!items.length) {
			console.warn("[BangumiPanel] 未找到 .bangumi-item 元素");
			return;
		}

		tabs.forEach((tab) => {
			tab.addEventListener("click", handleTabClick);
			eventListeners.push(() => tab.removeEventListener("click", handleTabClick));
		});

		prevBtn?.addEventListener("click", handlePrevClick);
		if (prevBtn) eventListeners.push(() => prevBtn?.removeEventListener("click", handlePrevClick));

		nextBtn?.addEventListener("click", handleNextClick);
		if (nextBtn) eventListeners.push(() => nextBtn?.removeEventListener("click", handleNextClick));

		mobileQuery.addEventListener("change", handleViewportChange);
		eventListeners.push(() => mobileQuery?.removeEventListener("change", handleViewportChange));

		render();

		return () => {
			eventListeners.forEach((cleanup) => {
				cleanup();
			});
			eventListeners.length = 0;
		};
	});
</script>
