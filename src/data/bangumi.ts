import { loadBangumiCollections } from "../utils/bangumi";
import seed from "./bangumi-collections.json";

let pending: ReturnType<typeof loadBangumiCollections> | undefined;

// The page and its public snapshot share one complete sync during a build.
export function getBangumiData() {
	pending ??= loadBangumiCollections({
		user: import.meta.env.PUBLIC_BANGUMI_USER || "yaron",
		token:
			import.meta.env.BANGUMI_TOKEN ||
			import.meta.env.PUBLIC_BANGUMI_TOKEN ||
			"",
		seed,
		snapshotUrl: "https://yaronluo.com/bangumi-data.json",
	});
	return pending;
}
