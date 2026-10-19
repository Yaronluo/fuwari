import {
	AUTO_MODE,
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
} from "@constants/constants.ts";
import { expressiveCodeConfig } from "@/config";
import type { LIGHT_DARK_MODE } from "@/types/config";

export type ThemePalette = "yui" | "mio" | "ritsu" | "mugi" | "azusa";

const DEFAULT_THEME_PALETTE: ThemePalette = "yui";
const THEME_PALETTES: ThemePalette[] = ["yui", "mio", "ritsu", "mugi", "azusa"];
const THEME_PALETTE_HUES: Record<ThemePalette, number> = {
	yui: 348,
	mio: 279,
	ritsu: 39,
	mugi: 29,
	azusa: 205,
};

/**
 * localStorage 在隐私模式、被禁 cookie 或存储写满时会直接抛异常。
 * 主题相关的读写都走这里，别让一次读取失败把整段首屏脚本或设置逻辑带崩。
 */
function readStore(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStore(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* 存不下就只影响这次记忆，当前页面照常工作 */
	}
}

export function getThemePalette(): ThemePalette {
	const stored = readStore("theme-palette") as ThemePalette | null;
	if (stored === ("htt" as ThemePalette)) {
		return "yui";
	}
	return stored && THEME_PALETTES.includes(stored)
		? stored
		: DEFAULT_THEME_PALETTE;
}

export function applyThemePalette(palette: ThemePalette): void {
	document.documentElement.dataset.palette = palette;
	document.documentElement.style.setProperty(
		"--hue",
		String(THEME_PALETTE_HUES[palette]),
	);
}

export function setThemePalette(palette: ThemePalette): void {
	writeStore("theme-palette", palette);
	applyThemePalette(palette);
}

export function getDefaultHue(): number {
	const fallback = "250";
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
}

export function getHue(): number {
	return THEME_PALETTE_HUES[getThemePalette()];
}

export function setHue(hue: number): void {
	writeStore("hue", String(hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(hue));
}

export function applyThemeToDocument(theme: LIGHT_DARK_MODE) {
	switch (theme) {
		case LIGHT_MODE:
			document.documentElement.classList.remove("dark");
			break;
		case DARK_MODE:
			document.documentElement.classList.add("dark");
			break;
		case AUTO_MODE:
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
			break;
	}

	// Set the theme for Expressive Code
	document.documentElement.setAttribute(
		"data-theme",
		expressiveCodeConfig.theme,
	);
}

export function setTheme(theme: LIGHT_DARK_MODE): void {
	writeStore("theme", theme);
	applyThemeToDocument(theme);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	return (readStore("theme") as LIGHT_DARK_MODE) || DEFAULT_THEME;
}
