import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { applySorting, applySortingByHeader } from "@/components/dialog/sorting";
import { clearMainTip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Marker } from "@/generators/markers-generator";
import { drawMarkers } from "@/renderers/draw-markers";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, getFileName, getLatitude, getLongitude } from "@/utils";
import { destroyDialogIfExists, ensureEl } from "../utils";

function open(): void {
  if (customization) return;
  closeDialogs("#markersOverview, .stable");
  if (!layerIsOn("toggleMarkers")) toggleMarkers();

  renderDialog();
  addLines();

  $("#markersOverview").dialog({
    title: "标记总览",
    resizable: false,
    width: "fit-content",
    close: closeMarkersOverview,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("markersOverview");

  const html = /* html */ `
    <div id="markersOverview" class="dialog stable">
      <div id="markersHeader" class="header" style="grid-template-columns: 15em 1em 3em">
        <div data-tip="点击按标记类型排序" class="sortable alphabetically" data-sortby="type">类型&nbsp;</div>
        <div
          id="markersInverPin"
          style="color: #6e5e66"
          data-tip="点击反转所有标记的固定状态"
          class="icon-pin pointer"
        ></div>
        <div
          id="markersInverLock"
          style="color: #6e5e66"
          data-tip="点击反转所有标记的锁定状态"
          class="icon-lock pointer"
        ></div>
      </div>
      <div id="markersBody" class="table"></div>
      <div>
        <label for="markersSearch" data-tip="按类型筛选">搜索：<input id="markersSearch" type="search" /></label>
      </div>
      <div id="markersFooter" class="totalLine">
        <div data-tip="标记数量">
          标记：<span id="markersFooterNumber">0</span> / <span id="markersFooterTotal">0</span>
        </div>
      </div>
      <div id="markersBottom">
        <button id="markersOverviewRefresh" data-tip="刷新总览界面" class="icon-cw"></button>
        <button id="markersRegenerate" data-tip="重新生成未锁定的标记" class="icon-shuffle"></button>
        <span id="markerTypeSelectorWrapper">
          <button id="markerTypeSelector" data-tip="选择新添加标记的标记类型。">❓</button>
          <div id="markerTypeSelectMenu"></div>
        </span>
        <button
          id="markersAddFromOverview"
          data-tip="添加新标记。按住 Shift 添加多个"
          class="icon-plus"
        ></button>
        <button id="markersGenerationConfig" data-tip="配置标记生成选项" class="icon-cog"></button>
        <button id="markersRemoveAll" data-tip="移除所有未锁定的标记" class="icon-trash"></button>
        <button id="markersExport" data-tip="将标记数据保存为文本文件 (.csv)" class="icon-download"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  applySortingByHeader("markersHeader");

  ensureEl("markersBody").addEventListener("click", handleLineClick);
  ensureEl("markersInverPin").addEventListener("click", invertPin);
  ensureEl("markersInverLock").addEventListener("click", invertLock);
  ensureEl("markersOverviewRefresh").addEventListener("click", addLines);
  ensureEl("markersRegenerate").addEventListener("click", regenerateMarkers);
  ensureEl("markerTypeSelector").addEventListener("click", toggleMarkerTypeMenu);
  ensureEl("markersAddFromOverview").addEventListener("click", () => void Controllers.MarkerCreator.toggle());
  ensureEl("markersGenerationConfig").addEventListener("click", () => void Controllers.MarkersSettings.open());
  ensureEl("markersRemoveAll").addEventListener("click", triggerRemoveAll);
  ensureEl("markersExport").addEventListener("click", exportMarkers);
  ensureEl("markersSearch").addEventListener("input", addLines);

  populateMarkerTypeMenu();
}

function closeMarkersOverview(): void {
  document.getElementById("addMarker")?.classList.remove("pressed");
  document.getElementById("markerAdd")?.classList.remove("pressed");
  applyDefaultViewboxEvents();
  clearMainTip();

  $("#markersOverview").dialog("destroy");
  ensureEl("markersOverview").remove();
}

function regenerateMarkers(): void {
  Markers.regenerate();
  if (layerIsOn("toggleMarkers")) drawMarkers();
  addLines();
}

function populateMarkerTypeMenu(): void {
  const menu = ensureEl("markerTypeSelectMenu");
  menu.innerHTML = "";

  const types = [{ type: "empty", icon: "❓" }, ...Markers.getConfig()];
  types.forEach(({ icon, type }) => {
    const option = document.createElement("button");
    option.textContent = `${icon} ${type}`;
    menu.appendChild(option);

    option.addEventListener("click", () => {
      ensureEl("markerTypeSelector").textContent = icon;
      ensureEl<HTMLInputElement>("addedMarkerType").value = type;
      changeMarkerType();
      toggleMarkerTypeMenu();
    });
  });
}

function handleLineClick(ev: MouseEvent): void {
  const el = ev.target as HTMLElement;
  const i = +(el.parentNode as HTMLElement).dataset.id!;

  if (el.classList.contains("icon-pencil")) return void openEditor(i);
  if (el.classList.contains("icon-target")) return void highlightMarker(i);
  if (el.classList.contains("icon-pin")) return void pinMarker(el, i);
  if (el.classList.contains("locks")) return void toggleLockStatus(el, i);
  if (el.classList.contains("icon-trash-empty")) return void triggerRemove(i);
}

function addLines(): void {
  let markers: Marker[] = pack.markers;

  const searchText = ensureEl<HTMLInputElement>("markersSearch").value.toLowerCase().trim();
  if (searchText) {
    markers = markers.filter(marker => {
      const type = (marker.type || "").toLowerCase();
      return type.includes(searchText);
    });
  }

  const lines = markers
    .map(({ i, type, icon, pinned, lock }) => {
      return /* html */ `
        <div class="states" data-id=${i} data-type="${type}">
          ${
            icon.startsWith("http") || icon.startsWith("data:image")
              ? `<img src="${icon}" data-tip="标记图标" style="width:1.2em; height:1.2em; vertical-align: middle;">`
              : `<span data-tip="标记图标" style="width:1.2em">${icon}</span>`
          }
          <div data-tip="标记类型" style="width:10em">${type}</div>
          <span style="padding-right:.1em" data-tip="编辑标记" class="icon-pencil"></span>
          <span style="padding-right:.1em" data-tip="定位该标记" class="icon-target"></span>
          <span style="padding-right:.1em" data-tip="固定标记（仅显示已固定的标记）" class="icon-pin ${
            pinned ? "" : "inactive"
          }" pointer"></span>
          <span style="padding-right:.1em" class="locks pointer ${
            lock ? "icon-lock" : "icon-lock-open inactive"
          }" onmouseover="showElementLockTip(event)"></span>
          <span data-tip="移除标记" class="icon-trash-empty"></span>
        </div>`;
    })
    .join("");

  const body = ensureEl("markersBody");
  body.innerHTML = lines;
  ensureEl("markersFooterNumber").innerText = String(markers.length);
  ensureEl("markersFooterTotal").innerText = String(pack.markers.length);

  applySorting(ensureEl("markersHeader"));
}

function invertPin(): void {
  let anyPinned = false;

  pack.markers.forEach(marker => {
    const pinned = !marker.pinned;
    if (pinned) {
      marker.pinned = true;
      anyPinned = true;
    } else delete marker.pinned;
  });

  ensureEl("markers").setAttribute("pinned", anyPinned ? "1" : "");
  drawMarkers();
  addLines();
}

function invertLock(): void {
  pack.markers = pack.markers.map(marker => ({ ...marker, lock: !marker.lock }));
  addLines();
}

function openEditor(i: number): void {
  const marker = pack.markers.find(marker => marker.i === i);
  if (!marker) return;

  const { x, y } = marker;
  zoomTo(x, y, 8, 2000);
  void Controllers.MarkersEditor.open(i);
}

function highlightMarker(i: number): void {
  const marker = document.getElementById(`marker${i}`);
  if (!marker) return;
  highlightElement(marker, 2);
}

function pinMarker(el: HTMLElement, i: number): void {
  const marker = pack.markers.find(marker => marker.i === i);
  if (!marker) return;

  const markerGroup = ensureEl("markers");
  if (marker.pinned) {
    delete marker.pinned;
    const anyPinned = pack.markers.some(marker => marker.pinned);
    if (!anyPinned) markerGroup.removeAttribute("pinned");
  } else {
    marker.pinned = true;
    markerGroup.setAttribute("pinned", "1");
  }
  el.classList.toggle("inactive");
  drawMarkers();
}

function toggleLockStatus(el: HTMLElement, i: number): void {
  const marker = pack.markers.find(marker => marker.i === i);
  if (!marker) return;

  if (marker.lock) {
    delete marker.lock;
    el.className = "locks pointer icon-lock-open inactive";
  } else {
    marker.lock = true;
    el.className = "locks pointer icon-lock";
  }
}

function triggerRemove(i: number): void {
  confirmationDialog({
    title: "移除标记",
    message: "确定要移除该标记吗？此操作无法撤销",
    confirm: "移除",
    onConfirm: () => removeMarker(i)
  });
}

function toggleMarkerTypeMenu(): void {
  ensureEl("markerTypeSelectMenu").classList.toggle("visible");
}

function toggleAddMarker(): void {
  void Controllers.MarkerCreator.toggle();
}

function changeMarkerType(): void {
  if (!ensureEl("markersAddFromOverview").classList.contains("pressed")) toggleAddMarker();
}

function removeMarker(i: number): void {
  notes = notes.filter(note => note.id !== `marker${i}`);
  pack.markers = pack.markers.filter(marker => marker.i !== i);
  document.getElementById(`marker${i}`)?.remove();
  addLines();
}

function triggerRemoveAll(): void {
  confirmationDialog({
    title: "移除所有标记",
    message: "确定要移除所有未锁定的标记吗？此操作无法撤销",
    confirm: "全部移除",
    onConfirm: removeAllMarkers
  });
}

function removeAllMarkers(): void {
  pack.markers = pack.markers.filter(({ i, lock }) => {
    if (lock) return true;

    const id = `marker${i}`;
    document.getElementById(id)?.remove();
    notes = notes.filter(note => note.id !== id);
    return false;
  });

  addLines();
}

function exportMarkers(): void {
  const headers = "Id,Type,Icon,Name,Note,X,Y,Latitude,Longitude\n";
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;

  const body = pack.markers.map(marker => {
    const { i, type, icon, x, y } = marker;

    const note = notes.find(note => note.id === `marker${i}`);
    const name = note ? quote(note.name) : "Unknown";
    const legend = note ? quote(note.legend) : "";

    const lat = getLatitude(y, mapCoordinates, graphHeight, 2);
    const lon = getLongitude(x, mapCoordinates, graphWidth, 2);

    return [i, type, icon, name, legend, x, y, lat, lon].join(",");
  });

  const data = headers + body.join("\n");
  const fileName = `${getFileName("Markers")}.csv`;
  downloadFile(data, fileName);
}

export const MarkersOverview = { open };
