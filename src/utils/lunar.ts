/**
 * 农历、二十四节气与节日工具（1900–2100）。
 *
 * 数据表取自 solarlunar（ISC License，© Ajing / JJonline）：
 * - LUNAR_INFO：农历每年闰月与月大小编码
 * - TERM_INFO：二十四节气日期
 *
 * 两张表已与香港天文台（HKO）公历农历对照表逐日核对：2000–2035 年农历
 * 13149 天、2000–2060 年节气 1464 项，差异均为 0。因此这里不使用
 * Intl 的 "en-u-ca-chinese" 日历——CLDR 在新月临近午夜时会差一天，
 * 例如 2027-02-06 春节会被算成腊月三十。
 */

export interface SolarDate {
	year: number;
	month: number;
	day: number;
}

export interface LunarDate {
	year: number;
	month: number;
	day: number;
	isLeap: boolean;
}

export type DayTone = "festival" | "holiday" | "term" | "lunar" | "muted";

export interface DayInfo {
	lunar: LunarDate | null;
	festival: { name: string; tone: DayTone } | null;
	term: string | null;
	label: string;
	tone: DayTone;
}

export interface UpcomingFestival {
	name: string;
	tone: DayTone;
	year: number;
	month: number;
	day: number;
	days: number;
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const DAY_MS = 86_400_000;
/** 农历 1900 年正月初一对应的公历时间戳 */
const LUNAR_EPOCH = Date.UTC(1900, 0, 31);

const LUNAR_INFO: readonly number[] = [
	0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0,
	0x09ad0, 0x055d2, 0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540,
	0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50,
	0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0,
	0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
	0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2,
	0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573,
	0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4,
	0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5,
	0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
	0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46,
	0x0ab60, 0x09570, 0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58,
	0x05ac0, 0x0ab60, 0x096d5, 0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50,
	0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, 0x0a950, 0x0b4a0,
	0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
	0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260,
	0x0ea65, 0x0d530, 0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0,
	0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2, 0x049b0,
	0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, 0x14b63, 0x09370,
	0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
	0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0,
	0x0a6d0, 0x055d4, 0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50,
	0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, 0x0b273, 0x06930, 0x07337, 0x06aa0,
	0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, 0x0e968, 0x0d520,
	0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
	0x0d520,
];

const TERM_INFO: readonly string[] = [
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf97c3598082c95f8c965cc920f",
	"97bd0b06bdb0722c965ce1cfcc920f",
	"b027097bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf97c359801ec95f8c965cc920f",
	"97bd0b06bdb0722c965ce1cfcc920f",
	"b027097bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf97c359801ec95f8c965cc920f",
	"97bd0b06bdb0722c965ce1cfcc920f",
	"b027097bd097c36b0b6fc9274c91aa",
	"9778397bd19801ec9210c965cc920e",
	"97b6b97bd19801ec95f8c965cc920f",
	"97bd09801d98082c95f8e1cfcc920f",
	"97bd097bd097c36b0b6fc9210c8dc2",
	"9778397bd197c36c9210c9274c91aa",
	"97b6b97bd19801ec95f8c965cc920e",
	"97bd09801d98082c95f8e1cfcc920f",
	"97bd097bd097c36b0b6fc9210c8dc2",
	"9778397bd097c36c9210c9274c91aa",
	"97b6b97bd19801ec95f8c965cc920e",
	"97bcf97c3598082c95f8e1cfcc920f",
	"97bd097bd097c36b0b6fc9210c8dc2",
	"9778397bd097c36c9210c9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf97c3598082c95f8c965cc920f",
	"97bd097bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf97c3598082c95f8c965cc920f",
	"97bd097bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf97c359801ec95f8c965cc920f",
	"97bd097bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf97c359801ec95f8c965cc920f",
	"97bd097bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf97c359801ec95f8c965cc920f",
	"97bd097bd07f595b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9210c8dc2",
	"9778397bd19801ec9210c9274c920e",
	"97b6b97bd19801ec95f8c965cc920f",
	"97bd07f5307f595b0b0bc920fb0722",
	"7f0e397bd097c36b0b6fc9210c8dc2",
	"9778397bd097c36c9210c9274c920e",
	"97b6b97bd19801ec95f8c965cc920f",
	"97bd07f5307f595b0b0bc920fb0722",
	"7f0e397bd097c36b0b6fc9210c8dc2",
	"9778397bd097c36c9210c9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bd07f1487f595b0b0bc920fb0722",
	"7f0e397bd097c36b0b6fc9210c8dc2",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf7f1487f595b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf7f1487f595b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf7f1487f531b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c965cc920e",
	"97bcf7f1487f531b0b0bb0b6fb0722",
	"7f0e397bd07f595b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b97bd19801ec9210c9274c920e",
	"97bcf7f0e47f531b0b0bb0b6fb0722",
	"7f0e397bd07f595b0b0bc920fb0722",
	"9778397bd097c36b0b6fc9210c91aa",
	"97b6b97bd197c36c9210c9274c920e",
	"97bcf7f0e47f531b0b0bb0b6fb0722",
	"7f0e397bd07f595b0b0bc920fb0722",
	"9778397bd097c36b0b6fc9210c8dc2",
	"9778397bd097c36c9210c9274c920e",
	"97b6b7f0e47f531b0723b0b6fb0722",
	"7f0e37f5307f595b0b0bc920fb0722",
	"7f0e397bd097c36b0b6fc9210c8dc2",
	"9778397bd097c36b0b70c9274c91aa",
	"97b6b7f0e47f531b0723b0b6fb0721",
	"7f0e37f1487f595b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc9210c8dc2",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f595b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e397bd07f595b0b0bc920fb0722",
	"9778397bd097c36b0b6fc9274c91aa",
	"97b6b7f0e47f531b0723b0787b0721",
	"7f0e27f0e47f531b0b0bb0b6fb0722",
	"7f0e397bd07f595b0b0bc920fb0722",
	"9778397bd097c36b0b6fc9210c91aa",
	"97b6b7f0e47f149b0723b0787b0721",
	"7f0e27f0e47f531b0723b0b6fb0722",
	"7f0e397bd07f595b0b0bc920fb0722",
	"9778397bd097c36b0b6fc9210c8dc2",
	"977837f0e37f149b0723b0787b0721",
	"7f07e7f0e47f531b0723b0b6fb0722",
	"7f0e37f5307f595b0b0bc920fb0722",
	"7f0e397bd097c35b0b6fc9210c8dc2",
	"977837f0e37f14998082b0787b0721",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e37f1487f595b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc9210c8dc2",
	"977837f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc920fb0722",
	"977837f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e397bd097c35b0b6fc920fb0722",
	"977837f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e397bd07f595b0b0bc920fb0722",
	"977837f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e397bd07f595b0b0bc920fb0722",
	"977837f0e37f14998082b0787b06bd",
	"7f07e7f0e47f149b0723b0787b0721",
	"7f0e27f0e47f531b0b0bb0b6fb0722",
	"7f0e397bd07f595b0b0bc920fb0722",
	"977837f0e37f14998082b0723b06bd",
	"7f07e7f0e37f149b0723b0787b0721",
	"7f0e27f0e47f531b0723b0b6fb0722",
	"7f0e397bd07f595b0b0bc920fb0722",
	"977837f0e37f14898082b0723b02d5",
	"7ec967f0e37f14998082b0787b0721",
	"7f07e7f0e47f531b0723b0b6fb0722",
	"7f0e37f1487f595b0b0bb0b6fb0722",
	"7f0e37f0e37f14898082b0723b02d5",
	"7ec967f0e37f14998082b0787b0721",
	"7f07e7f0e47f531b0723b0b6fb0722",
	"7f0e37f1487f531b0b0bb0b6fb0722",
	"7f0e37f0e37f14898082b0723b02d5",
	"7ec967f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e37f1487f531b0b0bb0b6fb0722",
	"7f0e37f0e37f14898082b072297c35",
	"7ec967f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e37f0e37f14898082b072297c35",
	"7ec967f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e37f0e366aa89801eb072297c35",
	"7ec967f0e37f14998082b0787b06bd",
	"7f07e7f0e47f149b0723b0787b0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
	"7f0e37f0e366aa89801eb072297c35",
	"7ec967f0e37f14998082b0723b06bd",
	"7f07e7f0e47f149b0723b0787b0721",
	"7f0e27f0e47f531b0723b0b6fb0722",
	"7f0e37f0e366aa89801eb072297c35",
	"7ec967f0e37f14998082b0723b06bd",
	"7f07e7f0e37f14998083b0787b0721",
	"7f0e27f0e47f531b0723b0b6fb0722",
	"7f0e37f0e366aa89801eb072297c35",
	"7ec967f0e37f14898082b0723b02d5",
	"7f07e7f0e37f14998082b0787b0721",
	"7f07e7f0e47f531b0723b0b6fb0722",
	"7f0e36665b66aa89801e9808297c35",
	"665f67f0e37f14898082b0723b02d5",
	"7ec967f0e37f14998082b0787b0721",
	"7f07e7f0e47f531b0723b0b6fb0722",
	"7f0e36665b66a449801e9808297c35",
	"665f67f0e37f14898082b0723b02d5",
	"7ec967f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e36665b66a449801e9808297c35",
	"665f67f0e37f14898082b072297c35",
	"7ec967f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e26665b66a449801e9808297c35",
	"665f67f0e37f1489801eb072297c35",
	"7ec967f0e37f14998082b0787b06bd",
	"7f07e7f0e47f531b0723b0b6fb0721",
	"7f0e27f1487f531b0b0bb0b6fb0722",
];

const DAY_NAMES = [
	"初一",
	"初二",
	"初三",
	"初四",
	"初五",
	"初六",
	"初七",
	"初八",
	"初九",
	"初十",
	"十一",
	"十二",
	"十三",
	"十四",
	"十五",
	"十六",
	"十七",
	"十八",
	"十九",
	"二十",
	"廿一",
	"廿二",
	"廿三",
	"廿四",
	"廿五",
	"廿六",
	"廿七",
	"廿八",
	"廿九",
	"三十",
] as const;

const MONTH_NAMES = [
	"正月",
	"二月",
	"三月",
	"四月",
	"五月",
	"六月",
	"七月",
	"八月",
	"九月",
	"十月",
	"冬月",
	"腊月",
] as const;

const TERM_NAMES = [
	"小寒",
	"大寒",
	"立春",
	"雨水",
	"惊蛰",
	"春分",
	"清明",
	"谷雨",
	"立夏",
	"小满",
	"芒种",
	"夏至",
	"小暑",
	"大暑",
	"立秋",
	"处暑",
	"白露",
	"秋分",
	"寒露",
	"霜降",
	"立冬",
	"小雪",
	"大雪",
	"冬至",
] as const;

interface FestivalRule {
	name: string;
	month: number;
	day: number;
}

/** 农历节日：闰月不算（闰月里的同名日子不过节） */
const LUNAR_FESTIVALS: readonly FestivalRule[] = [
	{ name: "春节", month: 1, day: 1 },
	{ name: "元宵节", month: 1, day: 15 },
	{ name: "龙抬头", month: 2, day: 2 },
	{ name: "端午节", month: 5, day: 5 },
	{ name: "七夕节", month: 7, day: 7 },
	{ name: "中元节", month: 7, day: 15 },
	{ name: "中秋节", month: 8, day: 15 },
	{ name: "重阳节", month: 9, day: 9 },
	{ name: "腊八节", month: 12, day: 8 },
];

/** 公历节日 */
const SOLAR_HOLIDAYS: readonly FestivalRule[] = [
	{ name: "元旦", month: 1, day: 1 },
	{ name: "劳动节", month: 5, day: 1 },
	{ name: "国庆节", month: 10, day: 1 },
];

function lunarInfoOf(year: number): number {
	return LUNAR_INFO[year - MIN_YEAR] ?? 0;
}

/** 闰几月，0 表示当年没有闰月 */
function leapMonthOf(year: number): number {
	return lunarInfoOf(year) & 0xf;
}

function leapDaysOf(year: number): number {
	if (leapMonthOf(year) === 0) return 0;
	return (lunarInfoOf(year) & 0x10000) === 0 ? 29 : 30;
}

function monthDaysOf(year: number, month: number): number {
	return (lunarInfoOf(year) & (0x10000 >> month)) === 0 ? 29 : 30;
}

/** 农历一年共多少天 */
function yearDaysOf(year: number): number {
	let total = 348;
	for (let mask = 0x8000; mask > 0x8; mask >>= 1) {
		if ((lunarInfoOf(year) & mask) !== 0) total += 1;
	}
	return total + leapDaysOf(year);
}

function epochDayOf(year: number, month: number, day: number): number {
	return Math.round((Date.UTC(year, month - 1, day) - LUNAR_EPOCH) / DAY_MS);
}

export function isSupportedYear(year: number): boolean {
	return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/** 该公历月有几天（month 从 1 开始） */
export function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = 周日，6 = 周六 */
export function weekdayOf(year: number, month: number, day: number): number {
	return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** 公历日期加减天数（不受时区影响） */
export function addDays(
	year: number,
	month: number,
	day: number,
	delta: number,
): SolarDate {
	const shifted = new Date(Date.UTC(year, month - 1, day) + delta * DAY_MS);
	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth() + 1,
		day: shifted.getUTCDate(),
	};
}

function isValidSolarDate(year: number, month: number, day: number): boolean {
	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day)
	)
		return false;
	if (month < 1 || month > 12 || day < 1) return false;
	return day <= daysInMonth(year, month);
}

