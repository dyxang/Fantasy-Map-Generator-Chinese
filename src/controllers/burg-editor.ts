import { drag, type Selection, select } from "d3";
import { Controllers } from "@/controllers";
import type { Burg } from "../generators/burgs-generator";
import {
  convertTemperature,
  destroyDialogIfExists,
  ensureEl,
  getPointer,
  getTemperatureLikeness,
  parseTransform,
  rand,
  rn
} from "../utils";
import type { PromptOptions } from "../utils/commonUtils";

declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

let selected: Selection<any, any, any, any> | null = null;

function open(id: number | string): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleBurgIcons")) toggleBurgIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  selected = select<any, unknown>("#burgLabels").select(`[data-id='${id}']`);
  if (!selected.size()) selected = select<any, unknown>("#burgIcons").select(`[data-id='${id}']`);

  select<SVGTextElement, unknown>("#burgLabels")
    .selectAll<SVGTextElement, unknown>("text")
    .call(drag<SVGTextElement, unknown>().on("start", dragBurgLabel))
    .classed("draggable", true);
  renderDialog();
  updateGroupsList();
  updateBurgValues();

  $("#burgEditor").dialog({
    title: "编辑城镇",
    resizable: false,
    close: closeBurgEditor,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("burgEditor");
  const editorHtml = /* html */ `<div id="burgEditor" class="dialog">
      <div id="burgBody" style="padding-bottom: 0.3em">
        <div style="display: flex; align-items: center">
          <svg data-tip="城镇纹章。点击编辑" class="pointer" viewBox="0 0 200 200" width="13em" height="13em">
            <use id="burgEmblem"></use>
          </svg>
          <div style="display: grid; grid-auto-rows: minmax(1.6em, auto)">
            <div id="burgProvinceAndState" style="font-weight: bold; max-width: 16em"></div>
            <div>
              <div class="label">名称：</div>
              <input
                id="burgName"
                data-tip="输入以重命名该城镇"
                autocorrect="off"
                spellcheck="false"
                style="width: 9em"
              />
              <span id="burgNameSpeak" data-tip="朗读名称。可在选项中更改语音和语言" class="speaker">🔊</span>
              <span
                id="burgNameReRandom"
                data-tip="为该城镇生成随机名称"
                class="icon-globe pointer"
              ></span>
            </div>
            <div data-tip="选择城镇分组。分组决定城镇图标、标签大小和样式">
              <div class="label">分组：</div>
              <select id="burgGroup" style="width: 9em"></select>
              <span id="burgGroupConfigure" data-tip="配置城镇分组" class="icon-cog pointer"></span>
            </div>
            <div data-tip="选择城镇类型。类型对纹章生成有轻微影响">
              <div class="label">类型：</div>
              <select id="burgType" style="width: 9em">
                <option value="Generic">Generic</option>
                <option value="River">River</option>
                <option value="Lake">Lake</option>
                <option value="Naval">Naval</option>
                <option value="Nomadic">Nomadic</option>
                <option value="Hunting">Hunting</option>
                <option value="Highland">Highland</option>
              </select>
            </div>
            <div data-tip="选择主导文化">
              <div class="label">文化：</div>
              <select id="burgCulture" style="width: 9em"></select>
              <span
                id="burgNameReCulture"
                data-tip="为该城镇生成特定文化的名称"
                class="icon-book pointer"
              ></span>
            </div>
            <div data-tip="设置城镇人口">
              <div class="label">人口：</div>
              <input id="burgPopulation" type="number" min="0" step="1" style="width: 9em" />
            </div>
            <div data-tip="城镇年平均气温" style="display: flex; justify-content: space-between">
              <div>
                <div class="label">气温：</div>
                <span id="burgTemperature"></span>
              </div>
              <div style="display: flex; gap: 0.5em">
                <i class="icon-info-circled" id="burgTemperatureLikeIn"></i>
                <i
                  id="burgTemperatureGraph"
                  data-tip="显示该城镇的气温图表"
                  class="icon-chart-area pointer"
                ></i>
              </div>
            </div>
            <div data-tip="城镇高于平均海平面的高度">
              <div class="label">海拔：</div>
              <span id="burgElevation"></span> 高于海平面
            </div>
            <div>
              <div class="label">特征：</div>
              <span
                id="burgCapital"
                data-tip="显示该城镇是否为国家首都。点击切换"
                data-feature="capital"
                class="burgFeature icon-star"
              ></span>
              <span
                id="burgPort"
                data-tip="显示该城镇是否为港口。点击切换"
                data-feature="port"
                class="burgFeature icon-anchor"
              ></span>
              <span
                id="burgCitadel"
                data-tip="显示该城镇是否有城堡（要塞）。点击切换"
                data-feature="citadel"
                class="burgFeature icon-chess-rook"
                style="font-size: 1.1em"
              ></span>
              <span
                id="burgWalls"
                data-tip="显示该城镇是否有城墙。点击切换"
                data-feature="walls"
                class="burgFeature icon-fort-awesome"
              ></span>
              <span
                id="burgPlaza"
                data-tip="显示该城镇是否为贸易中心（市场中心）。点击切换"
                data-feature="plaza"
                class="burgFeature icon-store"
                style="font-size: 1em"
              ></span>
              <span
                id="burgTemple"
                data-tip="显示该城镇是否为宗教中心。点击切换"
                data-feature="temple"
                class="burgFeature icon-chess-bishop"
                style="font-size: 1.1em; margin-left: 3px"
              ></span>
              <span
                id="burgShanty"
                data-tip="显示该城镇是否有贫民窟。点击切换"
                data-feature="shanty"
                class="burgFeature icon-campground"
                style="font-size: 1em"
              ></span>
            </div>
            <div data-tip="城镇日均产量">
              <div class="label">产量：</div>
              <span id="burgProduction" style="display: inline-flex; flex-wrap: wrap; column-gap: 0.3em; max-width: 110px;"></span>
            </div>
            <div data-tip="每人口点的总产值，日均">
              <div class="label">财富</div>
              <span id="burgWealth"></span>
            </div>
            <div data-tip="生产、购买和销售后的国库余额">
              <div class="label">国库</div>
              <span id="burgTreasury"></span>
            </div>
          </div>
        </div>
        <div id="burgPreviewSection" data-tip="城镇地图预览" style="display: flex; flex-direction: column">
          <div style="display: flex; justify-content: space-between">
            <span>城镇预览：</span>
            <div style="display: flex; gap: 0.5em">
              <i id="burgLinkOpen" data-tip="在新标签页中打开城镇地图" class="icon-link-ext pointer"></i>
            </div>
          </div>
          <div id="burgPreviewObject" style="pointer-events: none"></div>
        </div>
      </div>
      <div id="burgBottom">
        <button id="burgStyleShow" data-tip="显示样式编辑区域" class="icon-brush"></button>
        <div id="burgStyleSection" style="display: none">
          <button id="burgStyleHide" data-tip="隐藏样式编辑区域" class="icon-brush"></button>
          <button
            id="burgEditLabelStyle"
            data-tip="在样式编辑器中编辑城镇组标签样式"
            class="icon-font"
          ></button>
          <button
            id="burgEditIconStyle"
            data-tip="在样式编辑器中编辑城镇组图标样式"
            class="icon-dot-circled"
          ></button>
          <button
            id="burgEditAnchorStyle"
            data-tip="在样式编辑器中编辑城镇组港口图标（锚）样式"
            class="icon-anchor"
          ></button>
        </div>
        <button id="burgEditEmblem" data-tip="编辑纹章" class="icon-shield-alt"></button>
        <button id="burgSetPreviewLink" data-tip="设置自定义城镇地图 URL" class="icon-map-o"></button>
        <button id="burgLocate" data-tip="缩放地图并居中视图到城镇" class="icon-target"></button>
        <button
          id="burgProductionOverview"
          data-tip="显示此城镇的产能总览"
          class="icon-chart-bar"
        ></button>
        <button
          id="burgRelocate"
          data-tip="重新定位城镇。点击地图移动城镇"
          class="icon-map-pin"
        ></button>
        <button id="burglLegend" data-tip="编辑此城镇的自由文本笔记（图例）" class="icon-edit"></button>
        <button id="burgLock" class="icon-lock-open" onmouseover="showElementLockTip(event)"></button>
        <button
          id="burgRemove"
          data-tip="移除非首都城镇"
          data-shortcut="Delete"
          class="icon-trash fastDelete"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl("burgName").on("input", changeName);
  ensureEl("burgNameSpeak").on("click", () => speak(ensureEl<HTMLInputElement>("burgName").value));
  ensureEl("burgNameReRandom").on("click", generateNameRandom);
  ensureEl("burgGroup").on("change", changeGroup);
  ensureEl("burgGroupConfigure").on("click", editBurgGroups);
  ensureEl("burgType").on("change", changeType);
  ensureEl("burgCulture").on("change", changeCulture);
  ensureEl("burgNameReCulture").on("click", generateNameCulture);
  ensureEl("burgPopulation").on("change", changePopulation);
  ensureEl("burgBody")
    .querySelectorAll<HTMLElement>(".burgFeature")
    .forEach(el => void el.on("click", toggleFeature));
  ensureEl("burgLinkOpen").on("click", openBurgLink);

  ensureEl("burgStyleShow").on("click", showStyleSection);
  ensureEl("burgStyleHide").on("click", hideStyleSection);
  ensureEl("burgEditLabelStyle").on("click", editGroupLabelStyle);
  ensureEl("burgEditIconStyle").on("click", editGroupIconStyle);
  ensureEl("burgEditAnchorStyle").on("click", editGroupAnchorStyle);

  ensureEl("burgEmblem").on("click", openEmblemEdit);
  ensureEl("burgSetPreviewLink").on("click", setCustomPreview);
  ensureEl("burgEditEmblem").on("click", openEmblemEdit);
  ensureEl("burgLocate").on("click", zoomIntoBurg);
  ensureEl("burgRelocate").on("click", toggleRelocateBurg);
  ensureEl("burglLegend").on("click", editBurgLegend);
  ensureEl("burgLock").on("click", toggleBurgLockButton);
  ensureEl("burgRemove").on("click", removeSelectedBurg);
  ensureEl("burgTemperatureGraph").on("click", showTemperatureGraph);
  ensureEl("burgProductionOverview").on("click", showProductionOverview);
}

function getSelectedId(): number {
  return +selected!.attr("data-id");
}

function updateGroupsList(): void {
  const groupSelect = ensureEl<HTMLSelectElement>("burgGroup");
  groupSelect.options.length = 0; // remove all options
  for (const { name } of options.burgs.groups) {
    groupSelect.options.add(new Option(name, name));
  }
}

function updateBurgValues(): void {
  const id = getSelectedId();
  const b = pack.burgs[id];
  const province = pack.cells.province[b.cell];
  const provinceName = province ? `${pack.provinces[province].fullName}, ` : "";
  const stateName = pack.states[b.state!].fullName || pack.states[b.state!].name;
  ensureEl("burgProvinceAndState").innerHTML = provinceName + stateName;

  ensureEl<HTMLInputElement>("burgName").value = b.name!;
  ensureEl<HTMLSelectElement>("burgGroup").value = b.group!;
  ensureEl<HTMLSelectElement>("burgType").value = b.type || "Generic";
  ensureEl<HTMLInputElement>("burgPopulation").value = String(rn(b.population! * populationRate * urbanization));
  ensureEl("burgWealth").innerHTML = `🟡 ${rn(b.population! > 0 ? (b.product || 0) / b.population! : 0, 2)}`;
  ensureEl("burgTreasury").innerHTML = `🟡 ${rn(b.treasury || 0, 2)}`;
  ensureEl("burgEditAnchorStyle").style.display = +b.port! ? "inline-block" : "none";

  // update list and select culture
  const cultureSelect = ensureEl<HTMLSelectElement>("burgCulture");
  cultureSelect.options.length = 0;
  const cultures = pack.cultures.filter(c => !c.removed);
  cultures.forEach(c => void cultureSelect.options.add(new Option(c.name, String(c.i), false, c.i === b.culture)));

  const temperature = grid.cells.temp[pack.cells.g[b.cell]];
  ensureEl("burgTemperature").innerHTML = convertTemperature(temperature);
  ensureEl("burgTemperatureLikeIn").dataset.tip = `年平均气温类似于${getTemperatureLikeness(temperature)}`;
  ensureEl("burgElevation").innerHTML = getHeight(pack.cells.h[b.cell]);

  ensureEl("burgCapital").classList.toggle("inactive", !b.capital);
  ensureEl("burgPort").classList.toggle("inactive", !b.port);
  ensureEl("burgCitadel").classList.toggle("inactive", !b.citadel);
  ensureEl("burgWalls").classList.toggle("inactive", !b.walls);
  ensureEl("burgPlaza").classList.toggle("inactive", !b.plaza);
  ensureEl("burgTemple").classList.toggle("inactive", !b.temple);
  ensureEl("burgShanty").classList.toggle("inactive", !b.shanty);
  ensureEl("burgProduction").innerHTML = getProduction(Production.getBurgProduction(b));

  updateBurgLockIcon();

  // set emblem image
  const coaID = `burgCOA${id}`;
  COArenderer.trigger(coaID, b.coa);
  ensureEl("burgEmblem").setAttribute("href", `#${coaID}`);

  updateBurgPreview(b);
}

function dragBurgLabel(this: SVGTextElement, event: any): void {
  const tr = parseTransform(this.getAttribute("transform")!);
  const dx = +tr[0] - event.x;
  const dy = +tr[1] - event.y;

  event.on("drag", function (this: SVGTextElement, dragEvent: any) {
    const { x, y } = dragEvent;
    this.setAttribute("transform", `translate(${dx + x},${dy + y})`);
    tip('拖拽仅用于微调，要实际移动城镇请使用"重新定位"按钮', false, "warn");
  });
}

function changeName(): void {
  const id = getSelectedId();
  const value = ensureEl<HTMLInputElement>("burgName").value;
  pack.burgs[id].name = value;
  selected!.text(value);
}

function generateNameRandom(): void {
  const base = rand(nameBases.length - 1);
  ensureEl<HTMLInputElement>("burgName").value = Names.getBase(base);
  changeName();
}

function changeGroup(this: HTMLSelectElement): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  Burgs.changeGroup(burg, this.value);
}

