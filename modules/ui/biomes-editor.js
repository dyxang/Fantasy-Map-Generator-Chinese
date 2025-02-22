"use strict";
function editBiomes() {
  if (customization) return;
  closeDialogs("#biomesEditor, .stable");
  if (!layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleReligions")) toggleReligions();
  if (layerIsOn("toggleProvinces")) toggleProvinces();

  const body = document.getElementById("biomesBody");
  const animate = d3.transition().duration(2000).ease(d3.easeSinIn);
  refreshBiomesEditor();

  if (modules.editBiomes) return;
  modules.editBiomes = true;

  $("#biomesEditor").dialog({
    title: "生物群编辑器",
    resizable: false,
    width: fitContent(),
    close: closeBiomesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });

  // add listeners
  document.getElementById("biomesEditorRefresh").addEventListener("click", refreshBiomesEditor);
  document.getElementById("biomesEditStyle").addEventListener("click", () => editStyle("biomes"));
  document.getElementById("biomesLegend").addEventListener("click", toggleLegend);
  document.getElementById("biomesPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("biomesManually").addEventListener("click", enterBiomesCustomizationMode);
  document.getElementById("biomesManuallyApply").addEventListener("click", applyBiomesChange);
  document.getElementById("biomesManuallyCancel").addEventListener("click", () => exitBiomesCustomizationMode());
  document.getElementById("biomesRestore").addEventListener("click", restoreInitialBiomes);
  document.getElementById("biomesAdd").addEventListener("click", addCustomBiome);
  document.getElementById("biomesRegenerateReliefIcons").addEventListener("click", regenerateIcons);
  document.getElementById("biomesExport").addEventListener("click", downloadBiomesData);

  body.addEventListener("click", function (ev) {
    const el = ev.target;
    const cl = el.classList;
    if (el.tagName === "FILL-BOX") biomeChangeColor(el);
    else if (cl.contains("icon-info-circled")) openWiki(el);
    else if (cl.contains("icon-trash-empty")) removeCustomBiome(el);
    if (customization === 6) selectBiomeOnLineClick(el);
  });

  body.addEventListener("change", function (ev) {
    const el = ev.target,
      cl = el.classList;
    if (cl.contains("biomeName")) biomeChangeName(el);
    else if (cl.contains("biomeHabitability")) biomeChangeHabitability(el);
  });

  function refreshBiomesEditor() {
    biomesCollectStatistics();
    biomesEditorAddLines();
  }

  function biomesCollectStatistics() {
    const cells = pack.cells;
    const array = new Uint8Array(biomesData.i.length);
    biomesData.cells = Array.from(array);
    biomesData.area = Array.from(array);
    biomesData.rural = Array.from(array);
    biomesData.urban = Array.from(array);

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const b = cells.biome[i];
      biomesData.cells[b] += 1;
      biomesData.area[b] += cells.area[i];
      biomesData.rural[b] += cells.pop[i];
      if (cells.burg[i]) biomesData.urban[b] += pack.burgs[cells.burg[i]].population;
    }
  }

  function biomesEditorAddLines() {
    const unit = " " + getAreaUnit();
    const b = biomesData;
    let lines = "",
      totalArea = 0,
      totalPopulation = 0;

    for (const i of b.i) {
      if (!i || biomesData.name[i] === "removed") continue; // ignore water and removed biomes
      const area = getArea(b.area[i]);
      const rural = b.rural[i] * populationRate;
      const urban = b.urban[i] * populationRate * urbanization;
      const population = rn(rural + urban);
      const populationTip = `总人口: ${si(population)}; 农村人口: ${si(
        rural
      )}; 城市人口: ${si(urban)}`;
      totalArea += area;
      totalPopulation += population;

      lines += /* html */ `
        <div
          class="states biomes"
          data-id="${i}"
          data-name="${b.name[i]}"
          data-habitability="${b.habitability[i]}"
          data-cells=${b.cells[i]}
          data-area=${area}
          data-population=${population}
          data-color=${b.color[i]}
        >
          <fill-box fill="${b.color[i]}"></fill-box>
          <input data-tip="生物群落名称。点击并键入以更改" class="biomeName" value="${
            b.name[i]
          }" autocorrect="off" spellcheck="false" />
          <span data-tip="生物群落可居住百分比" class="hide">%</span>
          <input
            data-tip="生物群落可居住百分比。点击并设置新值以更改"
            type="number"
            min="0"
            max="9999"
            class="biomeHabitability hide"
            value=${b.habitability[i]}
          />
          <span data-tip="单元格计数" class="icon-check-empty hide"></span>
          <div data-tip="单元格计数" class="biomeCells hide">${b.cells[i]}</div>
          <span data-tip="生物区" style="padding-right: 4px" class="icon-map-o hide"></span>
          <div data-tip="生物区" class="biomeArea hide">${si(area) + unit}</div>
          <span data-tip="${populationTip}" class="icon-male hide"></span>
          <div data-tip="${populationTip}" class="biomePopulation hide">${si(population)}</div>
          <span data-tip="打开维基百科关于生物群落的文章" class="icon-info-circled pointer hide"></span>
          ${
            i > 12 && !b.cells[i]
              ? '<span data-tip="删除定制的生物群落" class="icon-trash-empty hide"></span>'
              : ""
          }
        </div>
      `;
    }
    body.innerHTML = lines;

    // update footer
    biomesFooterBiomes.innerHTML = body.querySelectorAll(":scope > div").length;
    biomesFooterCells.innerHTML = pack.cells.h.filter(h => h >= 20).length;
    biomesFooterArea.innerHTML = si(totalArea) + unit;
    biomesFooterPopulation.innerHTML = si(totalPopulation);
    biomesFooterArea.dataset.area = totalArea;
    biomesFooterPopulation.dataset.population = totalPopulation;

    // add listeners
    body.querySelectorAll("div.biomes").forEach(el => el.addEventListener("mouseenter", ev => biomeHighlightOn(ev)));
    body.querySelectorAll("div.biomes").forEach(el => el.addEventListener("mouseleave", ev => biomeHighlightOff(ev)));

    if (body.dataset.type === "percentage") {
      body.dataset.type = "absolute";
      togglePercentageMode();
    }
    applySorting(biomesHeader);
    $("#biomesEditor").dialog({width: fitContent()});
  }

  function biomeHighlightOn(event) {
    if (customization === 6) return;
    const biome = +event.target.dataset.id;
    biomes
      .select("#biome" + biome)
      .raise()
      .transition(animate)
      .attr("stroke-width", 2)
      .attr("stroke", "#cd4c11");
  }

  function biomeHighlightOff(event) {
    if (customization === 6) return;
    const biome = +event.target.dataset.id;
    const color = biomesData.color[biome];
    biomes
      .select("#biome" + biome)
      .transition()
      .attr("stroke-width", 0.7)
      .attr("stroke", color);
  }

  function biomeChangeColor(el) {
    const currentFill = el.getAttribute("fill");
    const biome = +el.parentNode.dataset.id;

    const callback = newFill => {
      el.fill = newFill;
      biomesData.color[biome] = newFill;
      biomes
        .select("#biome" + biome)
        .attr("fill", newFill)
        .attr("stroke", newFill);
    };

    openPicker(currentFill, callback);
  }

  function biomeChangeName(el) {
    const biome = +el.parentNode.dataset.id;
    el.parentNode.dataset.name = el.value;
    biomesData.name[biome] = el.value;
  }

  function biomeChangeHabitability(el) {
    const biome = +el.parentNode.dataset.id;
    const failed = isNaN(+el.value) || +el.value < 0 || +el.value > 9999;
    if (failed) {
      el.value = biomesData.habitability[biome];
      tip("请提供0-9999范围内的有效数字", false, "error");
      return;
    }
    biomesData.habitability[biome] = +el.value;
    el.parentNode.dataset.habitability = el.value;
    recalculatePopulation();
    refreshBiomesEditor();
  }

  function openWiki(el) {
    const biomeName = el.parentNode.dataset.name;
    if (biomeName === "Custom" || !biomeName) return tip("请填写生物群落名称", false, "error");

    const wikiBase = "https://en.wikipedia.org/wiki/";
    const pages = {
      "热带沙漠": "Desert_climate#Hot_desert_climates",
      "寒漠": "Desert_climate#Cold_desert_climates",
      Savanna: "Tropical_and_subtropical_grasslands,_savannas,_and_shrublands",
      Grassland: "Temperate_grasslands,_savannas,_and_shrublands",
      "热带季雨林": "Seasonal_tropical_forest",
      "温带落叶林": "Temperate_deciduous_forest",
      "热带雨林": "Tropical_rainforest",
      "温带雨林": "Temperate_rainforest",
      Taiga: "Taiga",
      Tundra: "Tundra",
      Glacier: "Glacier",
      Wetland: "Wetland"
    };
    const customBiomeLink = `https://en.wikipedia.org/w/index.php?search=${biomeName}`;
    const link = pages[biomeName] ? wikiBase + pages[biomeName] : customBiomeLink;
    openURL(link);
  }

  function toggleLegend() {
    if (legend.selectAll("*").size()) {
      clearLegend();
      return;
    } // hide legend
    const d = biomesData;
    const data = Array.from(d.i)
      .filter(i => d.cells[i])
      .sort((a, b) => d.area[b] - d.area[a])
      .map(i => [i, d.color[i], d.name[i]]);
    drawLegend("Biomes", data);
  }

  function togglePercentageMode() {
    if (body.dataset.type === "absolute") {
      body.dataset.type = "percentage";
      const totalCells = +biomesFooterCells.innerHTML;
      const totalArea = +biomesFooterArea.dataset.area;
      const totalPopulation = +biomesFooterPopulation.dataset.population;

      body.querySelectorAll(":scope>  div").forEach(function (el) {
        el.querySelector(".biomeCells").innerHTML = rn((+el.dataset.cells / totalCells) * 100) + "%";
        el.querySelector(".biomeArea").innerHTML = rn((+el.dataset.area / totalArea) * 100) + "%";
        el.querySelector(".biomePopulation").innerHTML = rn((+el.dataset.population / totalPopulation) * 100) + "%";
      });
    } else {
      body.dataset.type = "absolute";
      biomesEditorAddLines();
    }
  }

  function addCustomBiome() {
    const b = biomesData,
      i = biomesData.i.length;
    if (i > 254) {
      tip("生物群落达到最大数量(255) ，需进行数据清理", false, "error");
      return;
    }

    b.i.push(i);
    b.color.push(getRandomColor());
    b.habitability.push(50);
    b.name.push("Custom");
    b.iconsDensity.push(0);
    b.icons.push([]);
    b.cost.push(50);

    b.rural.push(0);
    b.urban.push(0);
    b.cells.push(0);
    b.area.push(0);

    const unit = getAreaUnit();
    const line = `<div class="states biomes" data-id="${i}" data-name="${b.name[i]}" data-habitability=${b.habitability[i]} data-cells=0 data-area=0 data-population=0 data-color=${b.color[i]}>
      <fill-box fill="${b.color[i]}"></fill-box>
      <input data-tip="生物群落名称。点击并键入更改” class="biomeName" value="${b.name[i]}" autocorrect="off" spellcheck="false">
      <span data-tip="生物群落可居住百分比" class="hide">%</span>
      <input data-tip="生物群落可居住百分比。点击并设置新值以更改" type="number" min=0 max=9999 step=1 class="biomeHabitability hide" value=${b.habitability[i]}>
      <span data-tip="单元格计数" class="icon-check-empty hide"></span>
      <div data-tip="单元格计数" class="biomeCells hide">${b.cells[i]}</div>
      <span data-tip="生物区" style="padding-right: 4px" class="icon-map-o hide"></span>
      <div data-tip="生物区" class="biomeArea hide">0 ${unit}</div>
      <span data-tip="总人口: 0" class="icon-male hide"></span>
      <div data-tip="总人口: 0" class="biomePopulation hide">0</div>
      <span data-tip="删除定制的生物群落" class="icon-trash-empty hide"></span>
    </div>`;

    body.insertAdjacentHTML("beforeend", line);
    biomesFooterBiomes.innerHTML = body.querySelectorAll(":scope > div").length;
    $("#biomesEditor").dialog({width: fitContent()});
  }

  function removeCustomBiome(el) {
    const biome = +el.parentNode.dataset.id;
    el.parentNode.remove();
    biomesData.name[biome] = "removed";
    biomesFooterBiomes.innerHTML = +biomesFooterBiomes.innerHTML - 1;
  }

  function regenerateIcons() {
    drawReliefIcons();
    if (!layerIsOn("toggleRelief")) toggleRelief();
  }

  function downloadBiomesData() {
    const unit = areaUnit.value === "square" ? distanceUnitInput.value + "2" : areaUnit.value;
    let data = "Id,Biome,Color,Habitability,Cells,Area " + unit + ",Population\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function (el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.color + ",";
      data += el.dataset.habitability + "%,";
      data += el.dataset.cells + ",";
      data += el.dataset.area + ",";
      data += el.dataset.population + "\n";
    });

    const name = getFileName("Biomes") + ".csv";
    downloadFile(data, name);
  }

  function enterBiomesCustomizationMode() {
    if (!layerIsOn("toggleBiomes")) toggleBiomes();
    customization = 6;
    biomes.append("g").attr("id", "temp");

    document.querySelectorAll("#biomesBottom > button").forEach(el => (el.style.display = "none"));
    document.querySelectorAll("#biomesBottom > div").forEach(el => (el.style.display = "block"));
    body.querySelector("div.biomes").classList.add("selected");

    biomesEditor.querySelectorAll(".hide").forEach(el => el.classList.add("hidden"));
    body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "none"));
    biomesFooter.style.display = "none";
    $("#biomesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

    tip("点击生物群落选择，拖动圆圈改变生物群落", true);
    viewbox
      .style("cursor", "crosshair")
      .on("click", selectBiomeOnMapClick)
      .call(d3.drag().on("start", dragBiomeBrush))
      .on("touchmove mousemove", moveBiomeBrush);
  }

  function selectBiomeOnLineClick(line) {
    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
    line.classList.add("selected");
  }

  function selectBiomeOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    if (pack.cells.h[i] < 20) {
      tip("你不能通过生物群落重新分配水。请编辑高程图来改变水", false, "error");
      return;
    }

    const assigned = biomes.select("#temp").select("polygon[data-cell='" + i + "']");
    const biome = assigned.size() ? +assigned.attr("data-biome") : pack.cells.biome[i];

    body.querySelector("div.selected").classList.remove("selected");
    body.querySelector("div[data-id='" + biome + "']").classList.add("selected");
  }

  function dragBiomeBrush() {
    const r = +biomesBrush.value;

    d3.event.on("drag", () => {
      if (!d3.event.dx && !d3.event.dy) return;
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);

      const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1])];
      const selection = found.filter(isLand);
      if (selection) changeBiomeForSelection(selection);
    });
  }

  // change region within selection
  function changeBiomeForSelection(selection) {
    const temp = biomes.select("#temp");
    const selected = body.querySelector("div.selected");

    const biomeNew = selected.dataset.id;
    const color = biomesData.color[biomeNew];

    selection.forEach(function (i) {
      const exists = temp.select("polygon[data-cell='" + i + "']");
      const biomeOld = exists.size() ? +exists.attr("data-biome") : pack.cells.biome[i];
      if (biomeNew === biomeOld) return;

      // change of append new element
      if (exists.size()) exists.attr("data-biome", biomeNew).attr("fill", color).attr("stroke", color);
      else
        temp
          .append("polygon")
          .attr("data-cell", i)
          .attr("data-biome", biomeNew)
          .attr("points", getPackPolygon(i))
          .attr("fill", color)
          .attr("stroke", color);
    });
  }

  function moveBiomeBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +biomesBrush.value;
    moveCircle(point[0], point[1], radius);
  }

  function applyBiomesChange() {
    const changed = biomes.select("#temp").selectAll("polygon");
    changed.each(function () {
      const i = +this.dataset.cell;
      const b = +this.dataset.biome;
      pack.cells.biome[i] = b;
    });

    if (changed.size()) {
      drawBiomes();
      refreshBiomesEditor();
    }
    exitBiomesCustomizationMode();
  }

  function exitBiomesCustomizationMode(close) {
    customization = 0;
    biomes.select("#temp").remove();
    removeCircle();

    document.querySelectorAll("#biomesBottom > button").forEach(el => (el.style.display = "inline-block"));
    document.querySelectorAll("#biomesBottom > div").forEach(el => (el.style.display = "none"));

    body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "all"));
    biomesEditor.querySelectorAll(".hide").forEach(el => el.classList.remove("hidden"));
    biomesFooter.style.display = "block";
    if (!close) $("#biomesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

    restoreDefaultEvents();
    clearMainTip();
    const selected = document.querySelector("#biomesBody > div.selected");
    if (selected) selected.classList.remove("selected");
  }

  function restoreInitialBiomes() {
    biomesData = Biomes.getDefault();
    Biomes.define();
    drawBiomes();
    recalculatePopulation();
    refreshBiomesEditor();
  }

  function closeBiomesEditor() {
    exitBiomesCustomizationMode("close");
  }
}
