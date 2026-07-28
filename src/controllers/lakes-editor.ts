import { drag, mean, min, polygonArea, polygonLength, type Selection, select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Feature } from "@/generators/features";
import { drawBiomes } from "@/renderers/draw-biomes";
import { drawBorders } from "@/renderers/draw-borders";
import { getFeaturePath } from "@/renderers/draw-features";
import { getArea, getAreaUnit, speak } from "@/utils";
import { destroyDialogIfExists, ensureEl, findEl, getPackPolygon, rand, rn, si, unique } from "../utils";
import { getHeight } from "../utils/unitUtils";

let selectedLake: Selection<SVGElement, unknown, HTMLElement, unknown>;

function open(element: SVGElement): void {
  if (customization) return;
  closeDialogs(".stable");
  if (layerIsOn("toggleCells")) toggleCells();

  renderDialog();

  select("#debug").append("g").attr("id", "vertices");
  selectedLake = select<SVGElement, unknown>(element) as unknown as typeof selectedLake;
  updateLakeValues();
  selectLakeGroup();
  drawLakeVertices();
  select<SVGElement, unknown>("#viewbox").on("touchmove mousemove", null);

  $("#lakeEditor").dialog({
    title: "编辑湖泊",
    resizable: false,
    position: { my: "center top+20", at: "top", of: "svg", collision: "fit" },
    close: closeLakesEditor
  });
}