function changeType(this: HTMLSelectElement): void {
  const id = getSelectedId();
  pack.burgs[id].type = this.value as Burg["type"];
}

function changeCulture(this: HTMLSelectElement): void {
  const id = getSelectedId();
  pack.burgs[id].culture = +this.value;
}

function generateNameCulture(): void {
  const id = getSelectedId();
  const culture = pack.burgs[id].culture!;
  ensureEl<HTMLInputElement>("burgName").value = Names.getCulture(culture);
  changeName();
}

function changePopulation(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];

  pack.burgs[id].population = rn(
    ensureEl<HTMLInputElement>("burgPopulation").valueAsNumber / populationRate / urbanization,
    4
  );
  updateBurgPreview(burg);
}

function toggleFeature(this: HTMLElement): void {
  const burgId = getSelectedId();
  const burg = pack.burgs[burgId];

  const feature = this.dataset.feature!;
  const value = Number(this.classList.contains("inactive"));

  if (feature === "port") togglePort(burgId);
  else if (feature === "capital") toggleCapital(burgId);
  else (burg as any)[feature] = value;

  this.classList.toggle("inactive", !(burg as any)[feature]);

  ensureEl("burgEditAnchorStyle").style.display = burg.port ? "inline-block" : "none";
  updateBurgPreview(burg);
}

