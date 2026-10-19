import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface BangumiSubject {
	id: number;
	name?: string;
	name_cn?: string;
	score?: number;
	eps?: number;
	total_episodes?: number;
	images?: { large?: string; common?: string };
	tags?: Array<{ name?: string }>;
}

export interface BangumiCollection {
	type: number;
	rate?: number;
	comment?: string;
	updated_at?: string;
	private?: boolean;
	ep_status?: number;
	subject: BangumiSubject;
}

export interface BangumiSnapshot {
	version: 1;
	user: string;
	fetchedAt: string;
	collections: BangumiCollection[];
}

const collectionTypes = [3, 2, 1, 4, 5];
const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

function isCollection(value: unknown): value is BangumiCollection {
	if (!value || typeof value !== "object") return false;
	const item = value as BangumiCollection;
	return (
		collectionTypes.includes(item.type) &&
		typeof item.subject?.id === "number" &&
		item.subject.id > 0
	);
}

function isSnapshot(value: unknown, user: string): value is BangumiSnapshot {
	if (!value || typeof value !== "object") return false;
	const snapshot = value as BangumiSnapshot;
	return (
		snapshot.version === 1 &&
		snapshot.user === user &&
		Number.isFinite(Date.parse(snapshot.fetchedAt)) &&
		Array.isArray(snapshot.collections) &&
		snapshot.collections.every((item) => isCollection(item) && !item.private)
	);
}

export async function fetchBangumiSnapshot({
	user,
	token = "",
	fetcher = fetch,
	wait = sleep,
}: {
	user: string;
	token?: string;
	fetcher?: typeof fetch;
	wait?: typeof sleep;
}): Promise<BangumiSnapshot> {
	const collections: BangumiCollection[] = [];
	// Keep API load bounded; retry the failed page without restarting successful pages.
	for (const type of collectionTypes) {
		const seen = new Set<number>();
		for (let offset = 0; ; offset += 50) {
			const url = `https://api.bgm.tv/v0/users/${encodeURIComponent(user)}/collections?subject_type=2&type=${type}&limit=50&offset=${offset}`;
			let batch: BangumiCollection[] | undefined;
			for (let attempt = 0; attempt < 3; attempt++) {
				let retryable = true;
				try {
					const response = await fetcher(url, {
						headers: {
							"User-Agent": "Fuwari-Bangumi/1.0",
							...(token ? { Authorization: `Bearer ${token}` } : {}),
						},
						signal: AbortSignal.timeout(15000),
					});
					if (!response.ok) {
						retryable = retryableStatuses.has(response.status);
						await response.body?.cancel();
						throw new Error(
							`Bangumi HTTP ${response.status} (type=${type}, offset=${offset})`,
						);
					}
					const payload = await response.json();
					if (
						!Array.isArray(payload.data) ||
						payload.data.length > 50 ||
						!Number.isInteger(payload.total) ||
						payload.total < 0
					) {
						throw new Error("Bangumi 返回了无效的分页数据");
					}
					batch = payload.data.map((item: BangumiCollection) => ({
						...item,
						type,
					}));
					if (
						!batch?.every(isCollection) ||
						(batch.length < 50 && offset + batch.length < payload.total) ||
						batch.some((item) => seen.has(item.subject.id))
					) {
						throw new Error("Bangumi 返回了不完整的收藏数据");
					}
					break;
				} catch (error) {
					if (!retryable || attempt === 2) throw error;
					await wait(1000 * (attempt + 1));
				}
			}
			if (!batch) throw new Error("Bangumi 收藏同步未完成");
			for (const item of batch) seen.add(item.subject.id);
			collections.push(...batch.filter((item) => !item.private));
			if (batch.length < 50) break;
		}
	}
	return { version: 1, user, fetchedAt: new Date().toISOString(), collections };
}

export async function loadBangumiCollections({
	user,
	token = "",
	seed,
	snapshotUrl,
	cachePath = resolve(".cache/bangumi", `${encodeURIComponent(user)}.json`),
	fetcher = fetch,
	wait = sleep,
}: {
	user: string;
	token?: string;
	seed?: unknown;
	snapshotUrl?: string;
	cachePath?: string;
	fetcher?: typeof fetch;
	wait?: typeof sleep;
}) {
	let fallback = isSnapshot(seed, user) ? seed : undefined;
	try {
		const cached: unknown = JSON.parse(await readFile(cachePath, "utf8"));
		if (
			isSnapshot(cached, user) &&
			(!fallback ||
				Date.parse(cached.fetchedAt) > Date.parse(fallback.fetchedAt))
		) {
			fallback = cached;
		}
	} catch {
		/* A fresh checkout may have no local cache. */
	}

	let snapshot: BangumiSnapshot;
	try {
		snapshot = await fetchBangumiSnapshot({ user, token, fetcher, wait });
	} catch (error) {
		// Static hosts may start each build with an empty filesystem. Recover the
		// last deployed public snapshot before falling back to the committed seed.
		if (snapshotUrl) {
			try {
				const response = await fetcher(snapshotUrl, {
					signal: AbortSignal.timeout(8000),
				});
				if (response.ok) {
					const deployed: unknown = await response.json();
					if (
						isSnapshot(deployed, user) &&
						(!fallback ||
							Date.parse(deployed.fetchedAt) > Date.parse(fallback.fetchedAt))
					) {
						fallback = deployed;
					}
				} else {
					await response.body?.cancel();
				}
			} catch {
				/* The first deployment has no published snapshot yet. */
			}
		}
		if (!fallback) {
			throw new Error(
				"Bangumi 同步失败且没有可用快照，停止构建以保留上次正常部署",
				{ cause: error },
			);
		}
		console.warn(
			"[Bangumi] 同步失败，使用上次完整的公开收藏快照：",
			error instanceof Error ? error.message : "请求异常",
		);
		return { ...fallback, stale: true };
	}
	try {
		await mkdir(dirname(cachePath), { recursive: true });
		await writeFile(`${cachePath}.tmp`, `${JSON.stringify(snapshot)}\n`);
		await rename(`${cachePath}.tmp`, cachePath);
	} catch {
		console.warn("[Bangumi] 本次同步成功，但无法保存本地缓存");
	}
	return { ...snapshot, stale: false };
}
