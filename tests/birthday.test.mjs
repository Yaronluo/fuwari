import assert from "node:assert/strict";
import test from "node:test";
import { getBirthdayState, chinaDay, isLunarBirthday } from "../src/utils/birthday.ts";

test("birthday begins at China midnight even for a visitor in another timezone", () => {
	assert.equal(getBirthdayState(new Date("2026-10-21T15:59:59Z")).isBirthday, false);
	assert.equal(getBirthdayState(new Date("2026-10-21T16:00:00Z")).isBirthday, true);
	assert.equal(chinaDay(new Date("2026-10-21T16:00:00Z")), "2026-10-22");
});

test("birthday remains active all day and ends at the following midnight", () => {
	assert.equal(getBirthdayState(new Date("2026-10-22T15:59:59Z")).isBirthday, true);
	const next = getBirthdayState(new Date("2026-10-22T16:00:00Z"));
	assert.equal(next.isBirthday, false);
	assert.equal(next.birthdayDay, "2027-10-12");
});

test("lunar birthday moves to a different Gregorian date each year", () => {
	assert.equal(getBirthdayState(new Date("2027-10-12T04:00:00Z")).isBirthday, true);
	assert.equal(getBirthdayState(new Date("2027-10-22T04:00:00Z")).isBirthday, false);
});

test("ordinary ninth month counts, leap ninth month does not repeat the birthday", () => {
	assert.equal(isLunarBirthday(new Date("2014-10-06T04:00:00Z")), true);
	assert.equal(isLunarBirthday(new Date("2014-11-05T04:00:00Z")), false);
	assert.equal(getBirthdayState(new Date("2014-11-05T04:00:00Z")).year, 2015);
});

test("countdown reaches one second then switches to today's celebration", () => {
	const before = getBirthdayState(new Date("2026-10-21T15:59:59Z"));
	assert.deepEqual([before.days, before.hours, before.minutes, before.seconds], [0, 0, 0, 1]);
	const during = getBirthdayState(new Date("2026-10-22T09:30:00Z"));
	assert.deepEqual([during.days, during.hours, during.minutes, during.seconds], [0, 0, 0, 0]);
});

test("date cache follows day changes and a restored older tab correctly", () => {
	getBirthdayState(new Date("2027-10-13T00:00:00+08:00"));
	assert.equal(getBirthdayState(new Date("2026-10-22T00:00:00+08:00")).isBirthday, true);
	assert.equal(getBirthdayState(new Date("2026-10-21T00:00:00+08:00")).birthdayDay, "2026-10-22");
});
