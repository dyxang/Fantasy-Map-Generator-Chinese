"use strict";
// functions to save project as .map file

// prepare map data for saving
function getMapData() {
  const date = new Date();
  const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  const license = "File can be loaded in azgaar.github.io/Fantasy-Map-Generator";
  const params = [version, license, dateString, seed, graphWidth, graphHeight, mapId].join("|");
  const settings = [
    distanceUnitInput.value,
    distanceScaleInput.value,
    areaUnit.value,
    heightUnit.value,
    heightExponentInput.value,
    temperatureScale.value,
    barSizeInput.value,
    barLabel.value,
    barBackOpacity.value,
    barBackColor.value,
    barPosX.value,
    barPosY.value,
    populationRate,
    urbanization,
    mapSizeOutput.value,
    latitudeOutput.value,
    temperatureEquatorOutput.value,
    temperaturePoleOutput.value,
    precOutput.value,
    JSON.stringify(options),
    mapName.value,
    +hideLabels.checked,
    stylePreset.value,
    +rescaleLabels.checked,
    urbanDensity
  ].join("|");
  const coords = JSON.stringify(mapCoordinates);
  const biomes = [biomesData.color, biomesData.habitability, biomesData.name].join("|");
  const notesData = JSON.stringify(notes);
  const rulersString = rulers.toString();
  const fonts = JSON.stringify(getUsedFonts(svg.node()));

  // save svg
  const cloneEl = document.getElementById("map").cloneNode(true);

  // reset transform values to default
  cloneEl.setAttribute("width", graphWidth);
  cloneEl.setAttribute("height", graphHeight);
  cloneEl.querySelector("#viewbox").removeAttribute("transform");

  cloneEl.querySelector("#ruler").innerHTML = ""; // always remove rulers

  const serializedSVG = new XMLSerializer().serializeToString(cloneEl);

  const {spacing, cellsX, cellsY, boundary, points, features, cellsDesired} = grid;
  const gridGeneral = JSON.stringify({spacing, cellsX, cellsY, boundary, points, features, cellsDesired});
  const packFeatures = JSON.stringify(pack.features);
  const cultures = JSON.stringify(pack.cultures);
  const states = JSON.stringify(pack.states);
  const burgs = JSON.stringify(pack.burgs);
  const religions = JSON.stringify(pack.religions);
  const provinces = JSON.stringify(pack.provinces);
  const rivers = JSON.stringify(pack.rivers);
  const markers = JSON.stringify(pack.markers);

  // store name array only if not the same as default
  const defaultNB = Names.getNameBases();
  const namesData = nameBases
    .map((b, i) => {
      const names = defaultNB[i] && defaultNB[i].b === b.b ? "" : b.b;
      return `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${names}`;
    })
    .join("/");

  // round population to save space
  const pop = Array.from(pack.cells.pop).map(p => rn(p, 4));

  // data format as below
  const mapData = [
    params,
    settings,
    coords,
    biomes,
    notesData,
    serializedSVG,
    gridGeneral,
    grid.cells.h,
    grid.cells.prec,
    grid.cells.f,
    grid.cells.t,
    grid.cells.temp,
    packFeatures,
    cultures,
    states,
    burgs,
    pack.cells.biome,
    pack.cells.burg,
    pack.cells.conf,
    pack.cells.culture,
    pack.cells.fl,
    pop,
    pack.cells.r,
    pack.cells.road,
    pack.cells.s,
    pack.cells.state,
    pack.cells.religion,
    pack.cells.province,
    pack.cells.crossroad,
    religions,
    provinces,
    namesData,
    rivers,
    rulersString,
    fonts,
    markers
  ].join("\r\n");
  return mapData;
}

// Download .map file
function dowloadMap() {
  if (customization)
    return tip("当编辑模式处于活动状态时无法保存地图，请退出模式并重试", false, "error");
  closeDialogs("#alert");

  const mapData = getMapData();
  const blob = new Blob([mapData], {type: "text/plain"});
  const URL = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = getFileName() + ".map";
  link.href = URL;
  link.click();
  tip(`${link.download} 已保存，打开“下载”屏幕(CTRL + J)以检查`, true, "success", 7000);
  window.URL.revokeObjectURL(URL);
}

async function saveToDropbox() {
  if (customization)
    return tip("当编辑模式处于活动状态时无法保存地图，请退出模式并重试", false, "error");
  closeDialogs("#alert");
  const mapData = getMapData();
  const filename = getFileName() + ".map";
  try {
    await Cloud.providers.dropbox.save(filename, mapData);
    tip("Map is saved to your Dropbox", true, "success", 8000);
  } catch (msg) {
    ERROR && console.error(msg);
    tip("Cannot save .map to your Dropbox", true, "error", 8000);
  }
}

async function initiateAutosave() {
  const MINUTE = 60000; // munite in milliseconds
  let lastSavedAt = Date.now();

  async function autosave() {
    const timeoutMinutes = byId("autosaveIntervalOutput").valueAsNumber;
    if (!timeoutMinutes) return;

    const diffInMinutes = (Date.now() - lastSavedAt) / MINUTE;
    if (diffInMinutes < timeoutMinutes) return;
    if (customization) return tip("自动保存: 编辑模式下无法自动保存", false, "warning", 2000);

    tip("自动保存: 保存地图中...", false, "warning", 3000);
    const mapData = getMapData();
    const blob = new Blob([mapData], {type: "text/plain"});
    await ldb.set("lastMap", blob);
    INFO && console.log("自动保存于", new Date().toLocaleTimeString());
    lastSavedAt = Date.now();
  }

  setInterval(autosave, MINUTE / 2);
}

async function quickSave() {
  if (customization)
    return tip("当编辑模式处于活动状态时无法保存地图，请退出模式并重试", false, "error");

  const mapData = getMapData();
  const blob = new Blob([mapData], {type: "text/plain"});
  if (blob) ldb.set("lastMap", blob); // auto-save map
  tip("地图已保存到浏览器内存中。请另存为 .map 文件以保护进度", true, "success", 2000);
}

const saveReminder = function () {
  if (localStorage.getItem("noReminder")) return;
  const message = [
    "请不要忘记把你的工作保存为.map 文件",
    "请记住把工作保存为.map 文件",
    "以.map 格式保存将确保在出现问题时数据不会丢失",
    "安全第一，请保存地图",
    "不要忘记定期保存你的地图！",
    "只是温柔地提醒你保存地图",
    "请不要忘记保存你的进度(保存为.map 是最好的选择)",
    "不想被提醒需要保存? 按 Ctrl + Q"
  ];
  const interval = 15 * 60 * 1000; // remind every 15 minutes

  saveReminder.reminder = setInterval(() => {
    if (customization) return;
    tip(ra(message), true, "warn", 2500);
  }, interval);
  saveReminder.status = 1;
};
saveReminder();

function toggleSaveReminder() {
  if (saveReminder.status) {
    tip("保存提醒关闭。再次按 Ctrl + Q 重新启动", true, "warn", 2000);
    clearInterval(saveReminder.reminder);
    localStorage.setItem("noReminder", true);
    saveReminder.status = 0;
  } else {
    tip("保存提醒已打开。按 Ctrl + Q 关闭", true, "warn", 2000);
    localStorage.removeItem("noReminder");
    saveReminder();
  }
}