/** 公历转农历；超出 1900–2100 范围返回 null */
export function solarToLunar(
	year: number,
	month: number,
	day: number,
): LunarDate | null {
	if (!isValidSolarDate(year, month, day)) return null;

	let offset = epochDayOf(year, month, day);
	if (offset < 0) return null;

	let lunarYear = MIN_YEAR;
	while (lunarYear <= MAX_YEAR) {
		const span = yearDaysOf(lunarYear);
		if (offset < span) break;
		offset -= span;
		lunarYear += 1;
	}
	if (lunarYear > MAX_YEAR) return null;

	const leap = leapMonthOf(lunarYear);
	for (let lunarMonth = 1; lunarMonth <= 12; lunarMonth += 1) {
		const span = monthDaysOf(lunarYear, lunarMonth);
		if (offset < span) {
			return {
				year: lunarYear,
				month: lunarMonth,
				day: offset + 1,
				isLeap: false,
			};
		}
		offset -= span;

		if (leap === lunarMonth) {
			const leapSpan = leapDaysOf(lunarYear);
			if (offset < leapSpan) {
				return {
					year: lunarYear,
					month: lunarMonth,
					day: offset + 1,
					isLeap: true,
				};
			}
			offset -= leapSpan;
		}
	}

	return null;
}

/** 农历日名：初一…三十 */
export function lunarDayName(day: number): string {
	return DAY_NAMES[day - 1] ?? "";
}