function renderDialog(): void {
  destroyDialogIfExists("lakeEditor");

  const html = /* html */ `<div id="lakeEditor" class="dialog">
    <div id="lakeBody" style="padding-bottom: 0.3em">
      <div>
        <div class="label" style="width: 4.8em">名称：</div>
        <span id="lakeNameCulture" data-tip="生成特定文化的湖泊名称" class="icon-book pointer"></span>
        <span id="lakeNameRandom" data-tip="生成随机湖泊名称" class="icon-globe pointer"></span>
        <input id="lakeName" data-tip="输入以重命名湖泊" autocorrect="off" spellcheck="false" />
        <span id="lakeNameSpeak" data-tip="朗读名称。可在选项中更改语音和语言" class="speaker">🔊</span>
      </div>
      <div data-tip="输入以更改湖泊类型（分组）">
        <div class="label" style="width: 4.8em">类型：</div>
        <span id="lakeGroupRemove" data-tip="移除该分组" class="icon-trash-empty pointer"></span>
        <span id="lakeGroupAdd" data-tip="为湖泊创建新类型（分组）" class="icon-plus pointer"></span>
        <select id="lakeGroup" data-tip="选择湖泊类型（分组）"></select>
        <input id="lakeGroupName" placeholder="输入名称" data-tip="为新分组提供名称" style="display: none" />
        <span id="lakeEditStyle" data-tip="在样式编辑器中编辑湖泊分组样式" class="icon-brush pointer"></span>
      </div>
      <div data-tip="湖泊面积（所选单位）">
        <div class="label">面积：</div>
        <input id="lakeArea" disabled />
      </div>
      <div data-tip="湖泊岸线长度（所选单位）">
        <div class="label">岸线长度：</div>
        <input id="lakeShoreLength" disabled />
      </div>
      <div data-tip="湖泊海拔（所选单位）">
        <div class="label">海拔：</div>
        <input id="lakeElevation" disabled />
      </div>
      <div data-tip="湖泊平均深度（所选单位）">
        <div class="label">平均深度：</div>
        <input id="lakeAverageDepth" disabled />
      </div>
      <div data-tip="湖泊最大深度（所选单位）">
        <div class="label">最大深度：</div>
        <input id="lakeMaxDepth" disabled />
      </div>
      <div data-tip="湖泊供水量。若供水 > 蒸发且有出湖口，则湖水为淡水。若供水极低，则湖泊干涸">
        <div class="label">供水：</div>
        <input id="lakeFlux" disabled />
      </div>
      <div data-tip="湖面蒸发量。若蒸发 > 供水，则湖水为咸水。若差值较大，则湖泊干涸">
        <div class="label">蒸发：</div>
        <input id="lakeEvaporation" disabled />
      </div>
      <div data-tip="湖泊入湖河流数">
        <div class="label">入湖河流：</div>
        <input id="lakeInlets" disabled />
      </div>
      <div data-tip="湖泊出湖河流">
        <div class="label">出湖河流：</div>
        <input id="lakeOutlet" disabled />
      </div>
    </div>
    <div id="lakeBottom">
      <button id="lakeLegend" data-tip="编辑湖泊的自由文本注释（图例）" class="icon-edit"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("lakeName").on("input", changeName);
  ensureEl("lakeNameSpeak").on("click", () => speak(ensureEl<HTMLInputElement>("lakeName").value));
  ensureEl("lakeNameCulture").on("click", generateNameCulture);
  ensureEl("lakeNameRandom").on("click", generateNameRandom);
  ensureEl("lakeGroup").on("change", changeLakeGroup);
  ensureEl("lakeGroupAdd").on("click", toggleNewGroupInput);
  ensureEl("lakeGroupName").on("change", createNewGroup);
  ensureEl("lakeGroupRemove").on("click", removeLakeGroup);
  ensureEl("lakeEditStyle").on("click", editGroupStyle);
  ensureEl("lakeLegend").on("click", editLakeLegend);
}

function getLake(): Feature {
  const lakeId = +selectedLake.attr("data-f");
  return pack.features.find(feature => feature.i === lakeId) as Feature;
}

function updateLakeValues(): void {
  const { cells, vertices, rivers } = pack;

  const l = getLake();
  ensureEl<HTMLInputElement>("lakeName").value = l.name;
  ensureEl<HTMLInputElement>("lakeArea").value = `${si(getArea(l.area))} ${getAreaUnit()}`;

  const length = polygonLength(l.vertices.map(v => vertices.p[v] as [number, number]));
  ensureEl<HTMLInputElement>("lakeShoreLength").value = `${si(length * distanceScale)} ${distanceUnitInput.value}`;

  const lakeCells = Array.from(cells.i.filter(i => cells.f[i] === l.i));
  const heights = lakeCells.map(i => cells.h[i]);

  ensureEl<HTMLInputElement>("lakeElevation").value = getHeight(l.height);
  ensureEl<HTMLInputElement>("lakeAverageDepth").value = getHeight(mean(heights) ?? 0, true);
  ensureEl<HTMLInputElement>("lakeMaxDepth").value = getHeight(min(heights) ?? 0, true);

  ensureEl<HTMLInputElement>("lakeFlux").value = String(l.flux);
  ensureEl<HTMLInputElement>("lakeEvaporation").value = String(l.evaporation);

  const inlets = l.inlets?.map(inlet => rivers.find(river => river.i === inlet)?.name);
  const outlet = l.outlet ? rivers.find(river => river.i === l.outlet)?.name : "no";
  const inletsInput = ensureEl<HTMLInputElement>("lakeInlets");
  inletsInput.value = inlets ? String(inlets.length) : "no";
  inletsInput.title = inlets ? inlets.join(", ") : "";
  ensureEl<HTMLInputElement>("lakeOutlet").value = outlet ?? "no";
}

function drawLakeVertices(): void {
  const vertices = getLake().vertices;

  const neibCells: number[] = unique(vertices.flatMap(v => pack.vertices.c[v]));
  select("#debug")
    .select("#vertices")
    .selectAll<SVGPolygonElement, number>("polygon")
    .data(neibCells)
    .enter()
    .append("polygon")
    .attr("points", (d: number) => getPackPolygon(d, pack))
    .attr("data-c", (d: number) => d);

  select<SVGGElement, unknown>("#debug")
    .select("#vertices")
    .selectAll<SVGCircleElement, number>("circle")
    .data(vertices)
    .enter()
    .append("circle")
    .attr("cx", (d: number) => pack.vertices.p[d][0])
    .attr("cy", (d: number) => pack.vertices.p[d][1])
    .attr("r", 0.4)
    .attr("data-v", (d: number) => d)
    .call(drag<SVGCircleElement, number>().on("drag", handleVertexDrag).on("end", handleVertexDragEnd))
    .on("mousemove", () => tip("拖动以移动顶点。请仅用于微调！编辑高度图以更改实际单元格高度"));
}

function handleVertexDrag(this: SVGCircleElement, event: any, vertexId: number): void {
  const x = rn(event.x, 2);
  const y = rn(event.y, 2);
  this.setAttribute("cx", String(x));
  this.setAttribute("cy", String(y));

  pack.vertices.p[vertexId] = [x, y];

  const feature = getLake();

  // update lake path
  select<SVGElement, unknown>("#deftemp")
    .select(`#featurePaths > path#feature_${feature.i}`)
    .attr("d", getFeaturePath(feature));

  // update area
  const points = feature.vertices.map(vertex => pack.vertices.p[vertex] as [number, number]);
  feature.area = Math.abs(polygonArea(points));
  ensureEl<HTMLInputElement>("lakeArea").value = `${si(getArea(feature.area))} ${getAreaUnit()}`;

  // update cell
  select("#debug")
    .select("#vertices")
    .selectAll<SVGPolygonElement, number>("polygon")
    .attr("points", d => getPackPolygon(d, pack));
}

function handleVertexDragEnd(): void {
  if (layerIsOn("toggleStates")) drawStates();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleBiomes")) drawBiomes();
  if (layerIsOn("toggleReligions")) drawReligions();
  if (layerIsOn("toggleCultures")) drawCultures();
}

