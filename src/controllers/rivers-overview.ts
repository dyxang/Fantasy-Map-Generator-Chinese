import { mean, select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { applySorting, applySortingByHeader } from "@/components/dialog/sorting";
import { Controllers } from "@/controllers";
import type { River } from "@/generators/river-generator";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, getFileName } from "@/utils";
import { destroyDialogIfExists, ensureEl, rn } from "../utils";

function open(): void {
  if (customization) return;
  closeDialogs("#riversOverview, .stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  renderDialog();
  riversOverviewAddLines();

  $("#riversOverview").dialog({
    title: "河流总览",
    resizable: false,
    width: "fit-content",
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: closeRiversOverview
  });
}

function renderDialog(): void {
  destroyDialogIfExists("riversOverview");

  const html = /* html */ `<div id="riversOverview" class="dialog stable">
    <div id="riversHeader" class="header" style="grid-template-columns: 9em 4em 7em 5em 5em 9em">
      <div data-tip="点击按河流名称排序" class="sortable alphabetically" data-sortby="name">河流&nbsp;</div>
      <div data-tip="点击按河流类型名称排序" class="sortable alphabetically" data-sortby="type">类型&nbsp;</div>
      <div data-tip="点击按流量（m3/s）排序" class="sortable icon-sort-number-down" data-sortby="discharge">流量&nbsp;</div>
      <div data-tip="点击按河流长度排序" class="sortable" data-sortby="length">长度&nbsp;</div>
      <div data-tip="点击按河口宽度排序" class="sortable" data-sortby="width">宽度&nbsp;</div>
      <div data-tip="点击按河流流域排序" class="sortable alphabetically" data-sortby="basin">流域&nbsp;</div>
    </div>
    <div id="riversBody" class="table"></div>
    <div id="riversFooter" class="totalLine">
      <div data-tip="河流数量" style="margin-left: 4px">河流:&nbsp;<span id="riversFooterNumber">0</span></div>
      <div data-tip="平均流量" style="margin-left: 12px">平均流量:&nbsp;<span id="riversFooterDischarge">0</span></div>
      <div data-tip="平均长度" style="margin-left: 12px">长度:&nbsp;<span id="riversFooterLength">0</span></div>
      <div data-tip="平均河口宽度" style="margin-left: 12px">宽度:&nbsp;<span id="riversFooterWidth">0</span></div>
    </div>
    <div id="riversBottom">
      <button id="riversOverviewRefresh" data-tip="刷新编辑器" class="icon-cw"></button>
      <button id="addNewRiver" data-tip="自动从点击的单元格添加河流。按住 Shift 添加多个" class="icon-plus"></button>
      <button id="riverCreateNew" data-tip="通过选择河流单元格创建新河流" class="icon-map-pin"></button>
      <button id="riversBasinHighlight" data-tip="切换流域高亮模式" class="icon-sitemap"></button>
      <button id="riversExport" data-tip="将河流相关数据保存为文本文件 (.csv)" class="icon-download"></button>
      <button id="riversRemoveAll" data-tip="移除所有河流" class="icon-trash"></button>
      <label for="riversSearch" data-tip="按名称、类型或流域筛选" style="margin-left: 0.2em">搜索： <input id="riversSearch" type="search" /></label>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  applySortingByHeader("riversHeader");
  applyLineHighlighting("riversOverview", ({ target, cellId }) => {
    const riverId = pack.cells.r[cellId];
    if (riverId) return riverId;
    const river = target.closest<SVGElement>("#rivers [id^='river']");
    return river && /^river\d+$/.test(river.id) ? Number(river.id.slice(5)) : undefined;
  });

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riversOverviewRefresh").on("click", riversOverviewAddLines);
  ensureEl("addNewRiver").on("click", () => void Controllers.RiverAutoCreator.toggle());
  ensureEl("riverCreateNew").on("click", createNewRiver);
  ensureEl("riversBasinHighlight").on("click", toggleBasinsHightlight);
  ensureEl("riversExport").on("click", downloadRiversData);
  ensureEl("riversRemoveAll").on("click", triggerAllRiversRemove);
  ensureEl("riversSearch").on("input", riversOverviewAddLines);
}

function closeRiversOverview(): void {
  destroyDialogIfExists("riversOverview");
}

function createNewRiver(): void {
  void Controllers.RiverCreator.open();
}

// add line for each river
function riversOverviewAddLines(): void {
  const body = ensureEl("riversBody");
  body.innerHTML = "";
  let lines = "";
  const unit = distanceUnitInput.value;

  // Precompute a lookup map from river id to river for efficient basin lookup
  const riversById = new Map<number, River>(pack.rivers.map((river: River) => [river.i, river]));

  let filteredRivers: River[] = pack.rivers;
  const searchText = ensureEl<HTMLInputElement>("riversSearch").value.toLowerCase().trim();
  if (searchText) {
    filteredRivers = filteredRivers.filter(r => {
      const name = (r.name || "").toLowerCase();
      const type = (r.type || "").toLowerCase();
      const basin = riversById.get(r.basin);
      const basinName = basin ? (basin.name || "").toLowerCase() : "";
      return name.includes(searchText) || type.includes(searchText) || basinName.includes(searchText);
    });
  }

  for (const r of filteredRivers) {
    const discharge = `${r.discharge} m³/s`;
    const length = `${rn(r.length * distanceScale)} ${unit}`;
    const width = `${rn(r.width * distanceScale, 3)} ${unit}`;
    const basin = riversById.get(r.basin)?.name;

    lines += /* html */ `<div
        class="states"
        data-id=${r.i}
        data-name="${r.name}"
        data-type="${r.type}"
        data-discharge="${r.discharge}"
        data-length="${r.length}"
        data-width="${r.width}"
        data-basin="${basin}"
      >
        <span data-tip="定位该河流" class="icon-target"></span>
        <div data-tip="河流名称" style="margin-left: 0.4em;" class="riverName">${r.name}</div>
        <div data-tip="河流类型名称" class="riverType">${r.type}</div>
        <div data-tip="河流流量（水力）" class="biomeArea">${discharge}</div>
        <div data-tip="河流长度（从源头到入海口）" class="biomeArea">${length}</div>
        <div data-tip="河流入海口宽度" class="biomeArea">${width}</div>
        <input data-tip="河流流域（主干的名称）" class="stateName" value="${basin}" disabled />
        <span data-tip="编辑河流" class="icon-pencil"></span>
        <span data-tip="移除河流" class="icon-trash-empty"></span>
      </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  // update footer
  ensureEl("riversFooterNumber").innerHTML = `${filteredRivers.length} of ${pack.rivers.length}`;
  const averageDischarge = rn(mean(filteredRivers.map(r => r.discharge))!) || 0;
  ensureEl("riversFooterDischarge").innerHTML = `${averageDischarge} m³/s`;
  const averageLength = rn(mean(filteredRivers.map(r => r.length))!) || 0;
  ensureEl("riversFooterLength").innerHTML = `${averageLength * distanceScale} ${unit}`;
  const averageWidth = rn(mean(filteredRivers.map(r => r.width))!, 3) || 0;
  ensureEl("riversFooterWidth").innerHTML = `${rn(averageWidth * distanceScale, 3)} ${unit}`;

  // add listeners
  body.querySelectorAll("div.states").forEach(el => void el.on("mouseenter", (ev: Event) => riverHighlightOn(ev)));
  body.querySelectorAll("div.states").forEach(el => void el.on("mouseleave", (ev: Event) => riverHighlightOff(ev)));
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.on("click", zoomToRiver));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.on("click", openRiverEditor));
  body.querySelectorAll("div > span.icon-trash-empty").forEach(el => void el.on("click", triggerRiverRemove));

  applySorting(ensureEl("riversHeader"));
}