/** 农历月名：正月…腊月，闰月带“闰”字 */
export function lunarMonthName(month: number, isLeap = false): string {
	const name: string = MONTH_NAMES[month - 1] ?? "";
	if (name === "") return "";
	return isLeap ? `闰${name}` : name;
}

/** 某一年的第 index 个节气（index 0 → 小寒）是几号 */
function termDayOfYear(year: number, index: number): number {
	const table = TERM_INFO[year - MIN_YEAR];
	if (table === undefined) return 0;

	const start = Math.floor(index / 4) * 5;
	const packed = Number.parseInt(table.slice(start, start + 5), 16).toString();
	// 5 位十六进制数展开成 6 位十进制串，块内 4 个节气日按 1 / 2 / 1 / 2 位切分
	const parts = [
		packed.slice(0, 1),
		packed.slice(1, 3),
		packed.slice(3, 4),
		packed.slice(4, 6),
	];
	return Number.parseInt(parts[index % 4] ?? "", 10) || 0;
}

/** 当天是哪个节气，不是节气返回 null */
export function solarTermName(
	year: number,
	month: number,
	day: number,
): string | null {
	if (!isSupportedYear(year) || month < 1 || month > 12) return null;
	const base = (month - 1) * 2;
	if (termDayOfYear(year, base) === day) return TERM_NAMES[base] ?? null;
	if (termDayOfYear(year, base + 1) === day)
		return TERM_NAMES[base + 1] ?? null;
	return null;
}

