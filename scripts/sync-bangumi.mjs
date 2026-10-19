import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

// Refresh the committed, public-only fallback before publishing when needed.
if (!process.env.FUWARI_BANGUMI_SYNC_CHILD) {
	try {
		process.loadEnvFile(".env");
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	const proxy = process.env.BANGUMI_PROXY;
	const child = spawnSync(
		process.execPath,
		["--experimental-strip-types", import.meta.filename],
		{
			stdio: "inherit",
			env: {
				...process.env,
				...(proxy ? { HTTPS_PROXY: proxy, HTTP_PROXY: proxy } : {}),
				NODE_USE_ENV_PROXY: "1",
				FUWARI_BANGUMI_SYNC_CHILD: "1",
			},
		},
	);
	process.exit(child.status ?? 1);
}

const { fetchBangumiSnapshot } = await import("../src/utils/bangumi.ts");
const snapshot = await fetchBangumiSnapshot({
	user: process.env.PUBLIC_BANGUMI_USER || "yaron",
});
await writeFile(
	new URL("../src/data/bangumi-collections.json", import.meta.url),
	`${JSON.stringify(snapshot, null, 2)}\n`,
);
console.log(
	`已保存 ${snapshot.collections.length} 条公开收藏，快照时间 ${snapshot.fetchedAt}`,
);