function togglePort(burgId: number): void {
  const burg = pack.burgs[burgId];
  if (burg.port) {
    burg.port = 0;

    const anchor = document.querySelector(`#anchors [data-id='${burgId}']`);
    if (anchor) anchor.remove();
  } else {
    const { cells, features } = pack;
    const haven = cells.haven[burg.cell];
    let portFeatureId: number | null;

    if (haven) {
      const featureId = cells.f[haven];
      const feature = features[featureId];
      portFeatureId =
        feature?.type === "lake" && feature.outlet
          ? (Rivers.resolveLakeDrainFeature(featureId) ?? featureId)
          : featureId;
    } else {
      portFeatureId = Rivers.resolveDrainFeature(burg.cell);
      if (!portFeatureId) {
        tip("下游未找到可通航水域，无法分配港口", false, "warn");
        return;
      }
    }

    burg.port = portFeatureId;

    select("#anchors")
      .select(`#${burg.group}`)
      .append("use")
      .attr("href", "#icon-anchor")
      .attr("id", `anchor${burg.i}`)
      .attr("data-id", burg.i)
      .attr("x", burg.x)
      .attr("y", burg.y);
  }
}

function toggleCapital(burgId: number): void {
  const { burgs, states } = pack;

  if (burgs[burgId].capital) {
    tip("要更换首都，请将首都地位分配给该国家的另一座城镇", false, "error");
    return;
  }

  const stateId = burgs[burgId].state;
  if (!stateId) {
    tip("中立领土不能拥有首都", false, "error");
    return;
  }

  const oldCapitalId = states[stateId].capital;
  states[stateId].capital = burgId;
  states[stateId].center = burgs[burgId].cell;

  const capital = burgs[burgId];
  capital.capital = 1;
  Burgs.changeGroup(capital);

  const oldCapital = burgs[oldCapitalId];
  oldCapital.capital = 0;
  Burgs.changeGroup(oldCapital);
}

