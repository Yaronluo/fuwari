<script lang="ts">
	import { onMount } from "svelte";

	let grid: HTMLElement;
	let items: NodeListOf<HTMLElement>;
	let tabs: NodeListOf<HTMLElement>;
	let prevBtn: HTMLButtonElement;
	let nextBtn: HTMLButtonElement;
	let indicator: HTMLElement;
	let paginationBar: HTMLElement;

	const ITEMS_PER_PAGE = 9;
	let currentStatus = 'all';
	let currentPage = 1;
	let totalPages = 1;

	function render() {
		if (!items.length) return;

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

		tabs.forEach(t => {
			t.className = "tab-btn bg-transparent text-neutral-600 dark:text-neutral-400 hover:bg-[var(--primary)] hover:text-white hover:scale-105 flex-shrink-0 px-3 py-1.5 text-xs rounded-xl font-bold tracking-wider transition-all duration-300 cursor-pointer";
		});
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
		grid = document.getElementById('bangumi-grid') as HTMLElement;
		items = document.querySelectorAll('.bangumi-item');
		tabs = document.querySelectorAll('.tab-btn');
		prevBtn = document.getElementById('btn-prev') as HTMLButtonElement;
		nextBtn = document.getElementById('btn-next') as HTMLButtonElement;
		indicator = document.getElementById('page-indicator') as HTMLElement;
		paginationBar = document.getElementById('bangumi-pagination') as HTMLElement;

		if (!grid || !items.length) return;

		// 绑定事件
		tabs.forEach(tab => {
			tab.addEventListener('click', handleTabClick);
		});

		prevBtn?.addEventListener('click', handlePrevClick);
		nextBtn?.addEventListener('click', handleNextClick);

		render();

		// 清理函数
		return () => {
			tabs.forEach(tab => {
				tab.removeEventListener('click', handleTabClick);
			});
			prevBtn?.removeEventListener('click', handlePrevClick);
			nextBtn?.removeEventListener('click', handleNextClick);
		};
	});
</script>
