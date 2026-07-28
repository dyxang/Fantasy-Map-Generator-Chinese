import {
  color as d3Color,
  drag,
  easeSinIn,
  interpolate,
  interpolateString,
  select,
  stratify,
  transition,
  treemap
} from "d3";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { applySorting, applySortingByHeader } from "@/components/dialog/sorting";
import type { FillBoxElement } from "@/components/fill-box";
import { clearMainTip, showMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Province } from "@/generators/provinces-generator";
import { drawBorders } from "@/renderers/draw-borders";
import { drawStateLabels } from "@/renderers/draw-state-labels";
import { moveCircle, removeCircle } from "@/renderers/overlays/brush-circle";
import { fog, unfog } from "@/renderers/overlays/fogging";
import { highlightElement } from "@/renderers/overlays/highlight";
import { applyOption, downloadFile, findAllCellsInRadius, getArea, getAreaUnit, getFileName, speak } from "@/utils";
import {
  destroyDialogIfExists,
  ensureEl,
  getPackPolygon,
  getPointer,
  getRandomColor,
  isLand,
  P,
  parseTransform,
  rand,
  rn,
  si,
  unique
} from "../utils";

function open(): void {
  if (customization) return;
  closeDialogs("#provincesEditor, .stable");
  if (!layerIsOn("toggleProvinces")) toggleProvinces();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleCultures")) toggleCultures();

  select<SVGGElement, unknown>("#provs")
    .selectAll<SVGTextElement, unknown>("text")
    .call(drag<SVGTextElement, unknown>().on("drag", dragLabel))
    .classed("draggable", true);

  renderDialog();
  refreshProvincesEditor();

  $("#provincesEditor").dialog({
    title: "省份编辑器",
    resizable: false,
    width: "fit-content",
    close: closeProvincesEditor,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("provincesEditor");
  const editorHtml = /* html */ `<div id="provincesEditor" class="dialog stable">
      <div id="provincesHeader" class="header" style="grid-template-columns: 11em 8em 8em 6em 6em 6em 8em">
        <div data-tip="点击按省份名称排序" class="sortable alphabetically" data-sortby="name">
          省份&nbsp;
        </div>
        <div data-tip="点击按省份政体名称排序" class="sortable alphabetically hide" data-sortby="form">
          政体&nbsp;
        </div>
        <div data-tip="点击按省份首府排序" class="sortable alphabetically hide" data-sortby="capital">
          首府&nbsp;
        </div>
        <div data-tip="点击按省份归属国家排序" class="sortable alphabetically" data-sortby="state">
          国家&nbsp;
        </div>
        <div data-tip="点击按省份城镇数排序" class="sortable hide" data-sortby="burgs">
          城镇&nbsp;
        </div>
        <div data-tip="点击按省份面积排序" class="sortable hide" data-sortby="area">面积&nbsp;</div>
        <div data-tip="点击按省份人口排序" class="sortable hide" data-sortby="population">
          人口&nbsp;
        </div>
      </div>
      <div id="provincesBodySection" class="table" data-type="absolute"></div>
      <div id="provincesFooter" class="totalLine">
        <div data-tip="显示的省份数" style="margin-left: 4px">
          省份:&nbsp;<span id="provincesFooterNumber">0</span>
        </div>
        <div data-tip="城镇总数" style="margin-left: 12px">
          城镇:&nbsp;<span id="provincesFooterBurgs">0</span>
        </div>
        <div data-tip="平均面积" style="margin-left: 14px">
          平均面积:&nbsp;<span id="provincesFooterArea">0</span>
        </div>
        <div data-tip="平均人口" style="margin-left: 14px">
          平均人口:&nbsp;<span id="provincesFooterPopulation">0</span>
        </div>
      </div>
      <div id="provincesBottom">
        <button id="provincesEditorRefresh" data-tip="刷新编辑器" class="icon-cw"></button>
        <button id="provincesEditStyle" data-tip="在样式编辑器中编辑省份样式" class="icon-adjust"></button>
        <button
          id="provincesRecolor"
          data-tip="基于国家颜色重新着色已列出的省份"
          class="icon-paint-roller"
        ></button>
        <button
          id="provincesPercentage"
          data-tip="切换百分比/绝对值视图"
          class="icon-percent"
        ></button>
        <button id="provincesChart" data-tip="显示省份图表" class="icon-chart-area"></button>
        <button
          id="provincesToggleLabels"
          data-tip="切换省份标签。在菜单 ⭢ 样式 ⭢ 省份中更改大小"
          class="icon-font"
        ></button>
        <button
          id="provincesExport"
          data-tip="将省份相关数据保存为文本文件 (.csv)"
          class="icon-download"
        ></button>
        <button id="provincesManually" data-tip="手动重新分配省份" class="icon-brush"></button>
        <div id="provincesManuallyButtons" style="display: none">
          <div data-tip="更改笔刷大小。快捷键：+ 增大；– 减小" style="margin-block: 0.3em">
            笔刷大小：
            <slider-input id="provincesBrush" min="1" max="100" value="8"></slider-input>
          </div>
          <button id="provincesManuallyApply" data-tip="应用分配" class="icon-check"></button>
          <button id="provincesManuallyCancel" data-tip="取消分配" class="icon-cancel"></button>
        </div>
        <button
          id="provincesRelease"
          data-tip="释放所有省份。将使所有含城镇的省份独立"
          class="icon-flag"
        ></button>
        <button
          id="provincesAdd"
          data-tip="添加新省份。按住 Shift 添加多个"
          class="icon-plus"
        ></button>
        <button id="provincesMerge" data-tip="合并多个省份为一个" class="icon-layer-group"></button>
        <button
          id="provincesRemoveAll"
          data-tip="移除所有省份。国家保持不变"
          class="icon-trash"
        ></button>
        <span>国家： </span>
        <select id="provincesFilterState"></select>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  applySortingByHeader("provincesHeader");
  applyLineHighlighting("provincesEditor", ({ cellId }) => pack.cells.province[cellId]);

  ensureEl("provincesEditorRefresh").on("click", refreshProvincesEditor);
  ensureEl("provincesEditStyle").on("click", () => editStyle("provs"));
  ensureEl("provincesFilterState").on("change", provincesEditorAddLines);
  ensureEl("provincesPercentage").on("click", togglePercentageMode);
  ensureEl("provincesChart").on("click", showChart);
  ensureEl("provincesToggleLabels").on("click", toggleLabels);
  ensureEl("provincesExport").on("click", downloadProvincesData);
  ensureEl("provincesRemoveAll").on("click", removeAllProvinces);
  ensureEl("provincesManually").on("click", enterProvincesManualAssignent);
  ensureEl("provincesManuallyApply").on("click", applyProvincesManualAssignent);
  ensureEl("provincesManuallyCancel").on("click", () => exitProvincesManualAssignment());
  ensureEl("provincesRelease").on("click", triggerProvincesRelease);
  ensureEl("provincesAdd").on("click", enterAddProvinceMode);
  ensureEl("provincesMerge").on("click", openProvinceMergeDialog);
  ensureEl("provincesRecolor").on("click", recolorProvinces);

  ensureEl("provincesBodySection").on("click", (ev: Event) => {
    if (customization) return;
    const el = ev.target as HTMLElement;
    const cl = el.classList;
    const line = el.parentNode as HTMLElement;
    const p = +line.dataset.id!;
    const stateId = pack.provinces[p].state;

    if (el.tagName === "FILL-BOX") changeFill(el as FillBoxElement);
    else if (cl.contains("name")) editProvinceName(p);
    else if (cl.contains("coaIcon"))
      void Controllers.EmblemsEditor.open("province", `provinceCOA${p}`, pack.provinces[p]);
    else if (cl.contains("icon-star-empty")) capitalZoomIn(p);
    else if (cl.contains("icon-flag-empty")) triggerIndependencePromps(p);
    else if (cl.contains("icon-dot-circled")) void Controllers.BurgsOverview.open({ stateId });
    else if (cl.contains("culturePopulation")) changePopulation(p);
    else if (cl.contains("icon-target"))
      highlightElement(select<SVGGElement, unknown>("#provs").select(`#province${p}`).node() as Element, 8);
    else if (cl.contains("icon-pin")) toggleFog(p, cl);
    else if (cl.contains("icon-trash-empty")) removeProvince(p);
    else if (cl.contains("icon-lock") || cl.contains("icon-lock-open")) updateLockStatus(p, cl);
  });

  ensureEl("provincesBodySection").on("change", (ev: Event) => {
    const el = ev.target as HTMLSelectElement;
    const cl = el.classList;
    const line = el.parentNode as HTMLElement;
    const p = +line.dataset.id!;
    if (cl.contains("cultureBase")) changeCapital(p, line, el.value);
  });
}

