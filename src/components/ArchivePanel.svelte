<script lang="ts">
import { onMount } from "svelte";
import Icon from "@iconify/svelte";

import I18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import { getPostUrlBySlug } from "../utils/url-utils";

export let tags: string[] = [];
export let categories: string[] = [];
export let sortedPosts: Post[] = [];
export let initialNow: string;

let uncategorized: string | null = null;

interface Post {
	slug: string;
	data: {
		title: string;
		tags: string[];
		category?: string | null;
		published: Date;
	};
}

interface Group {
	year: number;
	posts: Post[];
}

let groups: Group[] = [];

let currentYearPosts = 0;
let totalPosts = 0;
let currentYear = new Date(initialNow).getFullYear();
let dayOfYear = 0;
let yearPassedPercent = "0.0";
let todayPassedPercent = "0.0";

function updateTimeStats(now = new Date()) {
    currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const diff = now.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    
    dayOfYear = Math.floor(diff / oneDay) + 1;
    
    const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
    const daysInYear = isLeapYear ? 366 : 365;
    yearPassedPercent = ((dayOfYear / daysInYear) * 100).toFixed(4);
    
    const startOfDay = new Date(currentYear, now.getMonth(), now.getDate());
    const timePassedToday = now.getTime() - startOfDay.getTime();
    todayPassedPercent = ((timePassedToday / oneDay) * 100).toFixed(4);
}

function formatDate(date: Date) {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${month}-${day}`;
}

function formatTag(tagList: string[]) {
	return (tagList || []).map((t) => `#${t}`).join(" ");
}

function refreshGroups() {
	let filteredPosts: Post[] = sortedPosts;

	if (tags.length > 0) {
		filteredPosts = filteredPosts.filter(
			(post) =>
				Array.isArray(post.data.tags) &&
				post.data.tags.some((tag) => tags.includes(tag)),
		);
	}

	if (categories.length > 0) {
		filteredPosts = filteredPosts.filter(
			(post) => post.data.category && categories.includes(post.data.category),
		);
	}

	if (uncategorized) {
		filteredPosts = filteredPosts.filter((post) => !post.data.category);
	}

	const grouped = filteredPosts.reduce(
		(acc, post) => {
			const year = post.data.published.getFullYear();
			if (!acc[year]) {
				acc[year] = [];
			}
			acc[year].push(post);
			return acc;
		},
		{} as Record<number, Post[]>,
	);

	const groupedPostsArray = Object.keys(grouped).map((yearStr) => ({
		year: Number.parseInt(yearStr, 10),
		posts: grouped[Number.parseInt(yearStr, 10)],
	}));

	groupedPostsArray.sort((a, b) => b.year - a.year);

	groups = groupedPostsArray;
	totalPosts = filteredPosts.length;
	currentYearPosts = groups.find(g => g.year === currentYear)?.posts.length || 0;
}

// Render the complete timeline on the server so the footer cannot flash into
// its place while the Svelte component is still loading in the browser.
refreshGroups();
updateTimeStats(new Date(initialNow));

onMount(() => {
	const params = new URLSearchParams(window.location.search);
	tags = params.has("tag") ? params.getAll("tag") : [];
	categories = params.has("category") ? params.getAll("category") : [];
	uncategorized = params.get("uncategorized");
	updateTimeStats();
	refreshGroups();
	const interval = setInterval(updateTimeStats, 1000);
	return () => clearInterval(interval);
});
</script>