/** 节日（含节气里的清明、除夕），没有则 null */
function resolveFestival(
	lunar: LunarDate | null,
	year: number,
	month: number,
	day: number,
) {
	if (lunar !== null && !lunar.isLeap) {
		const rule = LUNAR_FESTIVALS.find(
			(item) => item.month === lunar.month && item.day === lunar.day,
		);
		if (rule) return { name: rule.name, tone: "festival" as DayTone };
	}

	// 除夕：腊月最后一天，次日为正月初一
	if (lunar !== null && lunar.month === 12) {
		const tomorrow = addDays(year, month, day, 1);
		const next = solarToLunar(tomorrow.year, tomorrow.month, tomorrow.day);
		if (next !== null && !next.isLeap && next.month === 1 && next.day === 1) {
			return { name: "除夕", tone: "festival" as DayTone };
		}
	}

	const holiday = SOLAR_HOLIDAYS.find(
		(item) => item.month === month && item.day === day,
	);
	if (holiday) return { name: holiday.name, tone: "holiday" as DayTone };

	if (solarTermName(year, month, day) === "清明") {
		return { name: "清明", tone: "festival" as DayTone };
	}

	return null;
}

/** 日历格子需要的全部信息：农历、节气、节日与展示文案 */
export function getDayInfo(year: number, month: number, day: number): DayInfo {
	const lunar = solarToLunar(year, month, day);
	const term = solarTermName(year, month, day);
	const festival = resolveFestival(lunar, year, month, day);

	let label = "";
	let tone: DayTone = "muted";

	if (festival !== null) {
		label = festival.name;
		tone = festival.tone;
	} else if (term !== null) {
		label = term;
		tone = "term";
	} else if (lunar !== null) {
		label =
			lunar.day === 1
				? lunarMonthName(lunar.month, lunar.isLeap)
				: lunarDayName(lunar.day);
		tone = "lunar";
	}

	return { lunar, festival, term, label, tone };
}

/**
 * 从指定日期（含当天）起找最近的节日。
 * 只统计传统节日、清明与元旦 / 劳动节 / 国庆节；冬至等节气只做格子标签。
 */
export function nextFestival(
	year: number,
	month: number,
	day: number,
	searchDays = 400,
): UpcomingFestival | null {
	let cursor: SolarDate = { year, month, day };

	for (let elapsed = 0; elapsed <= searchDays; elapsed += 1) {
		const info = getDayInfo(cursor.year, cursor.month, cursor.day);
		if (info.festival !== null) {
			return { ...info.festival, ...cursor, days: elapsed };
		}
		cursor = addDays(cursor.year, cursor.month, cursor.day, 1);
	}

	return null;
}