function refreshProvincesEditor(): void {
  collectStatistics();
  updateFilter();
  provincesEditorAddLines();
}

function collectStatistics(): void {
  const { cells, provinces, burgs } = pack;

  provinces.forEach(p => {
    if (!p.i || p.removed) return;
    p.area = p.rural = p.urban = 0;
    p.burgs = [];
    if ((p.burg && !burgs[p.burg]) || burgs[p.burg]?.removed) p.burg = 0;
  });

  for (const i of cells.i) {
    const p = cells.province[i];
    if (!p) continue;

    provinces[p].area! += cells.area[i];
    provinces[p].rural! += cells.pop[i];
    if (!cells.burg[i]) continue;
    provinces[p].urban! += burgs[cells.burg[i]].population ?? 0;
    provinces[p].burgs!.push(cells.burg[i]);
  }

  provinces.forEach(p => {
    if (!p.i || p.removed) return;
    if (!p.burg && p.burgs!.length) p.burg = p.burgs![0];
  });
}

function updateFilter(): void {
  const stateFilter = ensureEl<HTMLSelectElement>("provincesFilterState");
  const selectedState = stateFilter.value || "1";
  stateFilter.options.length = 0; // remove all options
  stateFilter.options.add(new Option(`all`, "-1", false, selectedState === "-1"));
  const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
  statesSorted.forEach(s => {
    stateFilter.options.add(new Option(s.name, String(s.i), false, String(s.i) === selectedState));
  });
}

// add line for each province
function provincesEditorAddLines(): void {
  const body = ensureEl("provincesBodySection");
  const unit = ` ${getAreaUnit()}`;
  const selectedState = +ensureEl<HTMLSelectElement>("provincesFilterState").value;
  let filtered = pack.provinces.filter(p => p.i && !p.removed); // all valid provinces
  if (selectedState !== -1) filtered = filtered.filter(p => p.state === selectedState); // filtered by state
  body.innerHTML = "";

  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;
  let totalBurgs = 0;

  for (const p of filtered) {
    const area = getArea(p.area!);
    totalArea += area;
    const rural = p.rural! * populationRate;
    const urban = p.urban! * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `总人口：${si(population)}；农村人口：${si(rural)}；城镇人口：${si(urban)}`;
    totalPopulation += population;
    totalBurgs += p.burgs!.length;

    const stateName = pack.states[p.state].name;
    const capital = p.burg ? pack.burgs[p.burg].name : "";
    const separable = p.burg && p.burg !== pack.states[p.state].capital;
    const focused = select<SVGElement, unknown>("#deftemp").select(`#fog #focusProvince${p.i}`).size();
    COArenderer.trigger(`provinceCOA${p.i}`, p.coa);
    lines += /* html */ `<div
      class="states"
      data-id=${p.i}
      data-name="${p.name}"
      data-form="${p.formName}"
      data-color="${p.color}"
      data-capital="${capital}"
      data-state="${stateName}"
      data-area=${area}
      data-population=${population}
      data-burgs=${p.burgs!.length}
    >
      <fill-box fill="${p.color}"></fill-box>
      <input data-tip="省份名称。点击更改" class="name pointer" value="${p.name}" readonly />
      <svg data-tip="点击查看和编辑省份纹章" class="coaIcon pointer hide" viewBox="0 0 200 200"><use href="#provinceCOA${p.i}"></use></svg>
      <input data-tip="省份政体名称。点击更改" class="name pointer hide" value="${p.formName}" readonly />
      <span data-tip="省份首府。点击放大查看" class="icon-star-empty pointer hide ${p.burg ? "" : "placeholder"}"></span>
      <select
        data-tip="省份首府。点击从国家内的城镇中选择。无首府表示该省份由国家首都管辖"
        class="cultureBase hide ${p.burgs!.length ? "" : "placeholder"}"
      >
        ${p.burgs!.length ? getCapitalOptions(p.burgs!, p.burg) : ""}
      </select>
      <input data-tip="省份所属国家" class="provinceOwner" value="${stateName}" disabled">
      <span data-tip="点击查看省份城镇概览" style="padding-right: 1px" class="icon-dot-circled pointer hide"></span>
      <div data-tip="城镇数" class="provinceBurgs hide">${p.burgs!.length}</div>
      <span data-tip="省份面积" style="padding-right: 4px" class="icon-map-o hide"></span>
      <div data-tip="省份面积" class="biomeArea hide">${si(area) + unit}</div>
      <span data-tip="${populationTip}" class="icon-male hide"></span>
      <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
      <span
        data-tip="宣布省份独立（将含城镇的非首府省份变为新国家）"
        class="icon-flag-empty ${separable ? "" : "placeholder"} hide"
      ></span>
      <span data-tip="定位该省份" class="icon-target hide"></span>
      <span data-tip="切换省份聚焦" class="icon-pin ${focused ? "" : " inactive"} hide"></span>
      <span data-tip="锁定该省份" class="icon-lock${p.lock ? "" : "-open"} hide"></span>
      <span data-tip="移除该省份" class="icon-trash-empty hide"></span>
    </div>`;
  }
  body.innerHTML = lines;

  // update footer
  ensureEl("provincesFooterNumber").innerHTML = String(filtered.length);
  ensureEl("provincesFooterBurgs").innerHTML = String(totalBurgs);
  ensureEl("provincesFooterArea").innerHTML = filtered.length ? si(totalArea / filtered.length) + unit : `0${unit}`;
  ensureEl("provincesFooterPopulation").innerHTML = filtered.length ? si(totalPopulation / filtered.length) : "0";
  ensureEl("provincesFooterArea").dataset.area = String(totalArea);
  ensureEl("provincesFooterPopulation").dataset.population = String(totalPopulation);

  body.querySelectorAll("div.states").forEach(el => {
    el.on("click", selectProvinceOnLineClick);
    el.on("mouseenter", provinceHighlightOn);
    el.on("mouseleave", provinceHighlightOff);
  });

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(ensureEl("provincesHeader"));
  $("#provincesEditor").dialog({ width: "fit-content" });
}

function getCapitalOptions(burgs: number[], capital: number): string {
  let options = "";
  burgs.forEach(b => {
    options += `<option ${b === capital ? "selected" : ""} value="${b}">${pack.burgs[b].name}</option>`;
  });
  return options;
}

function provinceHighlightOn(event: Event): void {
  const province = +(event.target as HTMLElement).dataset.id!;
  const el = ensureEl("provincesBodySection").querySelector(`div[data-id='${province}']`);
  if (el) el.classList.add("active");

  if (!layerIsOn("toggleProvinces")) return;
  if (customization) return;
  const animate = transition().duration(2000).ease(easeSinIn);
  select<SVGGElement, unknown>("#provs")
    .select(`#province${province}`)
    .raise()
    .transition(animate)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
}

