<script lang="ts">
import { onMount } from "svelte";

import I18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import { getPostUrlBySlug } from "../utils/url-utils";

export let tags: string[] = [];
export let categories: string[] = [];
export let sortedPosts: Post[] = [];

const params = new URLSearchParams(window.location.search);
tags = params.has("tag") ? params.getAll("tag") : [];
categories = params.has("category") ? params.getAll("category") : [];
const uncategorized = params.get("uncategorized");

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
let currentYear = new Date().getFullYear();
let dayOfYear = 0;
let yearPassedPercent = "0.0";
let todayPassedPercent = "0.0";

function updateTimeStats() {
    const now = new Date();
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

onMount(async () => {
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
	
	currentYearPosts = groups.find(g => g.year === currentYear)?.posts.length || 0;
	updateTimeStats();
	const interval = setInterval(updateTimeStats, 50);
	return () => clearInterval(interval);
});
</script>

<div class="px-8 py-6 max-w-4xl mx-auto">
    <!-- Time Statistics Text -->
    <div class="mb-10 flex flex-col gap-2 text-sm md:text-base text-50 font-medium leading-relaxed tracking-wide">
        <div>今年产出了 <span class="text-[var(--primary)] font-bold">{currentYearPosts}</span> 篇文章。</div>
        <div>今天是 {currentYear} 年的第 <span class="text-[var(--primary)] font-bold">{dayOfYear}</span> 天。</div>
        <div>今年已经过去了 <span class="text-[var(--primary)] font-bold">{yearPassedPercent}%</span>。</div>
        <div>今天已经过去 <span class="text-[var(--primary)] font-bold">{todayPassedPercent}%</span>。</div>
    </div>
    {#each groups as group}
        <div class="mb-8">
            <div class="flex flex-row w-full items-center h-16">
                <div class="w-[20%] md:w-[15%] transition text-3xl font-bold text-right text-75 tracking-wider">
                    {group.year}
                </div>
                <div class="w-[15%] md:w-[10%]">
                    <div
                            class="h-4 w-4 bg-none rounded-full outline outline-[var(--primary)] mx-auto
                  -outline-offset-[2px] z-50 outline-3"
                    ></div>
                </div>
                <div class="w-[65%] md:w-[75%] transition text-left text-50 font-medium">
                    {group.posts.length} {i18n(group.posts.length === 1 ? I18nKey.postCount : I18nKey.postsCount)}
                </div>
            </div>

            {#each group.posts as post}
                <a
                        href={getPostUrlBySlug(post.slug)}
                        aria-label={post.data.title}
                        class="group btn-plain !block h-14 w-full rounded-xl hover:bg-white/40 dark:hover:bg-black/20 hover:text-[initial] transition-colors"
                >
                    <div class="flex flex-row justify-start items-center h-full">
                        <!-- date -->
                        <div class="w-[20%] md:w-[15%] transition text-base text-right text-50 font-medium">
                            {formatDate(post.data.published)}
                        </div>

                        <!-- dot and line -->
                        <div class="w-[15%] md:w-[10%] relative dash-line h-full flex items-center">
                            <div
                                    class="transition-all mx-auto w-2 h-2 rounded-full group-hover:h-6 group-hover:w-2
                       bg-[oklch(0.5_0.05_var(--hue))] group-hover:bg-[var(--primary)]
                       z-50"
                            ></div>
                        </div>

                        <!-- post title -->
                        <div
                                class="w-[65%] md:max-w-[55%] md:w-[55%] text-left font-bold text-base md:text-lg
                     group-hover:translate-x-3 transition-transform group-hover:text-[var(--primary)]
                     text-75 pr-8 whitespace-nowrap overflow-ellipsis overflow-hidden"
                        >
                            {post.data.title}
                        </div>

                        <!-- tag list -->
                        <div
                                class="hidden md:block md:w-[20%] text-left text-sm transition
                     whitespace-nowrap overflow-ellipsis overflow-hidden text-30 font-medium tracking-wide"
                        >
                            {formatTag(post.data.tags)}
                        </div>
                    </div>
                </a>
            {/each}
        </div>
    {/each}
</div>