function riverHighlightOn(event: Event): void {
  if (!layerIsOn("toggleRivers")) toggleRivers();
  const r = +(event.target as HTMLElement).dataset.id!;
  select("#rivers").select(`#river${r}`).attr("stroke", "red").attr("stroke-width", 1);
}

function riverHighlightOff(e: Event): void {
  const r = +(e.target as HTMLElement).dataset.id!;
  select("#rivers").select(`#river${r}`).attr("stroke", null).attr("stroke-width", null);
}

function zoomToRiver(this: HTMLElement): void {
  const r = +(this.parentNode as HTMLElement).dataset.id!;
  const river = select("#rivers").select(`#river${r}`).node() as Element;
  highlightElement(river, 3);
}

function toggleBasinsHightlight(): void {
  if (select("#rivers").attr("data-basin") === "hightlighted") {
    select("#rivers").selectAll("*").attr("fill", null);
    select("#rivers").attr("data-basin", null);
  } else {
    select("#rivers").attr("data-basin", "hightlighted");
    const basins = [...new Set(pack.rivers.map((r: River) => r.basin))];
    const colors = [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf"
    ];

    basins.forEach((b, i) => {
      const color = colors[i % colors.length];
      pack.rivers
        .filter((r: River) => r.basin === b)
        .forEach((r: River) => {
          select("#rivers").select(`#river${r.i}`).attr("fill", color);
        });
    });
  }
}

function downloadRiversData(): void {
  let data = "Id,River,Type,Discharge,Length,Width,Basin\n"; // headers

  ensureEl("riversBody")
    .querySelectorAll<HTMLElement>(":scope > div")
    .forEach(el => {
      const d = el.dataset;
      const discharge = `${d.discharge} m³/s`;
      const length = `${rn(+d.length! * distanceScale)} ${distanceUnitInput.value}`;
      const width = `${rn(+d.width! * distanceScale, 3)} ${distanceUnitInput.value}`;
      data += `${[d.id, d.name, d.type, discharge, length, width, d.basin].join(",")}\n`;
    });

  const name = `${getFileName("Rivers")}.csv`;
  downloadFile(data, name);
}

function openRiverEditor(this: HTMLElement): void {
  const id = `river${(this.parentNode as HTMLElement).dataset.id}`;
  void Controllers.RiverEditor.open(id);
}

function triggerRiverRemove(this: HTMLElement): void {
  const river = +(this.parentNode as HTMLElement).dataset.id!;
  alertMessage.innerHTML = /* html */ `确定要移除该河流吗？所有支流将被自动移除`;

  $("#alert").dialog({
    resizable: false,
    width: "22em",
    title: "移除河流",
    buttons: {
      移除: function (this: any) {
        Rivers.remove(river);
        riversOverviewAddLines();
        $(this).dialog("close");
      },
      取消: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

function triggerAllRiversRemove(): void {
  alertMessage.innerHTML = /* html */ `确定要移除所有河流吗？`;
  $("#alert").dialog({
    resizable: false,
    title: "移除所有河流",
    buttons: {
      移除: function (this: any) {
        $(this).dialog("close");
        removeAllRivers();
      },
      取消: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

function removeAllRivers(): void {
  pack.rivers = [];
  pack.cells.r = new Uint16Array(pack.cells.i.length);
  select("#rivers").selectAll("*").remove();
  riversOverviewAddLines();
}

export const RiversOverview = { open };