function provinceHighlightOff(event: Event): void {
  const province = (event.target as HTMLElement)?.dataset?.id ? +(event.target as HTMLElement).dataset.id! : null;
  if (province) {
    const el = ensureEl("provincesBodySection").querySelector(`div[data-id='${province}']`);
    if (el) el.classList.remove("active");
  }

  if (!layerIsOn("toggleProvinces") || !province) {
    select("#debug").selectAll(".highlight").remove();
    return;
  }
  select<SVGGElement, unknown>("#provs")
    .select(`#province${province}`)
    .transition()
    .attr("stroke-width", null)
    .attr("stroke", null);
  select("#debug").selectAll(".highlight").remove();
}

function changeFill(fillBox: FillBoxElement): void {
  const currentFill = fillBox.getAttribute("fill")!;
  const p = +(fillBox.parentNode as HTMLElement).dataset.id!;

  const callback = (newFill: string): void => {
    fillBox.fill = newFill;
    pack.provinces[p].color = newFill;
    drawProvinces();
  };

  void Controllers.ColorPicker.open(currentFill, callback);
}

function capitalZoomIn(p: number): void {
  const capital = pack.provinces[p].burg;
  const l = select<SVGGElement, unknown>("#burgLabels").select(`[data-id='${capital}']`);
  const x = +l.attr("x");
  const y = +l.attr("y");
  zoomTo(x, y, 8, 2000);
}

function triggerIndependencePromps(p: number): void {
  confirmationDialog({
    title: "宣布独立",
    message: "确定要宣布省份独立吗？<br>这会将省份变为一个新国家",
    confirm: "宣布独立",
    onConfirm: () => {
      const result = declareProvinceIndependence(p);
      if (!result) return;
      const [oldStateId, newStateId] = result;
      updateStatesPostRelease([oldStateId], [newStateId]);
    }
  });
}

function declareProvinceIndependence(provinceId: number): [number, number] | undefined {
  const { states, provinces, cells, burgs } = pack;
  const province = provinces[provinceId];
  const { name, burg: burgId, burgs: provinceBurgs } = province;

  if (provinceBurgs!.some(b => burgs[b].capital)) {
    tip("无法宣布拥有首都城镇的省份独立。请先更改首都", false, "error");
    return;
  }
  if (!burgId) {
    tip("无法宣布没有城镇的省份独立", false, "error");
    return;
  }

  const oldStateId = province.state;
  const newStateId = states.length;

  // turn province burg into a capital
  const capital = burgs[burgId];
  capital.capital = 1;
  Burgs.changeGroup(capital);

  // move all burgs to a new state
  province.burgs!.forEach(b => {
    burgs[b].state = newStateId;
  });

  // define new state attributes
  const { cell: center, culture } = burgs[burgId];
  const color = getRandomColor();
  const coa = province.coa;
  const coaEl = ensureEl(`provinceCOA${provinceId}`);
  if (coaEl) coaEl.id = `stateCOA${newStateId}`;
  select<SVGElement, unknown>("#emblems").select(`#provinceEmblems > use[data-i='${provinceId}']`).remove();

  // update cells
  cells.i
    .filter(i => cells.province[i] === provinceId)
    .forEach(i => {
      cells.province[i] = 0;
      cells.state[i] = newStateId;
    });

  // update diplomacy and reverse relations
  const diplomacy = states.map(s => {
    if (!s.i || s.removed) return "x";
    let relations = states[oldStateId].diplomacy![s.i]; // relations between Nth state and old overlord
    // new state is Enemy to its old owner
    if (s.i === oldStateId) relations = "Enemy";
    else if (relations === "Ally") relations = "Suspicion";
    else if (relations === "Friendly") relations = "Suspicion";
    else if (relations === "Suspicion") relations = "Neutral";
    else if (relations === "Enemy") relations = "Friendly";
    else if (relations === "Rival") relations = "Friendly";
    else if (relations === "Vassal") relations = "Suspicion";
    else if (relations === "Suzerain") relations = "Enemy";
    s.diplomacy!.push(relations);
    return relations;
  });
  diplomacy.push("x");
  (states[0].diplomacy as unknown as string[][]).push([
    `Independance declaration`,
    `${name} declared its independance from ${states[oldStateId].name}`
  ]);

  // create new state
  states.push({
    i: newStateId,
    name,
    diplomacy,
    provinces: [],
    color,
    expansionism: 0.5,
    capital: burgId,
    type: "Generic",
    center,
    culture,
    military: [],
    alert: 1,
    coa
  } as unknown as (typeof states)[number]);

  // remove old province
  states[oldStateId].provinces = states[oldStateId].provinces!.filter(p => p !== provinceId);
  provinces[provinceId] = { i: provinceId, removed: true } as Province;

  return [oldStateId, newStateId];
}

function updateStatesPostRelease(oldStates: number[], newStates: number[]): void {
  const allStates = unique([...oldStates, ...newStates]);

  if (layerIsOn("toggleProvinces")) toggleProvinces();
  if (layerIsOn("toggleStates")) drawStates();
  else toggleStates();
  if (layerIsOn("toggleBorders")) drawBorders();
  else toggleBorders();

  States.getPoles();
  States.findNeighbors();
  States.collectStatistics();
  States.defineStateForms(newStates);
  drawStateLabels(allStates);

  // redraw emblems
  allStates.forEach(stateId => {
    select<SVGElement, unknown>("#emblems").select(`#stateEmblems > use[data-i='${stateId}']`).remove();
    const { coa, pole } = pack.states[stateId];
    COArenderer.add("state", stateId, coa, pole![0], pole![1]);
  });

  if (layerIsOn("toggleProvinces")) toggleProvinces();
  if (layerIsOn("toggleStates")) drawStates();
  else toggleStates();
  if (layerIsOn("toggleBorders")) drawBorders();
  else toggleBorders();

  unfog();
  closeDialogs();
  void Controllers.StatesEditor.open();
}

