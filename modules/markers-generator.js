"use strict";

window.Markers = (function () {
  let config = getDefaultConfig();
  let occupied = [];

  function getDefaultConfig() {
    const culturesSet = document.getElementById("culturesSet").value;
    const isFantasy = culturesSet.includes("Fantasy");

    /*
      Default markers config:
      type - short description (snake-case)
      icon - unicode character, make sure it's supported by most of the browsers. Source: emojipedia.org
      dx: icon offset in x direction, in pixels
      dy: icon offset in y direction, in pixels
      min: minimum number of candidates to add at least 1 marker
      each: how many of the candidates should be added as markers
      multiplier: multiply markers quantity to add
      list: function to select candidates
      add: function to add marker legend
    */
    // prettier-ignore
    return [
      {type: "volcanoes", icon: "🌋", dx: 52, px: 13, min: 10, each: 500, multiplier: 1, list: listVolcanoes, add: addVolcano},
      {type: "hot-springs", icon: "♨️", dy: 52, min: 30, each: 1200, multiplier: 1, list: listHotSprings, add: addHotSpring},
      {type: "water-sources", icon: "💧", min: 1, each: 1000, multiplier: 1, list: listWaterSources, add: addWaterSource},
      {type: "mines", icon: "⛏️", dx: 48, px: 13, min: 1, each: 15, multiplier: 1, list: listMines, add: addMine},
      {type: "bridges", icon: "🌉", px: 14, min: 1, each: 5, multiplier: 1, list: listBridges, add: addBridge},
      {type: "inns", icon: "🍻", px: 14, min: 1, each: 10, multiplier: 1, list: listInns, add: addInn},
      {type: "lighthouses", icon: "🚨", px: 14, min: 1, each: 2, multiplier: 1, list: listLighthouses, add: addLighthouse},
      {type: "waterfalls", icon: "⟱", dy: 54, px: 16, min: 1, each: 5, multiplier: 1, list: listWaterfalls, add: addWaterfall},
      {type: "battlefields", icon: "⚔️", dy: 52, min: 50, each: 700, multiplier: 1, list: listBattlefields, add: addBattlefield},
      {type: "dungeons", icon: "🗝️", dy: 51, px: 13, min: 30, each: 200, multiplier: 1, list: listDungeons, add: addDungeon},
      {type: "lake-monsters", icon: "🐉", dy: 48, min: 2, each: 10, multiplier: 1, list: listLakeMonsters, add: addLakeMonster},
      {type: "sea-monsters", icon: "🦑", min: 50, each: 700, multiplier: 1, list: listSeaMonsters, add: addSeaMonster},
      {type: "hill-monsters", icon: "👹", dy: 54, px: 13, min: 30, each: 600, multiplier: 1, list: listHillMonsters, add: addHillMonster},
      {type: "sacred-mountains", icon: "🗻", dy: 48, min: 1, each: 5, multiplier: 1, list: listSacredMountains, add: addSacredMountain},
      {type: "sacred-forests", icon: "🌳", min: 30, each: 1000, multiplier: 1, list: listSacredForests, add: addSacredForest},
      {type: "sacred-pineries", icon: "🌲", px: 13, min: 30, each: 800, multiplier: 1, list: listSacredPineries, add: addSacredPinery},
      {type: "sacred-palm-groves", icon: "🌴", px: 13, min: 1, each: 100, multiplier: 1, list: listSacredPalmGroves, add: addSacredPalmGrove},
      {type: "brigands", icon: "💰", px: 13, min: 50, each: 100, multiplier: 1, list: listBrigands, add: addBrigands},
      {type: "pirates", icon: "🏴‍☠️", dx: 51, min: 40, each: 300, multiplier: 1, list: listPirates, add: addPirates},
      {type: "statues", icon: "🗿", min: 80, each: 1200, multiplier: 1, list: listStatues, add: addStatue},
      {type: "ruins", icon: "🏺", min: 80, each: 1200, multiplier: 1, list: listRuins, add: addRuins},
      {type: "libraries", icon: "📚", min: 10, each: 1200, multiplier: 1, list: listLibraries, add: addLibrary},
      {type: "circuses", icon: "🎪", min: 80, each: 1000, multiplier: 1, list: listCircuses, add: addCircuse},
      {type: "jousts", icon: "🤺", dx: 48, min: 5, each: 500, multiplier: 1, list: listJousts, add: addJoust},
      {type: "fairs", icon: "🎠", min: 50, each: 1000, multiplier: 1, list: listFairs, add: addFair},
      {type: "canoes", icon: "🛶", min: 500, each: 2000, multiplier: 1, list: listCanoes, add: addCanoe},
      {type: "migration", icon: "🐗", min: 20, each: 1000, multiplier: 1, list: listMigrations, add: addMigration},
      {type: "dances", icon: "💃🏽", min: 50, each: 1000, multiplier: 1, list: listDances, add: addDances},
      {type: "mirage", icon: "💦", min: 10, each: 400, multiplier: 1, list: listMirage, add: addMirage},
      {type: "caves", icon:"🦇", min: 60, each: 1000, multiplier: 1, list: listCaves, add: addCave},
      {type: "portals", icon: "🌀", px: 14, min: 16, each: 8, multiplier: +isFantasy, list: listPortals, add: addPortal},
      {type: "rifts", icon: "🎆", min: 5, each: 3000, multiplier: +isFantasy, list: listRifts, add: addRift},
      {type: "disturbed-burials", icon: "💀", min: 20, each: 3000, multiplier: +isFantasy, list: listDisturbedBurial, add: addDisturbedBurial},
      {type: "necropolises", icon: "🪦", min: 20, each: 1000, multiplier: 1, list: listNecropolis, add: addNecropolis},
      {type: "encounters", icon: "🧙", min: 10, each: 600, multiplier: 1, list: listEncounters, add: addEncounter},
    ];
  }

  const getConfig = () => config;

  const setConfig = newConfig => {
    config = newConfig;
  };

  const generate = function () {
    setConfig(getDefaultConfig());
    pack.markers = [];
    generateTypes();
  };

  const regenerate = () => {
    pack.markers = pack.markers.filter(({i, lock, cell}) => {
      if (lock) {
        occupied[cell] = true;
        return true;
      }
      const id = `marker${i}`;
      document.getElementById(id)?.remove();
      const index = notes.findIndex(note => note.id === id);
      if (index != -1) notes.splice(index, 1);
      return false;
    });

    generateTypes();
  };

  const add = marker => {
    const base = config.find(c => c.type === marker.type);
    if (base) {
      const {icon, type, dx, dy, px} = base;
      marker = addMarker({icon, type, dx, dy, px}, marker);
      base.add("marker" + marker.i, marker.cell);
      return marker;
    }

    const i = last(pack.markers)?.i + 1 || 0;
    pack.markers.push({...marker, i});
    occupied[marker.cell] = true;
    return {...marker, i};
  };

  function generateTypes() {
    TIME && console.time("addMarkers");

    config.forEach(({type, icon, dx, dy, px, min, each, multiplier, list, add}) => {
      if (multiplier === 0) return;

      let candidates = Array.from(list(pack));
      let quantity = getQuantity(candidates, min, each, multiplier);
      // uncomment for debugging:
      // console.info(`${icon} ${type}: each ${each} of ${candidates.length}, min ${min} candidates. Got ${quantity}`);

      while (quantity && candidates.length) {
        const [cell] = extractAnyElement(candidates);
        const marker = addMarker({icon, type, dx, dy, px}, {cell});
        if (!marker) continue;
        add("marker" + marker.i, cell);
        quantity--;
      }
    });

    occupied = [];
    TIME && console.timeEnd("addMarkers");
  }

  function getQuantity(array, min, each, multiplier) {
    if (!array.length || array.length < min / multiplier) return 0;
    const requestQty = Math.ceil((array.length / each) * multiplier);
    return array.length < requestQty ? array.length : requestQty;
  }

  function extractAnyElement(array) {
    const index = Math.floor(Math.random() * array.length);
    return array.splice(index, 1);
  }

  function getMarkerCoordinates(cell) {
    const {cells, burgs} = pack;
    const burgId = cells.burg[cell];

    if (burgId) {
      const {x, y} = burgs[burgId];
      return [x, y];
    }

    return cells.p[cell];
  }

  function addMarker(base, marker) {
    if (marker.cell === undefined) return;
    const i = last(pack.markers)?.i + 1 || 0;
    const [x, y] = getMarkerCoordinates(marker.cell);
    marker = {...base, x, y, ...marker, i};
    pack.markers.push(marker);
    occupied[marker.cell] = true;
    return marker;
  }

  function deleteMarker(markerId) {
    const noteId = "marker" + markerId;
    notes = notes.filter(note => note.id !== noteId);
    pack.markers = pack.markers.filter(m => m.i !== markerId);
  }

  function listVolcanoes({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 70);
  }

  function addVolcano(id, cell) {
    const {cells} = pack;

    const proper = Names.getCulture(cells.culture[cell]);
    const name = P(0.3) ? "山峰 " + proper : P(0.7) ? proper + " 火山" : proper;
    const status = P(0.6) ? "休眠" : P(0.4) ? "活跃" : "爆发";
    notes.push({id, name, legend: `${status} 火山，高: ${getFriendlyHeight(cells.p[cell])}.`});
  }

  function listHotSprings({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] > 50 && cells.culture[i]);
  }

  function addHotSpring(id, cell) {
    const {cells} = pack;

    const proper = Names.getCulture(cells.culture[cell]);
    const temp = convertTemperature(gauss(35, 15, 20, 100));
    const name = P(0.3) ? "Hot Springs of " + proper : P(0.7) ? proper + " 温泉" : proper;
    const legend = `有天然热水的地热温泉，提供放松和药用的好处。平均气温为 ${temp}.`;

    notes.push({id, name, legend});
  }

  function listWaterSources({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] > 30 && cells.r[i]);
  }

  function addWaterSource(id, cell) {
    const {cells} = pack;

    const type = rw({
      "治愈之泉": 5,
      "净化之井": 2,
      "魔法水库": 1,
      "幸运小溪": 1,
      "青春之泉": 1,
      "智慧之泉": 1,
      "生命之泉": 1,
      "青春之泉": 1,
      "治愈之溪": 1
    });

    const proper = Names.getCulture(cells.culture[cell]);
    const name = `${proper} ${type}`;
    const legend =
      "这个传说中的水源在古代传说中流传，人们认为它具有神秘的属性。泉水散发出水晶般清澈的水，闪烁着超凡脱俗的彩虹色，即使在最昏暗的光线下也会闪烁。";

    notes.push({id, name, legend});
  }

  function listMines({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] > 47 && cells.burg[i]);
  }

  function addMine(id, cell) {
    const {cells} = pack;

    const resources = {salt: 5, gold: 2, silver: 4, copper: 2, iron: 3, lead: 1, tin: 1};
    const resource = rw(resources);
    const burg = pack.burgs[cells.burg[cell]];
    const name = `${burg.name} — ${resource} 矿业城市`;
    const population = rn(burg.population * populationRate * urbanization);
    const legend = `${burg.name}是一个有${population}人的矿业小镇，就在${resource}矿附近。`;
    notes.push({id, name, legend});
  }

  function listBridges({cells, burgs}) {
    const meanFlux = d3.mean(cells.fl.filter(fl => fl));
    return cells.i.filter(
      i =>
        !occupied[i] &&
        cells.burg[i] &&
        cells.t[i] !== 1 &&
        burgs[cells.burg[i]].population > 20 &&
        cells.r[i] &&
        cells.fl[i] > meanFlux
    );
  }

  function addBridge(id, cell) {
    const {cells} = pack;

    const burg = pack.burgs[cells.burg[cell]];
    const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const name = river && P(0.2) ? `${river.name} 桥` : `${burg.name} 桥`;
    const weightedAdjectives = {
      stone: 10,
      wooden: 1,
      lengthy: 2,
      formidable: 2,
      rickety: 1,
      beaten: 1,
      weathered: 1
    };
    const barriers = [
      "在洪水中坍塌",
      "据说是为了吸引巨魔",
      "当地贸易的枯竭",
      "该地区土匪横行",
      "旧的路标崩溃了"
    ];
    const legend = P(0.7)
      ? `一个 ${rw(weightedAdjectives)} 桥跨越 ${riverName} 接近 ${burg.name} `
      : `一条古老的 ${riverName} 渡口，自从 ${ra(barriers)} 很少使用`;

    notes.push({id, name, legend});
  }

  function listInns({cells}) {
    const crossRoads = cells.i.filter(i => !occupied[i] && cells.pop[i] > 5 && Routes.isCrossroad(i));
    return crossRoads;
  }

  function addInn(id, cell) {
    const colors = [
      "黑暗",
      "光明",
      "明亮",
      "金色",
      "白色",
      "黑色",
      "红色",
      "粉色",
      "紫色",
      "蓝色",
      "绿色",
      "黄色",
      "琥珀色",
      "橙色",
      "棕色",
      "灰色"
    ];
    const animals = [
      "羚羊",
      "猿",
      "獾",
      "熊",
      "海狸",
      "野牛",
      "野猪",
      "水牛",
      "猫",
      "鹤",
      "鳄鱼",
      "乌鸦",
      "鹿",
      "狗",
      "鹰",
      "麋鹿",
      "狐狸",
      "山羊",
      "鹅",
      "野兔",
      "鹰",
      "鹭",
      "马",
      "鬣狗",
      "朱鹭",
      "豺",
      "美洲虎",
      "云雀",
      "豹",
      "狮子",
      "螳螂",
      "貂",
      "麋鹿",
      "骡子",
      "独角鲸",
      "猫头鹰",
      "黑豹",
      "老鼠",
      "渡鸦",
      "白嘴鸦",
      "蝎子",
      "鲨鱼",
      "绵羊",
      "蛇",
      "蜘蛛",
      "天鹅",
      "老虎",
      "乌龟",
      "狼",
      "狼獾",
      "骆驼",
      "猎鹰",
      "猎犬",
      "牛"
    ];
    const adjectives = [
      "新",
      "好",
      "高",
      "老",
      "伟大",
      "大",
      "主要",
      "快乐",
      "主要",
      "巨大",
      "远",
      "美丽",
      "公平",
      "主要",
      "古老",
      "金色",
      "骄傲",
      "幸运",
      "胖",
      "诚实",
      "巨人",
      "遥远",
      "友好",
      "大声",
      "饥饿",
      "魔法",
      "优越",
      "和平",
      "冰冻",
      "神圣",
      "有利",
      "勇敢",
      "阳光",
      "飞行"
    ];
    const methods = [
"煮",
      "烤",
      "炙烤",
      "串烤",
      "炖",
      "填塞",
      "罐煮",
      "捣碎",
      "烘烤",
      "焖",
      "炒",
      "煲",
      "煮",
      "酱",
      "烩",
      "拌",
      "熘",
      "焖",
      "焯",
      "汆",
      "水煮",
      "腌制",
      "烧",
      "熏制",
      "风干",
      "熟成",
      "盐渍",
      "炸",
      "煎",
      "油炸",
      "卤",
      "蒸",
      "腌制",
      "糖泡",
      "炙烤"
    ];
    const courses = [
      "牛肉",
      "猪肉",
      "培根",
      "鸡肉",
      "羊肉",
      "山羊",
      "野兔",
      "兔肉",
      "鹿肉",
      "鹿角",
      "熊肉",
      "水牛",
      "獾肉",
      "海狸",
      "火鸡",
      "雉鸡",
      "鸭肉",
      "鹅肉",
      "鸭肉",
      "鹌鹑",
      "鸽肉",
      "海豹",
      "鲤鱼",
      "鲈鱼",
      "梭鱼",
      "鲶鱼",
      "鲟鱼",
      "扇贝",
      "馅饼",
      "蛋糕",
      "浓汤",
      "布丁",
      "洋葱",
      "胡萝卜",
      "土豆",
      "甜菜",
      "大蒜",
      "卷心菜",
      "茄子",
      "鸡蛋",
      "西兰花",
      "西葫芦",
      "辣椒",
      "橄榄",
      "南瓜",
      "菠菜",
      "豌豆",
      "鹰嘴豆",
      "豆类",
      "米饭",
      "意大利面",
      "面包",
      "苹果",
      "桃子",
      "梨",
      "瓜",
      "橙子",
      "芒果",
      "西红柿",
      "奶酪",
      "玉米",
      "老鼠尾巴",
      "猪耳朵",
      "豆腐",
      "海带",
      "紫菜",
      "海参",
      "鲍鱼",
      "鱼翅",
      "燕窝",
      "竹笋",
      "香菇",
      "木耳",
      "银耳",
      "莲子",
      "红枣",
      "枸杞",
      "桂圆",
      "生姜",
      "大蒜",
      "大葱",
      "香菜",
      "茴香"
    ];
    const types = [
      "热",
      "凉",
      "火",
      "冰",
      "烟熏",
      "雾蒙蒙",
      "闪亮",
      "甜",
      "苦",
      "咸",
      "酸",
      "闪闪发光",
      "臭"
    ];
    const drinks = [
      "葡萄酒",
      "白兰地",
      "杜松子酒",
      "威士忌",
      "朗姆酒",
      "啤酒",
      "苹果酒",
      "蜂蜜酒",
      "烈酒",
      "伏特加",
      "龙舌兰酒",
      "苦艾酒",
      "花蜜",
      "牛奶",
      "克瓦斯",
      "马奶酒",
      "茶",
      "水",
      "果汁",
      "树液",
      "清酒",
      "烧酒",
      "烧酎",
      "白酒",
      "米酒",
      "棕榈酒",
      "椰子水",
      "杏仁露",
      "芙蓉花水",
      "菠萝水",
      "马黛茶",
      "奇恰酒",
      "紫玉米汁",
      "印度奶茶",
      "拉西",
      "酸奶饮料",
      "布卡酒",
      "拉克酒",
      "茴香酒",
      "齐普罗酒",
      "桑格利亚",
      "龙井茶",
      "铁观音",
      "普洱茶",
      "黄酒",
      "乌龙茶",
      "茉莉花茶",
      "绿茶",
      "梅酒",
      "抹茶",
      "玄米茶",
      "柚子茶"
    ];

    const typeName = P(0.3) ? "旅店" : "酒馆";
    const isAnimalThemed = P(0.7);
    const animal = ra(animals);
    const name = isAnimalThemed
      ? P(0.6)
        ? ra(colors) + " " + animal
        : ra(adjectives) + " " + animal
      : ra(adjectives) + " " + capitalize(typeName);
    const meal = isAnimalThemed && P(0.3) ? animal : ra(courses);
    const course = `${ra(methods)} ${meal}`.toLowerCase();
    const drink = `${P(0.5) ? ra(types) : ra(colors)} ${ra(drinks)}`.toLowerCase();
    const legend = `大名鼎鼎的路边 ${typeName}. 这里供应美味的 ${course} 与 ${drink} `;
    notes.push({id, name: "The " + name, legend});
  }

  function listLighthouses({cells}) {
    return cells.i.filter(
      i => !occupied[i] && cells.harbor[i] > 6 && cells.c[i].some(c => cells.h[c] < 20 && Routes.isConnected(c))
    );
  }

  function addLighthouse(id, cell) {
    const {cells} = pack;

    const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
    notes.push({
      id,
      name: getAdjective(proper) + " 灯塔" + name,
      legend: `在公海上作为船只信标的灯塔`
    });
  }

  function listWaterfalls({cells}) {
    return cells.i.filter(
      i => cells.r[i] && !occupied[i] && cells.h[i] >= 50 && cells.c[i].some(c => cells.h[c] < 40 && cells.r[c])
    );
  }

  function addWaterfall(id, cell) {
    const {cells} = pack;

    const descriptions = [
      "一个华丽的瀑布在这里流淌",
      "一个异常美丽的瀑布的急流",
      "一个壮观的瀑布穿过大地",
      "壮丽的瀑布倾泻而下",
      "一条河从很高的地方流下，形成了一个奇妙的瀑布",
      "一个壮观的瀑布穿过风景"
    ];

    const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
    notes.push({id, name: getAdjective(proper) + " 瀑布" + name, legend: `${ra(descriptions)}`});
  }

  function listBattlefields({cells}) {
    return cells.i.filter(
      i => !occupied[i] && cells.state[i] && cells.pop[i] > 2 && cells.h[i] < 50 && cells.h[i] > 25
    );
  }

  function addBattlefield(id, cell) {
    const {cells, states} = pack;

    const state = states[cells.state[cell]];
    if (!state.campaigns) state.campaigns = BurgsAndStates.generateCampaign(state);
    const campaign = ra(state.campaigns);
    const date = generateDate(campaign.start, campaign.end);
    const name = Names.getCulture(cells.culture[cell]) + " 战场";
    const legend = `一场历史性的 ${campaign.name} 战役. \r\n日期: ${date} ${options.era}`;
    notes.push({id, name, legend});
  }

  function listDungeons({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.pop[i] && cells.pop[i] < 3);
  }

  function addDungeon(id, cell) {
    const dungeonSeed = `${seed}${cell}`;
    const name = "地牢";
    const legend = `<div>未被发现的地牢.<a href="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" target="_blank">打开地牢地图</a></div><iframe style="pointer-events: none;" src="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    notes.push({id, name, legend});
  }

  function listLakeMonsters({features}) {
    return features
      .filter(feature => feature.type === "lake" && feature.group === "freshwater" && !occupied[feature.firstCell])
      .map(feature => feature.firstCell);
  }

  function addLakeMonster(id, cell) {
    const lake = pack.features[pack.cells.f[cell]];

    // Check that the feature is a lake in case the user clicked on a wrong
    // square
    if (lake.type !== "lake") return;

    const name = `${lake.name} 怪物`;
    const length = gauss(10, 5, 5, 100);
    const subjects = [
      "Locals",
      "Elders",
      "Inscriptions",
      "Tipplers",
      "Legends",
      "Whispers",
      "Rumors",
      "Journeying folk",
      "Tales"
    ];
    const legend = `${ra(subjects)}说${lake.name}湖上住着一个${length} ${heightUnit.value}长的怪物。不管是真是假，人们都不敢在湖里钓鱼。`;
    notes.push({id, name, legend});
  }

  function listSeaMonsters({cells, features}) {
    return cells.i.filter(
      i => !occupied[i] && cells.h[i] < 20 && Routes.isConnected(i) && features[cells.f[i]].type === "ocean"
    );
  }

  function addSeaMonster(id, cell) {
    const name = `${Names.getCultureShort(0)} 怪物`;
    const length = gauss(25, 10, 10, 100);
    const legend = `老水手们讲述了一个巨大的海怪栖息在这片危险水域的故事。 传言说它可有 ${length} ${heightUnit.value} 长`;
    notes.push({id, name, legend});
  }

  function listHillMonsters({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 50 && cells.pop[i]);
  }

  function addHillMonster(id, cell) {
    const {cells} = pack;

    const adjectives = [
      "伟大的",
      "大的",
      "巨大的",
      "最好的",
      "金色的",
      "自豪的",
      "幸运的",
      "胖的",
      "巨大的",
      "饥饿的",
      "神奇的",
      "优越的",
      "可怕的",
      "恐怖的",
      "令人畏惧的"
    ];
    const subjects = [
      "当地人",
      "长者",
      "碑文",
      "酒徒",
      "传说",
      "低语",
      "谣言",
      "旅行者",
      "故事"
    ];
    const species = [
      "食人魔",
      "巨魔",
      "独眼巨人",
      "巨人",
      "怪物",
      "野兽",
      "龙",
      "不死生物",
      "食尸鬼",
      "吸血鬼",
      "女巫",
      "女妖",
      "胡须魔鬼",
      "巨鹰",
      "九头蛇",
      "座狼"
    ];
    const modusOperandi = [
      "夜晚偷牛",
      "喜欢吃小孩",
      "不介意人肉",
      "让地区保持警惕",
      "整个吃掉孩子",
      "绑架年轻女子",
      "恐吓该地区",
      "骚扰该地区的旅行者",
      "从家中抓走人",
      "攻击任何敢接近其巢穴的人",
      "攻击毫无防备的受害者"
    ];

    const monster = ra(species);
    const toponym = Names.getCulture(cells.culture[cell]);
    const name = `${toponym} ${monster}`;
    const legend = `${ra(subjects)} 讲述了一个 居住在 ${toponym} 山丘的 ${ra(adjectives)} ${monster} ， ${ra(
      modusOperandi
    )}.`;
    notes.push({id, name, legend});
  }

  // Sacred mountains spawn on lonely mountains
  function listSacredMountains({cells}) {
    return cells.i.filter(
      i =>
        !occupied[i] &&
        cells.h[i] >= 70 &&
        cells.c[i].some(c => cells.culture[c]) &&
        cells.c[i].every(c => cells.h[c] < 60)
    );
  }

  function addSacredMountain(id, cell) {
    const {cells, religions} = pack;

    const culture = cells.c[cell].map(c => cells.culture[c]).find(c => c);
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} 山`;
    const height = getFriendlyHeight(cells.p[cell]);
    const legend = `${religions[religion].name}的圣山，高: ${height}.`;
    notes.push({id, name, legend});
  }

  // Sacred forests spawn on temperate forests
  function listSacredForests({cells}) {
    return cells.i.filter(
      i => !occupied[i] && cells.culture[i] && cells.religion[i] && [6, 8].includes(cells.biome[i])
    );
  }

  function addSacredForest(id, cell) {
    const {cells, religions} = pack;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} 树林`;
    const legend = `对${religions[religion].name}当地人来说是神圣的树林`;
    notes.push({id, name, legend});
  }

  // Sacred pineries spawn on boreal forests
  function listSacredPineries({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && cells.religion[i] && cells.biome[i] === 9);
  }

  function addSacredPinery(id, cell) {
    const {cells, religions} = pack;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} 松树林`;
    const legend = `对 ${religions[religion].name}当地人来说是神圣的松树林`;
    notes.push({id, name, legend});
  }

  // Sacred palm groves spawn on oasises
  function listSacredPalmGroves({cells}) {
    return cells.i.filter(
      i =>
        !occupied[i] &&
        cells.culture[i] &&
        cells.religion[i] &&
        cells.biome[i] === 1 &&
        cells.pop[i] > 1 &&
        Routes.isConnected(i)
    );
  }

  function addSacredPalmGrove(id, cell) {
    const {cells, religions} = pack;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} 棕树林`;
    const legend = `对 ${religions[religion].name}当地人来说是神圣的棕榈树林`;
    notes.push({id, name, legend});
  }

  function listBrigands({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && Routes.hasRoad(i));
  }

  function addBrigands(id, cell) {
    const {cells} = pack;

    const animals = [
      "猿",
      "獾",
      "熊",
      "海狸",
      "野牛",
      "野猪",
      "猫",
      "乌鸦",
      "狗",
      "狐狸",
      "野兔",
      "鹰",
      "鬣狗",
      "豺",
      "美洲虎",
      "猎豹",
      "狮子",
      "猫头鹰",
      "黑豹",
      "老鼠",
      "渡鸦",
      "白嘴鸦",
      "蝎子",
      "鲨鱼",
      "蛇",
      "蜘蛛",
      "老虎",
      "狼",
      "狼獾",
      "猎鹰"
    ];
    const types = {brigands: 4, bandits: 3, robbers: 1, highwaymen: 1};

    const culture = cells.culture[cell];
    const biome = cells.biome[cell];
    const height = cells.p[cell];

    const locality = ((height, biome) => {
      if (height >= 70) return "山地人";
      if ([1, 2].includes(biome)) return "沙漠";
      if ([3, 4].includes(biome)) return "骑乘";
      if ([5, 6, 7, 8, 9].includes(biome)) return "森林";
      if (biome === 12) return "沼泽";
      return "愤怒";
    })(height, biome);

    const name = `${Names.getCulture(culture)} ${ra(animals)}`;
    const legend = `一帮 ${locality} ${rw(types)}.`;
    notes.push({id, name, legend});
  }

  // Pirates spawn on sea routes
  function listPirates({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] < 20 && Routes.isConnected(i));
  }

  function addPirates(id, cell) {
    const name = `海盗`;
    const legend = `在这片水域发现了海盗船`;
    notes.push({id, name, legend});
  }

  function listStatues({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 20 && cells.h[i] < 40);
  }

  function addStatue(id, cell) {
    const {cells} = pack;

    const variants = [
    "雕像",
    "方尖碑",
    "纪念碑",
    "石柱",
    "独石",
    "柱子",
    "巨石",
    "石碑",
    "符文石",
    "雕塑",
    "肖像",
    "人像"
    ];
    const scripts = {
      cypriot: "𐠁𐠂𐠃𐠄𐠅𐠈𐠊𐠋𐠌𐠍𐠎𐠏𐠐𐠑𐠒𐠓𐠔𐠕𐠖𐠗𐠘𐠙𐠚𐠛𐠜𐠝𐠞𐠟𐠠𐠡𐠢𐠣𐠤𐠥𐠦𐠧𐠨𐠩𐠪𐠫𐠬𐠭𐠮𐠯𐠰𐠱𐠲𐠳𐠴𐠵𐠷𐠸𐠼𐠿      ",
      geez: "ሀለሐመሠረሰቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ   ",
      coptic: "ⲲⲴⲶⲸⲺⲼⲾⳀⳁⳂⳃⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳤ⳥⳧⳩⳪ⳫⳬⳭⳲ⳹⳾   ",
      tibetan: "ༀ༁༂༃༄༅༆༇༈༉༊་༌༐༑༒༓༔༕༖༗༘༙༚༛༜༠༡༢༣༤༥༦༧༨༩༪༫༬༭༮༯༰༱༲༳༴༵༶༷༸༹༺༻༼༽༾༿",
      mongolian: "᠀᠐᠑᠒ᠠᠡᠦᠧᠨᠩᠪᠭᠮᠯᠰᠱᠲᠳᠵᠻᠼᠽᠾᠿᡀᡁᡆᡍᡎᡏᡐᡑᡒᡓᡔᡕᡖᡗᡙᡜᡝᡞᡟᡠᡡᡭᡮᡯᡰᡱᡲᡳᡴᢀᢁᢂᢋᢏᢐᢑᢒᢓᢛᢜᢞᢟᢠᢡᢢᢤᢥᢦ"
    };

    const culture = cells.culture[cell];

    const variant = ra(variants);
    const name = `${Names.getCulture(culture)} ${variant}`;
    const script = scripts[ra(Object.keys(scripts))];
    const inscription = Array(rand(40, 100))
      .fill(null)
      .map(() => ra(script))
      .join("");
    const legend = `一个古老 ${variant.toLowerCase()}. 上面有铭文，但没人能翻译:
        <div style="font-size: 1.8em; line-break: anywhere;">${inscription}</div>`;
    notes.push({id, name, legend});
  }

  function listRuins({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && cells.h[i] >= 20 && cells.h[i] < 60);
  }

  function addRuins(id, cell) {
    const types = [
      "城市",
      "城镇",
      "定居点",
      "金字塔",
      "堡垒",
      "要塞",
      "寺庙",
      "圣地",
      "陵墓",
      "前哨",
      "防御工事",
      "堡垒",
      "城堡"
    ];

    const ruinType = ra(types);
    const name = `荒废的 ${ruinType}`;
    const legend = `一座 ${ruinType.toLowerCase()} 的遗迹. 无尽的财富可能蕴藏其中`;
    notes.push({id, name, legend});
  }

  function listLibraries({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && cells.burg[i] && cells.pop[i] > 10);
  }

  function addLibrary(id, cell) {
    const {cells} = pack;

    const type = rw({Library: 3, Archive: 1, Collection: 1});
    const name = `${Names.getCulture(cells.culture[cell])} ${type}`;
    const legend = "大量的知识，包括许多罕见的和古老的书籍。";

    notes.push({id, name, legend});
  }

  function listCircuses({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.culture[i] && cells.h[i] >= 20 && Routes.isConnected(i));
  }

  function addCircuse(id, cell) {
    const adjectives = [
      "奇幻的",
      "奇妙的",
      "难以理解的",
      "魔法的",
      "非凡的",
      "不容错过的",
      "世界闻名的",
      "令人叹为观止的"
    ];

    const adjective = ra(adjectives);
    const name = `正旅行的 ${adjective} 马戏团`;
    const legend = `注意了！注意了！ 这个 ${adjective.toLowerCase()} 马戏团只在这暂留一段时间`;
    notes.push({id, name, legend});
  }

  function listJousts({cells, burgs}) {
    return cells.i.filter(i => !occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population > 20);
  }

  function addJoust(id, cell) {
    const {cells, burgs} = pack;
    const types = ["骑士格斗", "比赛", "混战", "锦标赛", "竞赛"];
    const virtues = ["狡猾", "力量", "速度", "伟大", "敏锐", "残忍"];

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;
    const type = ra(types);
    const virtue = ra(virtues);

    const name = `${burgName} ${type}`;
    const legend = `来自全国各地的战士们聚集在 ${burgName} 中，为了 ${virtue} 的 ${type.toLowerCase()} , 名利双收`;
    notes.push({id, name, legend});
  }

  function listFairs({cells, burgs}) {
    return cells.i.filter(
      i => !occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population < 20 && burgs[cells.burg[i]].population < 5
    );
  }

  function addFair(id, cell) {
    const {cells, burgs} = pack;
    if (!cells.burg[cell]) return;

    const burgName = burgs[cells.burg[cell]].name;
    const type = "Fair";

    const name = `${burgName} ${type}`;
    const legend = `一个交易会正在${burgName}举行，提供各种各样的本地和外国商品和服务。`;
    notes.push({id, name, legend});
  }

  function listCanoes({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.r[i]);
  }

  function addCanoe(id, cell) {
    const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);

    const name = `小码头`;
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const legend = `${riverName} 沿岸有一个可以放船的小地方坐落在这里，还有一个疲惫的船主，愿意出售沿河的通道`;
    notes.push({id, name, legend});
  }

  function listMigrations({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 20 && cells.pop[i] <= 2);
  }

  function addMigration(id, cell) {
    const animals = [
      "羚羊",
      "猿",
      "獾",
      "熊",
      "海狸",
      "野牛",
      "野猪",
      "水牛",
      "猫",
      "鹤",
      "鳄鱼",
      "乌鸦",
      "鹿",
      "狗",
      "鹰",
      "麋鹿",
      "狐狸",
      "山羊",
      "鹅",
      "野兔",
      "鹰",
      "鹭",
      "马",
      "鬣狗",
      "朱鹭",
      "豺",
      "美洲虎",
      "云雀",
      "豹",
      "狮子",
      "螳螂",
      "貂",
      "麋鹿",
      "骡子",
      "猫头鹰",
      "豹",
      "老鼠",
      "渡鸦",
      "白嘴鸦",
      "蝎子",
      "鲨鱼",
      "绵羊",
      "蛇",
      "蜘蛛",
      "老虎",
      "狼",
      "狼獾",
      "骆驼",
      "猎鹰",
      "猎犬",
      "牛"
    ];
    const animalChoice = ra(animals);

    const name = `${animalChoice} 迁徙`;
    const legend = `一大群 ${animalChoice.toLowerCase()} 正在迁徙, 无论是他们日常生活的一部分，还是更特别的东西`;
    notes.push({id, name, legend});
  }

  function listDances({cells, burgs}) {
    return cells.i.filter(i => !occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population > 15);
  }

  function addDances(id, cell) {
    const {cells, burgs} = pack;
    const burgName = burgs[cells.burg[cell]].name;
    const socialTypes = [
      "盛会",
      "舞会",
      "表演",
      "舞会",
      "晚会",
      "狂欢",
      "展览",
      "嘉年华",
      "节日",
      "庆典",
      "庆祝",
      "聚会",
      "节日"
    ];
    const people = [
      "大人物",
      "贵族",
      "当地长老",
      "外国政要",
      "精神领袖",
      "可疑革命者"
    ];
    const socialType = ra(socialTypes);

    const name = `${burgName} ${socialType}`;
    const legend = `${burgName} 已经组织了一场 ${socialType}，借此机会把当地的 ${ra(
      people
    )} 们聚集在一起行乐，结盟，围绕危机制定计划`;
    notes.push({id, name, legend});
  }

  function listMirage({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.biome[i] === 1);
  }

  function addMirage(id, cell) {
    const adjectives = ["Entrancing", "Diaphanous", "Illusory", "Distant", "Perculiar"];

    const mirageAdjective = ra(adjectives);
    const name = `${mirageAdjective} 海市蜃楼`;
    const legend = `此处的 ${mirageAdjective.toLowerCase()} 海市蜃楼已经吸引旅行者远离他们的道路亿万年`;
    notes.push({id, name, legend});
  }

  function listCaves({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 50 && cells.pop[i]);
  }

  function addCave(id, cell) {
    const {cells} = pack;

    const formations = {
      Cave: 10,
      Cavern: 8,
      Chasm: 6,
      Ravine: 6,
      Fracture: 5,
      Grotto: 4,
      Pit: 4,
      Sinkhole: 2,
      Hole: 2
    };
    const status = {
      "藏宝的好地方": 5,
      "奇怪怪物的家园": 5,
      "完全空旷之地": 4,
      "深不可测且未被探索之地": 4,
      "完全被淹没之地": 2,
      "熔岩填满之地": 1
    };

    let formation = rw(formations);
    const toponym = Names.getCulture(cells.culture[cell]);
    if (cells.biome[cell] === 11) {
      formation = "Glacial " + formation;
    }
    const name = `${toponym} ${formation}`;
    const legend = ` ${name}. 当地人称ta为 ${rw(status)}.`;
    notes.push({id, name, legend});
  }

  function listPortals({burgs}) {
    return burgs
      .slice(1, Math.ceil(burgs.length / 10) + 1)
      .filter(({cell}) => !occupied[cell])
      .map(burg => burg.cell);
  }

  function addPortal(id, cell) {
    const {cells, burgs} = pack;

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;

    const name = `${burgName} 之门`;
    const legend = `作为连接主要城市的魔法门户系统的一部分，这些门虽然几个世纪前就已建成，但至今仍能正常运作。`;
    notes.push({id, name, legend});
  }

  function listRifts({cells}) {
    return cells.i.filter(i => !occupied[i] && pack.cells.pop[i] <= 3 && biomesData.habitability[pack.cells.biome[i]]);
  }

  function addRift(id, cell) {
    const types = ["Demonic", "Interdimensional", "Abyssal", "Cosmic", "Cataclysmic", "Subterranean", "Ancient"];

    const descriptions = [
      "所有已知的附近生物都惊恐地逃离",
      "在现实中形成裂缝",
      "敌人蜂拥而出",
      "附近植物的生命会枯萎和腐烂",
      "一个带着无所不能的遗物的使者"
    ];

    const riftType = ra(types);
    const name = `${riftType} 裂缝`;
    const legend = `一个谣言 ${riftType.toLowerCase()} 裂缝造成了这个地区的 ${ra(descriptions)}.`;
    notes.push({id, name, legend});
  }

  function listDisturbedBurial({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 20 && cells.pop[i] > 2);
  }
  function addDisturbedBurial(id, cell) {
    const name = "被打扰的墓地";
    const legend = "这地区的一处墓地受到了打扰，导致沉睡的死者苏醒并袭击活人。";
    notes.push({id, name, legend});
  }

  function listNecropolis({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 20 && cells.pop[i] < 2);
  }

  function addNecropolis(id, cell) {
    const {cells} = pack;

    const toponym = Names.getCulture(cells.culture[cell]);
    const type = rw({
      Necropolis: 5,
      Crypt: 2,
      Tomb: 2,
      Graveyard: 1,
      Cemetery: 2,
      Mausoleum: 1,
      Sepulchre: 1
    });

    const name = `${toponym} ${type}`;
    const legend = ra([
      "一个笼罩在永恒黑暗中的不祥墓地，诡异的低语回荡在蜿蜒的走廊里，幽灵般的守护者站在那里守护着那些被遗忘已久的灵魂的坟墓”",
      "一座高耸的墓地，装饰着可怕的雕塑，由强大的不死哨兵守卫。它古老的大厅里埋葬着死去的英雄的遗体，与他们珍贵的遗物一起被埋葬",
      "这个空灵的墓地似乎悬浮在生者和死者之间。一缕缕薄雾在墓碑周围飞舞，空中回荡着纪念逝者的悠扬旋律",
      "从荒凉的景观中升起，这个邪恶的墓地是亡灵力量的证明。它的骷髅尖顶投下不祥的阴影，隐藏着禁忌的知识和神秘的秘密",
      "一个怪异的墓地，自然与死亡交织在一起。杂草丛生的墓碑被多刺的藤蔓缠绕，悲伤的灵魂徘徊在曾经生机勃勃的花朵凋零的花瓣中",
      "一个迷宫般的墓地，每走一步都回荡着令人难以忘怀的低语。墙壁上装饰着古老的符文，不安分的灵魂引导或阻碍着那些敢于深入其中的人",
      "这个被诅咒的墓地笼罩在永恒的暮色中，延续着一种末日即将来临的感觉。黑暗的魔法笼罩着坟墓，痛苦的灵魂的呻吟回荡在摇摇欲坠的大厅里",
      "在迷宫般的地下墓穴网络中建造的一个庞大的墓地。它的大厅里排列着无数的壁龛，每个壁龛里都安放着死者的遗体，而远处的骨头嘎嘎作响的声音充满了空气",
      "一个荒凉的墓地，笼罩着诡异的寂静。时间似乎凝固在腐朽的陵墓中，只有风的低语和破旗的沙沙声打破了寂静",
      "一个不祥的墓地坐落在参差不齐的悬崖上，俯瞰着一片荒凉的荒地。高耸的城墙庇护着不安的灵魂，雄伟的大门上有无数战斗和古老诅咒的痕迹"
    ]);

    notes.push({id, name, legend});
  }

  function listEncounters({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] >= 20 && cells.pop[i] > 1);
  }

  function addEncounter(id, cell) {
    const name = "偶遇";
    const encounterSeed = cell; // use just cell Id to not overwhelm the Vercel KV database
    const legend = `<div>你偶遇了一位人.</div><iframe src="https://deorum.8desk.top/encounter/${encounterSeed}" width="375" height="600" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
    notes.push({id, name, legend});
  }

  return {add, generate, regenerate, getConfig, setConfig, deleteMarker};
})();
