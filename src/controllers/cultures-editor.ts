import { csvParse, drag, easeSinIn, select, transition } from "d3";
import { Controllers } from "@/controllers";
import { CULTURE_TYPES } from "@/generators/cultures-generator";
import {
  abbreviate,
  capitalize,
  debounce,
  destroyDialogIfExists,
  ensureEl,
  findAllCellsInRadius,
  getPackPolygon,
  getPointer,
  isLand,
  parseTransform,
  ra,
  rn,
  si
} from "../utils";

let culturesManualHistory: string[] = [];

function open(): void {
  if (customization) return;
  closeDialogs("#culturesEditor, .stable");
  if (!layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleReligions")) toggleReligions();
  if (layerIsOn("toggleProvinces")) toggleProvinces();

  renderDialog();
  refreshCulturesEditor();

  $("#culturesEditor").dialog({
    title: "文化编辑器",
    resizable: false,
    close: closeCulturesEditor,
    position: { my: "right top", at: "right-10 top+10", of: "svg" }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("culturesEditor");
  const editorHtml = /* html */ `<div id="culturesEditor" class="dialog stable">
    <div id="culturesHeader" class="header" style="grid-template-columns: 10em 7em 9em 4em 8em 5em 7em 8em">
      <div data-tip="点击按文化名称排序" class="sortable alphabetically" data-sortby="name">文化&nbsp;</div>
      <div data-tip="点击按类型排序" class="sortable alphabetically" data-sortby="type">类型&nbsp;</div>
      <div data-tip="点击按文化名称库排序" class="sortable" data-sortby="base">名称库&nbsp;</div>
      <div data-tip="点击按文化单元格数排序" class="sortable hide" data-sortby="cells">单元格&nbsp;</div>
      <div data-tip="点击按扩张度排序" class="sortable hide" data-sortby="expansionism">扩张&nbsp;</div>
      <div data-tip="点击按文化面积排序" class="sortable hide" data-sortby="area">面积&nbsp;</div>
      <div data-tip="点击按文化人口排序" class="sortable hide icon-sort-number-down" data-sortby="population">人口&nbsp;</div>
      <div data-tip="点击按文化纹章形状排序" class="sortable alphabetically hide" data-sortby="emblems">纹章&nbsp;</div>
    </div>
    <div id="culturesBody" class="table" data-type="absolute"></div>

    <div id="culturesFooter" class="totalLine">
      <div data-tip="文化数量" style="margin-left: 12px">文化:&nbsp;<span id="culturesFooterCultures">0</span></div>
      <div data-tip="陆地单元格总数" style="margin-left: 12px">单元格:&nbsp;<span id="culturesFooterCells">0</span></div>
      <div data-tip="陆地总面积" style="margin-left: 12px">陆地面积:&nbsp;<span id="culturesFooterArea">0</span></div>
      <div data-tip="总人口" style="margin-left: 12px">人口:&nbsp;<span id="culturesFooterPopulation">0</span></div>
    </div>

    <div id="culturesBottom">
      <button id="culturesEditorRefresh" data-tip="刷新编辑器" class="icon-cw"></button>
      <button id="culturesEditStyle" data-tip="在样式编辑器中编辑文化样式" class="icon-adjust"></button>
      <button id="culturesLegend" data-tip="切换图例框" class="icon-list-bullet"></button>
      <button id="culturesPercentage" data-tip="切换百分比/绝对值显示模式" class="icon-percent"></button>
      <button id="culturesHeirarchy" data-tip="显示文化层级树" class="icon-sitemap"></button>
      <button id="culturesManually" data-tip="手动重新分配文化" class="icon-brush"></button>
      <div id="culturesManuallyButtons" style="display: none">
        <div data-tip="更改笔刷大小。快捷键：+ / ] 增大；- / [ 减小" style="margin-block: 0.3em;">
          <slider-input id="culturesBrush" min="1" max="100" value="15">笔刷大小：</slider-input>
        </div>
        <button id="culturesManuallyUndo" data-tip="撤销上次笔刷" class="icon-ccw"></button>
        <button id="culturesManuallyApply" data-tip="应用分配" class="icon-check"></button>
        <button id="culturesManuallyCancel" data-tip="取消分配" class="icon-cancel"></button>
      </div>
      <button id="culturesEditNamesBase" data-tip="编辑用于名称生成的数据库" class="icon-font"></button>
      <button id="culturesAdd" data-tip="添加新文化。按住 Shift 添加多个" class="icon-plus"></button>
      <button id="culturesExport" data-tip="下载文化相关数据" class="icon-download"></button>
      <button id="culturesImport" data-tip="上传文化相关数据" class="icon-upload"></button>
      <button id="culturesRecalculate" data-tip="基于当前增长相关属性值重新计算文化" class="icon-retweet"></button>
      <span data-tip="允许文化中心、扩张度和类型更改立即生效" style="display: inline-flex">
        <input id="culturesAutoChange" class="checkbox" type="checkbox" />
        <label for="culturesAutoChange" class="checkbox-label"><i>自动应用更改</i></label>
      </span>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  applySortingByHeader("culturesHeader");

  ensureEl("culturesEditorRefresh").on("click", refreshCulturesEditor);
  ensureEl("culturesEditStyle").on("click", () => editStyle("cults"));
  ensureEl("culturesLegend").on("click", toggleLegend);
  ensureEl("culturesPercentage").on("click", togglePercentageMode);
  ensureEl("culturesHeirarchy").on("click", showHierarchy);
  ensureEl("culturesRecalculate").on("click", () => recalculateCultures(true));
  ensureEl("culturesManually").on("click", enterCultureManualAssignent);
  ensureEl("culturesManuallyUndo").on("click", undoCulturesManualAssignment);
  ensureEl("culturesManuallyApply").on("click", applyCultureManualAssignent);
  ensureEl("culturesManuallyCancel").on("click", () => exitCulturesManualAssignment());
  ensureEl("culturesEditNamesBase").on("click", () => Controllers.NamesbaseEditor.open());
  ensureEl("culturesAdd").on("click", enterAddCulturesMode);
  ensureEl("culturesExport").on("click", downloadCulturesCsv);
  ensureEl("culturesImport").on("click", () => ensureEl("culturesCSVToLoad").click());
  ensureEl("culturesCSVToLoad").on("change", uploadCulturesData);
}

function refreshCulturesEditor(): void {
  culturesCollectStatistics();
  culturesEditorAddLines();
  drawCultureCenters();
}

function culturesCollectStatistics(): void {
  const { cells, cultures, burgs } = pack as any;
  cultures.forEach((c: any) => {
    c.cells = c.area = c.rural = c.urban = 0;
  });

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue;
    const cultureId = cells.culture[i];
    cultures[cultureId].cells += 1;
    cultures[cultureId].area += cells.area[i];
    cultures[cultureId].rural += cells.pop[i];
    const burgId = cells.burg[i];
    if (burgId) cultures[cultureId].urban += burgs[burgId].population;
  }
}

function culturesEditorAddLines(): void {
  const unit = getAreaUnit();
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;

  const emblemShapeGroup =
    ensureEl<HTMLSelectElement>("emblemShape").selectedOptions[0]?.parentElement?.getAttribute("label");
  const selectShape = emblemShapeGroup === "Diversiform";

  for (const c of pack.cultures) {
    if (c.removed) continue;
    const area = getArea(c.area ?? 0);
    const rural = (c.rural ?? 0) * populationRate;
    const urban = (c.urban ?? 0) * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `总人口：${si(population)}。农村人口：${si(rural)}。城市人口：${si(urban)}。点击编辑`;
    totalArea += area;
    totalPopulation += population;

    if (!c.i) {
      // Uncultured (neutral) line
      lines += /* html */ `<div
          class="states"
          data-id="${c.i}"
          data-name="${c.name}"
          data-color=""
          data-cells="${c.cells}"
          data-area="${area}"
          data-population="${population}"
          data-base="${c.base}"
          data-type=""
          data-expansionism=""
          data-emblems="${c.shield}"
        >
          <svg width="11" height="11" class="placeholder"></svg>
          <input data-tip="中立文化名称。点击输入以更改" class="cultureName italic" style="width: 7em"
            value="${c.name}" autocorrect="off" spellcheck="false" />
          <span class="icon-cw placeholder"></span>
          <select class="cultureType placeholder">${getTypeOptions(c.type)}</select>
          <span data-tip="点击重新生成分配给该文化的城镇名称" class="icon-arrows-cw hide"></span>
          <select data-tip="文化名称库。点击更改。点击箭头重新生成名称"
            class="cultureBase">${getBaseOptions(c.base)}</select>
          <span data-tip="单元格数量" class="icon-check-empty hide"></span>
          <div data-tip="单元格数量" class="cultureCells hide" style="width: 4em">${c.cells}</div>
          <span class="icon-resize-full placeholder hide"></span>
          <input class="cultureExpan placeholder hide" type="number" />
          <span data-tip="文化面积" style="padding-right: 4px" class="icon-map-o hide"></span>
          <div data-tip="文化面积" class="cultureArea hide" style="width: 6em">${si(area)} ${unit}</div>
          <span data-tip="${populationTip}" class="icon-male hide"></span>
          <div data-tip="${populationTip}" class="culturePopulation hide pointer"
            style="width: 4em">${si(population)}</div>
          ${getShapeOptions(selectShape, c.shield)}
        </div>`;
      continue;
    }

    lines += /* html */ `<div
        class="states"
        data-id="${c.i}"
        data-name="${c.name}"
        data-color="${c.color}"
        data-cells="${c.cells}"
        data-area="${area}"
        data-population="${population}"
        data-base="${c.base}"
        data-type="${c.type}"
        data-expansionism="${c.expansionism}"
        data-emblems="${c.shield}"
      >
        <fill-box fill="${c.color}"></fill-box>
        <input data-tip="文化名称。点击输入以更改" class="cultureName" style="width: 7em"
          value="${c.name}" autocorrect="off" spellcheck="false" />
        <span data-tip="重新生成文化名称" class="icon-cw hiddenIcon" style="visibility: hidden"></span>
        <select data-tip="文化类型。定义增长模型。点击更改"
          class="cultureType">${getTypeOptions(c.type)}</select>
        <span data-tip="点击重新生成分配给该文化的城镇名称" class="icon-arrows-cw hide"></span>
        <select data-tip="文化名称库。点击更改。点击箭头重新生成名称"
          class="cultureBase">${getBaseOptions(c.base)}</select>
        <span data-tip="单元格数量" class="icon-check-empty hide"></span>
        <div data-tip="单元格数量" class="cultureCells hide" style="width: 4em">${c.cells}</div>
        <span data-tip="文化扩张度。定义竞争力大小" class="icon-resize-full hide"></span>
        <input
          data-tip="文化扩张度。定义竞争力大小。点击更改，然后点击重新计算以应用更改"
          class="cultureExpan hide"
          type="number"
          min="0"
          max="99"
          step=".1"
          value=${c.expansionism}
        />
        <span data-tip="文化面积" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="文化面积" class="cultureArea hide" style="width: 6em">${si(area)} ${unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="culturePopulation hide pointer"
          style="width: 4em">${si(population)}</div>
        ${getShapeOptions(selectShape, c.shield)}
        <span data-tip="定位该文化" class="icon-target hide"></span>
        <span data-tip="锁定该文化" class="icon-lock${c.lock ? "" : "-open"} hide"></span>
        <span data-tip="移除该文化" class="icon-trash-empty hide"></span>
      </div>`;
  }
  ensureEl("culturesBody").innerHTML = lines;

  // update footer
  ensureEl("culturesFooterCultures").innerHTML = String(pack.cultures.filter(c => c.i && !c.removed).length);
  ensureEl("culturesFooterCells").innerHTML = String((pack.cells.h as unknown as number[]).filter(h => h >= 20).length);
  ensureEl("culturesFooterArea").innerHTML = `${si(totalArea)} ${unit}`;
  ensureEl("culturesFooterPopulation").innerHTML = si(totalPopulation);
  ensureEl("culturesFooterArea").dataset.area = String(totalArea);
  ensureEl("culturesFooterPopulation").dataset.population = String(totalPopulation);

  // add listeners
  ensureEl("culturesBody")
    .querySelectorAll(":scope > div")
    .forEach($line => {
      $line.on("mouseenter", cultureHighlightOn);
      $line.on("mouseleave", cultureHighlightOff);
      $line.on("click", selectCultureOnLineClick);
    });
  ensureEl("culturesBody")
    .querySelectorAll("fill-box")
    .forEach($el => void $el.on("click", cultureChangeColor));
  ensureEl("culturesBody")
    .querySelectorAll("div > input.cultureName")
    .forEach($el => void $el.on("input", cultureChangeName));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-cw")
    .forEach($el => void $el.on("click", cultureRegenerateName));
  ensureEl("culturesBody")
    .querySelectorAll("div > input.cultureExpan")
    .forEach($el => void $el.on("change", cultureChangeExpansionism));
  ensureEl("culturesBody")
    .querySelectorAll("div > select.cultureType")
    .forEach($el => void $el.on("change", cultureChangeType));
  ensureEl("culturesBody")
    .querySelectorAll("div > select.cultureBase")
    .forEach($el => void $el.on("change", cultureChangeBase));
  ensureEl("culturesBody")
    .querySelectorAll("div > select.cultureEmblems")
    .forEach($el => void $el.on("change", cultureChangeEmblemsShape));
  ensureEl("culturesBody")
    .querySelectorAll("div > div.culturePopulation")
    .forEach($el => void $el.on("click", changePopulation));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-arrows-cw")
    .forEach($el => void $el.on("click", cultureRegenerateBurgs));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-target")
    .forEach($el => void $el.on("click", cultureHighlightElement));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach($el => void $el.on("click", cultureRemovePrompt));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-lock")
    .forEach($el => void $el.on("click", updateLockStatus));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-lock-open")
    .forEach($el => void $el.on("click", updateLockStatus));

  const $culturesHeader = ensureEl("culturesHeader");
  ($culturesHeader.querySelector("div[data-sortby='emblems']") as HTMLElement).style.display = selectShape
    ? "inline-block"
    : "none";

  if (ensureEl("culturesBody").dataset.type === "percentage") {
    ensureEl("culturesBody").dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting($culturesHeader);
  $("#culturesEditor").dialog({ width: fitContent() });
}

function getTypeOptions(type: string): string {
  let options = "";
  CULTURE_TYPES.forEach(t => {
    options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`;
  });
  return options;
}

function getBaseOptions(base: number): string {
  let options = "";
  nameBases.forEach((n, i) => {
    options += `<option ${base === i ? "selected" : ""} value="${i}">${n.name}</option>`;
  });
  if (!nameBases[base]) options += `<option selected value="${base}">已移除</option>`; // in case namesbase was removed
  return options;
}

function getShapeOptions(selectShape: boolean, selected: string): string {
  if (!selectShape) return "";

  const shapes = Object.keys(COA.shields.types).flatMap(type => Object.keys(COA.shields[type]));
  const options = shapes.map(
    shape => `<option ${shape === selected ? "selected" : ""} value="${shape}">${capitalize(shape)}</option>`
  );
  return `<select data-tip="与文化关联的纹章形状。点击更改" class="cultureEmblems hide">${options}</select>`;
}

const cultureHighlightOn = debounce((event: any) => {
  const cultureId = Number(event.id || event.target.dataset.id);

  if (!layerIsOn("toggleCultures")) return;
  if (customization) return;

  const animate = transition().duration(2000).ease(easeSinIn);
  select("#cults")
    .select(`#culture${cultureId}`)
    .raise()
    .transition(animate)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
  select("#debug")
    .select(`#cultureCenter${cultureId}`)
    .raise()
    .transition(animate)
    .attr("r", 3)
    .attr("stroke", "#d0240f");
}, 200);

function cultureHighlightOff(event: any): void {
  const cultureId = Number(event.id || event.target.dataset.id);

  if (!layerIsOn("toggleCultures")) return;
  select("#cults").select(`#culture${cultureId}`).transition().attr("stroke-width", null).attr("stroke", null);
  select("#debug").select(`#cultureCenter${cultureId}`).transition().attr("r", 2).attr("stroke", null);
}

function cultureChangeColor(this: HTMLElement): void {
  const currentFill = this.getAttribute("fill") || "#ffffff";
  const cultureId = +(this.parentNode as HTMLElement).dataset.id!;

  const callback = (newFill: string) => {
    (this as any).fill = newFill;
    pack.cultures[cultureId].color = newFill;
    select("#cults").select(`#culture${cultureId}`).attr("fill", newFill);
    select("#debug").select(`#cultureCenter${cultureId}`).attr("fill", newFill);
  };

  openPicker(currentFill, callback);
}

function cultureChangeName(this: HTMLInputElement): void {
  const culture = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.name = this.value;
  const cultures = pack.cultures;
  cultures[culture].name = this.value;
  cultures[culture].code = abbreviate(
    this.value,
    cultures.flatMap(c => (c.code ? [c.code] : []))
  );
}

function cultureRegenerateName(this: HTMLElement): void {
  const cultureId = +(this.parentNode as HTMLElement).dataset.id!;
  const base = pack.cultures[cultureId].base;
  if (!nameBases[base]) {
    tip("名称库未定义，请选择有效的名称库", false, "error", 5000);
    return;
  }

  const name = Names.getCultureShort(cultureId);
  (this.parentNode as HTMLElement).querySelector<HTMLInputElement>("input.cultureName")!.value = name;
  pack.cultures[cultureId].name = name;
}

function cultureChangeExpansionism(this: HTMLInputElement): void {
  const culture = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.expansionism = this.value;
  pack.cultures[culture].expansionism = +this.value;
  recalculateCultures();
}

function cultureChangeType(this: HTMLSelectElement): void {
  const culture = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.type = this.value;
  const type = this.value as (typeof pack.cultures)[number]["type"];
  pack.cultures[culture].type = type;
  recalculateCultures();
}

function cultureChangeBase(this: HTMLSelectElement): void {
  const culture = +(this.parentNode as HTMLElement).dataset.id!;
  const v = +this.value;
  pack.cultures[culture].base = v;
  (this.parentNode as HTMLElement).dataset.base = String(v);
}

function cultureChangeEmblemsShape(this: HTMLSelectElement): void {
  const culture = +(this.parentNode as HTMLElement).dataset.id!;
  const shape = this.value;
  (this.parentNode as HTMLElement).dataset.emblems = pack.cultures[culture].shield = shape;

  const rerenderCOA = (id: string, coa: any) => {
    const $coa = document.getElementById(id);
    if (!$coa) return; // not rendered
    $coa.remove();
    COArenderer.trigger(id, coa);
  };

  pack.states.forEach(state => {
    if (state.culture !== culture || !state.i || state.removed || !state.coa || state.coa.custom) return;
    if (shape === state.coa.shield) return;
    state.coa.shield = shape;
    rerenderCOA(`stateCOA${state.i}`, state.coa);
  });

  pack.provinces.forEach(province => {
    if (
      pack.cells.culture[province.center] !== culture ||
      !province.i ||
      province.removed ||
      !province.coa ||
      province.coa.custom
    )
      return;
    if (shape === province.coa.shield) return;
    province.coa.shield = shape;
    rerenderCOA(`provinceCOA${province.i}`, province.coa);
  });

  pack.burgs.forEach(burg => {
    if (burg.culture !== culture || !burg.i || burg.removed || !burg.coa || burg.coa.custom) return;
    if (shape === burg.coa.shield) return;
    burg.coa.shield = shape;
    rerenderCOA(`burgCOA${burg.i}`, burg.coa);
  });
}

function changePopulation(this: HTMLElement): void {
  const cultureId = +(this.parentNode as HTMLElement).dataset.id!;
  const culture = pack.cultures[cultureId];
  if (!culture.cells) {
    tip("文化没有任何单元格，无法更改人口", false, "error");
    return;
  }

  const rural = rn((culture.rural ?? 0) * populationRate);
  const urban = rn((culture.urban ?? 0) * populationRate * urbanization);
  const total = rural + urban;
  const format = (n: number) => Number(n).toLocaleString();
  const burgs = pack.burgs.filter(b => !b.removed && b.culture === cultureId);

  alertMessage.innerHTML = /* html */ `<div>
    <i>更改分配给该文化的所有单元格的人口</i>
    <div style="margin: 0.5em 0">
      农村：<input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" />
      城市：<input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em"
        ${burgs.length ? "" : "disabled"} />
    </div>
    <div>总人口：${format(total)} ⇒ <span id="totalPop">${format(total)}</span>
      (<span id="totalPopPerc">100</span>%)
    </div>
  </div>`;

  const ruralPop = ensureEl<HTMLInputElement>("ruralPop");
  const urbanPop = ensureEl<HTMLInputElement>("urbanPop");
  const totalPop = ensureEl("totalPop");
  const totalPopPerc = ensureEl("totalPopPerc");

  const update = () => {
    const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
    if (Number.isNaN(totalNew)) return;
    totalPop.innerHTML = l(totalNew);
    totalPopPerc.innerHTML = String(rn((totalNew / total) * 100));
  };

  ruralPop.oninput = () => update();
  urbanPop.oninput = () => update();

  $("#alert").dialog({
    resizable: false,
    title: "更改文化人口",
    width: "24em",
    buttons: {
      应用: function (this: HTMLElement) {
        applyPopulationChange(rural, urban, +ruralPop.value, +urbanPop.value, cultureId);
        $(this).dialog("close");
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" }
  });
}

function applyPopulationChange(
  oldRural: number,
  oldUrban: number,
  newRural: number,
  newUrban: number,
  culture: number
): void {
  const ruralChange = newRural / oldRural;
  if (Number.isFinite(ruralChange) && ruralChange !== 1) {
    const cells = (pack.cells.i as unknown as number[]).filter(i => pack.cells.culture[i] === culture);
    cells.forEach(i => {
      pack.cells.pop[i] *= ruralChange;
    });
  }
  if (!Number.isFinite(ruralChange) && +newRural > 0) {
    const points = newRural / populationRate;
    const cells = (pack.cells.i as unknown as number[]).filter(i => pack.cells.culture[i] === culture);
    const pop = rn(points / cells.length);
    cells.forEach(i => {
      pack.cells.pop[i] = pop;
    });
  }

  const burgs = pack.burgs.filter(b => !b.removed && b.culture === culture);
  const urbanChange = newUrban / oldUrban;
  if (Number.isFinite(urbanChange) && urbanChange !== 1) {
    burgs.forEach(b => {
      b.population = rn((b.population ?? 0) * urbanChange, 4);
    });
  }
  if (!Number.isFinite(urbanChange) && +newUrban > 0) {
    const points = newUrban / populationRate / urbanization;
    const population = rn(points / burgs.length, 4);
    burgs.forEach(b => {
      b.population = population;
    });
  }

  if (layerIsOn("togglePopulation")) drawPopulation();
  refreshCulturesEditor();
}

function cultureRegenerateBurgs(this: HTMLElement): void {
  if (customization === 4) return;

  const cultureId = +(this.parentNode as HTMLElement).dataset.id!;
  const base = pack.cultures[cultureId].base;
  if (!nameBases[base]) {
    tip("名称库未定义，请选择有效的名称库", false, "error", 5000);
    return;
  }

  const cultureBurgs = pack.burgs.filter(b => b.culture === cultureId && !b.removed && !b.lock);
  cultureBurgs.forEach(b => {
    b.name = Names.getCulture(cultureId);
    select("#labels").select(`[data-id='${b.i}']`).text(b.name);
  });
  tip(`已为 ${cultureBurgs.length} 个城镇重新生成名称`, false, "success");
}

function removeCulture(cultureId: number): void {
  select("#cults").select(`#culture${cultureId}`).remove();
  select("#debug").select(`#cultureCenter${cultureId}`).remove();

  const { burgs, states, cells, cultures } = pack as any;

  burgs
    .filter((b: any) => b.culture === cultureId)
    .forEach((b: any) => {
      b.culture = 0;
    });
  states.forEach((s: any) => {
    if (s.culture === cultureId) s.culture = 0;
  });
  cells.culture.forEach((c: number, i: number) => {
    if (c === cultureId) cells.culture[i] = 0;
  });
  cultures[cultureId].removed = true;

  cultures
    .filter((c: any) => c.i && !c.removed)
    .forEach((c: any) => {
      c.origins = (c.origins ?? []).filter((origin: number) => origin !== cultureId);
      if (!c.origins.length) c.origins = [0];
    });
  refreshCulturesEditor();
}

function cultureHighlightElement(this: HTMLElement): void {
  const cultureId = +(this.parentNode as HTMLElement).dataset.id!;
  highlightElement(select("#cults").select(`#culture${cultureId}`).node() as Element, 4);
}

function cultureRemovePrompt(this: HTMLElement): void {
  if (customization) return;

  const cultureId = +(this.parentNode as HTMLElement).dataset.id!;
  confirmationDialog({
    title: "移除文化",
    message: "确定要移除该文化吗？<br>此操作无法撤销",
    confirm: "移除",
    onConfirm: () => removeCulture(cultureId)
  });
}

function drawCultureCenters(): void {
  const tooltip = "拖动以移动文化中心（祖居地）";
  const debugLayer = select("#debug");
  debugLayer.select("#cultureCenters").remove();
  const cultureCenters = debugLayer
    .append("g")
    .attr("id", "cultureCenters")
    .attr("stroke-width", 0.8)
    .attr("stroke", "#444444")
    .style("cursor", "move");

  const data = pack.cultures.filter(c => c.i && !c.removed);
  cultureCenters
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("id", (d: any) => `cultureCenter${d.i}`)
    .attr("data-id", (d: any) => d.i)
    .attr("r", 2)
    .attr("fill", (d: any) => d.color)
    .attr("cx", (d: any) => pack.cells.p[d.center][0])
    .attr("cy", (d: any) => pack.cells.p[d.center][1])
    .on("mouseenter", (event: any, d: any) => {
      tip(tooltip, true);
      ensureEl("culturesBody").querySelector(`div[data-id='${d.i}']`)?.classList.add("selected");
      cultureHighlightOn(event);
    })
    .on("mouseleave", (event: any, d: any) => {
      tip("", true);
      ensureEl("culturesBody").querySelector(`div[data-id='${d.i}']`)?.classList.remove("selected");
      cultureHighlightOff(event);
    })
    .call(drag<SVGCircleElement, any>().on("start", cultureCenterDrag));
}

function cultureCenterDrag(this: any, event: any): void {
  const cultureId = +this.id.slice(13);
  const tr = parseTransform(this.getAttribute("transform"));
  const x0 = +tr[0] - event.x;
  const y0 = +tr[1] - event.y;

  function handleDrag(this: any, dragEvent: any) {
    const { x, y } = dragEvent;
    this.setAttribute("transform", `translate(${x0 + x},${y0 + y})`);
    const cell = findCell(x, y);
    if (cell == null || pack.cells.h[cell] < 20) return; // ignore dragging on water

    pack.cultures[cultureId].center = cell;
    recalculateCultures();
  }

  const dragDebounced = debounce(handleDrag, 50);
  event.on("drag", dragDebounced);
}

function toggleLegend(): void {
  if (select("#legend").selectAll("*").size()) {
    clearLegend();
    return;
  }

  const data = pack.cultures
    .filter(c => c.i && !c.removed && c.cells)
    .sort((a, b) => (b.area ?? 0) - (a.area ?? 0))
    .map(c => [c.i, c.color, c.name]);
  drawLegend("文化", data);
}

function togglePercentageMode(): void {
  if (ensureEl("culturesBody").dataset.type === "absolute") {
    ensureEl("culturesBody").dataset.type = "percentage";
    const totalCells = +ensureEl("culturesFooterCells").innerText;
    const totalArea = +ensureEl("culturesFooterArea").dataset.area!;
    const totalPopulation = +ensureEl("culturesFooterPopulation").dataset.population!;

    ensureEl("culturesBody")
      .querySelectorAll<HTMLElement>(":scope > div")
      .forEach(el => {
        const { cells, area, population } = el.dataset;
        el.querySelector<HTMLElement>(".cultureCells")!.innerText = `${rn((+cells! / totalCells) * 100)}%`;
        el.querySelector<HTMLElement>(".cultureArea")!.innerText = `${rn((+area! / totalArea) * 100)}%`;
        el.querySelector<HTMLElement>(".culturePopulation")!.innerText =
          `${rn((+population! / totalPopulation) * 100)}%`;
      });
  } else {
    ensureEl("culturesBody").dataset.type = "absolute";
    culturesEditorAddLines();
  }
}

async function showHierarchy(): Promise<void> {
  if (customization) return;

  const getDescription = (culture: any) => {
    const { name, type, rural, urban } = culture;

    const population = rural * populationRate + urban * populationRate * urbanization;
    const populationText = population > 0 ? `${si(rn(population))} 人` : "已灭绝";
    return `${name} 文化。${type}。${populationText}`;
  };

  const getShape = ({ type }: any) => {
    if (type === "Generic") return "circle";
    if (type === "River") return "diamond";
    if (type === "Lake") return "hexagon";
    if (type === "Naval") return "square";
    if (type === "Highland") return "concave";
    if (type === "Nomadic") return "octagon";
    if (type === "Hunting") return "pentagon";
  };

  Controllers.HierarchyTree.open({
    type: "cultures",
    data: pack.cultures as any,
    onNodeEnter: cultureHighlightOn,
    onNodeLeave: cultureHighlightOff,
    getDescription,
    getShape
  });
}

function recalculateCultures(force?: boolean): void {
  if (force || ensureEl<HTMLInputElement>("culturesAutoChange").checked) {
    Cultures.expand();
    drawCultures();
    pack.burgs.forEach(b => {
      if (!b.i || b.removed) return;
      b.culture = pack.cells.culture[b.cell];
    });
    refreshCulturesEditor();
  }
}

function enterCultureManualAssignent(): void {
  if (!layerIsOn("toggleCultures")) toggleCultures();
  customization = 4;
  select("#cults").append("g").attr("id", "temp");
  document.querySelectorAll<HTMLElement>("#culturesBottom > *").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("culturesManuallyButtons").style.display = "inline-block";
  select("#debug").select("#cultureCenters").style("display", "none");

  ensureEl("culturesEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });
  ensureEl("culturesFooter").style.display = "none";
  ensureEl("culturesBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
  $("#culturesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg" } });

  tip("点击文化以选择，拖动圆形以更改文化", true);
  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", selectCultureOnMapClick)
    .call(drag<SVGElement, unknown>().on("start", dragCultureBrush))
    .on("touchmove mousemove", moveCultureBrush);

  ensureEl("culturesBody").querySelector("div")?.classList.add("selected");
  culturesManualHistory = [];
}

function selectCultureOnLineClick(this: HTMLElement): void {
  if (customization !== 4) return;
  const previous = ensureEl("culturesBody").querySelector("div.selected");
  if (previous) previous.classList.remove("selected");
  this.classList.add("selected");
}

function selectCultureOnMapClick(this: any, event: any): void {
  const point = getPointer(event, this);
  const i = findCell(point[0], point[1]);
  if (pack.cells.h[i!] < 20) return;

  const assigned = select("#cults").select("#temp").select(`polygon[data-cell='${i}']`);
  const culture = assigned.size() ? +assigned.attr("data-culture") : pack.cells.culture[i!];

  ensureEl("culturesBody").querySelector("div.selected")?.classList.remove("selected");
  ensureEl("culturesBody").querySelector(`div[data-id='${culture}']`)?.classList.add("selected");
}

function dragCultureBrush(this: any, event: any): void {
  const radius = +ensureEl<HTMLInputElement>("culturesBrush").value;
  saveCulturesManualSnapshot();

  event.on("drag", (dragEvent: any) => {
    if (!dragEvent.dx && !dragEvent.dy) return;
    const p = getPointer(dragEvent, this);
    moveCircle(p[0], p[1], radius);

    const found = radius > 5 ? findAllCellsInRadius(p[0], p[1], radius, pack) : [findCell(p[0], p[1], radius)];
    const selection = found.filter((i): i is number => i !== undefined && isLand(i, pack));
    if (selection) changeCultureForSelection(selection);
  });
}

function changeCultureForSelection(selection: number[]): void {
  const temp = select("#cults").select("#temp");
  const selected = ensureEl("culturesBody").querySelector<HTMLElement>("div.selected")!;

  const cultureNew = +selected.dataset.id!;
  const color = pack.cultures[cultureNew].color || "#ffffff";

  selection.forEach(i => {
    const exists = temp.select(`polygon[data-cell='${i}']`);
    const cultureOld = exists.size() ? +exists.attr("data-culture") : pack.cells.culture[i];
    if (cultureNew === cultureOld) return;

    // change of append new element
    if (exists.size()) exists.attr("data-culture", cultureNew).attr("fill", color).attr("stroke", color);
    else
      temp
        .append("polygon")
        .attr("data-cell", i)
        .attr("data-culture", cultureNew)
        .attr("points", getPackPolygon(i, pack))
        .attr("fill", color)
        .attr("stroke", color);
  });
}

function moveCultureBrush(this: any, event: any): void {
  showMainTip();
  const point = getPointer(event, this);
  const radius = +ensureEl<HTMLInputElement>("culturesBrush").value;
  moveCircle(point[0], point[1], radius);
}

function applyCultureManualAssignent(): void {
  const changed = select("#cults").select("#temp").selectAll<SVGPolygonElement, unknown>("polygon");
  changed.each(function () {
    const i = +this.dataset.cell!;
    const c = +this.dataset.culture!;
    pack.cells.culture[i] = c;
    if (pack.cells.burg[i]) pack.burgs[pack.cells.burg[i]].culture = c;
  });

  if (changed.size()) {
    drawCultures();
    refreshCulturesEditor();
  }
  exitCulturesManualAssignment();
}

function exitCulturesManualAssignment(close?: string): void {
  customization = 0;
  culturesManualHistory = [];
  select("#cults").select("#temp").remove();
  removeCircle();
  document.querySelectorAll<HTMLElement>("#culturesBottom > *").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("culturesManuallyButtons").style.display = "none";

  ensureEl("culturesEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.remove("hidden");
    });
  ensureEl("culturesFooter").style.display = "block";
  ensureEl("culturesBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "all";
    });
  if (!close) $("#culturesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg" } });

  select("#debug").select("#cultureCenters").style("display", null);
  restoreDefaultEvents();
  clearMainTip();
  const selected = ensureEl("culturesBody").querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

function saveCulturesManualSnapshot(): void {
  const temp = select("#cults").select("#temp").node() as HTMLElement | null;
  if (!temp) return;

  culturesManualHistory.push(temp.innerHTML);
  if (culturesManualHistory.length > 100) culturesManualHistory.shift();
}

function undoCulturesManualAssignment(): void {
  const temp = select("#cults").select("#temp").node() as HTMLElement | null;
  if (!temp || !culturesManualHistory.length) return;

  temp.innerHTML = culturesManualHistory.pop()!;
}

function enterAddCulturesMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddCultureMode();
    return;
  }

  customization = 9;
  this.classList.add("pressed");
  tip("点击地图以添加新文化", true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addCulture);
  ensureEl("culturesBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
}

