export type TravelPlace = {
	name: string;
	province: string;
	coordinates: [longitude: number, latitude: number];
	kind?: "city" | "scenic" | "home";
	labelOffset?: [x: number, y: number];
	labelAnchor?: "start" | "middle" | "end";
	note?: string;
	visitedAt?: string;
};

/**
 * 去过的地点统一记录在这里。
 * 等地点确认后，地图会自动点亮对应省份并显示城市标记。
 */
export const travelPlaces: TravelPlace[] = [
	{
		name: "长沙",
		province: "湖南省",
		coordinates: [112.9388, 28.2282],
		kind: "city",
		labelOffset: [-12, 22],
		labelAnchor: "end",
		note: "星城的一枚脚印",
	},
	{
		name: "岳阳",
		province: "湖南省",
		coordinates: [113.1289, 29.3571],
		kind: "city",
		labelOffset: [-13, -11],
		labelAnchor: "end",
		note: "洞庭湖畔的一段路",
	},
	{
		name: "平江县",
		province: "湖南省",
		coordinates: [113.5813, 28.702],
		kind: "home",
		labelOffset: [14, -10],
		labelAnchor: "start",
		note: "家乡 · 出发与归来的地方",
	},
	{
		name: "武功山",
		province: "江西省",
		coordinates: [114.1786, 27.4521],
		kind: "scenic",
		labelOffset: [14, 18],
		labelAnchor: "start",
		note: "走过高山草甸",
	},
	{
		name: "庐山",
		province: "江西省",
		coordinates: [115.9766, 29.5716],
		kind: "scenic",
		labelOffset: [13, -10],
		labelAnchor: "start",
		note: "云雾里的山间记忆",
	},
	{
		name: "厦门",
		province: "福建省",
		coordinates: [118.0853, 24.4801],
		kind: "city",
		labelOffset: [13, 18],
		labelAnchor: "start",
		note: "海风吹过的鹭岛",
	},
	{
		name: "广州",
		province: "广东省",
		coordinates: [113.2644, 23.1291],
		kind: "city",
		labelOffset: [-12, -11],
		labelAnchor: "end",
		note: "在花城留下足迹",
	},
	{
		name: "深圳",
		province: "广东省",
		coordinates: [114.0545, 22.5446],
		kind: "city",
		labelOffset: [13, 17],
		labelAnchor: "start",
		note: "路过鹏城的灯火",
	},
];

export const travelWishlist = {
	domestic: ["大理", "海南", "拉萨"],
	overseas: ["日本", "美国"],
};