<div class="archive-page max-w-5xl mx-auto">
    <section class="archive-overview" aria-label="时光轴概览">
        <div class="overview-glow" aria-hidden="true"></div>
        <div class="overview-stickers" aria-hidden="true">
            <span>♡</span><span>✦</span><span>₊˚⊹</span>
        </div>
        <div class="overview-heading">
            <div>
                <p><Icon icon="material-symbols:history-rounded" /> 时光收藏夹</p>
                <h1>写过的文章，都留在这里 <b>(｡•ᴗ•｡)♡</b></h1>
                <span>翻一翻过去的故事，也看看那时的自己。</span>
            </div>
        </div>

        <div class="overview-metrics">
            <span><strong>{totalPosts}</strong> 篇文章</span>
            <i aria-hidden="true"></i>
            <span>跨越 <strong>{groups.length}</strong> 个年份</span>
            <i aria-hidden="true"></i>
            <span>{currentYear} 年已更新 <strong>{currentYearPosts}</strong> 篇</span>
            <i aria-hidden="true"></i>
            <span>今天是第 <strong>{dayOfYear}</strong> 天</span>
        </div>

        <div class="progress-list">
            <div class="progress-item">
                <div><span>今年的旅程</span><strong>{yearPassedPercent}%</strong></div>
                <div class="progress-track"><span style={`width: ${yearPassedPercent}%`}></span></div>
            </div>
            <div class="progress-item">
                <div><span>今天的时光</span><strong>{todayPassedPercent}%</strong></div>
                <div class="progress-track progress-track-day"><span style={`width: ${todayPassedPercent}%`}></span></div>
            </div>
        </div>
    </section>

    {#each groups as group}
        <section class="archive-year">
            <header class="year-heading">
                <div class="year-number">{group.year}</div>
                <div class="year-marker"><span></span></div>
                <div class="year-summary">
                    <strong>{group.posts.length} {i18n(group.posts.length === 1 ? I18nKey.postCount : I18nKey.postsCount)}</strong>
                    <span>{group.year === currentYear ? '正在书写这一年' : '这一年的文字收藏'}</span>
                </div>
            </header>

            {#each group.posts as post}
                <a
                    href={getPostUrlBySlug(post.slug)}
                    aria-label={post.data.title}
                    class="timeline-entry"
                >
                    <time>{formatDate(post.data.published)}</time>
                    <div class="entry-marker"><span></span></div>
                    <div class="entry-content">
                        <strong title={post.data.title}>
                            {post.data.title}
                        </strong>
                        <div class="entry-tags">{formatTag(post.data.tags) || '未设置标签'}</div>
                    </div>
                    <div class="entry-arrow" aria-hidden="true">
                        <Icon icon="material-symbols:arrow-forward-rounded" />
                    </div>
                </a>
            {/each}
        </section>
    {/each}
</div>

<style>
    .archive-page {
        padding: 1rem 1.25rem 3rem;
    }

    .archive-overview {
        position: relative;
        overflow: hidden;
        margin-bottom: 2.25rem;
        padding: 1.5rem 1.65rem 1.35rem;
        border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--glass-border));
        border-radius: 1.6rem;
        background:
            radial-gradient(circle at 8% 12%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 24%),
            linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent), transparent 48%),
            var(--glass-card);
        box-shadow: 0 1.25rem 3rem rgb(118 80 68 / 0.08);
        backdrop-filter: blur(28px);
    }

    .overview-glow {
        position: absolute;
        width: 13rem;
        height: 13rem;
        right: -4rem;
        top: -5rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 24%, transparent);
        filter: blur(45px);
        pointer-events: none;
    }

    .overview-stickers {
        position: absolute;
        right: 1.35rem;
        top: 1rem;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: color-mix(in srgb, var(--primary) 72%, white);
        font-size: 0.9rem;
        font-weight: 800;
        transform: rotate(3deg);
        opacity: 0.8;
        pointer-events: none;
    }

    .overview-stickers span:nth-child(1) { font-size: 1.2rem; transform: rotate(-12deg); }
    .overview-stickers span:nth-child(2) { animation: archive-twinkle 2.4s ease-in-out infinite; }
    .overview-stickers span:nth-child(3) { font-size: 0.72rem; }

    .overview-heading {
        position: relative;
    }

    .overview-heading p {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0 0 0.18rem;
        color: var(--primary);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
    }

    .overview-heading h1 {
        margin: 0;
        color: var(--text-strong);
        font-size: clamp(1.3rem, 3vw, 1.75rem);
        line-height: 1.25;
    }

    .overview-heading h1 b {
        display: inline-block;
        margin-left: 0.25rem;
        color: var(--primary);
        font-size: 0.72em;
        font-weight: 700;
        white-space: nowrap;
        transform: rotate(-2deg);
    }

    .overview-heading span {
        display: block;
        margin-top: 0.3rem;
        color: var(--text-muted);
        font-size: 0.78rem;
    }

    .overview-metrics {
        position: relative;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.45rem 0.75rem;
        margin-top: 1rem;
        color: var(--text-muted);
        font-size: 0.74rem;
    }

    .overview-metrics strong {
        color: var(--primary);
        font-size: 0.95rem;
    }

    .overview-metrics i {
        width: 0.22rem;
        height: 0.22rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 45%, var(--text-muted));
    }

    .progress-list {
        position: relative;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        margin-top: 0.9rem;
    }

    .progress-item > div:first-child {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.38rem;
        color: var(--text-muted);
        font-size: 0.7rem;
    }

    .progress-item strong { color: var(--text-body); font-variant-numeric: tabular-nums; }
    .progress-track { height: 0.38rem; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--text-muted) 13%, transparent); }
    .progress-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 55%, #ffd28d)); transition: width 0.6s ease; }
    .progress-track span::after { content: ''; float: right; width: 0.52rem; height: 0.52rem; margin-top: -0.07rem; border: 2px solid color-mix(in srgb, white 82%, var(--primary)); border-radius: 999px; background: var(--primary); box-shadow: 0 0 0 0.18rem color-mix(in srgb, var(--primary) 12%, transparent); }
    .progress-track-day span { background: linear-gradient(90deg, color-mix(in srgb, var(--primary) 70%, #8fbce8), var(--primary)); }

    @keyframes archive-twinkle {
        0%, 100% { opacity: 0.45; transform: scale(0.85) rotate(0); }
        50% { opacity: 1; transform: scale(1.15) rotate(12deg); }
    }

    .archive-year {
        position: relative;
        margin-bottom: 1.5rem;
        padding: 0.4rem 0.7rem 0.75rem;
        border-radius: 1.5rem;
    }

    .year-heading, .timeline-entry {
        display: grid;
        grid-template-columns: 5rem 2.5rem minmax(0, 1fr) 2rem;
        align-items: center;
    }

    .year-heading { min-height: 4.8rem; }
    .year-number { color: var(--text-strong); font-size: 2rem; font-weight: 800; letter-spacing: 0.04em; text-align: right; }
    .year-marker { position: relative; align-self: stretch; display: grid; place-items: center; }
    .year-marker::after, .entry-marker::before { content: ''; position: absolute; left: 50%; width: 1px; transform: translateX(-50%); background: linear-gradient(var(--primary), color-mix(in srgb, var(--primary) 13%, transparent)); }
    .year-marker::after { top: 50%; bottom: -0.8rem; }
    .year-marker span { z-index: 1; width: 1.05rem; height: 1.05rem; border: 3px solid color-mix(in srgb, var(--primary) 78%, white); border-radius: 999px; background: var(--glass-card); box-shadow: 0 0 0 0.3rem color-mix(in srgb, var(--primary) 10%, transparent); }
    .year-summary { display: flex; flex-direction: column; gap: 0.1rem; }
    .year-summary strong { color: var(--text-body); font-size: 0.88rem; }
    .year-summary span { color: var(--text-muted); font-size: 0.68rem; }

    .timeline-entry {
        min-height: 4.15rem;
        color: inherit;
        border: 1px solid transparent;
        border-radius: 1.15rem;
        transition: transform 0.25s ease, background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }

    .timeline-entry:hover {
        transform: translateX(0.3rem);
        border-color: color-mix(in srgb, var(--primary) 18%, transparent);
        background: color-mix(in srgb, var(--glass-card) 82%, transparent);
        box-shadow: 0 0.7rem 1.8rem rgb(118 80 68 / 0.06);
    }

    .timeline-entry time {
        color: var(--text-muted);
        font-size: 0.78rem;
        font-weight: 600;
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    .entry-marker { position: relative; align-self: stretch; display: grid; place-items: center; }
    .entry-marker::before { inset-block: 0; }
    .entry-marker span { z-index: 1; width: 0.52rem; height: 0.52rem; border: 2px solid var(--glass-card); border-radius: 999px; background: color-mix(in srgb, var(--primary) 58%, var(--text-muted)); transition: transform 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease; }
    .timeline-entry:hover .entry-marker span { transform: scale(1.45); background: var(--primary); box-shadow: 0 0 0 0.3rem color-mix(in srgb, var(--primary) 13%, transparent); }

    .entry-content { min-width: 0; padding: 0.65rem 0.45rem; }
    .entry-content strong { display: block; overflow: hidden; color: var(--text-body); font-size: 0.98rem; text-overflow: ellipsis; white-space: nowrap; transition: color 0.25s ease; }
    .timeline-entry:hover .entry-content strong { color: var(--primary); }
    .entry-tags { overflow: hidden; margin-top: 0.22rem; color: var(--text-muted); font-size: 0.68rem; text-overflow: ellipsis; white-space: nowrap; opacity: 0.72; }
    .entry-arrow { display: grid; place-items: center; color: var(--primary); font-size: 1.1rem; opacity: 0; transform: translateX(-0.35rem); transition: opacity 0.25s ease, transform 0.25s ease; }
    .timeline-entry:hover .entry-arrow { opacity: 1; transform: translateX(0); }

    @media (max-width: 640px) {
        .archive-page { padding: 0.5rem 0 2rem; }
        .archive-overview { padding: 1.2rem; border-radius: 1.4rem; }
        .overview-heading span { display: none; }
        .overview-heading h1 b { display: block; width: max-content; margin: 0.35rem 0 0; }
        .overview-stickers { right: 0.9rem; top: 0.75rem; }
        .overview-metrics { gap: 0.4rem 0.55rem; }
        .overview-metrics span:nth-of-type(4), .overview-metrics i:nth-of-type(3) { display: none; }
        .progress-list { grid-template-columns: 1fr; gap: 0.7rem; }
        .archive-year { padding-inline: 0; }
        .year-heading, .timeline-entry { grid-template-columns: 3.5rem 2rem minmax(0, 1fr) 1.7rem; }
        .year-number { font-size: 1.45rem; }
        .entry-content strong { font-size: 0.88rem; }
        .entry-arrow { opacity: 0.55; transform: none; }
    }

    @media (prefers-reduced-motion: reduce) {
        .timeline-entry, .entry-marker span, .entry-arrow, .progress-track span { transition: none; }
        .overview-stickers span:nth-child(2) { animation: none; }
    }
</style>