function exitAddCultureMode(): void {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  ensureEl("culturesBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "all";
    });
  const culturesAdd = ensureEl("culturesAdd");
  if (culturesAdd.classList.contains("pressed")) culturesAdd.classList.remove("pressed");
}

function addCulture(this: SVGElement, event: MouseEvent): void {
  const point = getPointer(event, this);
  const center = findCell(point[0], point[1])!;

  if (pack.cells.h[center] < 20) {
    tip("无法将文化中心放置在水中。请点击陆地单元格", false, "error");
    return;
  }

  const occupied = pack.cultures.some(c => !c.removed && c.center === center);
  if (occupied) {
    tip("此单元格已是文化中心。请选择其他单元格", false, "error");
    return;
  }

  if (event.shiftKey === false) exitAddCultureMode();
  Cultures.add(center);

  drawCultureCenters();
  culturesEditorAddLines();
}

function downloadCulturesCsv(): void {
  const unit = getAreaUnit("2");
  const headers = `Id,Name,Color,Cells,Expansionism,Type,Area ${unit},Population,Namesbase,Emblems Shape,Origins`;
  const lines = Array.from(ensureEl("culturesBody").querySelectorAll<HTMLElement>(":scope > div"));
  const data = lines.map($line => {
    const { id, name, color, cells, expansionism, type, area, population, emblems, base } = $line.dataset;
    const namesbase = nameBases[+base!].name;
    const { origins } = pack.cultures[+id!];
    const originList = (origins ?? [])
      .filter((origin: number | null): origin is number => Boolean(origin))
      .map((origin: number) => pack.cultures[origin].name);
    const originText = `"${originList.join(", ")}"`;
    return [id, name, color, cells, expansionism, type, area, population, namesbase, emblems, originText].join(",");
  });
  const csvData = [headers].concat(data).join("\n");

  const name = `${getFileName("Cultures")}.csv`;
  downloadFile(csvData, name);
}

