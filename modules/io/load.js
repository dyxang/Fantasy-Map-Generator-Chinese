"use strict";
// Functions to load and parse .map/.gz files
async function quickLoad() {
  const blob = await ldb.get("lastMap");
  if (blob) loadMapPrompt(blob);
  else {
    tip("没有存储地图。请先把地图保存到浏览器的存储系统", true, "error", 2000);
    ERROR && console.error("No map stored");
  }
}

async function loadFromDropbox() {
  const mapPath = document.getElementById("loadFromDropboxSelect")?.value;

  DEBUG && console.log("Loading map from Dropbox:", mapPath);
  const blob = await Cloud.providers.dropbox.load(mapPath);
  uploadMap(blob);
}

async function createSharableDropboxLink() {
  const mapFile = document.querySelector("#loadFromDropbox select").value;
  const sharableLink = document.getElementById("sharableLink");
  const sharableLinkContainer = document.getElementById("sharableLinkContainer");
  let url;
  try {
    url = await Cloud.providers.dropbox.getLink(mapFile);
  } catch {
    return tip("Dropbox API error. Can not create link.", true, "error", 2000);
  }

  const fmg = window.location.href.split("?")[0];
  const reallink = `${fmg}?maplink=${url}`;
  // voodoo magic required by the yellow god of CORS
  const link = reallink.replace("www.dropbox.com/s/", "dl.dropboxusercontent.com/1/view/");
  const shortLink = link.slice(0, 50) + "...";

  sharableLinkContainer.style.display = "block";
  sharableLink.innerText = shortLink;
  sharableLink.setAttribute("href", link);
}

function loadMapPrompt(blob) {
  const workingTime = (Date.now() - last(mapHistory).created) / 60000; // minutes
  if (workingTime < 5) {
    loadLastSavedMap();
    return;
  }

  alertMessage.innerHTML = /* html */ `确实要加载已保存的地图吗?<br />
  对当前地图所做的所有未保存的更改都将丢失`;
  $("#alert").dialog({
    resizable: false,
    title: "载入已保存地图",
    buttons: {
      取消: function () {
        $(this).dialog("close");
      },
      加载: function () {
        loadLastSavedMap();
        $(this).dialog("close");
      }
    }
  });

  function loadLastSavedMap() {
    WARN && console.warn("载入最后保存的地图");
    try {
      uploadMap(blob);
    } catch (error) {
      ERROR && console.error(error);
      tip("无法加载上次保存的地图", true, "error", 2000);
    }
  }
}

function loadMapFromURL(maplink, random) {
  const URL = decodeURIComponent(maplink);

  fetch(URL, {method: "GET", mode: "cors"})
    .then(response => {
      if (response.ok) return response.blob();
      throw new Error("无法从 URL 加载地图");
    })
    .then(blob => uploadMap(blob))
    .catch(error => {
      showUploadErrorMessage(error.message, URL, random);
      if (random) generateMapOnLoad();
    });
}

function showUploadErrorMessage(error, URL, random) {
  ERROR && console.error(error);
  alertMessage.innerHTML = /* html */ `无法从 ${link(URL, "已提供连结")} 提供地图. ${
    random ? `随机生成一个新地图. ` : ""
  } 请确保链接文件可以访问，并且服务器端允许 CORS`;
  $("#alert").dialog({
    title: "载入错误",
    width: "32em",
    buttons: {
      好的: function () {
        $(this).dialog("close");
      }
    }
  });
}