function changePopulation(province: number): void {
  const p = pack.provinces[province];
  const cells = pack.cells.i.filter(i => pack.cells.province[i] === province);
  if (!cells.length) {
    tip("省份没有任何单元格，无法更改人口", false, "error");
    return;
  }
  const rural = rn(p.rural! * populationRate);
  const urban = rn(p.urban! * populationRate * urbanization);
  const total = rural + urban;
  const l = (n: number): string => Number(n).toLocaleString();

  alertMessage.innerHTML = /* html */ ` 农村： <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" /> 城镇：
    <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" ${p.burgs!.length ? "" : "disabled"} />
    <p>总人口：${l(total)} ⇒ <span id="totalPop">${l(total)}</span> (<span id="totalPopPerc">100</span>%)</p>`;

  const ruralPop = ensureEl<HTMLInputElement>("ruralPop");
  const urbanPop = ensureEl<HTMLInputElement>("urbanPop");

  const update = (): void => {
    const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
    if (Number.isNaN(totalNew)) return;
    ensureEl("totalPop").innerHTML = l(totalNew);
    ensureEl("totalPopPerc").innerHTML = String(rn((totalNew / total) * 100));
  };

  ruralPop.oninput = () => update();
  urbanPop.oninput = () => update();

  $("#alert").dialog({
    resizable: false,
    title: "更改省份人口",
    width: "24em",
    buttons: {
      应用: function (this: HTMLElement) {
        applyPopulationChange();
        $(this).dialog("close");
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" }
  });

  function applyPopulationChange(): void {
    const ruralChange = +ruralPop.value / rural;
    if (Number.isFinite(ruralChange) && ruralChange !== 1) {
      cells.forEach(i => {
        pack.cells.pop[i] *= ruralChange;
      });
    }
    if (!Number.isFinite(ruralChange) && +ruralPop.value > 0) {
      const points = +ruralPop.value / populationRate;
      const pop = rn(points / cells.length);
      cells.forEach(i => {
        pack.cells.pop[i] = pop;
      });
    }

    const urbanChange = +urbanPop.value / urban;
    if (Number.isFinite(urbanChange) && urbanChange !== 1) {
      p.burgs!.forEach(b => {
        pack.burgs[b].population = rn((pack.burgs[b].population ?? 0) * urbanChange, 4);
      });
    }
    if (!Number.isFinite(urbanChange) && +urbanPop.value > 0) {
      const points = +urbanPop.value / populationRate / urbanization;
      const population = rn(points / p.burgs!.length, 4);
      p.burgs!.forEach(b => {
        pack.burgs[b].population = population;
      });
    }

    if (layerIsOn("togglePopulation")) drawPopulation();
    refreshProvincesEditor();
  }
}

function toggleFog(p: number, cl: DOMTokenList): void {
  const path = select<SVGGElement, unknown>("#provs").select(`#province${p}`).attr("d");
  const id = `focusProvince${p}`;
  if (cl.contains("inactive")) fog(id, path);
  else unfog(id);
  cl.toggle("inactive");
}

function removeProvince(p: number): void {
  alertMessage.innerHTML = /* html */ `确定要移除该省份吗？<br />此操作无法撤销`;
  $("#alert").dialog({
    resizable: false,
    title: "移除省份",
    buttons: {
      移除: function (this: HTMLElement) {
        pack.cells.province.forEach((province, i) => {
          if (province === p) pack.cells.province[i] = 0;
        });
        const s = pack.provinces[p].state;
        const state = pack.states[s];
        if (state.provinces!.includes(p)) state.provinces!.splice(state.provinces!.indexOf(p), 1);

        unfog(`focusProvince${p}`);

        const coaEl = document.getElementById(`provinceCOA${p}`);
        if (coaEl) coaEl.remove();
        select<SVGElement, unknown>("#emblems").select(`#provinceEmblems > use[data-i='${p}']`).remove();

        pack.provinces[p] = { i: p, removed: true } as Province;

        const g = select<SVGGElement, unknown>("#provs").select("#provincesBody");
        g.select(`#province${p}`).remove();
        g.select(`#province-gap${p}`).remove();
        if (layerIsOn("toggleBorders")) drawBorders();
        refreshProvincesEditor();
        $(this).dialog("close");
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function editProvinceName(province: number): void {
  renderNameEditor();
  const p = pack.provinces[province];
  ensureEl("provinceNameEditor").dataset.province = String(province);
  ensureEl<HTMLInputElement>("provinceNameEditorShort").value = p.name;
  applyOption(ensureEl("provinceNameEditorSelectForm"), p.formName);
  ensureEl<HTMLInputElement>("provinceNameEditorFull").value = p.fullName;

  const cultureId = pack.cells.culture[p.center];
  ensureEl("provinceCultureDisplay").innerText = pack.cultures[cultureId].name;

  $("#provinceNameEditor").dialog({
    resizable: false,
    title: "更改省份名称",
    buttons: {
      应用: function (this: HTMLElement) {
        applyNameChange(p);
        $(this).dialog("close");
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" },
    close: closeProvinceNameEditor
  });
}

function renderNameEditor(): void {
  destroyDialogIfExists("provinceNameEditor");
  const nameEditorHtml = /* html */ `<div id="provinceNameEditor" class="dialog" data-province="0">
      <div>
        <div data-tip="省份简称" class="label">简称：</div>
        <input
          id="provinceNameEditorShort"
          data-tip="输入以更改简称"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="provinceNameEditorShortSpeak" data-tip="朗读名称。可在选项中更改语音和语言" class="speaker">🔊</span>
        <span
          id="provinceNameEditorShortCulture"
          data-tip="生成特定文化的省份名称"
          class="icon-book pointer"
        ></span>
        <span id="provinceNameEditorShortRandom" data-tip="生成随机名称" class="icon-globe pointer"></span>
      </div>
      <div data-tip="选择政体名称">
        <div data-tip="省份政体名称" class="label">政体名称：</div>
        <select id="provinceNameEditorSelectForm" style="display: inline-block; width: 11em; height: 1.645em">
          <option value="">留空</option>
          <option value="Area">Area</option>
          <option value="Autonomy">Autonomy</option>
          <option value="Barony">Barony</option>
          <option value="Canton">Canton</option>
          <option value="Captaincy">Captaincy</option>
          <option value="Chiefdom">Chiefdom</option>
          <option value="Clan">Clan</option>
          <option value="Colony">Colony</option>
          <option value="Council">Council</option>
          <option value="County">County</option>
          <option value="Deanery">Deanery</option>
          <option value="Department">Department</option>
          <option value="Dependency">Dependency</option>
          <option value="Diaconate">Diaconate</option>
          <option value="District">District</option>
          <option value="Earldom">Earldom</option>
          <option value="Governorate">Governorate</option>
          <option value="Island">Island</option>
          <option value="Islands">Islands</option>
          <option value="Land">Land</option>
          <option value="Landgrave">Landgrave</option>
          <option value="Mandate">Mandate</option>
          <option value="Margrave">Margrave</option>
          <option value="Municipality">Municipality</option>
          <option value="Occupation zone">占领区</option>
          <option value="Parish">Parish</option>
          <option value="Prefecture">Prefecture</option>
          <option value="Province">Province</option>
          <option value="Region">Region</option>
          <option value="Republic">Republic</option>
          <option value="Reservation">Reservation</option>
          <option value="Seneschalty">Seneschalty</option>
          <option value="Shire">Shire</option>
          <option value="State">State</option>
          <option value="Territory">Territory</option>
          <option value="Tribe">Tribe</option>
        </select>
        <input
          id="provinceNameEditorCustomForm"
          placeholder="输入政体名称"
          data-tip="创建自定义省份政体名称"
          style="display: none; width: 11em"
        />
        <span
          id="provinceNameEditorAddForm"
          data-tip="点击将自定义省份政体名称添加到列表"
          class="icon-plus pointer"
        ></span>
      </div>
      <div>
        <div data-tip="省份全称" class="label">全称：</div>
        <input
          id="provinceNameEditorFull"
          data-tip="输入以更改全称"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="provinceNameEditorFullSpeak" data-tip="朗读名称。可在选项中更改语音和语言" class="speaker">🔊</span>
        <span
          id="provinceNameEditorFullRegenerate"
          data-tip="点击重新生成全称"
          class="icon-arrows-cw pointer"
        ></span>
      </div>
      <div
        id="provinceCultureName"
        data-tip="省份主导文化。这决定了基于文化的命名。可通过文化编辑器更改"
        style="margin-top: 0.2em"
      >
        主导文化：&nbsp;<span id="provinceCultureDisplay"></span>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", nameEditorHtml);

  ensureEl("provinceNameEditorShortCulture").on("click", regenerateShortNameCulture);
  ensureEl("provinceNameEditorShortRandom").on("click", regenerateShortNameRandom);
  ensureEl("provinceNameEditorShortSpeak").on("click", () =>
    speak(ensureEl<HTMLInputElement>("provinceNameEditorShort").value)
  );
  ensureEl("provinceNameEditorAddForm").on("click", addCustomForm);
  ensureEl("provinceNameEditorFullRegenerate").on("click", regenerateFullName);
  ensureEl("provinceNameEditorFullSpeak").on("click", () =>
    speak(ensureEl<HTMLInputElement>("provinceNameEditorFull").value)
  );
}

function closeProvinceNameEditor(): void {
  $("#provinceNameEditor").dialog("destroy");
  ensureEl("provinceNameEditor").remove();
}

function regenerateShortNameCulture(): void {
  const province = +ensureEl("provinceNameEditor").dataset.province!;
  const culture = pack.cells.culture[pack.provinces[province].center];
  const name = Names.getState(Names.getCultureShort(culture), culture);
  ensureEl<HTMLInputElement>("provinceNameEditorShort").value = name;
}

function regenerateShortNameRandom(): void {
  const base = rand(Names.nameBases.length - 1);
  const name = Names.getState(Names.getBase(base), undefined as unknown as number, base);
  ensureEl<HTMLInputElement>("provinceNameEditorShort").value = name;
}

function addCustomForm(): void {
  const customForm = ensureEl<HTMLInputElement>("provinceNameEditorCustomForm");
  const selectForm = ensureEl("provinceNameEditorSelectForm");
  const value = customForm.value;
  const displayed = customForm.style.display === "inline-block";
  customForm.style.display = displayed ? "none" : "inline-block";
  selectForm.style.display = displayed ? "inline-block" : "none";
  if (displayed) applyOption(selectForm, value);
}

function regenerateFullName(): void {
  const short = ensureEl<HTMLInputElement>("provinceNameEditorShort").value;
  const form = ensureEl<HTMLSelectElement>("provinceNameEditorSelectForm").value;
  const getFullName = (): string => {
    if (!form) return short;
    if (!short && form) return `The ${form}`;
    return `${short} ${form}`;
  };
  ensureEl<HTMLInputElement>("provinceNameEditorFull").value = getFullName();
}

function applyNameChange(p: Province): void {
  p.name = ensureEl<HTMLInputElement>("provinceNameEditorShort").value;
  p.formName = ensureEl<HTMLSelectElement>("provinceNameEditorSelectForm").value;
  p.fullName = ensureEl<HTMLInputElement>("provinceNameEditorFull").value;
  if (layerIsOn("toggleProvinces")) drawProvinces();
  refreshProvincesEditor();
}

function changeCapital(p: number, line: HTMLElement, value: string): void {
  line.dataset.capital = pack.burgs[+value].name;
  pack.provinces[p].center = pack.burgs[+value].cell;
  pack.provinces[p].burg = +value;
}

function togglePercentageMode(): void {
  const body = ensureEl("provincesBodySection");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const totalBurgs = +ensureEl("provincesFooterBurgs").innerText;
    const totalArea = +ensureEl("provincesFooterArea").dataset.area!;
    const totalPopulation = +ensureEl("provincesFooterPopulation").dataset.population!;

    body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      const { burgs, area, population } = el.dataset;
      el.querySelector(".provinceBurgs")!.innerHTML = `${rn((+burgs! / totalBurgs) * 100)}%`;
      el.querySelector(".biomeArea")!.innerHTML = `${rn((+area! / totalArea) * 100)}%`;
      el.querySelector(".culturePopulation")!.innerHTML = `${rn((+population! / totalPopulation) * 100)}%`;
    });
  } else {
    body.dataset.type = "absolute";
    provincesEditorAddLines();
  }
}

type TreeNode = any;

function showChart(): void {
  // build hierarchy tree
  const getColor = (s: TreeNode): string =>
    !s.i || s.removed || s.color[0] !== "#" ? "#666" : String(d3Color(s.color)!.darker());
  const states = pack.states.map(s => ({ id: s.i, state: s.i ? 0 : null, color: getColor(s) }));
  const provinces = pack.provinces
    .filter(p => p.i && !p.removed)
    .map(p => ({
      id: p.i + states.length - 1,
      i: p.i,
      state: p.state,
      color: p.color,
      name: p.name,
      fullName: p.fullName,
      area: p.area,
      urban: p.urban,
      rural: p.rural
    }));
  const data: TreeNode[] = [...states, ...provinces];
  const root = stratify<TreeNode>()
    .parentId((d: TreeNode) => d.state)(data)
    .sum((d: TreeNode) => d.area);

  const uiSizeValue = +ensureEl<HTMLInputElement>("uiSize").value;
  const width = 300 + 300 * uiSizeValue;
  const height = 90 + 90 * uiSizeValue;
  const margin = { top: 10, right: 10, bottom: 0, left: 10 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;
  const treeLayout = treemap<TreeNode>().size([w, h]).padding(2);

  // prepare svg
  alertMessage.innerHTML = /* html */ `<select id="provincesTreeType" style="display:block; margin-left:13px; font-size:11px">
    <option value="area" selected>面积</option>
    <option value="population">总人口</option>
    <option value="rural">农村人口</option>
    <option value="urban">城镇人口</option>
  </select>`;
  alertMessage.innerHTML += `<div id='provinceInfo' class='chartInfo'>&#8205;</div>`;
  const svg = select("#alertMessage")
    .insert("svg", "#provinceInfo")
    .attr("id", "provincesTree")
    .attr("width", width)
    .attr("height", height)
    .attr("font-size", "10px");
  const graph = svg.append("g").attr("transform", `translate(10, 0)`);
  ensureEl("provincesTreeType").on("change", updateChart);

  treeLayout(root);

  const node = graph
    .selectAll<SVGGElement, TreeNode>("g")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("data-id", (d: TreeNode) => d.data.i)
    .on("mouseenter", (event: any, d: TreeNode) => showInfo(event, d))
    .on("mouseleave", (event: any) => hideInfo(event));

  function showInfo(ev: any, d: TreeNode): void {
    select(ev.currentTarget as SVGGElement)
      .select("rect")
      .classed("selected", true);
    const name = d.data.fullName;
    const state = pack.states[d.data.state].fullName;

    const area = `${getArea(d.data.area)} ${getAreaUnit()}`;
    const rural = rn(d.data.rural * populationRate);
    const urban = rn(d.data.urban * populationRate * urbanization);

    const typeValue = ensureEl<HTMLSelectElement>("provincesTreeType").value;
    const value =
      typeValue === "area"
        ? `面积：${area}`
        : typeValue === "rural"
          ? `农村人口：${si(rural)}`
          : typeValue === "urban"
            ? `城镇人口：${si(urban)}`
            : `人口：${si(rural + urban)}`;

    ensureEl("provinceInfo").innerHTML = /* html */ `${name}. ${state}. ${value}`;
    provinceHighlightOn(ev);
  }

  function hideInfo(ev: any): void {
    provinceHighlightOff(ev);
    if (!document.getElementById("provinceInfo")) return;
    ensureEl("provinceInfo").innerHTML = "&#8205;";
    select(ev.currentTarget as SVGGElement)
      .select("rect")
      .classed("selected", false);
  }

  node
    .append("rect")
    .attr("stroke", (d: TreeNode) => d.parent.data.color)
    .attr("stroke-width", 1)
    .attr("fill", (d: TreeNode) => d.data.color)
    .attr("x", (d: TreeNode) => d.x0)
    .attr("y", (d: TreeNode) => d.y0)
    .attr("width", (d: TreeNode) => d.x1 - d.x0)
    .attr("height", (d: TreeNode) => d.y1 - d.y0);

  node
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("dx", ".2em")
    .attr("dy", "1em")
    .attr("x", (d: TreeNode) => d.x0)
    .attr("y", (d: TreeNode) => d.y0);

  function hideNonfittingLabels(): void {
    node.select<SVGTextElement>("text").each(function (d: TreeNode) {
      this.innerHTML = d.data.name;
      let b = this.getBBox();
      if (b.y + b.height > d.y1 + 1) this.innerHTML = "";

      for (let i = 0; i < 15 && b.width > 0 && b.x + b.width > d.x1; i++) {
        if (this.innerHTML.length < 3) {
          this.innerHTML = "";
          break;
        }
        this.innerHTML = `${this.innerHTML.slice(0, -2)}…`;
        b = this.getBBox();
      }
    });
  }

  function updateChart(this: HTMLSelectElement): void {
    const value: (d: TreeNode) => number =
      this.value === "area"
        ? (d: TreeNode) => d.area
        : this.value === "rural"
          ? (d: TreeNode) => d.rural
          : this.value === "urban"
            ? (d: TreeNode) => d.urban
            : (d: TreeNode) => d.rural + d.urban;

    root.sum(value);
    node.data(treeLayout(root).leaves());

    node
      .select("rect")
      .transition()
      .duration(1500)
      .attr("x", (d: TreeNode) => d.x0)
      .attr("y", (d: TreeNode) => d.y0)
      .attr("width", (d: TreeNode) => d.x1 - d.x0)
      .attr("height", (d: TreeNode) => d.y1 - d.y0);

    node
      .select("text")
      .transition()
      .duration(1500)
      .attr("x", (d: TreeNode) => d.x0)
      .attr("y", (d: TreeNode) => d.y0);

    setTimeout(hideNonfittingLabels, 2000);
  }

  $("#alert").dialog({
    title: "省份图表",
    width: "fit-content",
    position: { my: "left bottom", at: "left+10 bottom-10", of: "svg" },
    buttons: {},
    close: () => {
      alertMessage.innerHTML = "";
    }
  });

  hideNonfittingLabels();
}

function toggleLabels(): void {
  const hidden = select<SVGGElement, unknown>("#provs").select("#provinceLabels").style("display") === "none";
  select<SVGGElement, unknown>("#provs")
    .select("#provinceLabels")
    .style("display", `${hidden ? "block" : "none"}`);
  select<SVGGElement, unknown>("#provs").attr("data-labels", +hidden);
  select<SVGGElement, unknown>("#provs")
    .selectAll<SVGTextElement, unknown>("text")
    .call(drag<SVGTextElement, unknown>().on("drag", dragLabel))
    .classed("draggable", true);
}

function triggerProvincesRelease(): void {
  confirmationDialog({
    title: "释放省份",
    message: `确定要释放所有省份吗？
        </br>这会将所有可分离的省份变为独立国家。
        </br>首都省份和没有城镇的省份将保持原状`,
    confirm: "释放",
    onConfirm: () => {
      const oldStateIds: number[] = [];
      const newStateIds: number[] = [];

      ensureEl("provincesBodySection")
        .querySelectorAll<HTMLElement>(":scope > div")
        .forEach(el => {
          const provinceId = +el.dataset.id!;
          const province = pack.provinces[provinceId];
          if (!province.burg) return;
          if (province.burg === pack.states[province.state].capital) return;
          if (province.burgs!.some(burgId => pack.burgs[burgId].capital)) return;

          const result = declareProvinceIndependence(provinceId);
          if (!result) return;
          oldStateIds.push(result[0]);
          newStateIds.push(result[1]);
        });

      updateStatesPostRelease(unique(oldStateIds), newStateIds);
    }
  });
}

function enterProvincesManualAssignent(): void {
  if (!layerIsOn("toggleProvinces")) toggleProvinces();
  if (!layerIsOn("toggleBorders")) toggleBorders();

  // make province and state borders more visible
  select<SVGGElement, unknown>("#provinceBorders").select("path").attr("stroke", "#000").attr("stroke-width", 0.5);
  select<SVGGElement, unknown>("#stateBorders").select("path").attr("stroke", "#000").attr("stroke-width", 1.2);

  customization = 11;
  select<SVGGElement, unknown>("#provs")
    .select("g#provincesBody")
    .append("g")
    .attr("id", "temp")
    .attr("stroke-width", 0.3);
  select<SVGGElement, unknown>("#provs")
    .select("g#provincesBody")
    .append("g")
    .attr("id", "centers")
    .attr("fill", "none")
    .attr("stroke", "#ff0000")
    .attr("stroke-width", 1);

  document.querySelectorAll<HTMLElement>("#provincesBottom > *").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("provincesManuallyButtons").style.display = "inline-block";

  ensureEl("provincesEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });
  (ensureEl("provincesHeader").querySelector("div[data-sortby='state']") as HTMLElement).style.left = "7.7em";
  ensureEl("provincesFooter").style.display = "none";
  ensureEl("provincesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
  $("#provincesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });

  tip("点击省份以选择，拖动圆形以更改省份", true);
  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", selectProvinceOnMapClick)
    .call(drag<SVGElement, unknown>().on("start", dragBrush))
    .on("touchmove mousemove", moveBrush);

  const firstLine = ensureEl("provincesBodySection").querySelector<HTMLElement>("div");
  firstLine?.classList.add("selected");
  if (firstLine) selectProvince(+firstLine.dataset.id!);
}

function selectProvinceOnLineClick(this: HTMLElement): void {
  if ((this.parentNode as HTMLElement).id !== "provincesBodySection") return;
  if (customization === 11) {
    ensureEl("provincesBodySection").querySelector("div.selected")?.classList.remove("selected");
    this.classList.add("selected");
    selectProvince(+this.dataset.id!);
  }
}

function selectProvinceOnMapClick(this: SVGElement, event: any): void {
  const point = getPointer(event, this);
  const i = findCell(point[0], point[1])!;
  if (pack.cells.h[i] < 20 || !pack.cells.state[i]) return;

  const assigned = select<SVGGElement, unknown>("#provs").select("g#temp").select(`polygon[data-cell='${i}']`);
  const province = assigned.size() ? +assigned.attr("data-province") : pack.cells.province[i];

  const editorLine = ensureEl("provincesBodySection").querySelector(`div[data-id='${province}']`);
  if (!editorLine) {
    tip("如果省份不在编辑器列表中，则无法选择", false, "error");
    return;
  }

  ensureEl("provincesBodySection").querySelector("div.selected")?.classList.remove("selected");
  editorLine.classList.add("selected");
  selectProvince(province);
}

function selectProvince(p: number): void {
  select("#debug").selectAll("path.selected").remove();
  const path = select<SVGGElement, unknown>("#provs").select(`#province${p}`).attr("d");
  select("#debug").append("path").attr("class", "selected").attr("d", path);
}

function dragBrush(this: SVGElement, event: any): void {
  const r = +ensureEl<HTMLInputElement>("provincesBrush").value;

  event.on("drag", (dragEvent: any) => {
    if (!dragEvent.dx && !dragEvent.dy) return;
    const p = getPointer(dragEvent, this);
    moveCircle(p[0], p[1], r);

    const found = r > 5 ? findAllCellsInRadius(p[0], p[1], r, pack) : [findCell(p[0], p[1])!];
    const selection = found.filter(i => isLand(i, pack));
    if (selection) changeForSelection(selection);
  });
}

// change province within selection
function changeForSelection(selection: number[]): void {
  const temp = select<SVGGElement, unknown>("#provs").select("#temp");
  const centers = select<SVGGElement, unknown>("#provs").select("#centers");
  const selected = ensureEl("provincesBodySection").querySelector<HTMLElement>("div.selected")!;

  const provinceNew = +selected.dataset.id!;
  const state = pack.provinces[provinceNew].state;
  const fill = pack.provinces[provinceNew].color || "#ffffff";

  selection.forEach(i => {
    if (!pack.cells.state[i] || pack.cells.state[i] !== state) return;
    const exists = temp.select(`polygon[data-cell='${i}']`);
    const provinceOld = exists.size() ? +exists.attr("data-province") : pack.cells.province[i];
    if (provinceNew === provinceOld) return;
    if (i === pack.provinces[provinceOld].center) {
      const center = centers.select(`polygon[data-center='${i}']`);
      if (!center.size()) centers.append("polygon").attr("data-center", i).attr("points", getPackPolygon(i, pack));
      tip("省份中心无法分配到其他区域。请先移除该省份", false, "error");
      return;
    }

    // change or append new element
    if (exists.size()) {
      if (pack.cells.province[i] === provinceNew) exists.remove();
      else exists.attr("data-province", provinceNew).attr("fill", fill);
    } else {
      temp
        .append("polygon")
        .attr("points", getPackPolygon(i, pack))
        .attr("data-cell", i)
        .attr("data-province", provinceNew)
        .attr("fill", fill)
        .attr("stroke", "#555");
    }
  });
}

function moveBrush(this: SVGElement, event: any): void {
  showMainTip();
  const point = getPointer(event, this);
  const radius = +ensureEl<HTMLInputElement>("provincesBrush").value;
  moveCircle(point[0], point[1], radius);
}

function applyProvincesManualAssignent(): void {
  select<SVGGElement, unknown>("#provs")
    .select("#temp")
    .selectAll<SVGPolygonElement, unknown>("polygon")
    .each(function () {
      const i = +this.dataset.cell!;
      pack.cells.province[i] = +this.dataset.province!;
    });

  Provinces.getPoles();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();

  exitProvincesManualAssignment();
  refreshProvincesEditor();
}

function exitProvincesManualAssignment(close?: string): void {
  customization = 0;
  select<SVGGElement, unknown>("#provs").select("#temp").remove();
  select<SVGGElement, unknown>("#provs").select("#centers").remove();
  removeCircle();

  // restore borders style
  select<SVGGElement, unknown>("#provinceBorders").select("path").attr("stroke", null).attr("stroke-width", null);
  select<SVGGElement, unknown>("#stateBorders").select("path").attr("stroke", null).attr("stroke-width", null);
  select("#debug").selectAll("path.selected").remove();

  document.querySelectorAll<HTMLElement>("#provincesBottom > *").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("provincesManuallyButtons").style.display = "none";

  ensureEl("provincesEditor")
    .querySelectorAll(".hide:not(.show)")
    .forEach(el => {
      el.classList.remove("hidden");
    });
  (ensureEl("provincesHeader").querySelector("div[data-sortby='state']") as HTMLElement).style.left = "22em";
  ensureEl("provincesFooter").style.display = "block";
  ensureEl("provincesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.removeProperty("pointer-events");
    });
  if (!close)
    $("#provincesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });

  applyDefaultViewboxEvents();
  clearMainTip();
  const selected = ensureEl("provincesBodySection").querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

function enterAddProvinceMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddProvinceMode();
    return;
  }

  customization = 12;
  this.classList.add("pressed");
  tip("点击地图以放置新省份中心", true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addProvince);
  ensureEl("provincesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
}

function addProvince(this: SVGElement, event: any): void {
  const { cells, provinces } = pack;
  const point = getPointer(event, this);
  const center = findCell(point[0], point[1])!;
  if (cells.h[center] < 20) {
    tip("无法将省份放入水中。请点击陆地单元格", false, "error");
    return;
  }

  const oldProvince = cells.province[center];
  if (oldProvince && provinces[oldProvince].center === center) {
    tip("该单元格已是其他省份的中心。请选择其他单元格", false, "error");
    return;
  }

  const state = cells.state[center];
  if (!state) {
    tip("无法在中立领土上创建省份。请先将该领土分配给一个国家", false, "error");
    return;
  }

  if (event.shiftKey === false) exitAddProvinceMode();

  const province = provinces.length;
  pack.states[state].provinces!.push(province);
  const burg = cells.burg[center];
  const c = cells.culture[center];
  const name = burg ? pack.burgs[burg].name : Names.getState(Names.getCultureShort(c), c);
  const formName = oldProvince ? provinces[oldProvince].formName : "Province";
  const fullName = `${name} ${formName}`;
  const stateColor = pack.states[state].color!;
  const rndColor = getRandomColor();
  const color = stateColor[0] === "#" ? d3Color(interpolate(stateColor, rndColor)(0.2))!.hex() : rndColor;

  // generate emblem
  const kinship = burg ? 0.8 : 0.4;
  const parent: any = burg ? pack.burgs[burg].coa : pack.states[state].coa;
  const type = Burgs.getType(center, parent.port);
  const coa = COA.generate(parent, kinship, +P(0.1), type);
  coa.shield = COA.getShield(c, state);
  COArenderer.add("province", province, coa as any, point[0], point[1]);

  provinces.push({ i: province, state, center, burg, name, formName, fullName, color, coa } as Province);

  cells.province[center] = province;
  cells.c[center].forEach(nc => {
    if (cells.h[nc] < 20 || cells.state[nc] !== state) return;
    if (provinces.find(p => !p.removed && p.center === nc)) return;
    cells.province[nc] = province;
  });

  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();

  collectStatistics();
  ensureEl<HTMLSelectElement>("provincesFilterState").value = String(state);
  provincesEditorAddLines();
}

function exitAddProvinceMode(): void {
  customization = 0;
  applyDefaultViewboxEvents();
  clearMainTip();
  ensureEl("provincesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.removeProperty("pointer-events");
    });
  const provincesAdd = ensureEl("provincesAdd");
  if (provincesAdd.classList.contains("pressed")) provincesAdd.classList.remove("pressed");
}

function recolorProvinces(): void {
  const state = +ensureEl<HTMLSelectElement>("provincesFilterState").value;

  pack.provinces.forEach(p => {
    if (!p || p.removed) return;
    if (state !== -1 && p.state !== state) return;
    const stateColor = pack.states[p.state].color!;
    const rndColor = getRandomColor();
    p.color = stateColor[0] === "#" ? d3Color(interpolate(stateColor, rndColor)(0.2))!.hex() : rndColor;
  });

  if (!layerIsOn("toggleProvinces")) toggleProvinces();
  else drawProvinces();
}

function downloadProvincesData(): void {
  const unit = areaUnit.value === "square" ? `${distanceUnitInput.value}2` : areaUnit.value;
  let data = `Id,Province,Full Name,Form,State,Color,Capital,Area ${unit},Total Population,Rural Population,Urban Population,Burgs\n`; // headers

  ensureEl("provincesBodySection")
    .querySelectorAll<HTMLElement>(":scope > div")
    .forEach(el => {
      const key = Number.parseInt(el.dataset.id!, 10);
      const provincePack = pack.provinces[key];
      data += `${el.dataset.id},`;
      data += `${el.dataset.name},`;
      data += `${provincePack.fullName},`;
      data += `${el.dataset.form},`;
      data += `${el.dataset.state},`;
      data += `${el.dataset.color},`;
      data += `${el.dataset.capital},`;
      data += `${el.dataset.area},`;
      data += `${el.dataset.population},`;
      data += `${Math.round(provincePack.rural! * populationRate)},`;
      data += `${Math.round(provincePack.urban! * populationRate * urbanization)},`;
      data += `${el.dataset.burgs}\n`;
    });

  const name = `${getFileName("Provinces")}.csv`;
  downloadFile(data, name);
}

function removeAllProvinces(): void {
  alertMessage.innerHTML = /* html */ `确定要移除所有省份吗？<br />此操作无法撤销`;
  $("#alert").dialog({
    resizable: false,
    title: "移除所有省份",
    buttons: {
      移除: function (this: HTMLElement) {
        $(this).dialog("close");

        // remove emblems
        document.querySelectorAll("[id^='provinceCOA']").forEach(el => {
          el.remove();
        });
        select<SVGElement, unknown>("#emblems").select("#provinceEmblems").selectAll("*").remove();

        // remove data
        pack.provinces = [0] as unknown as Province[];
        pack.cells.province = new Uint16Array(pack.cells.i.length);
        pack.states.forEach(s => {
          s.provinces = [];
        });

        unfog();
        if (layerIsOn("toggleBorders")) drawBorders();
        select<SVGGElement, unknown>("#provs").select("#provincesBody").remove();
        turnButtonOff("toggleProvinces");

        provincesEditorAddLines();
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function dragLabel(this: SVGTextElement, event: any): void {
  const tr = parseTransform(this.getAttribute("transform") ?? "");
  const x = +tr[0] - event.x;
  const y = +tr[1] - event.y;

  event.on("drag", function (this: SVGTextElement, dragEvent: any) {
    this.setAttribute("transform", `translate(${x + dragEvent.x},${y + dragEvent.y})`);
  });
}

function closeProvincesEditor(): void {
  select<SVGGElement, unknown>("#provs")
    .selectAll<SVGTextElement, unknown>("text")
    .call(drag<SVGTextElement, unknown>().on("drag", null))
    .attr("class", null);
  if (customization === 11) exitProvincesManualAssignment("close");
  if (customization === 12) exitAddProvinceMode();
  $("#provincesEditor").dialog("destroy");
  ensureEl("provincesEditor").remove();
}

function openProvinceMergeDialog(): void {
  const selectedState = +ensureEl<HTMLSelectElement>("provincesFilterState").value;
  if (selectedState === -1) {
    alertMessage.innerHTML = "请从过滤器中选择特定国家以在该国家内合并省份。";
    $("#alert").dialog({
      title: "合并省份",
      buttons: {
        确定: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
    return;
  }
  const provincesToMerge = pack.provinces.filter(p => p.i && !p.removed && p.state === selectedState);
  if (provincesToMerge.length < 2) {
    alertMessage.innerHTML = "所选国家中没有足够的省份可合并。";
    $("#alert").dialog({
      title: "合并省份",
      buttons: {
        确定: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
    return;
  }

  const emblem = (i: number): string =>
    /* html */ `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#provinceCOA${i}"></use></svg>`;
  const provincesSelector = provincesToMerge
    .map(
      p => /* html */ `
    <div data-id="${p.i}" data-tip="${p.fullName || p.name}" style="cursor:default">
      <input type="radio" name="rulingProvince" value="${p.i}" />
      <input id="selectProvince${p.i}" class="checkbox" type="checkbox" name="provincesToMerge" value="${p.i}" />
      <label for="selectProvince${p.i}" class="checkbox-label"><fill-box fill="${p.color}" disabled></fill-box>${emblem(p.i)}${p.name}</label>
    </div>
  `
    )
    .join("");

  alertMessage.innerHTML = /* html */ `
    <form id='mergeProvincesForm' style="overflow: hidden; display: flex; flex-direction: column; gap: 1em;">
      <p style="margin:0">
        勾选每个要合并的省份旁边的<b>复选框</b>。
        使用<b>单选按钮</b>选择将吸收其他所有省份的<em>主要省份</em>。
        将鼠标悬停在行上可在地图上高亮显示该省份。
      </p>
      <main style='display: grid; grid-template-columns: 1fr 1fr; gap: .3em;'>
        ${provincesSelector}
      </main>
    </form>
  `;

  ensureEl("mergeProvincesForm")
    .querySelectorAll("div[data-id]")
    .forEach(el => {
      el.addEventListener("mouseenter", highlightProvinceOnMergeHover);
      el.addEventListener("mouseleave", provinceHighlightOff);
    });

  $("#alert").dialog({
    width: 600,
    title: `合并省份`,
    close: provinceHighlightOff,
    buttons: {
      合并: function (this: HTMLElement) {
        const formData = new FormData(ensureEl<HTMLFormElement>("mergeProvincesForm"));
        const primaryProvinceId = Number(formData.get("rulingProvince"));
        if (!primaryProvinceId) {
          tip("请选择要合并到的省份", false, "error");
          return;
        }

        const provincesToMergeIds = formData
          .getAll("provincesToMerge")
          .map(Number)
          .filter(provinceId => provinceId !== primaryProvinceId);
        if (!provincesToMergeIds.length) {
          tip("请选择多个要合并的省份", false, "error");
          return;
        }

        confirmationDialog({
          title: "合并省份",
          message: /* html */ `
            <p>以下省份将被<strong>移除</strong>：${provincesToMergeIds
              .map(provinceId => `${emblem(provinceId)}${pack.provinces[provinceId].name}`)
              .join(", ")}。</p>
            <p>被移除省份的数据（城镇和单元格）将分配给 ${emblem(primaryProvinceId)}${pack.provinces[primaryProvinceId].name}。</p>
            <p>确定要合并省份吗？此操作无法撤销。</p>`,
          confirm: "合并",
          onConfirm: () => {
            mergeProvinces(provincesToMergeIds, primaryProvinceId);
            $(this).dialog("close");
          }
        });
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function highlightProvinceOnMergeHover(event: Event): void {
  if (!layerIsOn("toggleProvinces")) return;
  const province = +(event.currentTarget as HTMLElement).dataset.id!;
  if (!province) return;
  const d = select<SVGGElement, unknown>("#provs").select(`#province${province}`).attr("d");
  if (!d) return;

  provinceHighlightOff(event);

  const path = select("#debug")
    .append("path")
    .attr("class", "highlight")
    .attr("d", d)
    .attr("fill", "none")
    .attr("stroke", "red")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("filter", "url(#blur1)");

  const totalLength = (path.node() as SVGPathElement).getTotalLength();
  const duration = (totalLength + 5000) / 2;
  const interp = interpolateString(`0, ${totalLength}`, `${totalLength}, ${totalLength}`);
  path
    .transition()
    .duration(duration)
    .attrTween("stroke-dasharray", () => interp);
}

function cleanupMergedProvince(provinceId: number): void {
  // Clean up UI artifacts for a province being merged (similar to removeProvince cleanup)
  unfog(`focusProvince${provinceId}`);

  const coaEl = document.getElementById(`provinceCOA${provinceId}`);
  if (coaEl) coaEl.remove();
  select<SVGElement, unknown>("#emblems").select(`#provinceEmblems > use[data-i='${provinceId}']`).remove();
}

function mergeProvinces(ids: number[], primary: number): void {
  const primaryProvince = pack.provinces[primary];
  const provinceIdMap = new Map<number, number>();

  ids.forEach(id => {
    if (id === primary) return;
    const province = pack.provinces[id];

    // merge burgs
    province.burgs!.forEach(b => {
      (pack.burgs[b] as unknown as { province: number }).province = primary;
      if (!primaryProvince.burgs!.includes(b)) primaryProvince.burgs!.push(b);
    });
    if (!primaryProvince.burg && province.burg) {
      primaryProvince.burg = province.burg;
    }

    // Add to map for later cell reassignment
    provinceIdMap.set(id, primary);

    // Clean up UI artifacts before marking as removed
    cleanupMergedProvince(id);

    // remove province
    pack.provinces[id] = { i: id, removed: true } as Province;
  });

  // Single pass over cells to remap all merged province ids at once
  pack.cells.province.forEach((oldProvinceId, cellIndex) => {
    const newProvinceId = provinceIdMap.get(oldProvinceId);
    if (newProvinceId !== undefined) {
      pack.cells.province[cellIndex] = newProvinceId;
    }
  });

  // update state's provinces list
  const state = pack.states[primaryProvince.state];
  state.provinces = state.provinces!.filter(p => !pack.provinces[p].removed);

  // recalculate province statistics and poles
  collectStatistics();
  Provinces.getPoles();

  // redraw layers that may have changed
  if (layerIsOn("toggleProvinces")) drawProvinces();
  if (layerIsOn("toggleBorders")) drawBorders();

  // clear any fog or debug highlights
  unfog();
  select("#debug").selectAll(".highlight").remove();

  refreshProvincesEditor();
}

function updateLockStatus(provinceId: number, classList: DOMTokenList): void {
  const p = pack.provinces[provinceId];
  p.lock = !p.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

export const ProvincesEditor = { open };
