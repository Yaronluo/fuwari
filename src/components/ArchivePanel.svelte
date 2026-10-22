<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount, tick } from "svelte";

import I18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import {
	getCategoryUrl,
	getPostUrlBySlug,
	getTagUrl,
	url,
} from "../utils/url-utils";

interface Post {
	slug: string;
	words?: number;
	data: {
		title: string;
		tags: string[];
		category?: string | null;
		published: Date;
		pinned?: boolean;
	};
}

interface TimelinePost {
	slug: string;
	title: string;
	tags: string[];
	category: string;
	words: number;
	pinned: boolean;
	date: Date;
}

interface YearGroup {
	year: number;
	posts: TimelinePost[];
	words: number;
	months: number[];
	sparkMax: number;
	topTags: { name: string; count: number }[];
}

export let tags: string[] = [];
export let categories: string[] = [];
export let sortedPosts: Post[] = [];
export let initialNow: string;

/** 当前滚动到的时间轴条目，由滚动逻辑赋值，模板用 class:is-active 绑定 */
let activeSlug: string | null = null;

const ONE_DAY = 86_400_000;
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const numberFormat = new Intl.NumberFormat("zh-CN");
const archiveHref = url("/archive/");

const OUTER_CIRCUMFERENCE = 2 * Math.PI * 52;
const INNER_CIRCUMFERENCE = 2 * Math.PI * 39;

let pageEl: HTMLDivElement;
let uncategorized: string | null = null;
let filterChips: { label: string; href: string }[] = [];

let groups: YearGroup[] = [];
let totalPosts = 0;
let totalWords = 0;
let allPosts = 0;
let allWords = 0;

let currentYear = new Date(initialNow).getFullYear();
let currentMonth = new Date(initialNow).getMonth();
let dayOfYear = 0;
let yearPercent = 0;
let dayPercent = 0;
let clockText = "";

let firstPost: TimelinePost | null = null;
let latestPost: TimelinePost | null = null;
let longestPost: TimelinePost | null = null;
let busiestYear: { year: number; count: number; words: number } | null = null;
let monthCounts = Array.from({ length: 12 }, () => 0);
let rhythmMax = 1;
let monthsWithPosts = 0;
let busiestMonth = -1;
let yearsSpanned = 0;
let daysSinceFirst = 0;
let daysSinceLatest = 0;
let onThisDay: TimelinePost | null = null;

let rolling = false;
let rollTitle = "";

/* ---------------------------------------------------------------- utils */

function toTimelinePost(post: Post): TimelinePost {
	return {
		slug: post.slug,
		title: post.data.title,
		tags: Array.isArray(post.data.tags) ? post.data.tags : [],
		category: (post.data.category || "").trim(),
		words: Math.max(0, Math.round(post.words || 0)),
		pinned: Boolean(post.data.pinned),
		date: new Date(post.data.published),
	};
}

function startOfDay(date: Date) {
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	).getTime();
}

function daysBetween(from: Date, to: Date) {
	return Math.max(0, Math.round((startOfDay(to) - startOfDay(from)) / ONE_DAY));
}

