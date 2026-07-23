// Pre-created heightmaps: each key matches a grayscale image in public/heightmaps/<key>.png

export type PrecreatedHeightmap = {
  id: number;
  name: string;
};

export const precreatedHeightmaps: Record<string, PrecreatedHeightmap> = {
  "africa-centric": { id: 0, name: "非洲为中心" },
  arabia: { id: 1, name: "阿拉伯" },
  atlantics: { id: 2, name: "大西洋" },
  britain: { id: 3, name: "不列颠" },
  caribbean: { id: 4, name: "加勒比" },
  "east-asia": { id: 5, name: "东亚" },
  eurasia: { id: 6, name: "欧亚" },
  europe: { id: 7, name: "欧洲" },
  "europe-accented": { id: 8, name: "欧洲突出" },
  "europe-and-central-asia": { id: 9, name: "欧洲与中亚" },
  "europe-central": { id: 10, name: "欧洲中部" },
  "europe-north": { id: 11, name: "欧洲北部" },
  greenland: { id: 12, name: "格陵兰" },
  hellenica: { id: 13, name: "希腊" },
  iceland: { id: 14, name: "冰岛" },
  "indian-ocean": { id: 15, name: "印度洋" },
  "mediterranean-sea": { id: 16, name: "地中海" },
  "middle-east": { id: 17, name: "中东" },
  "north-america": { id: 18, name: "北美" },
  "us-centric": { id: 19, name: "美国为中心" },
  "us-mainland": { id: 20, name: "美国本土" },
  world: { id: 21, name: "世界" },
  "world-from-pacific": { id: 22, name: "太平洋视角的世界" }
};

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var precreatedHeightmaps: Record<string, PrecreatedHeightmap>;
}

// temp legacy compatibility
window.precreatedHeightmaps = precreatedHeightmaps;