function uploadMap(file, callback) {
  uploadMap.timeStart = performance.now();
  const OLDEST_SUPPORTED_VERSION = 0.7;
  const currentVersion = parseFloat(version);

  const fileReader = new FileReader();
  fileReader.onloadend = async function (fileLoadedEvent) {
    if (callback) callback();
    document.getElementById("coas").innerHTML = ""; // remove auto-generated emblems
    const result = fileLoadedEvent.target.result;
    const [mapData, mapVersion] = await parseLoadedResult(result);

    const isInvalid = !mapData || isNaN(mapVersion) || mapData.length < 26 || !mapData[5];
    const isUpdated = mapVersion === currentVersion;
    const isAncient = mapVersion < OLDEST_SUPPORTED_VERSION;
    const isNewer = mapVersion > currentVersion;
    const isOutdated = mapVersion < currentVersion;

    if (isInvalid) return showUploadMessage("invalid", mapData, mapVersion);
    if (isUpdated) return parseLoadedData(mapData);
    if (isAncient) return showUploadMessage("ancient", mapData, mapVersion);
    if (isNewer) return showUploadMessage("newer", mapData, mapVersion);
    if (isOutdated) return showUploadMessage("outdated", mapData, mapVersion);
  };

  fileReader.readAsArrayBuffer(file);
}

async function uncompress(compressedData) {
  try {
    const uncompressedStream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("gzip"));

    let uncompressedData = [];
    for await (const chunk of uncompressedStream) {
      uncompressedData = uncompressedData.concat(Array.from(chunk));
    }

    return new Uint8Array(uncompressedData);
  } catch (error) {
    ERROR && console.error(error);
    return null;
  }
}

async function parseLoadedResult(result) {
  try {
    const resultAsString = new TextDecoder().decode(result);
    // data can be in FMG internal format or base64 encoded
    const isDelimited = resultAsString.substring(0, 10).includes("|");
    const decoded = isDelimited ? resultAsString : decodeURIComponent(atob(resultAsString));
    const mapData = decoded.split("\r\n");
    const mapVersion = parseFloat(mapData[0].split("|")[0] || mapData[0]);
    return [mapData, mapVersion];
  } catch (error) {
        // map file can be compressed with gzip
        const uncompressedData = await uncompress(result);
        if (uncompressedData) return parseLoadedResult(uncompressedData);
    ERROR && console.error(error);
    return [null, null];
  }
}

function showUploadMessage(type, mapData, mapVersion) {
  const archive = link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog", "存档版本");
  let message, title, canBeLoaded;

  if (type === "invalid") {
    message = `该文件不是有效的保存文件.<br>请检查数据格式`;
    title = "无效文件";
    canBeLoaded = false;
  } else if (type === "ancient") {
    message = `你尝试加载的地图版本 (${mapVersion}) 太旧，无法更新到当前版本.<br>请继续使用 ${archive}`;
    title = "过旧文件";
    canBeLoaded = false;
  } else if (type === "newer") {
    message = `你要加载的地图版本 (${mapVersion}) 比现在的版本还新.<br>请加载相应版本的文件`;
    title = "过新文件";
    canBeLoaded = false;
  } else if (type === "outdated") {
    message = `地图版本 (${mapVersion}) 与 生成器当前版本(${ version })不匹配。 <br>点击“好的”让.map文件<b style="color: #005000">自动更新</b> 。 <br> 如果出现问题，请继续使用 ${archive} 的生成器`;
    title = "过期文件";
    canBeLoaded = true;
  }

  alertMessage.innerHTML = message;
  const buttons = {
    好的: function () {
      $(this).dialog("close");
      if (canBeLoaded) parseLoadedData(mapData);
    }
  };
  $("#alert").dialog({title, buttons});
}

