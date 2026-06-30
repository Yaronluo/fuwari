import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { LinkPreset, type NavBarLink } from "@/types/config";

export const LinkPresets: { [key in LinkPreset]: NavBarLink } = {
	[LinkPreset.Home]: {
		name: i18n(I18nKey.home),
		url: "/",
		icon: "fa6-solid:house-chimney-window",
	},
	[LinkPreset.About]: {
		name: i18n(I18nKey.about),
		url: "/about/",
		icon: "fa6-solid:face-smile-wink",
	},
	[LinkPreset.Archive]: {
		name: i18n(I18nKey.archive),
		url: "/archive/",
		icon: "fa6-solid:box-archive",
	},
    [LinkPreset.Series]: {
        name: i18n(I18nKey.series),
        url: '/series/',
		icon: "fa6-solid:book-bookmark",
    },
};
