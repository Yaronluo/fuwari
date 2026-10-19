import { getBangumiData } from "../data/bangumi";

export async function GET() {
	const { stale: _stale, ...snapshot } = await getBangumiData();
	return new Response(JSON.stringify(snapshot), {
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}
