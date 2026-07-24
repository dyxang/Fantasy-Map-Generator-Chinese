import { drag, select } from "d3";
import { Controllers } from "@/controllers";
import type { River } from "@/generators/river-generator";
import type { Point } from "@/generators/voronoi";
import { destroyDialogIfExists, ensureEl, findEl, getPackPolygon, getPointer, getSegmentId, rand, rn } from "../utils";

function open(id: string): void {
  if (customization) return;
  if (elSelected && id === elSelected.attr("id")) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  ensureEl("toggleCells").dataset.forced = String(+!layerIsOn("toggleCells"));
  if (!layerIsOn("toggleCells")) toggleCells();

  elSelected = select<SVGElement, unknown>(`#${id}`).on("click", addControlPoint);

  tip("拖动控制点可改变河流走向。点击控制点可移除。点击河流可添加控制点。如需大幅修改请新建一条河流", true);
  select("#debug").append("g").attr("id", "controlCells");
  select("#debug").append("g").attr("id", "controlPoints");

  renderDialog();
  updateRiverData();

  const river = getRiver();
  const { cells, points } = river;
  const riverPoints = Rivers.getRiverPoints(cells, points ?? null);
  drawControlPoints(riverPoints);
  drawCells(cells);

  $("#riverEditor").dialog({
    title: "编辑河流",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeRiverEditor
  });
}