function closeCulturesEditor(): void {
  select("#debug #cultureCenters").remove();
  exitCulturesManualAssignment("close");
  exitAddCultureMode();
  $("#culturesEditor").dialog("destroy");
  ensureEl("culturesEditor").remove();
}

async function uploadCulturesData(this: HTMLInputElement): Promise<void> {
  const file = this.files![0];
  this.value = "";
  const csv = await file.text();
  const data: any[] = csvParse(csv, d => ({
    name: d.Name,
    i: +d.Id!,
    color: d.Color,
    expansionism: +d.Expansionism!,
    type: d.Type,
    population: +d.Population!,
    emblemsShape: d["Emblems Shape"],
    origins: d.Origins,
    namesbase: d.Namesbase
  }));

  const { cultures, cells } = pack as any;
  const shapes = Object.keys(COA.shields.types).flatMap(type => Object.keys(COA.shields[type]));

  const populated = cells.pop.map((c: number, i: number) => (c ? i : null)).filter((c: number | null) => c);
  cultures.forEach((item: any) => {
    if (item.i) item.removed = true;
  });

  for (const culture of data) {
    let current: any;
    if (culture.i < cultures.length) {
      current = cultures[culture.i];

      const ratio = current.urban / (current.rural + current.urban);
      applyPopulationChange(
        current.rural,
        current.urban,
        culture.population * (1 - ratio),
        culture.population * ratio,
        culture.i
      );
    } else {
      current = { i: cultures.length, center: ra(populated), area: 0, cells: 0, origins: [0], rural: 0, urban: 0 };
      cultures.push(current);
    }

    current.removed = false;
    current.name = culture.name;

    if (current.i) {
      current.code = abbreviate(
        current.name,
        cultures.map((c: any) => c.code)
      );

      current.color = culture.color;
      current.expansionism = +culture.expansionism;

      if (CULTURE_TYPES.includes(culture.type)) current.type = culture.type;
      else current.type = "Generic";
    }

    culture.origins = current.i ? restoreOrigins(culture.origins || "") : [null];
    current.shield = shapes.includes(culture.emblemsShape) ? culture.emblemsShape : "heater";
    current.base = nameBases.findIndex(n => n.name === culture.namesbase); // can be -1 if namesbase is not found

    function restoreOrigins(originsString: string) {
      const originNames = originsString
        .replaceAll('"', "")
        .split(",")
        .map(s => s.trim())
        .filter(s => s);

      const originIds = originNames.map(name => {
        const id = cultures.findIndex((c: any) => c.name === name);
        return id === -1 ? null : id;
      });

      current.origins = originIds.filter((id: number | null) => id !== null);
      if (!current.origins.length) current.origins = [0];
    }
  }

  cultures
    .filter((c: any) => c.removed)
    .forEach((c: any) => {
      removeCulture(c.i);
    });

  drawCultures();
  refreshCulturesEditor();
}

function updateLockStatus(this: HTMLElement): void {
  if (customization) return;

  const cultureId = +(this.parentNode as HTMLElement).dataset.id!;
  const classList = this.classList;
  const c = pack.cultures[cultureId];
  c.lock = !c.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

export const CulturesEditor = { open };