function toggleBurgLockButton(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  burg.lock = !burg.lock;

  updateBurgLockIcon();
}

function updateBurgLockIcon(): void {
  const id = getSelectedId();
  const b = pack.burgs[id];
  if (b.lock) {
    ensureEl("burgLock").classList.remove("icon-lock-open");
    ensureEl("burgLock").classList.add("icon-lock");
  } else {
    ensureEl("burgLock").classList.remove("icon-lock");
    ensureEl("burgLock").classList.add("icon-lock-open");
  }
}

function showStyleSection(): void {
  document.querySelectorAll<HTMLElement>("#burgBottom > button").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("burgStyleSection").style.display = "inline-block";
}

function hideStyleSection(): void {
  document.querySelectorAll<HTMLElement>("#burgBottom > button").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("burgStyleSection").style.display = "none";
}

function editGroupLabelStyle(): void {
  const g = (selected!.node() as Element).parentNode as HTMLElement;
  closeDialogs(".stable");
  editStyle("labels", g.id);
}

function editGroupIconStyle(): void {
  const g = (selected!.node() as Element).parentNode as HTMLElement;
  closeDialogs(".stable");
  editStyle("burgIcons", g.id);
}

function editGroupAnchorStyle(): void {
  const g = (selected!.node() as Element).parentNode as HTMLElement;
  closeDialogs(".stable");
  editStyle("anchors", g.id);
}