function changeName(this: HTMLInputElement): void {
  getLake().name = this.value;
}

function generateNameCulture(): void {
  const lake = getLake();
  lake.name = ensureEl<HTMLInputElement>("lakeName").value = Lakes.getName(lake);
}

function generateNameRandom(): void {
  const lake = getLake();
  lake.name = ensureEl<HTMLInputElement>("lakeName").value = Names.getBase(rand(Names.nameBases.length - 1));
}

function selectLakeGroup(): void {
  const lake = getLake();

  const groupSelect = ensureEl<HTMLSelectElement>("lakeGroup");
  groupSelect.options.length = 0; // remove all options
  select<SVGGElement, unknown>("#lakes")
    .selectAll<SVGGElement, unknown>("g")
    .each(function () {
      groupSelect.options.add(new Option(this.id, this.id, false, this.id === lake.group));
    });
}

function changeLakeGroup(this: HTMLSelectElement): void {
  ensureEl(this.value).appendChild(selectedLake.node()!);
  getLake().group = this.value;
}

function toggleNewGroupInput(): void {
  const lakeGroupName = ensureEl("lakeGroupName");
  const lakeGroup = ensureEl("lakeGroup");
  if (lakeGroupName.style.display === "none") {
    lakeGroupName.style.display = "inline-block";
    lakeGroupName.focus();
    lakeGroup.style.display = "none";
  } else {
    lakeGroupName.style.display = "none";
    lakeGroup.style.display = "inline-block";
  }
}

function createNewGroup(this: HTMLInputElement): void {
  if (!this.value) {
    tip("请提供有效的组名");
    return;
  }
  const group = this.value
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^\w\s]/gi, "");

  if (findEl(group)) {
    tip("具有此 id 的元素已存在。请提供唯一的名称", false, "error");
    return;
  }

  if (Number.isFinite(+group.charAt(0))) {
    tip("组名应以字母开头", false, "error");
    return;
  }

  // just rename if only 1 element left
  const oldGroup = selectedLake.node()!.parentNode as SVGGElement;
  const basic = ["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"].includes(oldGroup.id);
  if (!basic && oldGroup.childElementCount === 1) {
    ensureEl<HTMLSelectElement>("lakeGroup").selectedOptions[0].remove();
    ensureEl<HTMLSelectElement>("lakeGroup").options.add(new Option(group, group, false, true));
    oldGroup.id = group;
    toggleNewGroupInput();
    ensureEl<HTMLInputElement>("lakeGroupName").value = "";
    return;
  }

  // create a new group
  const newGroup = (selectedLake.node()!.parentNode as SVGGElement).cloneNode(false) as SVGGElement;
  ensureEl("lakes").appendChild(newGroup);
  newGroup.id = group;
  ensureEl<HTMLSelectElement>("lakeGroup").options.add(new Option(group, group, false, true));
  ensureEl(group).appendChild(selectedLake.node()!);

  toggleNewGroupInput();
  ensureEl<HTMLInputElement>("lakeGroupName").value = "";
}

function removeLakeGroup(): void {
  const group = (selectedLake.node()!.parentNode as SVGGElement).id;
  if (["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"].includes(group)) {
    tip("这是默认组之一，无法移除", false, "error");
    return;
  }

  const count = (selectedLake.node()!.parentNode as SVGGElement).childElementCount;
  alertMessage.innerHTML = /* html */ `确定要移除该分组吗？该分组的所有湖泊（${count}）都将转为淡水湖`;
  $("#alert").dialog({
    resizable: false,
    title: "移除湖泊组",
    width: "26em",
    buttons: {
      移除: function (this: HTMLElement) {
        $(this).dialog("close");
        const freshwater = ensureEl("freshwater");
        const groupEl = ensureEl(group);
        while (groupEl.childNodes.length) {
          freshwater.appendChild(groupEl.childNodes[0]);
        }
        groupEl.remove();
        ensureEl<HTMLSelectElement>("lakeGroup").selectedOptions[0].remove();
        ensureEl<HTMLSelectElement>("lakeGroup").value = "freshwater";
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function editGroupStyle(): void {
  const g = (selectedLake.node()!.parentNode as SVGGElement).id;
  editStyle("lakes", g);
}

function editLakeLegend(): void {
  const id = selectedLake.attr("id");
  void Controllers.NotesEditor.open(id, `${getLake().name} ${ensureEl<HTMLSelectElement>("lakeGroup").value} lake`);
}

function closeLakesEditor(): void {
  select("#debug").select("#vertices").remove();
  applyDefaultViewboxEvents();
  destroyDialogIfExists("lakeEditor");
}

export const LakesEditor = { open };
