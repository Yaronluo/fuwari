import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	addDays,
	daysInMonth,
	getDayInfo,
	lunarDayName,
	lunarMonthName,
	nextFestival,
	solarTermName,
	solarToLunar,
	weekdayOf,
} from "../src/utils/lunar.ts";

describe("solarToLunar", () => {
	it("matches the Hong Kong Observatory lunar calendar", () => {
		const cases = [
			// [公历年, 月, 日, 农历年, 月, 日, 是否闰月]
			[1900, 1, 31, 1900, 1, 1, false],
			[2025, 7, 25, 2025, 6, 1, true],
			[2026, 3, 3, 2026, 1, 15, false],
			[2026, 6, 19, 2026, 5, 5, false],
			[2026, 9, 25, 2026, 8, 15, false],
			[2026, 10, 1, 2026, 8, 21, false],
			[2026, 10, 22, 2026, 9, 13, false],
			[2026, 11, 20, 2026, 10, 12, false],
			[2027, 2, 5, 2026, 12, 29, false],
			[2027, 2, 6, 2027, 1, 1, false],
			[2028, 6, 23, 2028, 5, 1, true],
			[2100, 12, 31, 2100, 12, 1, false],
		];

		for (const [
			year,
			month,
			day,
			lunarYear,
			lunarMonth,
			lunarDay,
			isLeap,
		] of cases) {
			const result = solarToLunar(year, month, day);
			assert.deepEqual(
				result,
				{ year: lunarYear, month: lunarMonth, day: lunarDay, isLeap },
				`${year}-${month}-${day} 应换算为 ${lunarYear} 年${isLeap ? "闰" : ""}${lunarMonth} 月${lunarDay} 日`,
			);
		}
	});

	it("returns null outside the supported range or for invalid dates", () => {
		assert.equal(solarToLunar(1900, 1, 30), null);
		// 2100 农历年跨到 2101 年 1 月，2 月起超出数据表
		assert.deepEqual(solarToLunar(2101, 1, 1), {
			year: 2100,
			month: 12,
			day: 2,
			isLeap: false,
		});
		assert.equal(solarToLunar(2101, 2, 1), null);
		assert.equal(solarToLunar(2026, 2, 30), null);
		assert.equal(solarToLunar(2026, 13, 1), null);
	});
});

describe("lunar names", () => {
	it("renders day and month names", () => {
		assert.equal(lunarDayName(1), "初一");
		assert.equal(lunarDayName(15), "十五");
		assert.equal(lunarDayName(30), "三十");
		assert.equal(lunarMonthName(1), "正月");
		assert.equal(lunarMonthName(11), "冬月");
		assert.equal(lunarMonthName(12), "腊月");
		assert.equal(lunarMonthName(6, true), "闰六月");
	});
});

describe("solar terms", () => {
	it("finds the term of a given day", () => {
		assert.equal(solarTermName(2026, 4, 5), "清明");
		assert.equal(solarTermName(2026, 10, 23), "霜降");
		assert.equal(solarTermName(2026, 12, 22), "冬至");
		assert.equal(solarTermName(2027, 2, 4), "立春");
		assert.equal(solarTermName(2026, 10, 22), null);
	});
});

describe("getDayInfo", () => {
	it("prefers festivals, then solar terms, then the lunar day", () => {
		const plain = getDayInfo(2026, 10, 22);
		assert.equal(plain.label, "十三");
		assert.equal(plain.tone, "lunar");
		assert.equal(plain.festival, null);

		const newYear = getDayInfo(2026, 1, 1);
		assert.equal(newYear.label, "元旦");
		assert.equal(newYear.tone, "holiday");

		const midAutumn = getDayInfo(2026, 9, 25);
		assert.equal(midAutumn.label, "中秋节");
		assert.equal(midAutumn.tone, "festival");

		const nationalDay = getDayInfo(2026, 10, 1);
		assert.equal(nationalDay.label, "国庆节");
		assert.equal(nationalDay.tone, "holiday");

		const qingming = getDayInfo(2026, 4, 5);
		assert.equal(qingming.label, "清明");
		assert.equal(qingming.tone, "festival");
		assert.equal(qingming.term, "清明");

		const frost = getDayInfo(2026, 10, 23);
		assert.equal(frost.label, "霜降");
		assert.equal(frost.tone, "term");
	});

	it("marks the eve of the Spring Festival", () => {
		assert.equal(getDayInfo(2027, 2, 5).label, "除夕");
		assert.equal(getDayInfo(2027, 2, 6).label, "春节");
	});

	it("ignores same-day festivals that fall in a leap month", () => {
		assert.equal(getDayInfo(2025, 7, 25).label, "闰六月");
	});
});

describe("nextFestival", () => {
	it("counts to the next festival instead of skipping months", () => {
		// 2026-10-22 之后最近的节日是 2027-01-01 元旦，而不是 2027-02-06 春节
		assert.deepEqual(nextFestival(2026, 10, 22), {
			name: "元旦",
			tone: "holiday",
			year: 2027,
			month: 1,
			day: 1,
			days: 71,
		});
	});

	it("returns today when today is a festival", () => {
		const springFestival = nextFestival(2026, 2, 17);
		assert.equal(springFestival?.name, "春节");
		assert.equal(springFestival?.days, 0);
	});

	it("finds a festival within the search window", () => {
		for (const start of [
			[2025, 1, 1],
			[2026, 3, 15],
			[2027, 6, 1],
			[2028, 12, 31],
		]) {
			const result = nextFestival(start[0], start[1], start[2]);
			assert.notEqual(result, null);
			assert.ok(result !== null && result.days <= 400);
		}
	});
});

describe("calendar helpers", () => {
	it("knows month lengths and weekdays", () => {
		assert.equal(daysInMonth(2026, 10), 31);
		assert.equal(daysInMonth(2026, 2), 28);
		assert.equal(daysInMonth(2028, 2), 29);
		// 2026-10-22 是星期四
		assert.equal(weekdayOf(2026, 10, 22), 4);
	});

	it("adds days across month and year boundaries", () => {
		assert.deepEqual(addDays(2026, 10, 31, 1), {
			year: 2026,
			month: 11,
			day: 1,
		});
		assert.deepEqual(addDays(2026, 12, 31, 1), {
			year: 2027,
			month: 1,
			day: 1,
		});
		assert.deepEqual(addDays(2026, 1, 1, -1), {
			year: 2025,
			month: 12,
			day: 31,
		});
	});

	it("labels every day across a few years", () => {
		let cursor = { year: 2025, month: 1, day: 1 };
		while (cursor.year < 2029) {
			const info = getDayInfo(cursor.year, cursor.month, cursor.day);
			assert.notEqual(
				info.label,
				"",
				`${cursor.year}-${cursor.month}-${cursor.day} 缺少标签`,
			);
			const next = addDays(cursor.year, cursor.month, cursor.day, 1);
			assert.ok(
				next.year > cursor.year ||
					next.month > cursor.month ||
					next.day > cursor.day,
			);
			cursor = next;
		}
	});
});
