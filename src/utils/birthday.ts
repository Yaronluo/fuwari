/** Birthday dates follow China Standard Time (Changsha, UTC+8), including for visitors abroad. */
export const BIRTHDAY_TIME_ZONE = "Asia/Shanghai";
export const BIRTHDAY_LABEL = "农历九月十三";
const DAY = 86_400_000;
const lunarFormatter = new Intl.DateTimeFormat("en-u-ca-chinese", {
	timeZone: BIRTHDAY_TIME_ZONE,
	year: "numeric",
	month: "numeric",
	day: "numeric",
});
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: BIRTHDAY_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

export function chinaDay(date: Date): string {
	const parts = dayFormatter.formatToParts(date);
	return ["year", "month", "day"].map((key) => parts.find((p) => p.type === key)?.value).join("-");
}

export function isLunarBirthday(date: Date): boolean {
	if (lunarFormatter.resolvedOptions().calendar !== "chinese") return false;
	const parts = lunarFormatter.formatToParts(date);
	// ICU represents a leap month as e.g. "9bis". Match the ordinary month only.
	return parts.find((p) => p.type === "month")?.value === "9"
		&& parts.find((p) => p.type === "day")?.value === "13";
}

let cachedDay = "";
let cachedBirthday = 0;

export function getBirthdayState(now = new Date()) {
	const day = chinaDay(now);
	if (day !== cachedDay) {
		const midnight = new Date(`${day}T00:00:00+08:00`).getTime();
		let found = 0;
		// Include today; a full lunar year can include a leap month.
		for (let offset = 0; offset < 400; offset++) {
			const candidate = midnight + offset * DAY;
			if (isLunarBirthday(new Date(candidate))) {
				found = candidate;
				break;
			}
		}
		if (!found) throw new Error("Chinese calendar is unavailable");
		cachedDay = day;
		cachedBirthday = found;
	}
	const remaining = Math.max(0, cachedBirthday - now.getTime());
	const birthdayDay = chinaDay(new Date(cachedBirthday));
	return {
		isBirthday: day === birthdayDay,
		birthdayDay,
		year: Number(birthdayDay.slice(0, 4)),
		days: Math.floor(remaining / DAY),
		hours: Math.floor(remaining / 3_600_000) % 24,
		minutes: Math.floor(remaining / 60_000) % 60,
		seconds: Math.floor(remaining / 1_000) % 60,
	};
}

export type BirthdayState = ReturnType<typeof getBirthdayState>;
