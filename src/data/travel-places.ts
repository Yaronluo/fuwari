export type TravelPlaceKind = "city" | "scenic" | "home";

export type TravelPlace = {
	name: string;
	province: string;
	coordinates: [longitude: number, latitude: number];
	kind?: TravelPlaceKind;
	/** 地图放大后，站名相对圆点的偏移（地图坐标单位）。 */
	zoomLabelOffset?: [x: number, y: number];
	zoomLabelAnchor?: "start" | "middle" | "end";
	note?: string;
	visitedAt?: string;
};

/**
 * 去过的地点统一记录在这里，顺序就是行程顺序。
 * 地图会按省份点亮，按坐标画点，按顺序连成一条线。
 */
export const travelPlaces: TravelPlace[] = [
	{
		name: "长沙",
		province: "湖南省",
		coordinates: [112.9388, 28.2282],
		kind: "city",
		zoomLabelOffset: [-6, 2.5],
		zoomLabelAnchor: "end",
		note: "星城的一枚脚印",
	},
	{
		name: "岳阳",
		province: "湖南省",
		coordinates: [113.1289, 29.3571],
		kind: "city",
		zoomLabelOffset: [-6.5, -4.5],
		zoomLabelAnchor: "end",
		note: "洞庭湖畔的一段路",
	},
	{
		name: "平江县",
		province: "湖南省",
		coordinates: [113.5813, 28.702],
		kind: "home",
		zoomLabelOffset: [6.5, 0.8],
		zoomLabelAnchor: "start",
		note: "家乡 · 出发与归来的地方",
	},
	{
		name: "武功山",
		province: "江西省",
		coordinates: [114.1786, 27.4521],
		kind: "scenic",
		zoomLabelOffset: [6.5, 4.6],
		zoomLabelAnchor: "start",
		note: "走过高山草甸",
	},
	{
		name: "庐山",
		province: "江西省",
		coordinates: [115.9766, 29.5716],
		kind: "scenic",
		zoomLabelOffset: [6.5, 1],
		zoomLabelAnchor: "start",
		note: "云雾里的山间记忆",
	},
	{
		name: "厦门",
		province: "福建省",
		coordinates: [118.0853, 24.4801],
		kind: "city",
		zoomLabelOffset: [6.5, 1],
		zoomLabelAnchor: "start",
		note: "海风吹过的鹭岛",
	},
	{
		name: "广州",
		province: "广东省",
		coordinates: [113.2644, 23.1291],
		kind: "city",
		zoomLabelOffset: [-6.5, 2.5],
		zoomLabelAnchor: "end",
		note: "在花城留下足迹",
	},
	{
		name: "深圳",
		province: "广东省",
		coordinates: [114.0545, 22.5446],
		kind: "city",
		zoomLabelOffset: [6.5, 4.2],
		zoomLabelAnchor: "start",
		note: "路过鹏城的灯火",
	},
];

export type TravelWishTone = "sakura" | "sky" | "tea" | "violet" | "mint";

/** 明信片上的小风景：山脊或海浪。 */
export type TravelWishScene = "ridge" | "wave";

export type TravelWish = {
	name: string;
	region: "国内" | "国外";
	note: string;
	glyph: string;
	tone: TravelWishTone;
	scene: TravelWishScene;
};

/** 想去、但还没去过的地方：先收进手账，等哪天真的抵达。 */
export const travelWishlist: TravelWish[] = [
	{
		name: "大理",
		region: "国内",
		note: "苍山洱海之间，慢慢走一段",
		glyph: "☁",
		tone: "sky",
		scene: "ridge",
	},
	{
		name: "海南",
		region: "国内",
		note: "冬天也要去看一次海",
		glyph: "≈",
		tone: "mint",
		scene: "wave",
	},
	{
		name: "拉萨",
		region: "国内",
		note: "去离天空最近的地方发呆",
		glyph: "☼",
		tone: "tea",
		scene: "ridge",
	},
	{
		name: "日本",
		region: "国外",
		note: "樱花季，和深夜食堂",
		glyph: "❀",
		tone: "sakura",
		scene: "wave",
	},
	{
		name: "美国",
		region: "国外",
		note: "一号公路、峡谷与公路片",
		glyph: "◈",
		tone: "violet",
		scene: "ridge",
	},
];
