import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	fetchBangumiSnapshot,
	loadBangumiCollections,
} from "../src/utils/bangumi.ts";

const collection = (id, extra = {}) => ({ type: 3, subject: { id }, ...extra });
const snapshot = (extra = {}) => ({
	version: 1,
	user: "test-user",
	fetchedAt: "2026-10-18T00:00:00Z",
	collections: [collection(123)],
	...extra,
});
const ok = (data = [], total = data.length) => Response.json({ data, total });
const noWait = async () => {};
const broken = async () =>
	new Response("<html>502 Bad Gateway</html>", { status: 502 });
async function options(extra = {}) {
	return {
		user: "test-user",
		wait: noWait,
		cachePath: join(
			await mkdtemp(join(tmpdir(), "fuwari-bangumi-")),
			"cache.json",
		),
		...extra,
	};
}

test("retries a transient 502, paginates, and excludes private collections", async () => {
	const calls = [];
	let failed = false;
	const result = await fetchBangumiSnapshot({
		user: "test-user",
		wait: noWait,
		fetcher: async (url) => {
			const u = new URL(url);
			const type = Number(u.searchParams.get("type"));
			const offset = Number(u.searchParams.get("offset"));
			calls.push([type, offset]);
			if (!failed) {
				failed = true;
				return broken();
			}
			if (type !== 3) return ok();
			return offset === 0
				? ok(
						Array.from({ length: 50 }, (_, id) => collection(id + 1)),
						51,
					)
				: ok([collection(51, { private: true })], 51);
		},
	});
	assert.equal(result.collections.length, 50);
	assert.deepEqual(calls.slice(0, 3), [
		[3, 0],
		[3, 0],
		[3, 50],
	]);
	assert.deepEqual(
		calls.slice(3).map(([type]) => type),
		[2, 1, 4, 5],
	);
});

test("a later-page failure preserves the entire last snapshot and cache", async () => {
	const seed = snapshot();
	const opts = await options({ seed });
	const stored = JSON.stringify(seed);
	await writeFile(opts.cachePath, stored);
	const result = await loadBangumiCollections({
		...opts,
		fetcher: async (url) =>
			new URL(url).searchParams.get("offset") === "0"
				? ok(
						Array.from({ length: 50 }, (_, id) => collection(id + 1)),
						51,
					)
				: broken(),
	});
	assert.equal(result.stale, true);
	assert.deepEqual(result.collections, seed.collections);
	assert.equal(await readFile(opts.cachePath, "utf8"), stored);
});

test("fresh checkouts use the committed seed on network failures", async () => {
	const result = await loadBangumiCollections(
		await options({
			seed: snapshot(),
			fetcher: async () => {
				throw new TypeError("network error");
			},
		}),
	);
	assert.equal(result.stale, true);
	assert.equal(result.collections[0].subject.id, 123);
});

test("without a valid matching snapshot, failure aborts the build", async () => {
	for (const seed of [
		undefined,
		snapshot({ user: "someone-else" }),
		snapshot({ collections: [collection(1, { private: true })] }),
	]) {
		await assert.rejects(
			loadBangumiCollections(await options({ seed, fetcher: broken })),
			/停止构建/,
		);
	}
});

test("prefers a newer complete local cache over the committed seed", async () => {
	const opts = await options({ seed: snapshot(), fetcher: broken });
	await writeFile(
		opts.cachePath,
		JSON.stringify(
			snapshot({
				fetchedAt: "2026-10-19T00:00:00Z",
				collections: [collection(456)],
			}),
		),
	);
	const result = await loadBangumiCollections(opts);
	assert.equal(result.collections[0].subject.id, 456);
});

test("malformed or truncated successful responses cannot replace good data", async () => {
	for (const fetcher of [
		async () => Response.json({}),
		async () => ok([], 10),
		async () => ok([{ type: 3 }]),
	]) {
		const result = await loadBangumiCollections(
			await options({ seed: snapshot(), fetcher }),
		);
		assert.equal(result.stale, true);
		assert.equal(result.collections.length, 1);
	}
});

test("successful empty collections replace an old nonempty snapshot", async () => {
	const opts = await options({ seed: snapshot(), fetcher: async () => ok() });
	const result = await loadBangumiCollections(opts);
	assert.equal(result.stale, false);
	assert.deepEqual(result.collections, []);
	assert.deepEqual(
		JSON.parse(await readFile(opts.cachePath, "utf8")).collections,
		[],
	);
});

test("authentication errors are not retried or exposed as upstream HTML", async () => {
	let calls = 0;
	await assert.rejects(
		fetchBangumiSnapshot({
			user: "test-user",
			wait: noWait,
			fetcher: async () => {
				calls++;
				return new Response("secret HTML", { status: 401 });
			},
		}),
		/HTTP 401/,
	);
	assert.equal(calls, 1);
});

test("clean cloud builds recover a newer snapshot from the previous deployment", async () => {
	const deployed = snapshot({
		fetchedAt: "2026-10-19T00:00:00Z",
		collections: [collection(789)],
	});
	const result = await loadBangumiCollections(
		await options({
			seed: snapshot(),
			snapshotUrl: "https://blog.test/bangumi-data.json",
			fetcher: async (url) =>
				String(url).startsWith("https://blog.test/")
					? Response.json(deployed)
					: broken(),
		}),
	);
	assert.equal(result.stale, true);
	assert.equal(result.collections[0].subject.id, 789);
	assert.equal(result.fetchedAt, deployed.fetchedAt);
});

test("a previous deployment for another user cannot override this user's seed", async () => {
	const result = await loadBangumiCollections(
		await options({
			seed: snapshot(),
			snapshotUrl: "https://blog.test/bangumi-data.json",
			fetcher: async (url) =>
				String(url).startsWith("https://blog.test/")
					? Response.json(
							snapshot({
								user: "someone-else",
								fetchedAt: "2026-10-19T00:00:00Z",
							}),
						)
					: broken(),
		}),
	);
	assert.equal(result.user, "test-user");
	assert.equal(result.collections[0].subject.id, 123);
});