async function parseLoadedData(data) {
  try {
    // exit customization
    if (window.closeDialogs) closeDialogs();
    customization = 0;
    if (customizationMenu.offsetParent) styleTab.click();

    const params = data[0].split("|");
    void (function parseParameters() {
      if (params[3]) {
        seed = params[3];
        optionsSeed.value = seed;
      }
      if (params[4]) graphWidth = +params[4];
      if (params[5]) graphHeight = +params[5];
      mapId = params[6] ? +params[6] : Date.now();
    })();

    INFO && console.group("Loaded Map " + seed);

    void (function parseSettings() {
      const settings = data[1].split("|");
      if (settings[0]) applyOption(distanceUnitInput, settings[0]);
      if (settings[1]) distanceScale = distanceScaleInput.value = distanceScaleOutput.value = settings[1];
      if (settings[2]) areaUnit.value = settings[2];
      if (settings[3]) applyOption(heightUnit, settings[3]);
      if (settings[4]) heightExponentInput.value = heightExponentOutput.value = settings[4];
      if (settings[5]) temperatureScale.value = settings[5];
      if (settings[6]) barSizeInput.value = barSizeOutput.value = settings[6];
      if (settings[7] !== undefined) barLabel.value = settings[7];
      if (settings[8] !== undefined) barBackOpacity.value = settings[8];
      if (settings[9]) barBackColor.value = settings[9];
      if (settings[10]) barPosX.value = settings[10];
      if (settings[11]) barPosY.value = settings[11];
      if (settings[12]) populationRate = populationRateInput.value = populationRateOutput.value = settings[12];
      if (settings[13]) urbanization = urbanizationInput.value = urbanizationOutput.value = settings[13];
      if (settings[14]) mapSizeInput.value = mapSizeOutput.value = minmax(settings[14], 1, 100);
      if (settings[15]) latitudeInput.value = latitudeOutput.value = minmax(settings[15], 0, 100);
      if (settings[18]) precInput.value = precOutput.value = settings[18];
      if (settings[19]) options = JSON.parse(settings[19]);
      // setting 16 and 17 (temperature) are part of options now, kept as "" in newer versions for compatibility
      if (settings[16]) options.temperatureEquator = +settings[16];
      if (settings[17]) options.temperatureNorthPole = options.temperatureSouthPole = +settings[17];
      if (settings[20]) mapName.value = settings[20];
      if (settings[21]) hideLabels.checked = +settings[21];
      if (settings[22]) stylePreset.value = settings[22];
      if (settings[23]) rescaleLabels.checked = +settings[23];
      if (settings[24]) urbanDensity = urbanDensityInput.value = urbanDensityOutput.value = +settings[24];
    })();

    void (function applyOptionsToUI() {
      stateLabelsModeInput.value = options.stateLabelsMode;
      yearInput.value = options.year;
      eraInput.value = options.era;
      shapeRendering.value = viewbox.attr("shape-rendering") || "geometricPrecision";
    })();

    void (function parseConfiguration() {
      if (data[2]) mapCoordinates = JSON.parse(data[2]);
      if (data[4]) notes = JSON.parse(data[4]);
      if (data[33]) rulers.fromString(data[33]);
      if (data[34]) {
        const usedFonts = JSON.parse(data[34]);
        usedFonts.forEach(usedFont => {
          const {family: usedFamily, unicodeRange: usedRange, variant: usedVariant} = usedFont;
          const defaultFont = fonts.find(
            ({family, unicodeRange, variant}) =>
              family === usedFamily && unicodeRange === usedRange && variant === usedVariant
          );
          if (!defaultFont) fonts.push(usedFont);
          declareFont(usedFont);
        });
      }

      const biomes = data[3].split("|");
      biomesData = Biomes.getDefault();
      biomesData.color = biomes[0].split(",");
      biomesData.habitability = biomes[1].split(",").map(h => +h);
      biomesData.name = biomes[2].split(",");

      // push custom biomes if any
      for (let i = biomesData.i.length; i < biomesData.name.length; i++) {
        biomesData.i.push(biomesData.i.length);
        biomesData.iconsDensity.push(0);
        biomesData.icons.push([]);
        biomesData.cost.push(50);
      }
    })();

    void (function replaceSVG() {
      svg.remove();
      document.body.insertAdjacentHTML("afterbegin", data[5]);
    })();

    void (function redefineElements() {
      svg = d3.select("#map");
      defs = svg.select("#deftemp");
      viewbox = svg.select("#viewbox");
      scaleBar = svg.select("#scaleBar");
      legend = svg.select("#legend");
      ocean = viewbox.select("#ocean");
      oceanLayers = ocean.select("#oceanLayers");
      oceanPattern = ocean.select("#oceanPattern");
      lakes = viewbox.select("#lakes");
      landmass = viewbox.select("#landmass");
      texture = viewbox.select("#texture");
      terrs = viewbox.select("#terrs");
      biomes = viewbox.select("#biomes");
      ice = viewbox.select("#ice");
      cells = viewbox.select("#cells");
      gridOverlay = viewbox.select("#gridOverlay");
      coordinates = viewbox.select("#coordinates");
      compass = viewbox.select("#compass");
      rivers = viewbox.select("#rivers");
      terrain = viewbox.select("#terrain");
      relig = viewbox.select("#relig");
      cults = viewbox.select("#cults");
      regions = viewbox.select("#regions");
      statesBody = regions.select("#statesBody");
      statesHalo = regions.select("#statesHalo");
      provs = viewbox.select("#provs");
      zones = viewbox.select("#zones");
      borders = viewbox.select("#borders");
      stateBorders = borders.select("#stateBorders");
      provinceBorders = borders.select("#provinceBorders");
      routes = viewbox.select("#routes");
      roads = routes.select("#roads");
      trails = routes.select("#trails");
      searoutes = routes.select("#searoutes");
      temperature = viewbox.select("#temperature");
      coastline = viewbox.select("#coastline");
      prec = viewbox.select("#prec");
      population = viewbox.select("#population");
      emblems = viewbox.select("#emblems");
      labels = viewbox.select("#labels");
      icons = viewbox.select("#icons");
      burgIcons = icons.select("#burgIcons");
      anchors = icons.select("#anchors");
      armies = viewbox.select("#armies");
      markers = viewbox.select("#markers");
      ruler = viewbox.select("#ruler");
      fogging = viewbox.select("#fogging");
      debug = viewbox.select("#debug");
      burgLabels = labels.select("#burgLabels");
    })();

    void (function parseGridData() {
      grid = JSON.parse(data[6]);

      const {cells, vertices} = calculateVoronoi(grid.points, grid.boundary);
      grid.cells = cells;
      grid.vertices = vertices;

      grid.cells.h = Uint8Array.from(data[7].split(","));
      grid.cells.prec = Uint8Array.from(data[8].split(","));
      grid.cells.f = Uint16Array.from(data[9].split(","));
      grid.cells.t = Int8Array.from(data[10].split(","));
      grid.cells.temp = Int8Array.from(data[11].split(","));
    })();

    void (function parsePackData() {
      reGraph();
      reMarkFeatures();
      pack.features = JSON.parse(data[12]);
      pack.cultures = JSON.parse(data[13]);
      pack.states = JSON.parse(data[14]);
      pack.burgs = JSON.parse(data[15]);
      pack.religions = data[29] ? JSON.parse(data[29]) : [{i: 0, name: "No religion"}];
      pack.provinces = data[30] ? JSON.parse(data[30]) : [0];
      pack.rivers = data[32] ? JSON.parse(data[32]) : [];
      pack.markers = data[35] ? JSON.parse(data[35]) : [];

      const cells = pack.cells;
      cells.biome = Uint8Array.from(data[16].split(","));
      cells.burg = Uint16Array.from(data[17].split(","));
      cells.conf = Uint8Array.from(data[18].split(","));
      cells.culture = Uint16Array.from(data[19].split(","));
      cells.fl = Uint16Array.from(data[20].split(","));
      cells.pop = Float32Array.from(data[21].split(","));
      cells.r = Uint16Array.from(data[22].split(","));
      cells.road = Uint16Array.from(data[23].split(","));
      cells.s = Uint16Array.from(data[24].split(","));
      cells.state = Uint16Array.from(data[25].split(","));
      cells.religion = data[26] ? Uint16Array.from(data[26].split(",")) : new Uint16Array(cells.i.length);
      cells.province = data[27] ? Uint16Array.from(data[27].split(",")) : new Uint16Array(cells.i.length);
      cells.crossroad = data[28] ? Uint16Array.from(data[28].split(",")) : new Uint16Array(cells.i.length);

      if (data[31]) {
        const namesDL = data[31].split("/");
        namesDL.forEach((d, i) => {
          const e = d.split("|");
          if (!e.length) return;
          const b = e[5].split(",").length > 2 || !nameBases[i] ? e[5] : nameBases[i].b;
          nameBases[i] = {name: e[0], min: e[1], max: e[2], d: e[3], m: e[4], b};
        });
      }
    })();

    void (function restoreLayersState() {
      // helper functions
      const notHidden = selection => selection.node() && selection.style("display") !== "none";
      const hasChildren = selection => selection.node()?.hasChildNodes();
      const hasChild = (selection, selector) => selection.node()?.querySelector(selector);
      const turnOn = el => document.getElementById(el).classList.remove("buttonoff");

      // turn all layers off
      document
        .getElementById("mapLayers")
        .querySelectorAll("li")
        .forEach(el => el.classList.add("buttonoff"));

      // turn on active layers
      if (notHidden(texture) && hasChild(texture, "image")) turnOn("toggleTexture");
      if (hasChildren(terrs)) turnOn("toggleHeight");
      if (hasChildren(biomes)) turnOn("toggleBiomes");
      if (hasChildren(cells)) turnOn("toggleCells");
      if (hasChildren(gridOverlay)) turnOn("toggleGrid");
      if (hasChildren(coordinates)) turnOn("toggleCoordinates");
      if (notHidden(compass) && hasChild(compass, "use")) turnOn("toggleCompass");
      if (hasChildren(rivers)) turnOn("toggleRivers");
      if (notHidden(terrain) && hasChildren(terrain)) turnOn("toggleRelief");
      if (hasChildren(relig)) turnOn("toggleReligions");
      if (hasChildren(cults)) turnOn("toggleCultures");
      if (hasChildren(statesBody)) turnOn("toggleStates");
      if (hasChildren(provs)) turnOn("toggleProvinces");
      if (hasChildren(zones) && notHidden(zones)) turnOn("toggleZones");
      if (notHidden(borders) && hasChild(borders, "path")) turnOn("toggleBorders");
      if (notHidden(routes) && hasChild(routes, "path")) turnOn("toggleRoutes");
      if (hasChildren(temperature)) turnOn("toggleTemp");
      if (hasChild(population, "line")) turnOn("togglePopulation");
      if (hasChildren(ice)) turnOn("toggleIce");
      if (hasChild(prec, "circle")) turnOn("togglePrec");
      if (notHidden(emblems) && hasChild(emblems, "use")) turnOn("toggleEmblems");
      if (notHidden(labels)) turnOn("toggleLabels");
      if (notHidden(icons)) turnOn("toggleIcons");
      if (hasChildren(armies) && notHidden(armies)) turnOn("toggleMilitary");
      if (hasChildren(markers)) turnOn("toggleMarkers");
      if (notHidden(ruler)) turnOn("toggleRulers");
      if (notHidden(scaleBar)) turnOn("toggleScaleBar");

      getCurrentPreset();
    })();

    void (function restoreEvents() {
      scaleBar.on("mousemove", () => tip("点击此处可打开“单位编辑器”")).on("click", () => editUnits());
      legend
        .on("mousemove", () => tip("拖动此形状可更改位置。点击可隐藏图例"))
        .on("click", () => clearLegend());
    })();

    {
      // dynamically import and run auto-update script
      const versionNumber = parseFloat(params[0]);
      const {resolveVersionConflicts} = await import("../dynamic/auto-update.js?v=1.93.00");
      resolveVersionConflicts(versionNumber);
    }

    {
      // add custom heightmap color scheme if any
      const scheme = terrs.attr("scheme");
      if (!(scheme in heightmapColorSchemes)) {
        addCustomColorScheme(scheme);
      }
    }
    
    void (function checkDataIntegrity() {
      const cells = pack.cells;

      if (pack.cells.i.length !== pack.cells.state.length) {
        const message = "数据完整性检查。条带问题。修复在擦除模式下编辑高程图";
        ERROR && console.error(message);
      }

      const invalidStates = [...new Set(cells.state)].filter(s => !pack.states[s] || pack.states[s].removed);
      invalidStates.forEach(s => {
        const invalidCells = cells.i.filter(i => cells.state[i] === s);
        invalidCells.forEach(i => (cells.state[i] = 0));
        ERROR && console.error("数据完整性检查。无效状态", s, "被分配到各个单元格", invalidCells);
      });

      const invalidProvinces = [...new Set(cells.province)].filter(
        p => p && (!pack.provinces[p] || pack.provinces[p].removed)
      );
      invalidProvinces.forEach(p => {
        const invalidCells = cells.i.filter(i => cells.province[i] === p);
        invalidCells.forEach(i => (cells.province[i] = 0));
        ERROR && console.error("数据完整性检查。无效省份", p, "被分配到各个单元格", invalidCells);
      });

      const invalidCultures = [...new Set(cells.culture)].filter(c => !pack.cultures[c] || pack.cultures[c].removed);
      invalidCultures.forEach(c => {
        const invalidCells = cells.i.filter(i => cells.culture[i] === c);
        invalidCells.forEach(i => (cells.province[i] = 0));
        ERROR && console.error("数据完整性检查. 无效文化", c, "被分配到各个单元格", invalidCells);
      });

      const invalidReligions = [...new Set(cells.religion)].filter(
        r => !pack.religions[r] || pack.religions[r].removed
      );
      invalidReligions.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.religion[i] === r);
        invalidCells.forEach(i => (cells.religion[i] = 0));
        ERROR && console.error("数据完整性检查. 无效的宗教", r, "被分配到各个单元格", invalidCells);
      });

      const invalidFeatures = [...new Set(cells.f)].filter(f => f && !pack.features[f]);
      invalidFeatures.forEach(f => {
        const invalidCells = cells.i.filter(i => cells.f[i] === f);
        // No fix as for now
        ERROR && console.error("数据完整性检查. 无效文化", f, "被分配到各个单元格", invalidCells);
      });

      const invalidBurgs = [...new Set(cells.burg)].filter(
        burgId => burgId && (!pack.burgs[burgId] || pack.burgs[burgId].removed)
      );
      invalidBurgs.forEach(burgId => {
        const invalidCells = cells.i.filter(i => cells.burg[i] === burgId);
        invalidCells.forEach(i => (cells.burg[i] = 0));
        ERROR && console.error("数据完整性检查. 无效城市", b, "被分配到各个单元格", invalidCells);
      });

      const invalidRivers = [...new Set(cells.r)].filter(r => r && !pack.rivers.find(river => river.i === r));
      invalidRivers.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.r[i] === r);
        invalidCells.forEach(i => (cells.r[i] = 0));
        rivers.select("river" + r).remove();
        ERROR && console.error("数据完整性检查. 无效河流", r, "被分配到各个单元格", invalidCells);
      });

      pack.burgs.forEach(burg => {
        if ((!burg.i || burg.removed) && burg.lock) {
          ERROR &&
            console.error(
              `Data Integrity Check. Burg ${burg.i || "0"} is removed or invalid but still locked. Unlocking the burg`
            );
          delete burg.lock;
          return;
        }

        if (!burg.i || burg.removed) return;
        if (burg.cell === undefined || burg.x === undefined || burg.y === undefined) {
          ERROR &&
            console.error(
              `数据完整性检查. 城市 ${burg.i} 没有单元格信息或坐标，删除了城市`
            );
          burg.removed = true;
        }

        if (burg.port < 0) {
          ERROR && console.error("数据完整性检查. 城市", burg.i, "港口值无效", burg.port);
          burg.port = 0;
        }

        if (burg.cell >= cells.i.length) {
          ERROR && console.error("数据完整性检查. 城市", burg.i, "链接到无效单元格", burg.cell);
          burg.cell = findCell(burg.x, burg.y);
          cells.i.filter(i => cells.burg[i] === burg.i).forEach(i => (cells.burg[i] = 0));
          cells.burg[burg.cell] = burg.i;
        }

        if (burg.state && !pack.states[burg.state]) {
          ERROR && console.error("数据完整性检查. 城市", burg.i, "链接到无效国家", burg.state);
          burg.state = 0;
        }

        if (burg.state && pack.states[burg.state].removed) {
          ERROR && console.error("数据完整性检查. 城市", burg.i, "链接到已删除国家", burg.state);
          burg.state = 0;
        }

        if (burg.state === undefined) {
          ERROR && console.error("数据完整性检查. 城市", burg.i, "无国家数据");
          burg.state = 0;
        }
      });

      pack.provinces.forEach(p => {
        if (!p.i || p.removed) return;
        if (pack.states[p.state] && !pack.states[p.state].removed) return;
        ERROR && console.error("数据完整性检查. 省", p.i, "链接到已删除国家", p.state);
        p.removed = true; // remove incorrect province
      });

      {
        const markerIds = [];
        let nextId = last(pack.markers)?.i + 1 || 0;

        pack.markers.forEach(marker => {
          if (markerIds[marker.i]) {
            ERROR && console.error("数据完整性检查. 标记", marker.i, "具有非唯一 id。更改为", nextId);

            const domElements = document.querySelectorAll("#marker" + marker.i);
            if (domElements[1]) domElements[1].id = "marker" + nextId; // rename 2nd dom element

            const noteElements = notes.filter(note => note.id === "marker" + marker.i);
            if (noteElements[1]) noteElements[1].id = "marker" + nextId; // rename 2nd note

            marker.i = nextId;
            nextId += 1;
          } else {
            markerIds[marker.i] = true;
          }
        });

        // sort markers by index
        pack.markers.sort((a, b) => a.i - b.i);
      }
    })();

    changeMapSize();

    // remove href from emblems, to trigger rendering on load
    emblems.selectAll("use").attr("href", null);

    // draw data layers (no kept in svg)
    if (rulers && layerIsOn("toggleRulers")) rulers.draw();
    if (layerIsOn("toggleGrid")) drawGrid();

    if (window.restoreDefaultEvents) restoreDefaultEvents();
    focusOn(); // based on searchParams focus on point, cell or burg
    invokeActiveZooming();

    WARN && console.warn(`TOTAL: ${rn((performance.now() - uploadMap.timeStart) / 1000, 2)}s`);
    showStatistics();
    INFO && console.groupEnd("Loaded Map " + seed);
    tip("地图已成功加载", true, "success", 7000);
  } catch (error) {
    ERROR && console.error(error);
    clearMainTip();

    alertMessage.innerHTML = /* html */ `地图加载时发生错误。请选择要加载的其他文件, <br />随机生成一个新地图或取消加载
      <p id="errorBox">${parseError(error)}</p>`;

    $("#alert").dialog({
      resizable: false,
      title: "加载错误",
      maxWidth: "50em",
      buttons: {
        "选择文件": function () {
          $(this).dialog("close");
          mapToLoad.click();
        },
        "新建地图": function () {
          $(this).dialog("close");
          regenerateMap("loading error");
        },
        取消: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  }
}
