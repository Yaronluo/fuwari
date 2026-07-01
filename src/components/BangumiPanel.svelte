<script lang="ts">
	import { onMount } from "svelte";

	let grid: HTMLElement | null = null;
	let items: NodeListOf<HTMLElement> | null = null;
	let tabs: NodeListOf<HTMLElement> | null = null;
	let prevBtn: HTMLElement | null = null;
	let nextBtn: HTMLElement | null = null;
	let pageIndicator: HTMLElement | null = null;
	let paginationBar: HTMLElement | null = null;
	let hoverIndicator: HTMLElement | null = null;
	let tabsContainer: HTMLElement | null = null;

	const ITEMS_PER_PAGE = 9;
	let currentStatus = 'all';
	let currentPage = 1;
	let totalPages = 1;

	// 事件监听器引用，用于清理
	const eventListeners: Array<() => void> = [];

	function updateHoverIndicator(target: HTMLElement) {
		if (!hoverIndicator) return;
		hoverIndicator.style.width = `${target.offsetWidth * 0.8}px`;
		hoverIndicator.style.left = `${target.offsetLeft + (target.offsetWidth * 0.1)}px`;
		hoverIndicator.style.opacity = '1';
	}

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
		if (pageIndicator) pageIndicator.textContent = `${currentPage} / ${totalPages}`;
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
				t.classList.remove("bangumi-tab-active");
				t.classList.add("bangumi-tab-inactive");
			});
		}
		target.classList.remove("bangumi-tab-inactive");
		target.classList.add("bangumi-tab-active");
		updateHoverIndicator(target);

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
		pageIndicator = document.getElementById('page-indicator');
		paginationBar = document.getElementById('bangumi-pagination');
		hoverIndicator = document.getElementById('bangumi-indicator');
		tabsContainer = document.getElementById('bangumi-tabs-container');

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

				const handleEnter = (e: Event) => updateHoverIndicator(e.currentTarget as HTMLElement);
				tab.addEventListener('mouseenter', handleEnter);
				eventListeners.push(() => tab.removeEventListener('mouseenter', handleEnter));
			});
		}
		
		if (tabsContainer) {
			const handleLeave = () => {
				const activeTab = document.querySelector('.bangumi-tab-active') as HTMLElement;
				if (activeTab) updateHoverIndicator(activeTab);
				else if (hoverIndicator) hoverIndicator.style.opacity = '0';
			};
			tabsContainer.addEventListener('mouseleave', handleLeave);
			eventListeners.push(() => tabsContainer?.removeEventListener('mouseleave', handleLeave));
		}

		if (prevBtn) {
			prevBtn.addEventListener('click', handlePrevClick);
			eventListeners.push(() => prevBtn?.removeEventListener('click', handlePrevClick));
		}

		if (nextBtn) {
			nextBtn.addEventListener('click', handleNextClick);
			eventListeners.push(() => nextBtn?.removeEventListener('click', handleNextClick));
		}

		// 初始化流动光标位置
		setTimeout(() => {
			const activeTab = document.querySelector('.bangumi-tab-active') as HTMLElement;
			if (activeTab) updateHoverIndicator(activeTab);
		}, 100);

		render();

		// 清理函数
		return () => {
			eventListeners.forEach(cleanup => cleanup());
			eventListeners.length = 0;
		};
	});
</script>
