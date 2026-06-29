<script lang="ts">
	import { onMount } from "svelte";

	let grid: HTMLElement | null = null;
	let items: NodeListOf<HTMLElement> | null = null;
	let tabs: NodeListOf<HTMLElement> | null = null;
	let prevBtn: HTMLElement | null = null;
	let nextBtn: HTMLElement | null = null;
	let indicator: HTMLElement | null = null;
	let paginationBar: HTMLElement | null = null;

	const ITEMS_PER_PAGE = 9;
	let currentStatus = 'all';
	let currentPage = 1;
	let totalPages = 1;

	// 事件监听器引用，用于清理
	const eventListeners: Array<() => void> = [];

	function render() {
		if (!items || !items.length) {
			// 当没有项目时，隐藏分页栏
			if (paginationBar) {
				paginationBar.style.display = 'none';
			}
			return;
		}

		const visibleItems: HTMLElement[] = [];

		// 1. 分类隐藏
		items.forEach(item => {
			if (currentStatus === 'all' || item.dataset.type === currentStatus) {
				visibleItems.push(item);
			} else {
				item.style.display = 'none';
			}
		});

		// 2. 边界约束计算
		totalPages = Math.ceil(visibleItems.length / ITEMS_PER_PAGE) || 1;
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;

		const start = (currentPage - 1) * ITEMS_PER_PAGE;
		const end = start + ITEMS_PER_PAGE;

		// 3. 严格分拨 3x3 页面可见元素
		visibleItems.forEach((el, index) => {
			if (index >= start && index < end) {
				el.style.display = 'block';
			} else {
				el.style.display = 'none';
			}
		});

		// 4. 控制栏同步
		if (prevBtn) prevBtn.disabled = (currentPage === 1);
		if (nextBtn) nextBtn.disabled = (currentPage === totalPages);
		if (indicator) indicator.textContent = `${currentPage} / ${totalPages}`;
		if (paginationBar) {
			paginationBar.style.display = totalPages <= 1 ? 'none' : 'flex';
		}
	}

	function handleTabClick(e: Event) {
		const target = e.currentTarget as HTMLElement;
		currentStatus = target.dataset.status || 'all';
		currentPage = 1;

		if (tabs) {
			tabs.forEach(t => {
				t.className = "tab-btn bg-transparent text-neutral-600 dark:text-neutral-400 hover:bg-[var(--primary)] hover:text-white hover:scale-105 flex-shrink-0 px-3 py-1.5 text-xs rounded-xl font-bold tracking-wider transition-all duration-300 cursor-pointer";
			});
		}
		target.className = "tab-btn bg-[var(--primary)] text-white flex-shrink-0 px-3 py-1.5 text-xs rounded-xl font-bold tracking-wider transition-all duration-300 cursor-pointer shadow-sm scale-105";

		render();
	}

	function handlePrevClick() {
		if (currentPage > 1) {
			currentPage--;
			render();
			grid?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	function handleNextClick() {
		if (currentPage < totalPages) {
			currentPage++;
			render();
			grid?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	onMount(() => {
		grid = document.getElementById('bangumi-grid');
		items = document.querySelectorAll('.bangumi-item');
		tabs = document.querySelectorAll('.tab-btn');
		prevBtn = document.getElementById('btn-prev');
		nextBtn = document.getElementById('btn-next');
		indicator = document.getElementById('page-indicator');
		paginationBar = document.getElementById('bangumi-pagination');

		if (!grid) {
			console.error('[BangumiPanel] 未找到 #bangumi-grid 元素');
			return;
		}

		if (!items || !items.length) {
			console.warn('[BangumiPanel] 未找到 .bangumi-item 元素');
			return;
		}

		// 绑定事件
		if (tabs) {
			tabs.forEach(tab => {
				tab.addEventListener('click', handleTabClick);
				eventListeners.push(() => tab.removeEventListener('click', handleTabClick));
			});
		}

		if (prevBtn) {
			prevBtn.addEventListener('click', handlePrevClick);
			eventListeners.push(() => prevBtn.removeEventListener('click', handlePrevClick));
		}

		if (nextBtn) {
			nextBtn.addEventListener('click', handleNextClick);
			eventListeners.push(() => nextBtn.removeEventListener('click', handleNextClick));
		}

		render();

		// 清理函数
		return () => {
			eventListeners.forEach(cleanup => cleanup());
			eventListeners.length = 0;
		};
	});
</script>
