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

export function getThemePalette(): ThemePalette {
	const stored = localStorage.getItem("theme-palette") as ThemePalette | null;
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
	localStorage.setItem("theme-palette", palette);
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
	localStorage.setItem("hue", String(hue));
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
	localStorage.setItem("theme", theme);
	applyThemeToDocument(theme);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	return (localStorage.getItem("theme") as LIGHT_DARK_MODE) || DEFAULT_THEME;
}
