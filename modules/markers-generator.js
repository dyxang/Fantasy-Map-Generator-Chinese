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
    notes.push({id, name, legend: `${status} volcano. Height: ${getFriendlyHeight(cells.p[cell])}.`});
  }

  function listHotSprings({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] > 50 && cells.culture[i]);
  }

  function addHotSpring(id, cell) {
    const {cells} = pack;

    const proper = Names.getCulture(cells.culture[cell]);
    const temp = convertTemperature(gauss(35, 15, 20, 100));
    const name = P(0.3) ? "Hot Springs of " + proper : P(0.7) ? proper + " Hot Springs" : proper;
    const legend = `有天然热水的地热温泉，提供放松和药用的好处。平均气温为 ${temp}.`;

    notes.push({id, name, legend});
  }

  function listWaterSources({cells}) {
    return cells.i.filter(i => !occupied[i] && cells.h[i] > 30 && cells.r[i]);
  }

  function addWaterSource(id, cell) {
    const {cells} = pack;

    const type = rw({
      "Healing Spring": 5,
      "Purifying Well": 2,
      "Enchanted Reservoir": 1,
      "Creek of Luck": 1,
      "Fountain of Youth": 1,
      "Wisdom Spring": 1,
      "Spring of Life": 1,
      "Spring of Youth": 1,
      "Healing Stream": 1
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
      "Dark",
      "Light",
      "Bright",
      "Golden",
      "White",
      "Black",
      "Red",
      "Pink",
      "Purple",
      "Blue",
      "Green",
      "Yellow",
      "Amber",
      "Orange",
      "Brown",
      "Grey"
    ];
    const animals = [
      "Antelope",
      "Ape",
      "Badger",
      "Bear",
      "Beaver",
      "Bison",
      "Boar",
      "Buffalo",
      "Cat",
      "Crane",
      "Crocodile",
      "Crow",
      "Deer",
      "Dog",
      "Eagle",
      "Elk",
      "Fox",
      "Goat",
      "Goose",
      "Hare",
      "Hawk",
      "Heron",
      "Horse",
      "Hyena",
      "Ibis",
      "Jackal",
      "Jaguar",
      "Lark",
      "Leopard",
      "Lion",
      "Mantis",
      "Marten",
      "Moose",
      "Mule",
      "Narwhal",
      "Owl",
      "Panther",
      "Rat",
      "Raven",
      "Rook",
      "Scorpion",
      "Shark",
      "Sheep",
      "Snake",
      "Spider",
      "Swan",
      "Tiger",
      "Turtle",
      "Wolf",
      "Wolverine",
      "Camel",
      "Falcon",
      "Hound",
      "Ox"
    ];
    const adjectives = [
      "New",
      "Good",
      "High",
      "Old",
      "Great",
      "Big",
      "Major",
      "Happy",
      "Main",
      "Huge",
      "Far",
      "Beautiful",
      "Fair",
      "Prime",
      "Ancient",
      "Golden",
      "Proud",
      "Lucky",
      "Fat",
      "Honest",
      "Giant",
      "Distant",
      "Friendly",
      "Loud",
      "Hungry",
      "Magical",
      "Superior",
      "Peaceful",
      "Frozen",
      "Divine",
      "Favorable",
      "Brave",
      "Sunny",
      "Flying"
    ];
    const methods = [
      "Boiled",
      "Grilled",
      "Roasted",
      "Spit-roasted",
      "Stewed",
      "Stuffed",
      "Jugged",
      "Mashed",
      "Baked",
      "Braised",
      "Poached",
      "Marinated",
      "Pickled",
      "Smoked",
      "Dried",
      "Dry-aged",
      "Corned",
      "Fried",
      "Pan-fried",
      "Deep-fried",
      "Dressed",
      "Steamed",
      "Cured",
      "Syrupped",
      "Flame-Broiled"
    ];
    const courses = [
      "beef",
      "pork",
      "bacon",
      "chicken",
      "lamb",
      "chevon",
      "hare",
      "rabbit",
      "hart",
      "deer",
      "antlers",
      "bear",
      "buffalo",
      "badger",
      "beaver",
      "turkey",
      "pheasant",
      "duck",
      "goose",
      "teal",
      "quail",
      "pigeon",
      "seal",
      "carp",
      "bass",
      "pike",
      "catfish",
      "sturgeon",
      "escallop",
      "pie",
      "cake",
      "pottage",
      "pudding",
      "onions",
      "carrot",
      "potato",
      "beet",
      "garlic",
      "cabbage",
      "eggplant",
      "eggs",
      "broccoli",
      "zucchini",
      "pepper",
      "olives",
      "pumpkin",
      "spinach",
      "peas",
      "chickpea",
      "beans",
      "rice",
      "pasta",
      "bread",
      "apples",
      "peaches",
      "pears",
      "melon",
      "oranges",
      "mango",
      "tomatoes",
      "cheese",
      "corn",
      "rat tails",
      "pig ears"
    ];
    const types = [
      "hot",
      "cold",
      "fire",
      "ice",
      "smoky",
      "misty",
      "shiny",
      "sweet",
      "bitter",
      "salty",
      "sour",
      "sparkling",
      "smelly"
    ];
    const drinks = [
      "wine",
      "brandy",
      "gin",
      "whisky",
      "rom",
      "beer",
      "cider",
      "mead",
      "liquor",
      "spirits",
      "vodka",
      "tequila",
      "absinthe",
      "nectar",
      "milk",
      "kvass",
      "kumis",
      "tea",
      "water",
      "juice",
      "sap"
    ];

    const typeName = P(0.3) ? "inn" : "tavern";
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
    const legend = `大名鼎鼎的路边 ${typeName}. 这里供应美味 ${course} 和 ${drink} `;
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
    const legend = `<div>未被发现的地牢.查看: <a href="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" target="_blank">One page dungeon</a></div><iframe style="pointer-events: none;" src="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" sandbox="allow-scripts allow-same-origin"></iframe>`;
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
      "great",
      "big",
      "huge",
      "prime",
      "golden",
      "proud",
      "lucky",
      "fat",
      "giant",
      "hungry",
      "magical",
      "superior",
      "terrifying",
      "horrifying",
      "feared"
    ];
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
    const species = [
      "Ogre",
      "Troll",
      "Cyclops",
      "Giant",
      "Monster",
      "Beast",
      "Dragon",
      "Undead",
      "Ghoul",
      "Vampire",
      "Hag",
      "Banshee",
      "Bearded Devil",
      "Roc",
      "Hydra",
      "Warg"
    ];
    const modusOperandi = [
      "steals cattle at night",
      "prefers eating children",
      "doesn't mind human flesh",
      "keeps the region at bay",
      "eats kids whole",
      "abducts young women",
      "terrorizes the region",
      "harasses travelers in the area",
      "snatches people from homes",
      "attacks anyone who dares to approach its lair",
      "attacks unsuspecting victims"
    ];

    const monster = ra(species);
    const toponym = Names.getCulture(cells.culture[cell]);
    const name = `${toponym} ${monster}`;
    const legend = `${ra(subjects)} speak of a ${ra(adjectives)} ${monster} who inhabits ${toponym} hills and ${ra(
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
      "Apes",
      "Badgers",
      "Bears",
      "Beavers",
      "Bisons",
      "Boars",
      "Cats",
      "Crows",
      "Dogs",
      "Foxes",
      "Hares",
      "Hawks",
      "Hyenas",
      "Jackals",
      "Jaguars",
      "Leopards",
      "Lions",
      "Owls",
      "Panthers",
      "Rats",
      "Ravens",
      "Rooks",
      "Scorpions",
      "Sharks",
      "Snakes",
      "Spiders",
      "Tigers",
      "Wolfs",
      "Wolverines",
      "Falcons"
    ];
    const types = {brigands: 4, bandits: 3, robbers: 1, highwaymen: 1};

    const culture = cells.culture[cell];
    const biome = cells.biome[cell];
    const height = cells.p[cell];

    const locality = ((height, biome) => {
      if (height >= 70) return "highlander";
      if ([1, 2].includes(biome)) return "desert";
      if ([3, 4].includes(biome)) return "mounted";
      if ([5, 6, 7, 8, 9].includes(biome)) return "forest";
      if (biome === 12) return "swamp";
      return "angry";
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
      "Statue",
      "Obelisk",
      "Monument",
      "Column",
      "Monolith",
      "Pillar",
      "Megalith",
      "Stele",
      "Runestone",
      "Sculpture",
      "Effigy",
      "Idol"
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
      "City",
      "Town",
      "Settlement",
      "Pyramid",
      "Fort",
      "Stronghold",
      "Temple",
      "Sacred site",
      "Mausoleum",
      "Outpost",
      "Fortification",
      "Fortress",
      "Castle"
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
      "Fantastical",
      "Wonderous",
      "Incomprehensible",
      "Magical",
      "Extraordinary",
      "Unmissable",
      "World-famous",
      "Breathtaking"
    ];

    const adjective = ra(adjectives);
    const name = `正旅行的 ${adjective} 马戏团`;
    const legend = `注意了，注意了, 这个 ${adjective.toLowerCase()} 的马戏团只在这里停留一段的时间`;
    notes.push({id, name, legend});
  }

  function listJousts({cells, burgs}) {
    return cells.i.filter(i => !occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population > 20);
  }

  function addJoust(id, cell) {
    const {cells, burgs} = pack;
    const types = ["Joust", "Competition", "Melee", "Tournament", "Contest"];
    const virtues = ["cunning", "might", "speed", "the greats", "acumen", "brutality"];

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
      "Antelopes",
      "Apes",
      "Badgers",
      "Bears",
      "Beavers",
      "Bisons",
      "Boars",
      "Buffalo",
      "Cats",
      "Cranes",
      "Crocodiles",
      "Crows",
      "Deer",
      "Dogs",
      "Eagles",
      "Elk",
      "Foxes",
      "Goats",
      "Geese",
      "Hares",
      "Hawks",
      "Herons",
      "Horses",
      "Hyenas",
      "Ibises",
      "Jackals",
      "Jaguars",
      "Larks",
      "Leopards",
      "Lions",
      "Mantises",
      "Martens",
      "Mooses",
      "Mules",
      "Owls",
      "Panthers",
      "Rats",
      "Ravens",
      "Rooks",
      "Scorpions",
      "Sharks",
      "Sheep",
      "Snakes",
      "Spiders",
      "Tigers",
      "Wolves",
      "Wolverines",
      "Camels",
      "Falcons",
      "Hounds",
      "Oxen"
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
      "gala",
      "dance",
      "performance",
      "ball",
      "soiree",
      "jamboree",
      "exhibition",
      "carnival",
      "festival",
      "jubilee",
      "celebration",
      "gathering",
      "fete"
    ];
    const people = [
      "great and the good",
      "nobility",
      "local elders",
      "foreign dignitaries",
      "spiritual leaders",
      "suspected revolutionaries"
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
      "a good spot to hid treasure": 5,
      "the home of strange monsters": 5,
      "totally empty": 4,
      "endlessly deep and unexplored": 4,
      "completely flooded": 2,
      "slowly filling with lava": 1
    };

    let formation = rw(formations);
    const toponym = Names.getCulture(cells.culture[cell]);
    if (cells.biome[cell] === 11) {
      formation = "Glacial " + formation;
    }
    const name = `${toponym} ${formation}`;
    const legend = `The ${name}. Locals claim that it is ${rw(status)}.`;
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
    const legend = `连接主要城市的魔法门户系统的一个组成部分.门几个世纪前就造好了，但还能正常工作`;
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
    const legend = `<div>你偶遇了一位人物.（以下内容由于被墙无法直接访问）</div><a href="https://deorum.vercel.app/encounter/${encounterSeed}" target="_blank" style="color:#deb640;">官方链接</a><iframe src="https://deorum.vercel.app/encounter/${encounterSeed}" width="375" height="600" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
    notes.push({id, name, legend});
  }

  return {add, generate, regenerate, getConfig, setConfig, deleteMarker};
})();
