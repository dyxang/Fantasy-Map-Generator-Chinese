import { mean, select } from "d3";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { applySorting, applySortingByHeader } from "@/components/dialog/sorting";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { Route } from "@/generators/routes-generator";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, getFileName } from "@/utils";
import { destroyDialogIfExists, ensureEl, rn } from "../utils";

function open(): void {
  if (customization) return;
  closeDialogs("#routesOverview, .stable");
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  renderDialog();
  routesOverviewAddLines();

  $("#routesOverview").dialog({
    title: "道路总览",
    resizable: false,
    width: "fit-content",
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: closeRoutesOverview
  });
}

function renderDialog(): void {
  destroyDialogIfExists("routesOverview");

  const html = /* html */ `<div id="routesOverview" class="dialog stable">
    <div id="routesHeader" class="header" style="grid-template-columns: 17em 8em 8em">
      <div data-tip="点击按道路名称排序" class="sortable alphabetically" data-sortby="name">道路&nbsp;</div>
      <div data-tip="点击按道路组排序" class="sortable alphabetically" data-sortby="group">组&nbsp;</div>
      <div data-tip="点击按道路长度排序" class="sortable icon-sort-number-down" data-sortby="length">长度&nbsp;</div>
    </div>
    <div id="routesBody" class="table"></div>
    <div id="routesFooter" class="totalLine">
      <div data-tip="道路数量" style="margin-left: 4px">道路:&nbsp;<span id="routesFooterNumber">0</span></div>
      <div data-tip="平均长度" style="margin-left: 12px">平均长度:&nbsp;<span id="routesFooterLength">0</span></div>
    </div>
    <div id="routesBottom">
      <button id="routesOverviewRefresh" data-tip="刷新编辑器" class="icon-cw"></button>
      <button id="routesCreateNew" data-tip="通过选择道路单元格创建新道路" class="icon-map-pin"></button>
      <button id="routesExport" data-tip="将道路相关数据保存为文本文件 (.csv)" class="icon-download"></button>
      <button id="routesLockAll" data-tip="锁定或解锁所有道路" class="icon-lock"></button>
      <button id="routesRemoveAll" data-tip="移除所有未锁定的道路（已锁定的道路保留）" class="icon-trash"></button>
      <label for="routesSearch" data-tip="按名称或分组筛选" style="margin-left: 0.2em">搜索：<input id="routesSearch" type="search" /></label>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  applySortingByHeader("routesHeader");

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("routesOverviewRefresh").on("click", routesOverviewAddLines);
  ensureEl("routesCreateNew").on("click", createNewRoute);
  ensureEl("routesExport").on("click", downloadRoutesData);
  ensureEl("routesLockAll").on("click", toggleLockAll);
  ensureEl("routesRemoveAll").on("click", triggerAllRoutesRemove);
  ensureEl("routesSearch").on("input", routesOverviewAddLines);
}

function closeRoutesOverview(): void {
  destroyDialogIfExists("routesOverview");
}

function createNewRoute(): void {
  Controllers.RouteCreator.open();
}

// add line for each route
function routesOverviewAddLines(): void {
  const body = ensureEl("routesBody");
  body.innerHTML = "";
  let lines = "";

  let filteredRoutes: Route[] = pack.routes;

  const searchText = ensureEl<HTMLInputElement>("routesSearch").value.toLowerCase().trim();
  if (searchText) {
    filteredRoutes = filteredRoutes.filter(route => {
      const name = (route.name || "").toLowerCase();
      const group = (route.group || "").toLowerCase();
      return name.includes(searchText) || group.includes(searchText);
    });
  }

  for (const route of filteredRoutes) {
    if (!route.points || route.points.length < 2) continue;
    route.name = route.name || Routes.generateName(route);
    route.length = route.length || Routes.getLength(route.i);
    const length = `${rn(route.length * distanceScale)} ${distanceUnitInput.value}`;

    lines += /* html */ `<div
        class="states"
        data-id="${route.i}"
        data-name="${route.name}"
        data-group="${route.group}"
        data-length="${route.length}"
      >
        <span data-tip="定位该道路" class="icon-target"></span>
        <div data-tip="道路名称" style="width: 15em; margin-left: 0.4em;">${route.name}</div>
        <div data-tip="道路分组" style="width: 8em;">${route.group}</div>
        <div data-tip="道路长度" style="width: 6em;">${length}</div>
        <span data-tip="编辑道路" class="icon-pencil"></span>
        <span class="locks pointer ${
          route.lock ? "icon-lock" : "icon-lock-open inactive"
        }" onmouseover="showElementLockTip(event)"></span>
        <span data-tip="移除道路" class="icon-trash-empty"></span>
      </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  // update footer
  ensureEl("routesFooterNumber").innerHTML = `${filteredRoutes.length} / ${pack.routes.length}`;
  const averageLength = rn(mean(filteredRoutes.map(r => r.length)) || 0) || 0;
  ensureEl("routesFooterLength").innerHTML = `${averageLength * distanceScale} ${distanceUnitInput.value}`;

  // add listeners
  body.querySelectorAll("div.states").forEach(el => void el.on("mouseenter", routeHighlightOn));
  body.querySelectorAll("div.states").forEach(el => void el.on("mouseleave", routeHighlightOff));
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.on("click", zoomToRoute));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.on("click", openRouteEditor));
  body.querySelectorAll("div > span.locks").forEach(el => void el.on("click", toggleLockStatus));
  body.querySelectorAll("div > span.icon-trash-empty").forEach(el => void el.on("click", triggerRouteRemove));

  applySorting(ensureEl("routesHeader"));
}

