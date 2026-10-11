<script lang="ts">
	import { onMount } from "svelte";

	let grid: HTMLElement | null = null;
	let items: NodeListOf<HTMLElement> | null = null;
	let tabs: NodeListOf<HTMLButtonElement> | null = null;
	let prevBtn: HTMLButtonElement | null = null;
	let nextBtn: HTMLButtonElement | null = null;
	let pageIndicator: HTMLElement | null = null;
	let paginationBar: HTMLElement | null = null;
	let reviewSection: HTMLElement | null = null;
	let reviewItems: NodeListOf<HTMLElement> | null = null;
	let viewButtons: NodeListOf<HTMLButtonElement> | null = null;
	let statusTabs: HTMLElement | null = null;
	let currentView = "wall";

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

		const isReviews = currentView === "reviews";
		if (grid) grid.hidden = isReviews;
		if (reviewSection) reviewSection.hidden = !isReviews;
		if (statusTabs) statusTabs.hidden = isReviews;
		const activeItems = isReviews ? Array.from(reviewItems || []) : Array.from(items);
		const filteredItems = activeItems.filter(
			(item) => isReviews || currentStatus === "all" || item.dataset.type === currentStatus,
		);

		const itemsPerPage = isReviews ? 6 : mobileQuery?.matches ? MOBILE_ITEMS_PER_PAGE : DESKTOP_ITEMS_PER_PAGE;
		totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
		currentPage = Math.min(Math.max(currentPage, 1), totalPages);

		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;

		activeItems.forEach((item) => {
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

	function handleViewClick(event: Event) {
		currentView = (event.currentTarget as HTMLButtonElement).dataset.view || "wall";
		currentPage = 1;
		viewButtons?.forEach((button) => {
			const active = button.dataset.view === currentView;
			button.classList.toggle("bangumi-view-active", active);
			button.setAttribute("aria-pressed", String(active));
		});
		const url = new URL(window.location.href);
		if (currentView === "reviews") url.searchParams.set("view", "reviews");
		else url.searchParams.delete("view");
		window.history.replaceState(window.history.state, "", url);
		render();
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
		(currentView === "reviews" ? reviewSection : grid)?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	function handleNextClick() {
		if (currentPage >= totalPages) return;
		currentPage++;
		render();
		(currentView === "reviews" ? reviewSection : grid)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
		reviewSection = document.getElementById("bangumi-reviews");
		reviewItems = document.querySelectorAll<HTMLElement>(".bangumi-review-item");
		viewButtons = document.querySelectorAll<HTMLButtonElement>("[data-view]");
		statusTabs = document.getElementById("bangumi-tabs-container");
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
		viewButtons.forEach((button) => {
			button.addEventListener("click", handleViewClick);
			eventListeners.push(() => button.removeEventListener("click", handleViewClick));
		});
		if (new URLSearchParams(window.location.search).get("view") === "reviews") {
			viewButtons.forEach((button) => {
				if (button.dataset.view === "reviews") button.click();
			});
		}

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