function formatMonthDay(date: Date) {
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${month}-${day}`;
}

function formatFullDate(date: Date) {
	return `${date.getFullYear()}-${formatMonthDay(date)}`;
}

function toIsoDate(date: Date) {
	return `${formatFullDate(date)}T${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

function formatWords(value: number) {
	if (value <= 0) return "0";
	if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
	return numberFormat.format(value);
}

function formatRelativeDays(days: number) {
	if (days <= 0) return "就是今天";
	if (days === 1) return "昨天";
	return `${days} 天前`;
}

function postHref(post: TimelinePost | null) {
	return post ? getPostUrlBySlug(post.slug) : archiveHref;
}

function openPost(slug: string) {
	const href = getPostUrlBySlug(slug);
	const swup = (
		window as unknown as { swup?: { navigate?: (value: string) => void } }
	).swup;
	if (swup && typeof swup.navigate === "function") swup.navigate(href);
	else window.location.assign(href);
}

/* -------------------------------------------------------- data shaping */

function refreshGroups() {
	let list = sortedPosts.map(toTimelinePost);

	if (tags.length > 0) {
		list = list.filter((post) => post.tags.some((tag) => tags.includes(tag)));
	}
	if (categories.length > 0) {
		list = list.filter(
			(post) => post.category && categories.includes(post.category),
		);
	}
	if (uncategorized) {
		list = list.filter((post) => !post.category);
	}

	const byYear = new Map<number, TimelinePost[]>();
	for (const post of list) {
		const year = post.date.getFullYear();
		const bucket = byYear.get(year);
		if (bucket) bucket.push(post);
		else byYear.set(year, [post]);
	}

	groups = Array.from(byYear.entries())
		.sort((a, b) => b[0] - a[0])
		.map(([year, posts]) => {
			const months = Array.from({ length: 12 }, () => 0);
			const tagCount = new Map<string, number>();
			let words = 0;
			for (const post of posts) {
				months[post.date.getMonth()] += 1;
				words += post.words;
				for (const tag of post.tags) {
					tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
				}
			}
			const topTags = Array.from(tagCount.entries())
				.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
				.slice(0, 3)
				.map(([name, count]) => ({ name, count }));
			return {
				year,
				posts,
				words,
				months,
				sparkMax: Math.max(1, ...months),
				topTags,
			};
		});

	totalPosts = list.length;
	totalWords = list.reduce((sum, post) => sum + post.words, 0);

	/* the rhythm chart follows the current filter so its numbers always
		   agree with the timeline right below it */
	monthCounts = Array.from({ length: 12 }, () => 0);
	for (const post of list) {
		monthCounts[post.date.getMonth()] += 1;
	}
	rhythmMax = Math.max(1, ...monthCounts);
	monthsWithPosts = monthCounts.filter((count) => count > 0).length;
	let peak = 0;
	busiestMonth = -1;
	monthCounts.forEach((count, index) => {
		if (count > peak) {
			peak = count;
			busiestMonth = index;
		}
	});
}

/* the hero always describes the whole blog, never the filtered slice */
function refreshGlobalStats() {
	allPosts = sortedPosts.length;
	allWords = sortedPosts.reduce(
		(sum, post) => sum + Math.max(0, Math.round(post.words || 0)),
		0,
	);
}

function refreshMilestones(now: Date) {
	const list = sortedPosts
		.map(toTimelinePost)
		.sort((a, b) => a.date.getTime() - b.date.getTime());

	if (list.length === 0) {
		firstPost = null;
		latestPost = null;
		longestPost = null;
		busiestYear = null;
		onThisDay = null;
		return;
	}

	firstPost = list[0];
	latestPost = list[list.length - 1];
	longestPost = list.reduce(
		(best, post) => (post.words > best.words ? post : best),
		list[0],
	);

	const yearCount = new Map<number, { count: number; words: number }>();
	for (const post of list) {
		const year = post.date.getFullYear();
		const entry = yearCount.get(year);
		if (entry) {
			entry.count += 1;
			entry.words += post.words;
		} else {
			yearCount.set(year, { count: 1, words: post.words });
		}
	}

	yearsSpanned = yearCount.size;
	busiestYear =
		Array.from(yearCount.entries())
			.map(([year, value]) => ({ year, ...value }))
			.sort((a, b) => b.count - a.count || b.words - a.words)[0] || null;

	daysSinceFirst = daysBetween(firstPost.date, now);
	daysSinceLatest = daysBetween(latestPost.date, now);
	onThisDay =
		[...list]
			.reverse()
			.find(
				(post) =>
					post.date.getMonth() === now.getMonth() &&
					post.date.getDate() === now.getDate(),
			) || null;
}

function updateClock(now: Date) {
	currentYear = now.getFullYear();
	currentMonth = now.getMonth();
	const startOfYear = new Date(currentYear, 0, 1);
	dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / ONE_DAY) + 1;
	const isLeapYear =
		(currentYear % 4 === 0 && currentYear % 100 !== 0) ||
		currentYear % 400 === 0;
	yearPercent = (dayOfYear / (isLeapYear ? 366 : 365)) * 100;
	const startOfToday = new Date(currentYear, now.getMonth(), now.getDate());
	dayPercent = ((now.getTime() - startOfToday.getTime()) / ONE_DAY) * 100;
	clockText = [now.getHours(), now.getMinutes(), now.getSeconds()]
		.map((value) => `${value}`.padStart(2, "0"))
		.join(":");
}

/* -------------------------------------------------------------- motion */

function countUp(
	element: HTMLElement,
	target: number,
	format?: (value: number) => string,
) {
	const render = format || ((value: number) => numberFormat.format(value));
	const duration = 900;
	const started = performance.now();
	element.textContent = render(0);

	const tickFrame = (time: number) => {
		const progress = Math.min(1, (time - started) / duration);
		const eased = 1 - (1 - progress) ** 3;
		element.textContent = render(Math.round(target * eased));
		if (progress < 1) requestAnimationFrame(tickFrame);
		else element.textContent = render(target);
	};
	requestAnimationFrame(tickFrame);
}

function rollRandom() {
	if (rolling || sortedPosts.length === 0) return;
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const target = sortedPosts[Math.floor(Math.random() * sortedPosts.length)];
	if (reduced || sortedPosts.length < 2) {
		openPost(target.slug);
		return;
	}

	rolling = true;
	const total = 10 + Math.floor(Math.random() * 4);
	let step = 0;
	const spin = () => {
		const sample = sortedPosts[Math.floor(Math.random() * sortedPosts.length)];
		rollTitle = sample.data.title;
		step += 1;
		if (step >= total) {
			rolling = false;
			rollTitle = "";
			openPost(target.slug);
			return;
		}
		window.setTimeout(spin, 40 + step * 11);
	};
	spin();
}

/* ----------------------------------------------------- server render */

refreshGlobalStats();
refreshGroups();
refreshMilestones(new Date(initialNow));
updateClock(new Date(initialNow));

onMount(() => {
	const params = new URLSearchParams(window.location.search);
	tags = params.has("tag") ? params.getAll("tag") : [];
	categories = params.has("category") ? params.getAll("category") : [];
	uncategorized = params.get("uncategorized");

	filterChips = [
		...tags.map((tag) => ({ label: `#${tag}`, href: getTagUrl(tag) })),
		...categories.map((category) => ({
			label: category,
			href: getCategoryUrl(category),
		})),
		...(uncategorized
			? [{ label: i18n(I18nKey.uncategorized), href: getCategoryUrl(null) }]
			: []),
	];

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const finePointer = window.matchMedia(
		"(hover: hover) and (pointer: fine)",
	).matches;
	const startedAt = new Date();
	refreshGroups();
	refreshMilestones(startedAt);
	updateClock(startedAt);

	/* Hero counters ------------------------------------------------- */
	if (!reduced) {
		for (const node of pageEl.querySelectorAll<HTMLElement>(
			"[data-count-to]",
		)) {
			countUp(
				node,
				Number(node.dataset.countTo || "0"),
				node.dataset.countFormat === "words" ? formatWords : undefined,
			);
		}
	}

	/* Timeline rail -------------------------------------------------- */
	let frame = 0;
	let railNodes: HTMLElement[] = [];
	let entryNodes: HTMLElement[] = [];
	let activeEntry: HTMLElement | null = null;

	const collect = () => {
		railNodes = Array.from(pageEl.querySelectorAll<HTMLElement>("[data-rail]"));
		entryNodes = railNodes.filter((node) => node.dataset.rail === "entry");
	};

	const updateRail = () => {
		frame = 0;
		const anchor = window.innerHeight * 0.44;
		let best: HTMLElement | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (const node of railNodes) {
			const rect = node.getBoundingClientRect();
			const center = rect.top + rect.height / 2;
			const passed = center <= anchor;
			const flag = passed ? "on" : "off";
			if (node.dataset.railOn !== flag) {
				node.dataset.railOn = flag;
				node.style.setProperty("--rail-fill", passed ? "100%" : "0%");
			}
			if (node.dataset.rail === "entry" && passed) {
				const distance = anchor - center;
				if (distance < bestDistance) {
					bestDistance = distance;
					best = node;
				}
			}
		}

		if (best !== activeEntry) {
			activeEntry = best;
			activeSlug = best?.dataset.slug ?? null;
		}
	};

	const onScroll = () => {
		if (frame) return;
		frame = window.requestAnimationFrame(updateRail);
	};

	collect();
	updateRail();
	void tick().then(() => {
		collect();
		updateRail();
	});

	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onScroll);

	/* Pointer spotlight on milestone cards --------------------------- */
	const spotlights = finePointer
		? Array.from(pageEl.querySelectorAll<HTMLElement>("[data-spotlight]"))
		: [];
	const onPointerMove = (event: PointerEvent) => {
		const card = event.currentTarget as HTMLElement;
		const rect = card.getBoundingClientRect();
		card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
		card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
	};
	for (const card of spotlights) {
		card.addEventListener("pointermove", onPointerMove);
	}

	/* Live clock ----------------------------------------------------- */
	let dayKey = formatFullDate(startedAt);
	const interval = window.setInterval(() => {
		const now = new Date();
		updateClock(now);
		const today = formatFullDate(now);
		if (today !== dayKey) {
			dayKey = today;
			refreshMilestones(now);
			refreshGroups();
		}
	}, 1000);

	return () => {
		window.clearInterval(interval);
		window.removeEventListener("scroll", onScroll);
		window.removeEventListener("resize", onScroll);
		for (const card of spotlights) {
			card.removeEventListener("pointermove", onPointerMove);
		}
		if (frame) window.cancelAnimationFrame(frame);
	};
});
</script>

