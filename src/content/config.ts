import { defineCollection, z } from "astro:content";

const postsCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),
        series: z.string().optional(),
        pinned: z.boolean().optional().default(false),
		anime: z.object({
			theme: z.enum(["weathering-with-you", "k-on"]),
			titleJa: z.string(),
			titleEn: z.string().optional().default(""),
			year: z.string(),
			director: z.string(),
			music: z.string(),
			firstWatch: z.string().optional().default(""),
			rewatch: z.string().optional().default(""),
			rating: z.string().optional().default(""),
			spoiler: z.boolean().optional().default(false),
			cover: z.string(),
			quote: z.string().optional().default(""),
		}).optional(),


        /* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});
const specCollection = defineCollection({
	schema: z.object({}),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
};
