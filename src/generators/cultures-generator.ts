import { max, quadtree, range } from "d3";
import { abbreviate, biased, ensureEl, getColors, getRandomColor, minmax, P, rand, rn, rw } from "../utils";

declare global {
  var Cultures: CulturesModule;
}

export interface Culture {
  name: string;
  i: number;
  base: number;
  shield: string;
  lock?: boolean;
  code?: string;
  center?: number;
  // transient coordinates cached by the heightmap editor across a re-graph
  x?: number;
  y?: number;
  sort?: (i: number) => number;
  odd?: number;
  color?: string;
  type: CultureType;
  expansionism?: number;
  origins?: (number | null)[];
  removed?: boolean;
  cells?: number;
  area?: number;
  rural?: number;
  urban?: number;
}

export const CULTURE_TYPES = ["Generic", "Hunting", "Highland", "River", "Lake", "Naval", "Nomadic"] as const;
export type CultureType = (typeof CULTURE_TYPES)[number];
export const DEFAULT_CULTURE_TYPE: CultureType = "Generic";

class CulturesModule {
  cells: any;

  getRandomShield() {
    const type = rw(COA.shields.types);
    return rw(COA.shields[type]);
  }

  getDefault(count: number = 0): Omit<Culture, "i" | "type">[] {
    // generic sorting functions
    const cells = pack.cells,
      s = cells.s,
      sMax = max(s) as number,
      t = cells.t,
      h = cells.h,
      temp = grid.cells.temp;
    const n = (cell: number) => Math.ceil((s[cell] / sMax) * 3); // normalized cell score
    const td = (cell: number, goal: number) => {
      const d = Math.abs(temp[cells.g[cell]] - goal);
      return d ? d + 1 : 1;
    }; // temperature difference fee
    const bd = (cell: number, biomes: number[], fee = 4) => (biomes.includes(cells.biome[cell]) ? 1 : fee); // biome difference fee
    const sf = (cell: number, fee = 4) =>
      cells.haven[cell] && pack.features[cells.f[cells.haven[cell]]].type !== "lake" ? 1 : fee; // not on sea coast fee

    if (culturesSet.value === "european") {
      return [
        {
          name: "施瓦森",
          base: 0,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10) / bd(i, [6, 8]),
          shield: "swiss"
        },
        {
          name: "安格夏",
          base: 1,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10) / sf(i),
          shield: "wedged"
        },
        {
          name: "卢阿里",
          base: 2,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12) / bd(i, [6, 8]),
          shield: "french"
        },
        {
          name: "塔利安",
          base: 3,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 15),
          shield: "horsehead"
        },
        {
          name: "阿斯特利安",
          base: 4,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 16),
          shield: "spanish"
        },
        {
          name: "斯洛凡",
          base: 5,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 6)) * t[i],
          shield: "polish"
        },
        {
          name: "诺斯",
          base: 6,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 5),
          shield: "heater"
        },
        {
          name: "艾拉丹",
          base: 7,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 18)) * h[i],
          shield: "boeotian"
        },
        {
          name: "罗曼",
          base: 8,
          odd: 0.2,
          sort: (i: number) => n(i) / td(i, 15) / t[i],
          shield: "roman"
        },
        {
          name: "索米",
          base: 9,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 5) / bd(i, [9])) * t[i],
          shield: "pavise"
        },
        {
          name: "波图齐安",
          base: 13,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 17) / sf(i),
          shield: "renaissance"
        },
        {
          name: "文格里安",
          base: 15,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 11) / bd(i, [4])) * t[i],
          shield: "horsehead2"
        },
        {
          name: "突厥安",
          base: 16,
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 14),
          shield: "round"
        },
        {
          name: "尤斯卡蒂",
          base: 20,
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 15)) * h[i],
          shield: "oldFrench"
        },
        {
          name: "凯尔坦",
          base: 22,
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i],
          shield: "oval"
        }
      ];
    }

    if (culturesSet.value === "oriental") {
      return [
        {
          name: "高丽",
          base: 10,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12) / t[i],
          shield: "round"
        },
        {
          name: "汉族",
          base: 11,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 13),
          shield: "banner"
        },
        {
          name: "大和",
          base: 12,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 15) / t[i],
          shield: "round"
        },
        {
          name: "突厥安",
          base: 16,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "round"
        },
        {
          name: "柏柏尔安",
          base: 17,
          odd: 0.2,
          sort: (i: number) => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
          shield: "oval"
        },
        {
          name: "尤拉比",
          base: 18,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i],
          shield: "oval"
        },
        {
          name: "幼发拉底",
          base: 23,
          odd: 0.1,
          sort: (i: number) => (n(i) / td(i, 22)) * t[i],
          shield: "round"
        },
        {
          name: "德黑兰",
          base: 24,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 18)) * h[i],
          shield: "round"
        },
        {
          name: "毛伊",
          base: 25,
          odd: 0.2,
          sort: (i: number) => n(i) / td(i, 24) / sf(i) / t[i],
          shield: "vesicaPiscis"
        },
        {
          name: "卡纳蒂克",
          base: 26,
          odd: 0.5,
          sort: (i: number) => n(i) / td(i, 26),
          shield: "round"
        },
        {
          name: "越南",
          base: 29,
          odd: 0.8,
          sort: (i: number) => n(i) / td(i, 25) / bd(i, [7], 7) / t[i],
          shield: "banner"
        },
        {
          name: "关族",
          base: 30,
          odd: 0.5,
          sort: (i: number) => n(i) / td(i, 17),
          shield: "banner"
        },
        {
          name: "乌鲁斯",
          base: 31,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
          shield: "banner"
        }
      ];
    }

    if (culturesSet.value === "english") {
      const getName = () => Names.getBase(1, 5, 9, "");
      return [
        { name: getName(), base: 1, odd: 1, shield: "heater" },
        { name: getName(), base: 1, odd: 1, shield: "wedged" },
        { name: getName(), base: 1, odd: 1, shield: "swiss" },
        { name: getName(), base: 1, odd: 1, shield: "oldFrench" },
        { name: getName(), base: 1, odd: 1, shield: "swiss" },
        { name: getName(), base: 1, odd: 1, shield: "spanish" },
        { name: getName(), base: 1, odd: 1, shield: "hessen" },
        { name: getName(), base: 1, odd: 1, shield: "fantasy5" },
        { name: getName(), base: 1, odd: 1, shield: "fantasy4" },
        { name: getName(), base: 1, odd: 1, shield: "fantasy1" }
      ];
    }

    if (culturesSet.value === "antique") {
      return [
        {
          name: "罗马",
          base: 8,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 14) / t[i],
          shield: "roman"
        }, // Roman
        {
          name: "罗马",
          base: 8,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 15) / sf(i),
          shield: "roman"
        }, // Roman
        {
          name: "罗马",
          base: 8,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 16) / sf(i),
          shield: "roman"
        }, // Roman
        {
          name: "罗马",
          base: 8,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 17) / t[i],
          shield: "roman"
        }, // Roman
        {
          name: "希腊",
          base: 7,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 18) / sf(i)) * h[i],
          shield: "boeotian"
        }, // Greek
        {
          name: "希腊",
          base: 7,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 19) / sf(i)) * h[i],
          shield: "boeotian"
        }, // Greek
        {
          name: "马其顿",
          base: 7,
          odd: 0.5,
          sort: (i: number) => (n(i) / td(i, 12)) * h[i],
          shield: "round"
        }, // Greek
        {
          name: "凯尔特",
          base: 22,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]),
          shield: "round"
        },
        {
          name: "日耳曼",
          base: 0,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10) ** 0.5 / bd(i, [6, 8]),
          shield: "round"
        },
        {
          name: "波斯",
          base: 24,
          odd: 0.8,
          sort: (i: number) => (n(i) / td(i, 18)) * h[i],
          shield: "oval"
        }, // Iranian
        {
          name: "斯基泰",
          base: 24,
          odd: 0.5,
          sort: (i: number) => n(i) / td(i, 11) ** 0.5 / bd(i, [4]),
          shield: "round"
        }, // Iranian
        {
          name: "坎塔布连",
          base: 20,
          odd: 0.5,
          sort: (i: number) => (n(i) / td(i, 16)) * h[i],
          shield: "oval"
        }, // Basque
        {
          name: "埃斯提",
          base: 9,
          odd: 0.2,
          sort: (i: number) => (n(i) / td(i, 5)) * t[i],
          shield: "pavise"
        }, // Finnic
        {
          name: "迦太基",
          base: 42,
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 20) / sf(i),
          shield: "oval"
        }, // Levantine
        {
          name: "希伯来",
          base: 42,
          odd: 0.2,
          sort: (i: number) => (n(i) / td(i, 19)) * sf(i),
          shield: "oval"
        }, // Levantine
        {
          name: "美索不达米亚",
          base: 23,
          odd: 0.2,
          sort: (i: number) => n(i) / td(i, 22) / bd(i, [1, 2, 3]),
          shield: "oval"
        } // Mesopotamian
      ];
    }

    if (culturesSet.value === "highFantasy") {
      return [
        // fantasy races
        {
          name: "昆雅（精灵）",
          base: 33,
          odd: 1,
          sort: (i: number) => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i],
          shield: "gondor"
        }, // Elves
        {
          name: "艾尔达（精灵）",
          base: 33,
          odd: 1,
          sort: (i: number) => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i],
          shield: "noldor"
        }, // Elves
        {
          name: "特罗（暗精灵）",
          base: 34,
          odd: 0.9,
          sort: (i: number) => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
          shield: "hessen"
        }, // Dark Elves
        {
          name: "洛西安（暗精灵）",
          base: 34,
          odd: 0.3,
          sort: (i: number) => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
          shield: "wedged"
        }, // Dark Elves
        {
          name: "杜尼尔（矮人）",
          base: 35,
          odd: 1,
          sort: (i: number) => n(i) + h[i],
          shield: "ironHills"
        }, // Dwarfs
        {
          name: "卡扎杜尔（矮人）",
          base: 35,
          odd: 1,
          sort: (i: number) => n(i) + h[i],
          shield: "erebor"
        }, // Dwarfs
        {
          name: "狗头人（哥布林）",
          base: 36,
          odd: 1,
          sort: (i: number) => t[i] - s[i],
          shield: "moriaOrc"
        }, // Goblin
        {
          name: "乌鲁克（兽人）",
          base: 37,
          odd: 1,
          sort: (i: number) => h[i] * t[i],
          shield: "urukHai"
        }, // Orc
        {
          name: "乌格卢克（兽人）",
          base: 37,
          odd: 0.5,
          sort: (i: number) => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]),
          shield: "moriaOrc"
        }, // Orc
        {
          name: "尤顿（巨人）",
          base: 38,
          odd: 0.7,
          sort: (i: number) => td(i, -10),
          shield: "pavise"
        }, // Giant
        {
          name: "雷克（龙族）",
          base: 39,
          odd: 0.7,
          sort: (i: number) => -s[i],
          shield: "fantasy2"
        }, // Draconic
        {
          name: "阿拉戈（蛛形）",
          base: 40,
          odd: 0.7,
          sort: (i: number) => t[i] - s[i],
          shield: "horsehead2"
        }, // Arachnid
        {
          name: "阿杰·斯纳加（蛇人）",
          base: 41,
          odd: 0.7,
          sort: (i: number) => n(i) / bd(i, [12], 10),
          shield: "fantasy1"
        }, // Serpents
        // fantasy human
        {
          name: "阿诺（人类）",
          base: 32,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10),
          shield: "fantasy5"
        },
        {
          name: "戴尔（人类）",
          base: 32,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 13),
          shield: "roman"
        },
        {
          name: "罗罕（人类）",
          base: 16,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 16),
          shield: "round"
        },
        {
          name: "杜兰迪尔（人类）",
          base: 31,
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
          shield: "easterling"
        }
      ];
    }

    if (culturesSet.value === "darkFantasy") {
      return [
        // common real-world English
        {
          name: "安格夏",
          base: 1,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10) / sf(i),
          shield: "heater"
        },
        {
          name: "英格兰",
          base: 1,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "heater"
        },
        {
          name: "韦斯顿",
          base: 1,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10),
          shield: "heater"
        },
        {
          name: "诺森布里亚",
          base: 1,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 7),
          shield: "heater"
        },
        {
          name: "麦西亚",
          base: 1,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 9),
          shield: "heater"
        },
        {
          name: "肯特",
          base: 1,
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "heater"
        },
        // rare real-world western
        {
          name: "诺斯",
          base: 6,
          odd: 0.7,
          sort: (i: number) => n(i) / td(i, 5) / sf(i),
          shield: "oldFrench"
        },
        {
          name: "施瓦岑",
          base: 0,
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 10) / bd(i, [6, 8]),
          shield: "gonfalon"
        },
        {
          name: "卢阿里安",
          base: 2,
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 12) / bd(i, [6, 8]),
          shield: "oldFrench"
        },
        {
          name: "赫塔利安",
          base: 3,
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 15),
          shield: "oval"
        },
        {
          name: "阿斯特利安",
          base: 4,
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 16),
          shield: "spanish"
        },
        // rare real-world exotic
        {
          name: "斯瓦希里",
          base: 28,
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]),
          shield: "vesicaPiscis"
        },
        {
          name: "约鲁巴",
          base: 21,
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 15) / bd(i, [5, 7]),
          shield: "vesicaPiscis"
        },
        {
          name: "高丽",
          base: 10,
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 12) / t[i],
          shield: "round"
        },
        {
          name: "汉族",
          base: 11,
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 13),
          shield: "banner"
        },
        {
          name: "大和",
          base: 12,
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 15) / t[i],
          shield: "round"
        },
        {
          name: "关族",
          base: 30,
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 17),
          shield: "banner"
        },
        {
          name: "乌鲁斯",
          base: 31,
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
          shield: "banner"
        },
        {
          name: "突厥",
          base: 16,
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "round"
        },
        {
          name: "柏柏尔安",
          base: 17,
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
          shield: "round"
        },
        {
          name: "尤拉比",
          base: 18,
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i],
          shield: "round"
        },
        {
          name: "斯洛凡",
          base: 5,
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 6)) * t[i],
          shield: "round"
        },
        {
          name: "凯尔坦",
          base: 22,
          odd: 0.1,
          sort: (i: number) => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]),
          shield: "vesicaPiscis"
        },
        {
          name: "艾拉丹",
          base: 7,
          odd: 0.2,
          sort: (i: number) => (n(i) / td(i, 18) / sf(i)) * h[i],
          shield: "boeotian"
        },
        {
          name: "罗曼",
          base: 8,
          odd: 0.2,
          sort: (i: number) => n(i) / td(i, 14) / t[i],
          shield: "roman"
        },
        // fantasy races
        {
          name: "艾尔达",
          base: 33,
          odd: 0.5,
          sort: (i: number) => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i],
          shield: "fantasy5"
        }, // Elves
        {
          name: "特罗",
          base: 34,
          odd: 0.8,
          sort: (i: number) => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
          shield: "hessen"
        }, // Dark Elves
        {
          name: "杜林",
          base: 35,
          odd: 0.8,
          sort: (i: number) => n(i) + h[i],
          shield: "erebor"
        }, // Dwarven
        {
          name: "科布林",
          base: 36,
          odd: 0.8,
          sort: (i: number) => t[i] - s[i],
          shield: "moriaOrc"
        }, // Goblin
        {
          name: "乌鲁克",
          base: 37,
          odd: 0.8,
          sort: (i: number) => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]),
          shield: "urukHai"
        }, // Orc
        {
          name: "尤顿",
          base: 38,
          odd: 0.8,
          sort: (i: number) => td(i, -10),
          shield: "pavise"
        }, // Giant
        {
          name: "德雷克",
          base: 39,
          odd: 0.9,
          sort: (i: number) => -s[i],
          shield: "fantasy2"
        }, // Draconic
        {
          name: "拉赫尼德",
          base: 40,
          odd: 0.9,
          sort: (i: number) => t[i] - s[i],
          shield: "horsehead2"
        }, // Arachnid
        {
          name: "阿杰·斯纳加",
          base: 41,
          odd: 0.9,
          sort: (i: number) => n(i) / bd(i, [12], 10),
          shield: "fantasy1"
        } // Serpents
      ];
    }

    if (culturesSet.value === "random") {
      return range(count).map(() => {
        const rnd = rand(nameBases.length - 1);
        const name = Names.getBaseShort(rnd);
        return { name, base: rnd, odd: 1, shield: this.getRandomShield() };
      });
    }

    // all-world
    return [
      {
        name: "施瓦森",
        base: 0,
        odd: 0.7,
        sort: (i: number) => n(i) / td(i, 10) / bd(i, [6, 8]),
        shield: "hessen"
      },
      {
        name: "安格夏",
        base: 1,
        odd: 1,
        sort: (i: number) => n(i) / td(i, 10) / sf(i),
        shield: "heater"
      },
      {
        name: "卢阿里",
        base: 2,
        odd: 0.6,
        sort: (i: number) => n(i) / td(i, 12) / bd(i, [6, 8]),
        shield: "oldFrench"
      },
      {
        name: "塔利安",
        base: 3,
        odd: 0.6,
        sort: (i: number) => n(i) / td(i, 15),
        shield: "horsehead2"
      },
      {
        name: "阿斯特利安",
        base: 4,
        odd: 0.6,
        sort: (i: number) => n(i) / td(i, 16),
        shield: "spanish"
      },
      {
        name: "斯洛凡",
        base: 5,
        odd: 0.7,
        sort: (i: number) => (n(i) / td(i, 6)) * t[i],
        shield: "round"
      },
      {
        name: "诺斯",
        base: 6,
        odd: 0.7,
        sort: (i: number) => n(i) / td(i, 5),
        shield: "heater"
      },
      {
        name: "艾拉丹",
        base: 7,
        odd: 0.7,
        sort: (i: number) => (n(i) / td(i, 18)) * h[i],
        shield: "boeotian"
      },
      {
        name: "罗曼",
        base: 8,
        odd: 0.7,
        sort: (i: number) => n(i) / td(i, 15),
        shield: "roman"
      },
      {
        name: "索米",
        base: 9,
        odd: 0.3,
        sort: (i: number) => (n(i) / td(i, 5) / bd(i, [9])) * t[i],
        shield: "pavise"
      },
      {
        name: "高丽",
        base: 10,
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 12) / t[i],
        shield: "round"
      },
      {
        name: "汉族",
        base: 11,
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 13),
        shield: "banner"
      },
      {
        name: "大和",
        base: 12,
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 15) / t[i],
        shield: "round"
      },
      {
        name: "波图齐安",
        base: 13,
        odd: 0.4,
        sort: (i: number) => n(i) / td(i, 17) / sf(i),
        shield: "spanish"
      },
      {
        name: "纳瓦特",
        base: 14,
        odd: 0.1,
        sort: (i: number) => h[i] / td(i, 18) / bd(i, [7]),
        shield: "square"
      },
      {
        name: "文格里安",
        base: 15,
        odd: 0.2,
        sort: (i: number) => (n(i) / td(i, 11) / bd(i, [4])) * t[i],
        shield: "wedged"
      },
      {
        name: "突厥安",
        base: 16,
        odd: 0.2,
        sort: (i: number) => n(i) / td(i, 13),
        shield: "round"
      },
      {
        name: "柏柏尔安",
        base: 17,
        odd: 0.1,
        sort: (i: number) => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
        shield: "round"
      },
      {
        name: "尤拉比",
        base: 18,
        odd: 0.2,
        sort: (i: number) => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i],
        shield: "round"
      },
      {
        name: "因纽特",
        base: 19,
        odd: 0.05,
        sort: (i: number) => td(i, -1) / bd(i, [10, 11]) / sf(i),
        shield: "square"
      },
      {
        name: "尤斯卡蒂",
        base: 20,
        odd: 0.05,
        sort: (i: number) => (n(i) / td(i, 15)) * h[i],
        shield: "spanish"
      },
      {
        name: "约鲁巴",
        base: 21,
        odd: 0.05,
        sort: (i: number) => n(i) / td(i, 15) / bd(i, [5, 7]),
        shield: "vesicaPiscis"
      },
      {
        name: "凯尔坦",
        base: 22,
        odd: 0.05,
        sort: (i: number) => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i],
        shield: "vesicaPiscis"
      },
      {
        name: "幼发拉底",
        base: 23,
        odd: 0.05,
        sort: (i: number) => (n(i) / td(i, 22)) * t[i],
        shield: "diamond"
      },
      {
        name: "德黑兰",
        base: 24,
        odd: 0.1,
        sort: (i: number) => (n(i) / td(i, 18)) * h[i],
        shield: "round"
      },
      {
        name: "毛伊",
        base: 25,
        odd: 0.05,
        sort: (i: number) => n(i) / td(i, 24) / sf(i) / t[i],
        shield: "round"
      },
      {
        name: "卡纳蒂克",
        base: 26,
        odd: 0.05,
        sort: (i: number) => n(i) / td(i, 26),
        shield: "round"
      },
      {
        name: "印加",
        base: 27,
        odd: 0.05,
        sort: (i: number) => h[i] / td(i, 13),
        shield: "square"
      },
      {
        name: "斯瓦希里",
        base: 28,
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]),
        shield: "vesicaPiscis"
      },
      {
        name: "越南",
        base: 29,
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 25) / bd(i, [7], 7) / t[i],
        shield: "banner"
      },
      {
        name: "关族",
        base: 30,
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 17),
        shield: "banner"
      },
      {
        name: "乌鲁斯",
        base: 31,
        odd: 0.1,
        sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
        shield: "banner"
      },
      {
        name: "希伯来",
        base: 42,
        odd: 0.2,
        sort: (i: number) => (n(i) / td(i, 18)) * sf(i),
        shield: "oval"
      } // Levantine
    ];
  }

  generate() {
    TIME && console.time("generateCultures");
    this.cells = pack.cells;
    const cultureIds = new Uint16Array(this.cells.i.length); // cell cultures

    const culturesInputNumber = +(ensureEl("culturesInput") as HTMLInputElement).value;
    const culturesInSetNumber = +((ensureEl("culturesSet") as HTMLSelectElement).selectedOptions[0].dataset.max ?? "0");
    let count = Math.min(culturesInputNumber, culturesInSetNumber);
    const populated = this.cells.i.filter((i: number) => this.cells.s[i]); // populated cells

    if (populated.length < count * 25) {
      count = Math.floor(populated.length / 50);
      if (!count) {
        WARN && console.warn(`There are no populated cells. Cannot generate cultures`);
        pack.cultures = [
          {
            name: "荒野",
            i: 0,
            base: 1,
            shield: "round",
            type: DEFAULT_CULTURE_TYPE
          }
        ];
        this.cells.culture = cultureIds;

        alertMessage.innerHTML = /* html */ `气候恶劣，人类无法在此世界生存。<br />
          不会创建任何文化、国家和城镇。<br />
          请考虑在世界配置器中更改气候设置`;

        $("#alert").dialog({
          resizable: false,
          title: "极端气候警告",
          buttons: {
            Ok: function () {
              $(this).dialog("close");
            }
          }
        });
        return;
      } else {
        WARN && console.warn(`Not enough populated cells (${populated.length}). Will generate only ${count} cultures`);
        alertMessage.innerHTML = /* html */ `仅有 ${populated.length} 个宜居单元格，宜居面积不足。<br />
          将只生成 ${count} 个文化（共请求 ${culturesInput.value} 个）。<br />
          请考虑在世界配置器中更改气候设置`;
        $("#alert").dialog({
          resizable: false,
          title: "极端气候警告",
          buttons: {
            Ok: function () {
              $(this).dialog("close");
            }
          }
        });
      }
    }

    const selectCultures = (culturesNumber: number): Culture[] => {
      const defaultCultures = this.getDefault(culturesNumber);
      const cultures: Culture[] = [];

      pack.cultures?.forEach(culture => {
        if (culture.lock && !culture.removed) cultures.push(culture);
      });

      if (!cultures.length) {
        if (culturesNumber === defaultCultures.length) return defaultCultures as Culture[];
        if (defaultCultures.every(d => d.odd === 1)) return defaultCultures.splice(0, culturesNumber) as Culture[];
      }

      for (let culture: Culture, rnd: number, i = 0; cultures.length < culturesNumber && defaultCultures.length > 0; ) {
        do {
          rnd = rand(defaultCultures.length - 1);
          culture = defaultCultures[rnd] as Culture;
          i++;
        } while (i < 200 && !P(culture.odd as number));
        cultures.push(culture);
        defaultCultures.splice(rnd, 1);
      }
      return cultures;
    };

    const cultures = selectCultures(count);
    pack.cultures = cultures;
    const centers = quadtree<number>();
    const colors = getColors(count);
    const emblemShape = (ensureEl("emblemShape") as HTMLInputElement).value;

    const codes: string[] = [];

    const placeCenter = (sortingFn: (i: number) => number) => {
      let spacing = (graphWidth + graphHeight) / 2 / count;
      const MAX_ATTEMPTS = 100;

      const sorted = [...populated].sort((a, b) => sortingFn(b) - sortingFn(a));
      const max = Math.floor(sorted.length / 2);

      let cellId = 0;
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        cellId = sorted[biased(0, max, 5)];
        spacing *= 0.9;
        if (!cultureIds[cellId] && !centers.find(this.cells.p[cellId][0], this.cells.p[cellId][1], spacing)) break;
      }

      return cellId;
    };

    // set culture type based on culture center position
    const defineCultureType = (i: number) => {
      if (this.cells.h[i] < 70 && [1, 2, 4].includes(this.cells.biome[i])) return "Nomadic"; // high penalty in forest biomes and near coastline
      if (this.cells.h[i] > 50) return "Highland"; // no penalty for hills and mountains, high for other elevations
      const f = pack.features[this.cells.f[this.cells.haven[i]]]; // opposite feature
      if (f.type === "lake" && f.cells > 5) return "Lake"; // low water cross penalty and high for growth not along coastline
      if (
        (this.cells.harbor[i] && f.type !== "lake" && P(0.1)) ||
        (this.cells.harbor[i] === 1 && P(0.6)) ||
        (pack.features[this.cells.f[i]].group === "isle" && P(0.4))
      )
        return "Naval"; // low water cross penalty and high for non-along-coastline growth
      if (this.cells.r[i] && this.cells.fl[i] > 100) return "River"; // no River cross penalty, penalty for non-River growth
      if (this.cells.t[i] > 2 && [3, 7, 8, 9, 10, 12].includes(this.cells.biome[i])) return "Hunting"; // high penalty in non-native biomes
      return DEFAULT_CULTURE_TYPE;
    };

    const defineCultureExpansionism = (type: CultureType) => {
      let base = 1; // Generic
      if (type === "Lake") base = 0.8;
      else if (type === "Naval") base = 1.5;
      else if (type === "River") base = 0.9;
      else if (type === "Nomadic") base = 1.5;
      else if (type === "Hunting") base = 0.7;
      else if (type === "Highland") base = 1.2;
      return rn(((Math.random() * (ensureEl("sizeVariety") as HTMLInputElement).valueAsNumber) / 2 + 1) * base, 1);
    };

    cultures.forEach((c: Culture, i: number) => {
      const newId = i + 1;

      if (c.lock) {
        codes.push(c.code as string);
        centers.add(c.center as number);

        for (const i of this.cells.i) {
          if (this.cells.culture[i] === c.i) cultureIds[i] = newId;
        }

        c.i = newId;
        return;
      }

      const sortingFn = c.sort ? c.sort : (i: number) => this.cells.s[i];
      const center = placeCenter(sortingFn);

      centers.add(this.cells.p[center]);
      c.center = center;
      c.i = newId;
      delete c.odd;
      delete c.sort;
      c.color = colors[i];
      c.type = defineCultureType(center);
      c.expansionism = defineCultureExpansionism(c.type);
      c.origins = [0];
      c.code = abbreviate(c.name, codes);
      codes.push(c.code);
      cultureIds[center] = newId;
      if (emblemShape === "random") c.shield = this.getRandomShield();
    });

    this.cells.culture = cultureIds;

    // the first culture with id 0 is for wildlands
    cultures.unshift({
      name: "荒野",
      i: 0,
      base: 1,
      origins: [null],
      shield: "round",
      type: DEFAULT_CULTURE_TYPE
    });

    // make sure all bases exist in nameBases
    if (!nameBases.length) {
      ERROR && console.error("名称库为空，将应用默认名称库");
      nameBases = Names.getNameBases();
    }

    cultures.forEach((c: Culture) => {
      c.base = c.base % nameBases.length;
    });

    TIME && console.timeEnd("generateCultures");
  }

  add(center: number) {
    const defaultCultures = this.getDefault();
    let culture: number, base: number, name: string;

    if (pack.cultures.length < defaultCultures.length) {
      // add one of the default cultures
      culture = pack.cultures.length;
      base = defaultCultures[culture].base;
      name = defaultCultures[culture].name;
    } else {
      // add random culture based on one of the current ones
      culture = rand(pack.cultures.length - 1);
      name = Names.getCulture(culture, 5, 8, "");
      base = pack.cultures[culture].base;
    }

    const code = abbreviate(name, pack.cultures.map(c => c.code) as string[]);
    const i = pack.cultures.length;
    const color = getRandomColor();

    // define emblem shape
    const emblemShape = (document.getElementById("emblemShape") as HTMLInputElement).value;

    pack.cultures.push({
      name,
      color,
      base,
      center,
      i,
      expansionism: 1,
      type: DEFAULT_CULTURE_TYPE,
      cells: 0,
      area: 0,
      rural: 0,
      urban: 0,
      origins: [pack.cells.culture[center]],
      code,
      shield: emblemShape === "random" ? this.getRandomShield() : ""
    });
  }

  expand() {
    TIME && console.time("expandCultures");
    const { cells, cultures } = pack;

    const queue = new FlatQueue();
    const cost: number[] = [];

    const neutralRate = (document.getElementById("neutralRate") as HTMLInputElement | null)?.valueAsNumber || 1;
    const maxExpansionCost = cells.i.length * 0.6 * neutralRate; // limit cost for culture growth

    // remove culture from all cells except of locked
    const hasLocked = cultures.some(c => !c.removed && c.lock);
    if (hasLocked) {
      for (const cellId of cells.i) {
        const culture = cultures[cells.culture[cellId]];
        if (culture.lock) continue;
        cells.culture[cellId] = 0;
      }
    } else {
      cells.culture = new Uint16Array(cells.i.length);
    }

    for (const culture of cultures) {
      if (!culture.i || culture.removed || culture.lock) continue;
      queue.push({ cellId: culture.center, cultureId: culture.i, priority: 0 }, 0);
    }

    const getBiomeCost = (c: number, biome: number, type: string) => {
      if (cells.biome[cultures[c].center as number] === biome) return 10; // tiny penalty for native biome
      if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
      if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 10; // forest biome penalty for nomads
      return biomesData.cost[biome] * 2; // general non-native biome penalty
    };

    const getHeightCost = (i: number, h: number, type: string) => {
      const f = pack.features[cells.f[i]],
        a = cells.area[i];
      if (type === "Lake" && f.type === "lake") return 10; // no lake crossing penalty for Lake cultures
      if (type === "Naval" && h < 20) return a * 2; // low sea/lake crossing penalty for Naval cultures
      if (type === "Nomadic" && h < 20) return a * 50; // giant sea/lake crossing penalty for Nomads
      if (h < 20) return a * 6; // general sea/lake crossing penalty
      if (type === "Highland" && h < 44) return 3000; // giant penalty for highlanders on lowlands
      if (type === "Highland" && h < 62) return 200; // giant penalty for highlanders on lowhills
      if (type === "Highland") return 0; // no penalty for highlanders on highlands
      if (h >= 67) return 200; // general mountains crossing penalty
      if (h >= 44) return 30; // general hills crossing penalty
      return 0;
    };

    const getRiverCost = (riverId: number, cellId: number, type: string) => {
      if (type === "River") return riverId ? 0 : 100; // penalty for river cultures
      if (!riverId) return 0; // no penalty for others if there is no river
      return minmax(cells.fl[cellId] / 10, 20, 100); // river penalty from 20 to 100 based on flux
    };

    const getTypeCost = (t: number, type: string) => {
      if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
      if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
      if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
      return 0;
    };

    while (queue.length) {
      const { cellId, priority, cultureId } = queue.pop();
      const { type, expansionism } = cultures[cultureId];
      const sourceBiome = cells.biome[cellId];

      cells.c[cellId].forEach(neibCellId => {
        if (hasLocked) {
          const neibCultureId = cells.culture[neibCellId];
          if (neibCultureId && cultures[neibCultureId].lock) return; // do not overwrite cell of locked culture
        }

        const targetBiome = cells.biome[neibCellId];
        const biomeCost = getBiomeCost(cultureId, targetBiome, type as string);
        const biomeChangeCost = sourceBiome === targetBiome ? 0 : 20; // penalty on biome change
        const heightCost = getHeightCost(neibCellId, cells.h[neibCellId], type as string);
        const riverCost = getRiverCost(cells.r[neibCellId], neibCellId, type as string);
        const typeCost = getTypeCost(cells.t[neibCellId], type as string);
        const cellCost = (biomeCost + biomeChangeCost + heightCost + riverCost + typeCost) / (expansionism as number);
        const totalCost = priority + cellCost;

        if (totalCost > maxExpansionCost) return;

        if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
          if (cells.pop[neibCellId] > 0) cells.culture[neibCellId] = cultureId; // assign culture to populated cell
          cost[neibCellId] = totalCost;
          queue.push({ cellId: neibCellId, cultureId, priority: totalCost }, totalCost);
        }
      });
    }

    TIME && console.timeEnd("expandCultures");
  }
}

window.Cultures = new CulturesModule();
