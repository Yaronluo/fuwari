<script lang="ts">
	import { onMount } from "svelte";

	let grid: HTMLElement | null = null;
	let wall: HTMLElement | null = null;
	let wallCount: HTMLElement | null = null;
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

	let revealObserver: IntersectionObserver | null = null;
	const revealedItems = new WeakSet<HTMLElement>();
	let toggleSyncFrame = 0;

	function prefersReducedMotion() {
		return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}

	function render() {
		if (!items?.length) {
			if (paginationBar) paginationBar.hidden = true;
			return;
		}

		const isReviews = currentView === "reviews";
		if (grid) grid.hidden = isReviews;
		if (wall) wall.hidden = isReviews;
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

		if (isReviews) {
			prepareReviewReveal();
			syncReviewToggles();
		} else {
			if (wallCount) wallCount.textContent = String(filteredItems.length);
			syncPosterImages();
			prepareWallReveal();
		}
	}

	/** 封面骨架屏与真实图片/失败占位之间的状态同步（含缓存命中的图片） */
	function syncPosterImages() {
		if (!items?.length) return;

		Array.from(items).forEach((item) => {
			if (item.hidden) return;
			const img = item.querySelector<HTMLImageElement>(".bangumi-poster img");
			const poster = img?.closest<HTMLElement>(".bangumi-poster");
			if (!img || !poster || !img.complete) return;
			poster.classList.add(img.naturalWidth > 0 ? "is-loaded" : "is-failed");
		});
	}

	/** 番剧墙卡片进入视口时逐张上浮，配合 CSS 的错峰延迟形成波浪入场 */
	function prepareWallReveal() {
		if (!wall || !items?.length) return;

		if (prefersReducedMotion()) {
			wall.classList.remove("is-animated");
			return;
		}

		wall.classList.add("is-animated");

		let visibleIndex = 0;
		Array.from(items).forEach((item) => {
			if (item.hidden) return;
			const order = visibleIndex++;
			item.style.setProperty("--card-delay", `${Math.min(order, 8) * 62}ms`);
			if (revealedItems.has(item)) return;
			if (!revealObserver) revealObserver = createRevealObserver();
			revealObserver.observe(item);
		});
	}

	/** 翻页或切换筛选后重放一次入场动画 */
	function resetWallReveal() {
		if (!items?.length) return;

		Array.from(items).forEach((item) => {
			revealedItems.delete(item);
			item.classList.remove("is-revealed");
		});
	}

	/** 短评卡片首次进入视口时逐张浮现，已经展示过的卡片不再重复播放 */
	function prepareReviewReveal() {
		if (!reviewSection || !reviewItems?.length) return;

		if (prefersReducedMotion()) {
			reviewSection.classList.remove("is-animated");
			return;
		}

		reviewSection.classList.add("is-animated");

		let visibleIndex = 0;
		Array.from(reviewItems).forEach((item) => {
			if (item.hidden) return;
			const order = visibleIndex++;
			if (revealedItems.has(item)) return;
			item.style.setProperty("--review-delay", `${Math.min(order, 6) * 70}ms`);
			if (!revealObserver) revealObserver = createRevealObserver();
			revealObserver.observe(item);
		});
	}

	function createRevealObserver() {
		return new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;
					const item = entry.target as HTMLElement;
					revealedItems.add(item);
					item.classList.add("is-revealed");
					revealObserver?.unobserve(item);
				});
			},
			{ rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
		);
	}

	/** 依据真实渲染高度决定是否出现「展开全文」按钮，避免窄屏漏截或多截 */
	function syncReviewToggles() {
		if (!reviewItems?.length) return;

		reviewItems.forEach((item) => {
			if (item.hidden) return;
			const text = item.querySelector<HTMLElement>(".bangumi-review-text");
			const clip = item.querySelector<HTMLElement>(".bangumi-review-clip");
			const copy = item.querySelector<HTMLElement>(".bangumi-review-copy");
			const toggle = item.querySelector<HTMLButtonElement>(".bangumi-review-toggle");
			if (!text || !clip || !copy || !toggle) return;

			const limit = parseFloat(getComputedStyle(clip).fontSize || "15") * 7.8;
			const overflows = copy.scrollHeight - limit > 2;
			const expanded = !text.classList.contains("is-collapsed");
			const label = toggle.querySelector<HTMLElement>(".bangumi-review-toggle-label");

			if (overflows) {
				toggle.hidden = false;
				toggle.setAttribute("aria-expanded", String(expanded));
				if (label) label.textContent = (expanded ? label.dataset.less : label.dataset.more) ?? "展开全文";
			} else {
				toggle.hidden = true;
				text.classList.remove("is-collapsed");
				clip.style.maxHeight = "";
			}
		});
	}

	function scheduleSyncReviewToggles() {
		if (toggleSyncFrame) window.cancelAnimationFrame(toggleSyncFrame);
		toggleSyncFrame = window.requestAnimationFrame(() => {
			toggleSyncFrame = 0;
			if (currentView === "reviews") syncReviewToggles();
		});
	}

	function handleReviewClick(event: MouseEvent) {
		const target = event.target as HTMLElement | null;
		const toggle = target?.closest<HTMLButtonElement>(".bangumi-review-toggle");
		if (!toggle) return;

		const text = toggle.closest<HTMLElement>(".bangumi-review-text");
		const clip = text?.querySelector<HTMLElement>(".bangumi-review-clip");
		if (!text || !clip) return;

		const label = toggle.querySelector<HTMLElement>(".bangumi-review-toggle-label");
		const expanded = toggle.getAttribute("aria-expanded") === "true";

		if (expanded) {
			clip.style.maxHeight = `${clip.scrollHeight}px`;
			void clip.offsetHeight;
			text.classList.add("is-collapsed");
			clip.style.maxHeight = "";
			toggle.setAttribute("aria-expanded", "false");
			if (label) label.textContent = label.dataset.more ?? "展开全文";
		} else {
			clip.style.maxHeight = `${clip.scrollHeight}px`;
			text.classList.remove("is-collapsed");
			toggle.setAttribute("aria-expanded", "true");
			if (label) label.textContent = label.dataset.less ?? "收起全文";
			window.setTimeout(() => {
				if (toggle.getAttribute("aria-expanded") === "true") clip.style.maxHeight = "none";
			}, 520);
		}
	}

	function handleReviewPointerMove(event: PointerEvent) {
		const item = (event.target as HTMLElement | null)?.closest<HTMLElement>(".bangumi-review-item");
		if (!item || item.hidden) return;
		const rect = item.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		item.style.setProperty("--review-x", `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(2)}%`);
		item.style.setProperty("--review-y", `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(2)}%`);
	}

	/** 番剧墙卡片跟随指针做轻微 3D 倾斜，指针离开后归位 */
	function handleWallPointerMove(event: PointerEvent) {
		if (event.pointerType === "touch") return;

		const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(".bangumi-card");
		if (!card) return;

		const rect = card.getBoundingClientRect();
		if (!rect.width || !rect.height) return;

		const ratioX = (event.clientX - rect.left) / rect.width - 0.5;
		const ratioY = (event.clientY - rect.top) / rect.height - 0.5;
		card.style.setProperty("--tilt-y", `${(ratioX * 7).toFixed(2)}deg`);
		card.style.setProperty("--tilt-x", `${(-ratioY * 6).toFixed(2)}deg`);
	}

	function resetCardTilt(card: HTMLElement) {
		card.style.removeProperty("--tilt-x");
		card.style.removeProperty("--tilt-y");
	}

	function handleWallPointerOut(event: PointerEvent) {
		const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(".bangumi-card");
		if (!card) return;

		const next = event.relatedTarget as Node | null;
		if (next && card.contains(next)) return;
		resetCardTilt(card);
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
		if (currentView === "wall") resetWallReveal();
		render();
		if (currentView === "reviews") syncReviewToggles();
	}

	function handleTabClick(event: Event) {
		const target = event.currentTarget as HTMLButtonElement;
		currentStatus = target.dataset.status || "all";
		currentPage = 1;
		resetWallReveal();

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
		resetWallReveal();
		render();
		(currentView === "reviews" ? reviewSection : grid)?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	function handleNextClick() {
		if (currentPage >= totalPages) return;
		currentPage++;
		resetWallReveal();
		render();
		(currentView === "reviews" ? reviewSection : grid)?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	function handleViewportChange() {
		currentPage = 1;
		resetWallReveal();
		render();
	}

	onMount(() => {
		grid = document.getElementById("bangumi-grid");
		wall = grid?.closest<HTMLElement>(".bangumi-wall") ?? document.querySelector<HTMLElement>(".bangumi-wall");
		wallCount = document.getElementById("bangumi-wall-count");
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

		if (reviewSection) {
			reviewSection.addEventListener("click", handleReviewClick);
			eventListeners.push(() => reviewSection?.removeEventListener("click", handleReviewClick));
			reviewSection.addEventListener("pointermove", handleReviewPointerMove, { passive: true });
			eventListeners.push(() => reviewSection?.removeEventListener("pointermove", handleReviewPointerMove));
		}

		if (wall) {
			wall.addEventListener("pointermove", handleWallPointerMove, { passive: true });
			eventListeners.push(() => wall?.removeEventListener("pointermove", handleWallPointerMove));
			wall.addEventListener("pointerout", handleWallPointerOut);
			eventListeners.push(() => wall?.removeEventListener("pointerout", handleWallPointerOut));
		}

		window.addEventListener("resize", scheduleSyncReviewToggles);
		eventListeners.push(() => window.removeEventListener("resize", scheduleSyncReviewToggles));

		syncPosterImages();
		render();

		document.fonts?.ready.then(() => {
			if (currentView === "reviews") syncReviewToggles();
		});

		return () => {
			eventListeners.forEach((cleanup) => {
				cleanup();
			});
			eventListeners.length = 0;
			revealObserver?.disconnect();
			revealObserver = null;
			if (toggleSyncFrame) window.cancelAnimationFrame(toggleSyncFrame);
		};
	});
</script>