<div class="archive-page max-w-5xl mx-auto" bind:this={pageEl}>
	<!-- 时光收藏夹 ------------------------------------------------------ -->
	<section class="archive-hero" aria-labelledby="archive-hero-title">
		<span class="hero-orb hero-orb-a" aria-hidden="true"></span>
		<span class="hero-orb hero-orb-b" aria-hidden="true"></span>
		<span class="hero-stickers" aria-hidden="true">
			<i>♡</i><i>✦</i><i>₊˚⊹</i>
		</span>

		<div class="hero-main">
			<p class="hero-eyebrow">
				<Icon icon="material-symbols:history-rounded" />
				<span>时光收藏夹</span>
				<small>TIME CAPSULE</small>
			</p>
			<h1 id="archive-hero-title">
				写过的文章，都留在这里 <b>(｡•ᴗ•｡)♡</b>
			</h1>
			<p class="hero-sub">翻一翻过去的故事，也看看那时的自己。</p>

			<ul class="hero-stats">
				<li>
					<strong data-count-to={allPosts}>{allPosts}</strong>
					<span>篇文章</span>
				</li>
				<li>
					<strong data-count-to={allWords} data-count-format="words"
						>{formatWords(allWords)}</strong
					>
					<span>字</span>
				</li>
				<li>
					<strong data-count-to={yearsSpanned}>{yearsSpanned}</strong>
					<span>个年份</span>
				</li>
				<li>
					<strong data-count-to={daysSinceFirst}>{daysSinceFirst}</strong>
					<span>天相伴</span>
				</li>
			</ul>

			<div class="hero-actions">
				<button
					type="button"
					class="hero-roll"
					class:is-rolling={rolling}
					disabled={rolling}
					onclick={rollRandom}
				>
					<Icon icon="material-symbols:casino-outline-rounded" />
					<span class="roll-label">{rolling ? rollTitle : "随便翻一篇"}</span>
				</button>
				{#if latestPost}
					<a class="hero-latest" href={postHref(latestPost)}>
						<span>读最新的一篇</span>
						<Icon icon="material-symbols:arrow-forward-rounded" />
					</a>
				{/if}
			</div>
		</div>

		<aside class="hero-clock" aria-label="时间进度">
			<div class="clock-ring">
				<svg
					viewBox="0 0 120 120"
					role="img"
					aria-label={`${currentYear} 年已过 ${yearPercent.toFixed(1)}%，今天已过 ${dayPercent.toFixed(1)}%`}
				>
					<circle class="ring-track" cx="60" cy="60" r="52" />
					<circle
						class="ring-year"
						cx="60"
						cy="60"
						r="52"
						stroke-dasharray={OUTER_CIRCUMFERENCE}
						stroke-dashoffset={OUTER_CIRCUMFERENCE * (1 - yearPercent / 100)}
					/>
					<circle class="ring-track is-inner" cx="60" cy="60" r="39" />
					<circle
						class="ring-day"
						cx="60"
						cy="60"
						r="39"
						stroke-dasharray={INNER_CIRCUMFERENCE}
						stroke-dashoffset={INNER_CIRCUMFERENCE * (1 - dayPercent / 100)}
					/>
					<circle
						class="ring-spark"
						cx={60 + 52 * Math.cos((yearPercent / 100) * Math.PI * 2 - Math.PI / 2)}
						cy={60 + 52 * Math.sin((yearPercent / 100) * Math.PI * 2 - Math.PI / 2)}
						r="3.4"
					/>
				</svg>
				<div class="clock-core">
					<span class="clock-year">{currentYear}</span>
					<strong>{dayOfYear}<i>天</i></strong>
					<span class="clock-percent">今年 {yearPercent.toFixed(1)}%</span>
				</div>
			</div>
			<div class="clock-legend">
				<span><i class="legend-dot is-day"></i>今日 {dayPercent.toFixed(1)}%</span>
				<span class="clock-time">
					<Icon icon="material-symbols:schedule-outline-rounded" />
					{clockText}
				</span>
			</div>
		</aside>
	</section>

	<!-- 筛选状态 -------------------------------------------------------- -->
	{#if filterChips.length > 0}
		<div class="filter-bar" role="status">
			<span class="filter-icon" aria-hidden="true">
				<Icon icon="material-symbols:filter-alt-outline-rounded" />
			</span>
			<span class="filter-text">正在筛选</span>
			<div class="filter-chips">
				{#each filterChips as chip (chip.href)}
					<a class="filter-chip" href={chip.href}>{chip.label}</a>
				{/each}
			</div>
			<a class="filter-clear" href={archiveHref}>
				<Icon icon="material-symbols:close-rounded" />
				清除筛选
			</a>
		</div>
	{/if}

	<!-- 写作里程碑 ------------------------------------------------------ -->
	{#if firstPost && latestPost && longestPost && busiestYear}
		<section class="archive-card archive-milestones" aria-labelledby="archive-milestones-title">
			<header class="section-heading">
				<span class="section-icon"><Icon icon="material-symbols:auto-awesome-rounded" /></span>
				<div class="section-title">
					<p>WRITING MOMENTS</p>
					<h2 id="archive-milestones-title">写作里程碑</h2>
				</div>
				<span class="section-note">全部 {allPosts} 篇 · 从第一篇到现在 {daysSinceFirst} 天</span>
			</header>

			<div class="milestone-grid">
				<a
					class="milestone-card is-seed"
					href={postHref(firstPost)}
					data-spotlight
				>
					<span class="milestone-icon"><Icon icon="material-symbols:eco-outline-rounded" /></span>
					<p class="milestone-label">故事的起点</p>
					<strong class="milestone-title">{firstPost.title}</strong>
					<span class="milestone-meta">
						{formatFullDate(firstPost.date)} · 已经 {daysSinceFirst} 天
					</span>
				</a>

				<a class="milestone-card is-latest" href={postHref(latestPost)} data-spotlight>
					<span class="milestone-icon"><Icon icon="material-symbols:bolt-outline-rounded" /></span>
					<p class="milestone-label">最近更新</p>
					<strong class="milestone-title">{latestPost.title}</strong>
					<span class="milestone-meta">
						{formatFullDate(latestPost.date)} · {formatRelativeDays(daysSinceLatest)}
					</span>
				</a>

				<div class="milestone-card is-busy" data-spotlight>
					<span class="milestone-icon">
						<Icon icon="material-symbols:trophy-outline-rounded" />
					</span>
					<p class="milestone-label">笔耕最勤的一年</p>
					<strong class="milestone-title">{busiestYear.year} 年</strong>
					<span class="milestone-meta">
						{busiestYear.count} 篇 · 约 {formatWords(busiestYear.words)} 字
					</span>
				</div>

				<a class="milestone-card is-longest" href={postHref(longestPost)} data-spotlight>
					<span class="milestone-icon">
						<Icon icon="material-symbols:menu-book-outline-rounded" />
					</span>
					<p class="milestone-label">最长的一篇</p>
					<strong class="milestone-title">{longestPost.title}</strong>
					<span class="milestone-meta">约 {formatWords(longestPost.words)} 字</span>
				</a>
			</div>
		</section>

		<!-- 写作节律 ---------------------------------------------------- -->
		<section class="archive-card archive-rhythm" aria-labelledby="archive-rhythm-title">
			<header class="section-heading">
				<span class="section-icon"><Icon icon="material-symbols:bar-chart-rounded" /></span>
				<div class="section-title">
					<p>WRITING RHYTHM</p>
					<h2 id="archive-rhythm-title">写作节律</h2>
				</div>
				<span class="section-note">
					{totalPosts} 篇文字落在 {monthsWithPosts} 个月份里{#if busiestMonth >= 0}，最常在 {busiestMonth + 1} 月落笔{/if}
				</span>
			</header>

			<div
				class="rhythm-chart"
				role="img"
				aria-label={`各月发文数量：${monthCounts.map((count, index) => `${index + 1} 月 ${count} 篇`).join("，")}`}
			>
				{#each monthCounts as count, index}
					<div
						class="rhythm-col"
						class:is-peak={index === busiestMonth && count > 0}
						class:is-now={index === currentMonth}
					>
						<span class="rhythm-value">{count > 0 ? count : ""}</span>
						<span class="rhythm-track">
							<i
								class="rhythm-bar"
								style={`--bar-h:${count > 0 ? Math.max(12, (count / rhythmMax) * 100) : 0}%;--bar-delay:${index * 55}ms`}
							></i>
						</span>
						<span class="rhythm-label">{index + 1}</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- 时光回声 -------------------------------------------------------- -->
	{#if onThisDay}
		<a class="echo-bar is-flashback" href={postHref(onThisDay)}>
			<span class="echo-icon"><Icon icon="material-symbols:history-2-rounded" /></span>
			<span class="echo-text">
				往年今日 · {onThisDay.date.getFullYear()} 年的今天，你写下
			</span>
			<strong class="echo-title">「{onThisDay.title}」</strong>
			<span class="echo-arrow" aria-hidden="true">
				<Icon icon="material-symbols:arrow-forward-rounded" />
			</span>
		</a>
	{:else if latestPost}
		<div class="echo-bar is-quiet">
			<span class="echo-icon"><Icon icon="material-symbols:edit-note-rounded" /></span>
			<span class="echo-text">
				{#if daysSinceLatest <= 0}
					今天的故事已经写下了，慢慢来。
				{:else}
					今天还没有故事，最新的一篇停在 {formatRelativeDays(daysSinceLatest)}。
				{/if}
			</span>
			<a class="echo-link" href={postHref(latestPost)}>
				去翻一翻
				<Icon icon="material-symbols:arrow-forward-rounded" />
			</a>
		</div>
	{/if}

	<!-- 时间轴 ---------------------------------------------------------- -->
	<header class="timeline-head">
		<span class="section-icon"><Icon icon="material-symbols:timeline-rounded" /></span>
		<div class="section-title">
			<p>TIME LINE</p>
			<h2>按时间读回去</h2>
		</div>
		<span class="timeline-count">
			共 <b>{totalPosts}</b> 篇 · {groups.length} 个年份
		</span>
	</header>

	{#each groups as group (group.year)}
		<section class="archive-year" aria-labelledby={`archive-year-${group.year}`}>
			<header class="year-heading">
				<h3 class="year-number" id={`archive-year-${group.year}`}>{group.year}</h3>
				<div class="year-marker" data-rail="year"><span></span></div>
				<div class="year-summary">
					<div class="year-summary-main">
						<strong>
							{group.posts.length}
							{i18n(group.posts.length === 1 ? I18nKey.postCount : I18nKey.postsCount)}
						</strong>
						<span class="year-words">约 {formatWords(group.words)} 字</span>
						{#if group.year === currentYear}
							<em class="year-now">正在书写这一年</em>
						{/if}
					</div>
					<div class="year-meta">
						<span class="year-spark" aria-hidden="true">
							{#each group.months as count, index}
								<i
									class:has-post={count > 0}
									style={`--spark:${count > 0 ? 0.3 + (count / group.sparkMax) * 0.7 : 0.16}`}
									title={`${index + 1} 月 · ${count} 篇`}
								></i>
							{/each}
						</span>
						{#if group.topTags.length > 0}
							<span class="year-tags">
								{#each group.topTags as tag (tag.name)}
									<a href={getTagUrl(tag.name)}>#{tag.name}<i>{tag.count}</i></a>
								{/each}
							</span>
						{/if}
					</div>
				</div>
				<span class="year-spacer" aria-hidden="true"></span>
			</header>

			{#each group.posts as post (post.slug)}
				<a
					class="timeline-entry"
					class:is-pinned={post.pinned}
					class:is-active={post.slug === activeSlug}
					href={postHref(post)}
					aria-label={post.title}
					data-rail="entry"
					data-slug={post.slug}
				>
					<time datetime={toIsoDate(post.date)} title={formatFullDate(post.date)}>
						<b>{formatMonthDay(post.date)}</b>
						<span>{WEEKDAYS[post.date.getDay()]}</span>
					</time>
					<div class="entry-marker" data-rail="dot"><span></span></div>
					<div class="entry-content">
						<div class="entry-title">
							{#if post.pinned}
								<em class="entry-badge is-pin">置顶</em>
							{/if}
							{#if latestPost && post.slug === latestPost.slug}
								<em class="entry-badge is-new">最新</em>
							{/if}
							<strong>{post.title}</strong>
							<span class="entry-leader" aria-hidden="true"></span>
							{#if post.words > 0}
								<span class="entry-words">{formatWords(post.words)} 字</span>
							{/if}
						</div>
						<div class="entry-meta">
							<span class="entry-tags">
								{#if post.tags.length > 0}
									{#each post.tags as tag (tag)}<i>#{tag}</i>{/each}
								{:else}
									<i class="is-empty">{i18n(I18nKey.noTags)}</i>
								{/if}
							</span>
							{#if post.category}
								<span class="entry-category">{post.category}</span>
							{/if}
						</div>
					</div>
					<span class="entry-arrow" aria-hidden="true">
						<Icon icon="material-symbols:arrow-forward-rounded" />
					</span>
				</a>
			{/each}
		</section>
	{/each}

	{#if groups.length === 0}
		<div class="archive-empty">
			<span class="empty-face">(˶ᵔ ᵕ ᵔ˶)</span>
			<h3>这个筛选下还没有故事</h3>
			<p>换一个标签看看，或者把筛选清掉。</p>
			<a class="empty-clear" href={archiveHref}>
				<Icon icon="material-symbols:restart-alt-rounded" />
				清除筛选
			</a>
		</div>
	{:else}
		<footer class="archive-outro">
			<span class="outro-rule" aria-hidden="true"><i></i><Icon icon="material-symbols:graphic-eq-rounded" /><i></i></span>
			<p>故事还在继续 <b>( ˶ˆ ᗜ ˆ˵ )</b></p>
			{#if latestPost}
				<a href={postHref(latestPost)}>回溯到最近的一篇</a>
			{/if}
		</footer>
	{/if}
</div>

<style>
	.archive-page {
		padding: 1rem 1.25rem 3rem;
	}

	/* ---------------------------------------------------------- heading */

	.section-heading,
	.timeline-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.section-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.1rem;
		height: 2.1rem;
		border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
		border-radius: 0.75rem;
		background: color-mix(in srgb, var(--primary) 11%, transparent);
		color: var(--primary);
		font-size: 1.15rem;
	}

	.section-title {
		min-width: 0;
	}

	.section-title p {
		margin: 0;
		color: color-mix(in srgb, var(--primary) 78%, var(--text-muted));
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.16em;
	}

	.section-title h2 {
		margin: 0.05rem 0 0;
		color: var(--text-strong);
		font-size: 1rem;
		font-weight: 750;
	}

	.section-note {
		margin-left: auto;
		color: var(--text-muted);
		font-size: 0.7rem;
		text-align: right;
	}

	.archive-card {
		position: relative;
		overflow: hidden;
		margin-bottom: 1.15rem;
		padding: 1.15rem 1.3rem 1.25rem;
		border: 1px solid color-mix(in srgb, var(--primary) 15%, var(--glass-border));
		border-radius: 1.5rem;
		background:
			linear-gradient(140deg, color-mix(in srgb, var(--primary) 7%, transparent), transparent 52%),
			var(--glass-card);
		box-shadow: 0 1rem 2.4rem rgb(118 80 68 / 0.07);
		backdrop-filter: blur(22px);
		animation: card-rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	/* ------------------------------------------------------------- hero */

	.archive-hero {
		position: relative;
		overflow: hidden;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1.5rem;
		align-items: center;
		margin-bottom: 1.15rem;
		padding: 1.5rem 1.6rem 1.35rem;
		border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--glass-border));
		border-radius: 1.6rem;
		background:
			radial-gradient(circle at 6% 10%, color-mix(in srgb, var(--primary) 13%, transparent), transparent 42%),
			linear-gradient(130deg, color-mix(in srgb, var(--primary) 9%, transparent), transparent 55%),
			var(--glass-card);
		box-shadow: 0 1.15rem 2.8rem rgb(118 80 68 / 0.08);
		backdrop-filter: blur(26px);
		animation: card-rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.hero-orb {
		position: absolute;
		border-radius: 999px;
		filter: blur(46px);
		pointer-events: none;
	}

	.hero-orb-a {
		width: 13rem;
		height: 13rem;
		right: -3.5rem;
		top: -5rem;
		background: color-mix(in srgb, var(--primary) 26%, transparent);
		animation: orb-drift 13s ease-in-out infinite;
	}

	.hero-orb-b {
		width: 9rem;
		height: 9rem;
		left: -3rem;
		bottom: -4rem;
		background: color-mix(in srgb, var(--mio-purple) 22%, transparent);
		animation: orb-drift 17s ease-in-out infinite reverse;
	}

	.hero-stickers {
		position: absolute;
		right: 1.4rem;
		top: 0.95rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: color-mix(in srgb, var(--primary) 70%, white);
		pointer-events: none;
	}

	.hero-stickers i {
		font-style: normal;
		font-size: 0.72rem;
		font-weight: 800;
	}

	.hero-stickers i:nth-child(1) {
		font-size: 1.2rem;
		transform: rotate(-12deg);
	}

	.hero-stickers i:nth-child(2) {
		animation: sticker-twinkle 2.6s ease-in-out infinite;
	}

	.hero-main {
		position: relative;
		min-width: 0;
	}

	.hero-eyebrow {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0 0 0.3rem;
		color: var(--primary);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.06em;
	}

	.hero-eyebrow small {
		margin-left: 0.2rem;
		color: color-mix(in srgb, var(--primary) 45%, var(--text-muted));
		font-size: 0.56rem;
		letter-spacing: 0.16em;
	}

	.hero-main h1 {
		margin: 0;
		color: var(--text-strong);
		font-size: clamp(1.35rem, 2.6vw, 1.85rem);
		font-weight: 800;
		line-height: 1.25;
	}

	.hero-main h1 b {
		display: inline-block;
		margin-left: 0.25rem;
		color: var(--primary);
		font-size: 0.66em;
		font-weight: 700;
		white-space: nowrap;
		transform: rotate(-2deg);
	}

	.hero-sub {
		margin: 0.4rem 0 0;
		color: var(--text-muted);
		font-size: 0.78rem;
	}

	.hero-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem 1.5rem;
		margin: 1.05rem 0 0;
		padding: 0;
		list-style: none;
	}

	.hero-stats li {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.hero-stats strong {
		color: var(--primary);
		font-size: 1.18rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.01em;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1.1rem;
	}

	.hero-roll {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		max-width: 15rem;
		padding: 0.5rem 0.95rem;
		border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 12%, transparent);
		color: var(--primary);
		font-family: inherit;
		font-size: 0.76rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			transform 0.22s ease,
			background-color 0.22s ease,
			box-shadow 0.22s ease;
	}

	.hero-roll:hover:not(:disabled) {
		transform: translateY(-0.1rem);
		background: color-mix(in srgb, var(--primary) 20%, transparent);
		box-shadow: 0 0.55rem 1.2rem color-mix(in srgb, var(--primary) 18%, transparent);
	}

	.hero-roll:disabled {
		cursor: progress;
	}

	.roll-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hero-roll.is-rolling .roll-label {
		opacity: 0.72;
	}

	.hero-latest {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.7rem;
		border-radius: 999px;
		color: var(--text-muted);
		font-size: 0.76rem;
		font-weight: 600;
		transition:
			color 0.22s ease,
			background-color 0.22s ease;
	}

	.hero-latest:hover {
		color: var(--primary);
		background: color-mix(in srgb, var(--primary) 9%, transparent);
	}

	.hero-latest :global(svg) {
		transition: transform 0.22s ease;
	}

	.hero-latest:hover :global(svg) {
		transform: translateX(0.18rem);
	}

	/* ------------------------------------------------------- hero clock */

	.hero-clock {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding-right: 0.2rem;
	}

	.clock-ring {
		position: relative;
		width: 8.6rem;
		height: 8.6rem;
	}

	.clock-ring svg {
		width: 100%;
		height: 100%;
		overflow: visible;
		transform: rotate(-90deg);
	}

	.ring-track,
	.ring-year,
	.ring-day {
		fill: none;
		stroke-linecap: round;
	}

	.ring-track {
		stroke: color-mix(in srgb, var(--text-muted) 16%, transparent);
		stroke-width: 8;
	}

	.ring-track.is-inner {
		stroke-width: 5;
	}

	.ring-year {
		stroke: var(--primary);
		stroke-width: 8;
		transition: stroke-dashoffset 0.7s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.ring-day {
		stroke: color-mix(in srgb, var(--primary) 45%, var(--azusa-blue));
		stroke-width: 5;
		transition: stroke-dashoffset 0.7s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.ring-spark {
		fill: var(--primary);
		animation: spark-pulse 2.4s ease-in-out infinite;
	}

	.clock-core {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.05rem;
		text-align: center;
	}

	.clock-year {
		color: var(--text-muted);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.12em;
	}

	.clock-core strong {
		color: var(--text-strong);
		font-size: 1.5rem;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.clock-core strong i {
		margin-left: 0.1rem;
		color: var(--text-muted);
		font-size: 0.56rem;
		font-style: normal;
		font-weight: 700;
	}

	.clock-percent {
		color: var(--primary);
		font-size: 0.6rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.clock-legend {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		color: var(--text-muted);
		font-size: 0.62rem;
		font-variant-numeric: tabular-nums;
	}

	.clock-legend > span {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
	}

	.clock-time {
		letter-spacing: 0.06em;
	}

	.legend-dot {
		width: 0.42rem;
		height: 0.42rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 45%, var(--azusa-blue));
	}

	/* ------------------------------------------------------------ filter */

	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.15rem;
		padding: 0.6rem 0.9rem;
		border: 1px dashed color-mix(in srgb, var(--primary) 34%, transparent);
		border-radius: 1.1rem;
		background: color-mix(in srgb, var(--primary) 7%, transparent);
		color: var(--text-muted);
		font-size: 0.72rem;
		animation: card-rise 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.filter-icon {
		display: grid;
		place-items: center;
		color: var(--primary);
		font-size: 1rem;
	}

	.filter-text {
		font-weight: 700;
	}

	.filter-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.filter-chip {
		padding: 0.18rem 0.55rem;
		border: 1px solid color-mix(in srgb, var(--primary) 26%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		color: var(--primary);
		font-weight: 700;
		transition: background-color 0.2s ease;
	}

	.filter-chip:hover {
		background: color-mix(in srgb, var(--primary) 20%, transparent);
	}

	.filter-clear,
	.empty-clear {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		margin-left: auto;
		color: var(--text-muted);
		font-weight: 600;
		transition: color 0.2s ease;
	}

	.filter-clear:hover,
	.empty-clear:hover {
		color: var(--primary);
	}

	/* ------------------------------------------------------- milestones */

	.milestone-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11.5rem, 1fr));
		gap: 0.7rem;
		margin-top: 0.95rem;
	}

	.milestone-card {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.85rem 0.9rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--primary) 14%, var(--glass-border));
		border-radius: 1.1rem;
		background: color-mix(in srgb, var(--card-bg) 62%, transparent);
		color: inherit;
		transition:
			transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.28s ease,
			box-shadow 0.28s ease;
	}

	.milestone-card::before {
		content: "";
		position: absolute;
		inset: 0;
		background: radial-gradient(
			16rem circle at var(--spot-x, 50%) var(--spot-y, 0%),
			color-mix(in srgb, var(--primary) 15%, transparent),
			transparent 62%
		);
		opacity: 0;
		transition: opacity 0.35s ease;
		pointer-events: none;
	}

	.milestone-card:hover {
		transform: translateY(-0.18rem);
		border-color: color-mix(in srgb, var(--primary) 32%, transparent);
		box-shadow: 0 0.85rem 1.8rem color-mix(in srgb, var(--primary) 13%, transparent);
	}

	.milestone-card:hover::before {
		opacity: 1;
	}

	.milestone-icon {
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--primary) 12%, transparent);
		color: var(--primary);
		font-size: 0.95rem;
	}

	.milestone-label {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	.milestone-title {
		display: block;
		overflow: hidden;
		color: var(--text-body);
		font-size: 0.86rem;
		font-weight: 700;
		line-height: 1.4;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.milestone-card:hover .milestone-title {
		color: var(--primary);
	}

	.milestone-meta {
		margin-top: auto;
		padding-top: 0.2rem;
		color: var(--text-muted);
		font-size: 0.62rem;
		font-variant-numeric: tabular-nums;
	}

	.milestone-card.is-seed .milestone-icon {
		background: color-mix(in srgb, #6fae7f 16%, transparent);
		color: color-mix(in srgb, #4f9a63 80%, var(--text-body));
	}

	.milestone-card.is-latest .milestone-icon {
		background: color-mix(in srgb, var(--azusa-blue) 18%, transparent);
		color: color-mix(in srgb, var(--azusa-blue) 85%, var(--text-body));
	}

	.milestone-card.is-busy .milestone-icon {
		background: color-mix(in srgb, #e0a94a 18%, transparent);
		color: color-mix(in srgb, #d09230 85%, var(--text-body));
	}

	.milestone-card.is-longest .milestone-icon {
		background: color-mix(in srgb, var(--mio-purple) 18%, transparent);
		color: color-mix(in srgb, var(--mio-purple) 85%, var(--text-body));
	}

	/* ----------------------------------------------------------- rhythm */

	.rhythm-chart {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 0.3rem;
		margin-top: 1rem;
	}

	.rhythm-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}

	.rhythm-value {
		min-height: 0.85rem;
		color: var(--text-muted);
		font-size: 0.6rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.rhythm-track {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		width: 100%;
		height: 4.4rem;
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--text-muted) 7%, transparent);
	}

	.rhythm-bar {
		display: block;
		width: 62%;
		height: var(--bar-h);
		min-height: 0.22rem;
		border-radius: 0.5rem 0.5rem 0.28rem 0.28rem;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--primary) 62%, #ffd7a8),
			var(--primary)
		);
		transform-origin: bottom center;
		animation: bar-grow 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: var(--bar-delay, 0ms);
	}

	.rhythm-col.is-peak .rhythm-bar {
		background: linear-gradient(180deg, var(--primary), color-mix(in srgb, var(--primary) 72%, #ffb37a));
		box-shadow: 0 0 0 0.15rem color-mix(in srgb, var(--primary) 16%, transparent);
	}

	.rhythm-col.is-peak .rhythm-value {
		color: var(--primary);
	}

	.rhythm-col.is-now .rhythm-track {
		background: color-mix(in srgb, var(--primary) 12%, transparent);
	}

	.rhythm-label {
		color: var(--text-muted);
		font-size: 0.6rem;
		font-variant-numeric: tabular-nums;
	}

	.rhythm-col.is-now .rhythm-label {
		color: var(--primary);
		font-weight: 700;
	}

	/* ------------------------------------------------------------- echo */

	.echo-bar {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-bottom: 1.15rem;
		padding: 0.7rem 1rem;
		border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--glass-border));
		border-radius: 1.1rem;
		background: color-mix(in srgb, var(--glass-card) 78%, transparent);
		color: var(--text-muted);
		font-size: 0.75rem;
		backdrop-filter: blur(14px);
		transition:
			border-color 0.25s ease,
			transform 0.25s ease,
			box-shadow 0.25s ease;
	}

	.echo-bar.is-flashback {
		border-style: dashed;
		animation: card-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.echo-bar.is-flashback:hover {
		transform: translateY(-0.12rem);
		border-color: color-mix(in srgb, var(--primary) 38%, transparent);
		box-shadow: 0 0.7rem 1.6rem color-mix(in srgb, var(--primary) 12%, transparent);
	}

	.echo-icon {
		display: grid;
		place-items: center;
		flex: none;
		color: var(--primary);
		font-size: 1.05rem;
	}

	.echo-text {
		flex: none;
	}

	.echo-title {
		overflow: hidden;
		color: var(--text-body);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.echo-bar.is-flashback:hover .echo-title {
		color: var(--primary);
	}

	.echo-arrow {
		display: grid;
		place-items: center;
		margin-left: auto;
		color: var(--primary);
		font-size: 1rem;
		transition: transform 0.25s ease;
	}

	.echo-bar.is-flashback:hover .echo-arrow {
		transform: translateX(0.2rem);
	}

	.echo-link {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		margin-left: auto;
		color: var(--primary);
		font-weight: 700;
		white-space: nowrap;
	}

	.echo-link :global(svg) {
		transition: transform 0.25s ease;
	}

	.echo-link:hover :global(svg) {
		transform: translateX(0.2rem);
	}

	/* --------------------------------------------------------- timeline */

	.timeline-head {
		margin: 1.55rem 0 0.9rem;
		padding: 0 0.7rem;
	}

	.timeline-count {
		margin-left: auto;
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.timeline-count b {
		color: var(--primary);
		font-size: 0.85rem;
	}

	.archive-year {
		position: relative;
		margin-bottom: 1.5rem;
		padding: 0.4rem 0.7rem 0.75rem;
		border-radius: 1.5rem;
	}

	.year-heading,
	.timeline-entry {
		display: grid;
		grid-template-columns: 5rem 2.5rem minmax(0, 1fr) 2rem;
		align-items: center;
	}

	.year-heading {
		min-height: 4.9rem;
	}

	.year-number {
		margin: 0;
		color: var(--text-strong);
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-align: right;
		line-height: 1;
	}

	.year-marker,
	.entry-marker {
		position: relative;
		align-self: stretch;
		display: grid;
		place-items: center;
	}

	.year-marker::before,
	.year-marker::after,
	.entry-marker::before,
	.entry-marker::after {
		content: "";
		position: absolute;
		left: 50%;
		width: 2px;
		border-radius: 999px;
		transform: translateX(-50%);
	}

	.year-marker::before,
	.entry-marker::before {
		top: 0;
		bottom: 0;
		background: color-mix(in srgb, var(--primary) 13%, transparent);
	}

	.year-marker::after,
	.entry-marker::after {
		top: 0;
		height: var(--rail-fill, 0%);
		background: linear-gradient(
			var(--primary),
			color-mix(in srgb, var(--primary) 42%, transparent)
		);
		transition: height 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.year-marker::before,
	.year-marker::after {
		top: 50%;
	}

	.archive-year > .timeline-entry:last-child .entry-marker::before {
		bottom: 50%;
	}

	.archive-year > .timeline-entry:last-child .entry-marker::after {
		top: 0;
		height: calc(var(--rail-fill, 0%) * 0.5);
	}

	.year-marker span {
		z-index: 1;
		width: 1.05rem;
		height: 1.05rem;
		border: 3px solid color-mix(in srgb, var(--primary) 78%, white);
		border-radius: 999px;
		background: var(--glass-card);
		box-shadow: 0 0 0 0.3rem color-mix(in srgb, var(--primary) 10%, transparent);
	}

	.year-summary {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.year-summary-main {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
	}

	.year-summary-main strong {
		color: var(--text-body);
		font-size: 0.88rem;
	}

	.year-words {
		color: var(--text-muted);
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
	}

	.year-now {
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 13%, transparent);
		color: var(--primary);
		font-size: 0.6rem;
		font-style: normal;
		font-weight: 700;
	}

	.year-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.85rem;
	}

	.year-spark {
		display: flex;
		align-items: flex-end;
		gap: 0.16rem;
		height: 0.95rem;
	}

	.year-spark i {
		display: block;
		width: 0.22rem;
		height: calc(var(--spark, 0.16) * 0.95rem);
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-muted) 22%, transparent);
		transition: background-color 0.25s ease;
	}

	.year-spark i.has-post {
		background: color-mix(in srgb, var(--primary) 55%, transparent);
	}

	.year-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.year-tags a {
		display: inline-flex;
		align-items: center;
		gap: 0.22rem;
		padding: 0.1rem 0.42rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-muted) 9%, transparent);
		color: var(--text-muted);
		font-size: 0.62rem;
		transition:
			color 0.2s ease,
			background-color 0.2s ease;
	}

	.year-tags a i {
		font-style: normal;
		opacity: 0.62;
		font-variant-numeric: tabular-nums;
	}

	.year-tags a:hover {
		background: color-mix(in srgb, var(--primary) 14%, transparent);
		color: var(--primary);
	}

	.year-spacer {
		display: block;
	}

	/* --------------------------------------------------------- entries */

	.timeline-entry {
		position: relative;
		min-height: 4.2rem;
		color: inherit;
		border: 1px solid transparent;
		border-radius: 1.15rem;
		transition:
			transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
			background-color 0.25s ease,
			border-color 0.25s ease,
			box-shadow 0.25s ease;
	}

	.timeline-entry:hover,
	.timeline-entry.is-active {
		border-color: color-mix(in srgb, var(--primary) 18%, transparent);
		background: color-mix(in srgb, var(--glass-card) 82%, transparent);
	}

	.timeline-entry:hover {
		transform: translateX(0.3rem);
		box-shadow: 0 0.7rem 1.8rem rgb(118 80 68 / 0.06);
	}

	.timeline-entry time {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.timeline-entry time b {
		font-weight: 700;
	}

	.timeline-entry time span {
		font-size: 0.6rem;
		opacity: 0.66;
	}

	.entry-marker span {
		z-index: 1;
		width: 0.52rem;
		height: 0.52rem;
		border: 2px solid var(--glass-card);
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 58%, var(--text-muted));
		transition:
			transform 0.25s ease,
			background-color 0.25s ease,
			box-shadow 0.25s ease;
	}

	.timeline-entry:hover .entry-marker span,
	.timeline-entry.is-active .entry-marker span {
		transform: scale(1.45);
		background: var(--primary);
		box-shadow: 0 0 0 0.3rem color-mix(in srgb, var(--primary) 13%, transparent);
	}

	.entry-content {
		min-width: 0;
		padding: 0.7rem 0.5rem;
	}

	.entry-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.entry-title strong {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		color: var(--text-body);
		font-size: 0.98rem;
		font-weight: 650;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: color 0.25s ease;
	}

	.entry-leader {
		flex: 1 1 1.5rem;
		min-width: 1.25rem;
		height: 0;
		margin: 0 0.1rem;
		border-bottom: 1px dotted color-mix(in srgb, var(--primary) 30%, transparent);
		transform: translateY(-0.08rem);
		transition: border-color 0.25s ease;
	}

	.timeline-entry:hover .entry-leader,
	.timeline-entry.is-active .entry-leader {
		border-bottom-color: color-mix(in srgb, var(--primary) 60%, transparent);
	}

	.timeline-entry:hover .entry-title strong,
	.timeline-entry.is-active .entry-title strong {
		color: var(--primary);
	}

	.entry-badge {
		flex: none;
		padding: 0.06rem 0.34rem;
		border-radius: 999px;
		font-size: 0.56rem;
		font-style: normal;
		font-weight: 800;
		letter-spacing: 0.04em;
	}

	.entry-badge.is-pin {
		background: color-mix(in srgb, var(--primary) 16%, transparent);
		color: var(--primary);
	}

	.entry-badge.is-new {
		background: color-mix(in srgb, #6fae7f 20%, transparent);
		color: color-mix(in srgb, #4f9a63 88%, var(--text-body));
	}

	.entry-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.3rem;
	}

	.entry-tags {
		display: flex;
		min-width: 0;
		gap: 0.35rem;
		overflow: hidden;
		color: var(--text-body);
		font-size: 0.66rem;
		white-space: nowrap;
		/* 不再做右侧渐隐：短标签的最后一个字也会被吃掉，超长时直接裁切 */
	}

	.entry-tags i {
		font-style: normal;
	}

	.entry-tags i.is-empty {
		opacity: 0.7;
	}

	.entry-category {
		flex: none;
		padding: 0.06rem 0.44rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-muted) 8%, transparent);
		color: var(--text-body);
		font-size: 0.62rem;
	}

	.entry-words {
		flex: none;
		padding-left: 0.1rem;
		color: color-mix(in srgb, var(--text-muted) 92%, var(--primary));
		font-size: 0.64rem;
		font-variant-numeric: tabular-nums;
	}

	.entry-arrow {
		display: grid;
		place-items: center;
		color: var(--primary);
		font-size: 1.05rem;
		opacity: 0;
		transform: translateX(-0.35rem);
		transition:
			opacity 0.25s ease,
			transform 0.25s ease;
	}

	.timeline-entry:hover .entry-arrow,
	.timeline-entry.is-active .entry-arrow {
		opacity: 1;
		transform: translateX(0);
	}

	/* ------------------------------------------------------ empty/outro */

	.archive-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 3rem 1rem;
		border: 1px dashed color-mix(in srgb, var(--primary) 30%, transparent);
		border-radius: 1.5rem;
		background: color-mix(in srgb, var(--primary) 5%, transparent);
		text-align: center;
	}

	.empty-face {
		color: var(--primary);
		font-size: 1.4rem;
		font-weight: 700;
	}

	.archive-empty h3 {
		margin: 0;
		color: var(--text-strong);
		font-size: 1rem;
	}

	.archive-empty p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.76rem;
	}

	.empty-clear {
		margin: 0.6rem 0 0;
		padding: 0.42rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--primary) 28%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 11%, transparent);
		color: var(--primary);
		font-size: 0.74rem;
		font-weight: 700;
	}

	.archive-outro {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		padding: 1.6rem 1rem 0.5rem;
		color: var(--text-muted);
		font-size: 0.74rem;
	}

	.outro-rule {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: min(16rem, 80%);
		color: color-mix(in srgb, var(--primary) 62%, transparent);
	}

	.outro-rule i {
		flex: 1;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--primary) 42%, transparent)
		);
	}

	.outro-rule i:last-child {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--primary) 42%, transparent),
			transparent
		);
	}

	.archive-outro p {
		margin: 0;
	}

	.archive-outro b {
		color: var(--primary);
		font-weight: 700;
	}

	.archive-outro a {
		color: var(--text-muted);
		font-size: 0.72rem;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--primary) 35%, transparent);
		text-underline-offset: 0.25rem;
		transition: color 0.2s ease;
	}

	.archive-outro a:hover {
		color: var(--primary);
	}

	/* ------------------------------------------------------- animations */

	@keyframes card-rise {
		from {
			opacity: 0;
			translate: 0 0.9rem;
		}
		to {
			opacity: 1;
			translate: 0 0;
		}
	}

	@keyframes bar-grow {
		from {
			transform: scaleY(0.02);
			opacity: 0.2;
		}
		to {
			transform: scaleY(1);
			opacity: 1;
		}
	}

	@keyframes orb-drift {
		0%,
		100% {
			transform: translate3d(0, 0, 0) scale(1);
		}
		50% {
			transform: translate3d(-0.7rem, 0.8rem, 0) scale(1.06);
		}
	}

	@keyframes sticker-twinkle {
		0%,
		100% {
			opacity: 0.45;
			transform: scale(0.85) rotate(0deg);
		}
		50% {
			opacity: 1;
			transform: scale(1.15) rotate(12deg);
		}
	}

	@keyframes spark-pulse {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 1;
		}
	}

	@supports (animation-timeline: view()) {
		@media (prefers-reduced-motion: no-preference) {
			.archive-year > .timeline-entry {
				animation: entry-rise linear both;
				animation-timeline: view();
				/* entry 100% 在元素完全进入视口时收尾；若用 cover 26%，
				   页面末尾的条目因滚动距离不足会永远停在半透明状态。 */
				animation-range: entry 0% entry 100%;
			}

			.year-heading {
				animation: entry-rise linear both;
				animation-timeline: view();
				animation-range: entry 0% entry 100%;
			}
		}
	}

	@keyframes entry-rise {
		from {
			opacity: 0;
			translate: 0 0.9rem;
		}
		to {
			opacity: 1;
			translate: 0 0;
		}
	}

	/* ------------------------------------------------------ responsive */

	@media (max-width: 640px) {
		.archive-page {
			padding: 0.5rem 0 2rem;
		}

		.archive-hero {
			grid-template-columns: minmax(0, 1fr);
			gap: 1rem;
			padding: 1.2rem 1.15rem 1.15rem;
			border-radius: 1.4rem;
		}

		.hero-clock {
			flex-direction: row;
			justify-content: center;
			gap: 1rem;
			padding: 0;
		}

		.clock-ring {
			width: 6.6rem;
			height: 6.6rem;
		}

		.clock-core strong {
			font-size: 1.15rem;
		}

		.hero-stickers {
			right: 0.9rem;
			top: 0.7rem;
		}

		.hero-main h1 b {
			display: block;
			width: max-content;
			margin: 0.35rem 0 0;
		}

		.hero-stats {
			gap: 0.5rem 1.05rem;
		}

		.section-note {
			display: none;
		}

		.archive-card {
			padding: 1rem 0.95rem 1.1rem;
			border-radius: 1.3rem;
		}

		.milestone-grid {
			grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
		}

		.rhythm-chart {
			gap: 0.18rem;
		}

		.rhythm-track {
			height: 3.4rem;
		}

		.echo-bar {
			flex-wrap: wrap;
		}

		.echo-title {
			flex: 1 1 100%;
			white-space: normal;
		}

		.archive-year {
			padding-inline: 0;
		}

		.year-heading,
		.timeline-entry {
			grid-template-columns: 3.4rem 2rem minmax(0, 1fr) 1.6rem;
		}

		.year-number {
			font-size: 1.45rem;
		}

		.timeline-entry time span {
			display: none;
		}

		.entry-title strong {
			font-size: 0.88rem;
		}

		.entry-arrow {
			opacity: 0.5;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.archive-card,
		.archive-hero,
		.filter-bar,
		.echo-bar.is-flashback,
		.rhythm-bar {
			animation: none;
		}

		.hero-orb,
		.hero-stickers i,
		.ring-spark {
			animation: none;
		}

		.timeline-entry,
		.entry-marker span,
		.entry-arrow,
		.milestone-card,
		.milestone-card::before,
		.echo-bar,
		.year-marker::after,
		.entry-marker::after,
		.ring-year,
		.ring-day {
			transition: none;
		}
	}
</style>