function updateBurgPreview(burg: Burg): void {
  const preview = Burgs.getPreview(burg).preview;
  if (!preview) {
    ensureEl("burgPreviewSection").style.display = "none";
    return;
  }

  ensureEl("burgPreviewSection").style.display = "block";

  // recreate object to force reload (Chrome bug)
  const container = ensureEl("burgPreviewObject");
  container.innerHTML = "";
  const object = document.createElement("object");
  object.style.width = "100%";
  object.style.maxWidth = "60vw";
  object.style.maxHeight = "60vh";
  object.data = preview;
  container.insertBefore(object, null);
}

function openBurgLink(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  const link = Burgs.getPreview(burg).link;
  if (link) openURL(link);
}

function setCustomPreview(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];

  prompt(
    "提供城镇地图的自定义 URL。可以是生成器的链接或仅是图片。留空则使用默认地图预览",
    { default: Burgs.getPreview(burg).link || "", required: false },
    link => {
      if (link) burg.link = String(link);
      else delete burg.link;
      updateBurgPreview(burg);
    }
  );
}

function openEmblemEdit(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  void Controllers.EmblemsEditor.open("burg", `burgCOA${id}`, burg);
}

function zoomIntoBurg(): void {
  const id = getSelectedId();
  const burg = pack.burgs[id];
  zoomTo(burg.x, burg.y, 8, 2000);
}

function toggleRelocateBurg(): void {
  const toggler = ensureEl("toggleCells");
  ensureEl("burgRelocate").classList.toggle("pressed");
  if (ensureEl("burgRelocate").classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", relocateBurgOnClick);
    tip("在地图上点击以重新定位城镇。按住 Shift 可连续移动", true);
    if (!layerIsOn("toggleCells")) {
      toggleCells();
      toggler.dataset.forced = "true";
    }
  } else {
    clearMainTip();
    restoreDefaultEvents();
    if (layerIsOn("toggleCells") && toggler.dataset.forced) {
      toggleCells();
      toggler.dataset.forced = "false";
    }
  }
}

