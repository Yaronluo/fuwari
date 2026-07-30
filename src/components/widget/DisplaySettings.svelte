<script lang="ts">
import Icon from "@iconify/svelte";
import {
	getThemePalette,
	setThemePalette,
	type ThemePalette,
} from "@utils/setting-utils";

const palettes: {
	id: ThemePalette;
	label: string;
	description: string;
	colors: string[];
	icon: string;
}[] = [
	{
		id: "yui",
		label: "平泽唯 · 草莓奶油",
		description: "奶油白 · 草莓粉 · 吉他棕",
		colors: ["#fff9ef", "#d97991", "#765044"],
		icon: "mdi:guitar-acoustic",
	},
	{
		id: "mio",
		label: "秋山澪 · 深莓紫",
		description: "柔雾白 · 澪紫 · 夜弦灰",
		colors: ["#fbf8fc", "#88709c", "#6c5268"],
		icon: "mdi:guitar-electric",
	},
	{
		id: "ritsu",
		label: "田井中律 · 向日葵",
		description: "暖米白 · 鼓槌金 · 乐队灰",
		colors: ["#fffaf0", "#d39a3d", "#655847"],
		icon: "mdi:drum",
	},
	{
		id: "mugi",
		label: "琴吹紬 · 红茶蜂蜜",
		description: "奶霜白 · 蜂蜜金 · 红茶棕",
		colors: ["#fff8ed", "#b98652", "#704f3b"],
		icon: "mdi:tea",
	},
	{
		id: "azusa",
		label: "中野梓 · 校服蓝",
		description: "雾白 · 梓喵蓝 · 深海灰",
		colors: ["#f5fafb", "#668eae", "#526977"],
		icon: "mdi:guitar-pick",
	},
];

let selectedPalette = getThemePalette();

function selectPalette(palette: ThemePalette) {
	selectedPalette = palette;
	setThemePalette(palette);
}
</script>

<div id="display-setting" class="float-panel float-panel-closed absolute transition-all w-[22rem] max-w-[calc(100vw-2rem)] right-4 px-4 py-4 pointer-events-auto">
	<div class="flex items-center gap-2 mb-3 ml-1 text-[var(--text-strong)]">
		<Icon icon="material-symbols:palette-outline-rounded" class="text-xl text-[var(--primary)]" />
		<div>
			<div class="font-bold text-base">配色主题</div>
			<div class="text-xs text-[var(--text-muted)] font-normal mt-0.5">选择一套完整的站点配色</div>
		</div>
	</div>

	<div class="grid gap-2" role="radiogroup" aria-label="配色主题">
		{#each palettes as palette}
			<button
				type="button"
				role="radio"
				aria-checked={selectedPalette === palette.id}
				aria-label={`使用${palette.label}主题`}
				class:active={selectedPalette === palette.id}
				class="palette-option"
				onclick={() => selectPalette(palette.id)}
			>
				<span class="palette-emblem" aria-hidden="true" style={`--palette-accent:${palette.colors[1]}`}>
					<Icon icon={palette.icon} class="palette-instrument" />
					<span class="palette-swatches">
						{#each palette.colors as color}
							<span class="palette-swatch" style={`background:${color}`}></span>
						{/each}
					</span>
				</span>
				<span class="min-w-0 flex-1 text-left">
					<span class="block text-sm font-bold text-[var(--text-strong)]">{palette.label}</span>
					<span class="block text-xs text-[var(--text-muted)] mt-0.5">{palette.description}</span>
				</span>
				<span class="palette-check" class:visible={selectedPalette === palette.id} aria-hidden="true">
					<Icon icon="material-symbols:check-rounded" class="text-lg" />
				</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.palette-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.7rem;
		border: 1px solid var(--glass-border);
		border-radius: 0.85rem;
		background: color-mix(in srgb, var(--cream-base) 58%, transparent);
		transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
	}

	.palette-option:hover {
		border-color: color-mix(in srgb, var(--primary) 50%, var(--glass-border));
		background: color-mix(in srgb, var(--primary) 7%, var(--cream-base));
		transform: translateY(-1px);
	}

	.palette-option.active {
		border-color: color-mix(in srgb, var(--primary) 65%, transparent);
		background: color-mix(in srgb, var(--primary) 11%, var(--cream-base));
	}

	.palette-swatches {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: -0.15rem;
		padding-left: 0.2rem;
	}

	.palette-emblem {
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		width: 2.9rem;
		height: 2.9rem;
		border: 1px solid color-mix(in srgb, var(--palette-accent) 28%, var(--glass-border));
		border-radius: 0.85rem;
		background: color-mix(in srgb, var(--palette-accent) 10%, var(--cream-base));
		color: var(--palette-accent);
		transition: transform 180ms ease, background 180ms ease;
	}

	.palette-option:hover .palette-emblem,
	.palette-option.active .palette-emblem {
		transform: rotate(-3deg) scale(1.04);
		background: color-mix(in srgb, var(--palette-accent) 17%, var(--cream-base));
	}

	.palette-instrument {
		width: 1.35rem;
		height: 1.35rem;
	}

	.palette-swatch {
		width: 0.52rem;
		height: 0.52rem;
		margin-left: -0.1rem;
		border: 1px solid var(--cream-base);
		border-radius: 999px;
		box-shadow: 0 0.12rem 0.35rem rgba(67, 46, 42, 0.14);
	}

	.palette-check {
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 999px;
		color: white;
		background: var(--primary);
		opacity: 0;
		transform: scale(0.75);
		transition: opacity 160ms ease, transform 160ms ease;
	}

	.palette-check.visible {
		opacity: 1;
		transform: scale(1);
	}
</style>