function renderDialog(): void {
  destroyDialogIfExists("riverEditor");

  const html = /* html */ `<div id="riverEditor" class="dialog">
    <div id="riverBody" style="padding-bottom: 0.3em">
      <div>
        <div class="label" style="width: 4.8em">名称：</div>
        <span id="riverNameCulture" data-tip="生成特定文化的河流名称" class="icon-book pointer"></span>
        <span id="riverNameRandom" data-tip="生成河流的随机名称" class="icon-globe pointer"></span>
        <input id="riverName" data-tip="输入以重命名河流" autocorrect="off" spellcheck="false" />
        <span id="riverNameSpeak" data-tip="朗读名称。可在选项中更改语音和语言" class="speaker">🔊</span>
      </div>
      <div data-tip="输入以更改河流类型（例如：fork、creek、river、brook、stream）">
        <div class="label">类型：</div>
        <input id="riverType" autocorrect="off" spellcheck="false" />
      </div>
      <div data-tip="选择父级河流">
        <div class="label">父级河流：</div>
        <select id="riverMainstem"></select>
      </div>
      <div data-tip="河流流域（分水岭）">
        <div class="label">流域：</div>
        <input id="riverBasin" disabled />
      </div>
      <div data-tip="河流流量（水力）">
        <div class="label">流量：</div>
        <input id="riverDischarge" disabled />
      </div>
      <div data-tip="河流长度（所选单位）">
        <div class="label">长度：</div>
        <input id="riverLength" disabled />
      </div>
      <div data-tip="河流入海口宽度（所选单位）">
        <div class="label">入海口宽度：</div>
        <input id="riverWidth" disabled />
      </div>
      <div data-tip="河流源头附加宽度。默认值为 0">
        <div class="label">源头宽度：</div>
        <input id="riverSourceWidth" type="number" min="0" max="3" step=".01" />
      </div>
      <div data-tip="河流宽度倍数。默认值为 1">
        <div class="label">宽度倍数：</div>
        <input id="riverWidthFactor" type="number" min=".1" max="4" step=".1" />
      </div>
    </div>
    <div id="riverBottom">
      <button id="riverCreateSelectingCells" data-tip="通过选择河流单元格创建新河流" class="icon-map-pin"></button>
      <button id="riverEditStyle" data-tip="在样式编辑器中编辑所有河流样式" class="icon-brush"></button>
      <button id="riverElevationProfile" data-tip="显示河流的高程剖面" class="icon-chart-area"></button>
      <button id="riverLegend" data-tip="编辑河流的自由文本注释（图例）" class="icon-edit"></button>
      <button id="riverRemove" data-tip="移除河流" data-shortcut="Delete" class="icon-trash fastDelete"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riverCreateSelectingCells").on("click", openRiverCreator);
  ensureEl("riverEditStyle").on("click", openRiverStyle);
  ensureEl("riverElevationProfile").on("click", showRiverElevationProfile);
  ensureEl("riverLegend").on("click", editRiverLegend);
  ensureEl("riverRemove").on("click", removeRiver);
  ensureEl("riverName").on("input", changeName);
  ensureEl("riverNameSpeak").on("click", () => speak(ensureEl<HTMLInputElement>("riverName").value));
  ensureEl("riverType").on("input", changeType);
  ensureEl("riverNameCulture").on("click", generateNameCulture);
  ensureEl("riverNameRandom").on("click", generateNameRandom);
  ensureEl("riverMainstem").on("change", changeParent);
  ensureEl("riverSourceWidth").on("input", changeSourceWidth);
  ensureEl("riverWidthFactor").on("input", changeWidthFactor);
}

function openRiverCreator(): void {
  void Controllers.RiverCreator.open();
}

function openRiverStyle(): void {
  editStyle("rivers");
}

function getRiver(): River {
  const riverId = +elSelected.attr("id").slice(5);
  return pack.rivers.find((r: River) => r.i === riverId) as River;
}

function updateRiverData(): void {
  const r = getRiver();

  ensureEl<HTMLInputElement>("riverName").value = r.name;
  ensureEl<HTMLInputElement>("riverType").value = r.type;

  const parentSelect = ensureEl<HTMLSelectElement>("riverMainstem");
  parentSelect.options.length = 0;
  const parent = r.parent || r.i;
  const sortedRivers = pack.rivers.slice().sort((a: River, b: River) => (a.name > b.name ? 1 : -1));
  sortedRivers.forEach((river: River) => {
    const opt = new Option(river.name, String(river.i), false, river.i === parent);
    parentSelect.options.add(opt);
  });
  ensureEl<HTMLInputElement>("riverBasin").value = pack.rivers.find((river: River) => river.i === r.basin)!.name;

  ensureEl<HTMLInputElement>("riverDischarge").value = `${r.discharge} m³/s`;
  ensureEl<HTMLInputElement>("riverSourceWidth").value = String(r.sourceWidth);
  ensureEl<HTMLInputElement>("riverWidthFactor").value = String(r.widthFactor);

  updateRiverLength(r);
  updateRiverWidth(r);
}

function updateRiverLength(river: River): void {
  river.length = rn((elSelected.node() as SVGGeometryElement).getTotalLength() / 2, 2);
  const lengthUI = `${rn(river.length * distanceScale)} ${distanceUnitInput.value}`;
  ensureEl<HTMLInputElement>("riverLength").value = lengthUI;
}

function updateRiverWidth(river: River): void {
  const { cells, discharge, widthFactor, sourceWidth } = river;
  const meanderedPoints = Rivers.addMeandering(cells);
  river.width = Rivers.getWidth(
    Rivers.getOffset({
      flux: discharge,
      pointIndex: meanderedPoints.length,
      widthFactor,
      startingWidth: sourceWidth
    })
  );

  const width = `${rn(river.width * distanceScale, 3)} ${distanceUnitInput.value}`;
  ensureEl<HTMLInputElement>("riverWidth").value = width;
}

function drawControlPoints(points: Point[]): void {
  select<SVGGElement, unknown>("#controlPoints")
    .selectAll<SVGCircleElement, Point>("circle")
    .data(points)
    .join("circle")
    .attr("cx", (d: Point) => d[0])
    .attr("cy", (d: Point) => d[1])
    .attr("r", 0.6)
    .call(drag<SVGCircleElement, Point>().on("start", dragControlPoint))
    .on("click", removeControlPoint);
}

function drawCells(cells: number[]): void {
  const validCells = [...new Set(cells)].filter(i => pack.cells.i[i]);
  select<SVGGElement, unknown>("#controlCells")
    .selectAll(`polygon`)
    .data(validCells)
    .join("polygon")
    .attr("points", (d: number) => getPackPolygon(d, pack));
}

function dragControlPoint(event: any): void {
  const { r, fl } = pack.cells;
  const river = getRiver();

  const { x: x0, y: y0 } = event;
  const initCell = findCell(x0, y0);

  let movedToCell: number | null = null;

  event.on("drag", function (this: any, dragEvent: any) {
    const { x, y } = dragEvent;
    const currentCell = findCell(x, y);

    movedToCell = initCell !== currentCell ? currentCell! : null;

    this.setAttribute("cx", x);
    this.setAttribute("cy", y);
    this.__data__ = [rn(x, 1), rn(y, 1)];
    redrawRiver();
    drawCells(river.cells);
  });

  event.on("end", () => {
    if (movedToCell && !r[movedToCell]) {
      // swap river data
      r[initCell!] = 0;
      r[movedToCell] = river.i;
      const sourceFlux = fl[initCell!];
      fl[initCell!] = fl[movedToCell];
      fl[movedToCell] = sourceFlux;
      redrawRiver();
    }
  });
}

function redrawRiver(): void {
  const river = getRiver();
  river.points = select("#controlPoints").selectAll("*").data() as Point[];
  river.cells = river.points.map(([x, y]) => findCell(x, y)!);

  const meanderedPoints = Rivers.addMeandering(river.cells, river.points);
  const path = Rivers.getRiverPath(meanderedPoints, river.widthFactor, river.sourceWidth);
  elSelected.attr("d", path);

  updateRiverLength(river);
  if (findEl("elevationProfile")) showRiverElevationProfile();
}

function addControlPoint(this: any, event: any): void {
  const [x, y] = getPointer(event, this);
  const point: Point = [rn(x, 1), rn(y, 1)];

  const river = getRiver();
  if (!river.points) river.points = select("#controlPoints").selectAll("*").data() as Point[];

  const index = getSegmentId(river.points, point, 2);
  river.points.splice(index, 0, point);
  drawControlPoints(river.points);
  redrawRiver();
}

function removeControlPoint(this: any): void {
  this.remove();
  redrawRiver();

  const { cells } = getRiver();
  drawCells(cells);
}

function changeName(this: HTMLInputElement): void {
  getRiver().name = this.value;
}

function changeType(this: HTMLInputElement): void {
  getRiver().type = this.value;
}

function generateNameCulture(): void {
  const r = getRiver();
  r.name = ensureEl<HTMLInputElement>("riverName").value = Rivers.getName(r.mouth);
}

function generateNameRandom(): void {
  const r = getRiver();
  if (r) r.name = ensureEl<HTMLInputElement>("riverName").value = Names.getBase(rand(nameBases.length - 1));
}

function changeParent(this: HTMLInputElement): void {
  const r = getRiver();
  r.parent = +this.value;
  r.basin = pack.rivers.find((river: River) => river.i === r.parent)!.basin;
  ensureEl<HTMLInputElement>("riverBasin").value = pack.rivers.find((river: River) => river.i === r.basin)!.name;
}

function changeSourceWidth(this: HTMLInputElement): void {
  const river = getRiver();
  river.sourceWidth = +this.value;
  updateRiverWidth(river);
  redrawRiver();
}

function changeWidthFactor(this: HTMLInputElement): void {
  const river = getRiver();
  river.widthFactor = +this.value;
  updateRiverWidth(river);
  redrawRiver();
}

function showRiverElevationProfile(): void {
  const points = (select("#controlPoints").selectAll("*").data() as Point[]).map(([x, y]) => findCell(x, y)!);
  const river = getRiver();
  const riverLen = rn(river.length * distanceScale);
  void Controllers.ElevationProfile.open(points, riverLen, true);
}

function editRiverLegend(): void {
  const id = elSelected.attr("id");
  const river = getRiver();
  void Controllers.NotesEditor.open(id, `${river.name} ${river.type}`);
}

function removeRiver(): void {
  alertMessage.innerHTML = "确定要移除该河流及其所有支流吗？";
  $("#alert").dialog({
    resizable: false,
    width: "22em",
    title: "移除河流及支流",
    buttons: {
      移除: function (this: any) {
        $(this).dialog("close");
        const river = +elSelected.attr("id").slice(5);
        Rivers.remove(river);
        elSelected.remove();
        $("#riverEditor").dialog("close");
      },
      取消: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

function closeRiverEditor(): void {
  select("#controlPoints").remove();
  select("#controlCells").remove();

  elSelected.on("click", null);
  unselect();
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && layerIsOn("toggleCells")) toggleCells();

  destroyDialogIfExists("riverEditor");
}

export const RiverEditor = { open };