function relocateBurgOnClick(this: SVGGElement, event: any): void {
  const cells = pack.cells;
  const point = getPointer(event, this);
  const cellId = findCell(point[0], point[1])!;
  const id = getSelectedId();
  const burg = pack.burgs[id];

  if (cells.h[cellId] < 20) {
    tip("无法将城镇放入水中！请选择陆地单元格", false, "error");
    return;
  }
  if (cells.burg[cellId] && cells.burg[cellId] !== id) {
    tip("此单元格中已存在城镇。请选择空闲单元格", false, "error");
    return;
  }

  const newState = cells.state[cellId];
  const oldState = burg.state;
  if (newState !== oldState && burg.capital) {
    tip("首都无法迁移到另一个国家！", false, "error");
    return;
  }

  // change UI
  const x = rn(point[0], 2);
  const y = rn(point[1], 2);

  select("#burgIcons").select(`#burg${id}`).attr("x", x).attr("y", y);
  select("#burgLabels").select(`#burgLabel${id}`).attr("transform", null).attr("x", x).attr("y", y);

  const anchor = select("#anchors").select(`use[data-id='${id}']`);
  if (anchor.size()) {
    const size = +anchor.attr("width");
    const xa = rn(x - size * 0.47, 2);
    const ya = rn(y - size * 0.47, 2);
    anchor.attr("transform", null).attr("x", xa).attr("y", ya);
  }

  // change data
  cells.burg[burg.cell] = 0;
  cells.burg[cellId] = id;
  burg.cell = cellId;
  burg.state = newState;
  burg.x = x;
  burg.y = y;
  if (burg.capital) pack.states[newState].center = burg.cell;

  if (event.shiftKey === false) toggleRelocateBurg();
}

function editBurgLegend(): void {
  const id = selected!.attr("data-id");
  const name = selected!.text();
  void Controllers.NotesEditor.open(`burg${id}`, name);
}

function showTemperatureGraph(): void {
  const id = +selected!.attr("data-id");
  void Controllers.TemperatureGraph.open(id);
}

function showProductionOverview(): void {
  const id = getSelectedId();
  Controllers.ProductionOverview.open(id);
}

function removeSelectedBurg(): void {
  const burgId = getSelectedId();
  const burg = pack.burgs[burgId];

  if (burg.capital) {
    alertMessage.innerHTML = /* html */ `无法移除首都。必须先更改国家首都`;
    $("#alert").dialog({
      resizable: false,
      title: "移除城镇",
      buttons: {
        确定: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
  } else if (pack.markets?.some(m => m.centerBurgId === burgId)) {
    alertMessage.innerHTML = /* html */ `无法移除市场中心城镇。请先移除市场`;
    $("#alert").dialog({
      resizable: false,
      title: "移除城镇",
      buttons: {
        确定: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
  } else {
    confirmationDialog({
      title: "移除城镇",
      message: "确定要移除该城镇吗？<br>此操作无法撤销",
      confirm: "移除",
      onConfirm: () => {
        Burgs.remove(burgId);
        $("#burgEditor").dialog("close");
      }
    });
  }
}

function editBurgGroups(): void {
  Controllers.BurgGroupEditor.open();
}

function closeBurgEditor(): void {
  ensureEl("burgRelocate").classList.remove("pressed");
  select<SVGTextElement, unknown>("#burgLabels")
    .selectAll<SVGTextElement, unknown>("text")
    .call(drag<SVGTextElement, unknown>().on("drag", null))
    .classed("draggable", false);
  unselect();
  $("#burgEditor").dialog("destroy");
  ensureEl("burgEditor").remove();
}

function getProduction(pool: Record<number, number>): string {
  if (!pool) return "";
  let html = "";
  const sorted = Object.entries(pool).sort(([, a], [, b]) => b - a);
  for (const [resourceId, production] of sorted) {
    const resource = Goods.get(+resourceId);
    if (!resource) continue;
    const { name, unit, icon } = resource;
    const unitName = production === 1 ? unit : `${unit}s`;
    html += `<span data-tip="${name}: ${production} ${unitName} per day">
      <svg class="resIcon" width="1em" height="1em"><use href="#${icon}"></use></svg>
      <span style="margin: 0 0.2em 0 -0.2em">${production}</span>
    </span>`;
  }
  return html;
}

export const BurgEditor = { open };