function routeHighlightOn(event: Event): void {
  if (!layerIsOn("toggleRoutes")) toggleRoutes();
  const routeId = +(event.target as HTMLElement).dataset.id!;
  select("#routes")
    .select(`#route${routeId}`)
    .attr("stroke", "red")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "none");
}

function routeHighlightOff(e: Event): void {
  const routeId = +(e.target as HTMLElement).dataset.id!;
  select("#routes")
    .select(`#route${routeId}`)
    .attr("stroke", null)
    .attr("stroke-width", null)
    .attr("stroke-dasharray", null);
}

function zoomToRoute(this: HTMLElement): void {
  const routeId = +(this.parentNode as HTMLElement).dataset.id!;
  const route = select("#routes").select(`#route${routeId}`).node() as Element;
  highlightElement(route, 3);
}

function downloadRoutesData(): void {
  let data = "Id,Route,Group,Length\n"; // headers

  ensureEl("routesBody")
    .querySelectorAll<HTMLElement>(":scope > div")
    .forEach(el => {
      const d = el.dataset;
      const length = `${rn(+d.length! * distanceScale)} ${distanceUnitInput.value}`;
      data += `${[d.id, d.name, d.group, length].join(",")}\n`;
    });

  const name = `${getFileName("Routes")}.csv`;
  downloadFile(data, name);
}

function openRouteEditor(this: HTMLElement): void {
  const routeId = `route${(this.parentNode as HTMLElement).dataset.id}`;
  void Controllers.RouteEditor.open(routeId);
}

function toggleLockStatus(this: HTMLElement): void {
  const routeId = +(this.parentNode as HTMLElement).dataset.id!;
  const route = pack.routes.find((route: Route) => route.i === routeId);
  if (!route) return;

  route.lock = !route.lock;
  if (this.classList.contains("icon-lock")) {
    this.classList.remove("icon-lock");
    this.classList.add("icon-lock-open");
    this.classList.add("inactive");
  } else {
    this.classList.remove("icon-lock-open");
    this.classList.add("icon-lock");
    this.classList.remove("inactive");
  }
}

function toggleLockAll(): void {
  const allLocked = pack.routes.every((route: Route) => route.lock);

  pack.routes.forEach((route: Route) => {
    route.lock = !allLocked;
  });

  routesOverviewAddLines();
  ensureEl("routesLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
}

function triggerRouteRemove(this: HTMLElement): void {
  const routeId = +(this.parentNode as HTMLElement).dataset.id!;
  confirmationDialog({
    title: "移除道路",
    message: "确定要移除该道路吗？<br>此操作无法撤销",
    confirm: "移除",
    onConfirm: () => {
      const route = pack.routes.find((r: Route) => r.i === routeId) as Route;
      Routes.remove(route);
      routesOverviewAddLines();
    }
  });
}

function triggerAllRoutesRemove(): void {
  const toRemove = pack.routes.filter((route: Route) => !route.lock);
  if (!toRemove.length) {
    if (!pack.routes.length) {
      tip("没有可移除的道路", false, "error");
    } else {
      tip("所有道路已锁定。请解锁道路以移除，或使用「全部锁定」先解锁。", false, "error");
    }
    return;
  }

  const lockedCount = pack.routes.length - toRemove.length;
  alertMessage.innerHTML =
    lockedCount > 0
      ? /* html */ `移除所有<b>未锁定</b>的道路（${toRemove.length} 条）？<b>${lockedCount}</b> 条已锁定的道路将被保留。此操作无法撤销。`
      : /* html */ `确定要移除所有道路吗？此操作无法撤销`;

  $("#alert").dialog({
    resizable: false,
    title: lockedCount > 0 ? "移除未锁定道路" : "移除所有道路",
    buttons: {
      移除: function (this: any) {
        const routesToRemove = pack.routes.filter((route: Route) => !route.lock);
        if (!routesToRemove.length) {
          if (!pack.routes.length) {
            tip("没有可移除的道路", false, "error");
          } else {
            tip("所有道路现已锁定；未移除任何内容。", false, "error");
          }
          $(this).dialog("close");
          return;
        }
        for (const route of routesToRemove) {
          Routes.remove(route);
        }
        pack.cells.routes = Routes.buildLinks(pack.routes);
        routesOverviewAddLines();
        $(this).dialog("close");
      },
      取消: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

export const RoutesOverview = { open };
