import { drag, quadtree, range, type Selection, select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { clearMainTip, showMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { moveCircle, removeCircle } from "@/renderers/overlays/brush-circle";
import { destroyDialogIfExists, ensureEl, findAllInQuadtree, getPointer, rn } from "../utils";

let selectedRelief: Selection<SVGElement, unknown, HTMLElement, unknown>;

function open(element: SVGElement): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRelief")) toggleRelief();

  select<SVGGElement, unknown>("#terrain")
    .selectAll<SVGUseElement, unknown>("use")
    .call(drag<SVGUseElement, unknown>().on("drag", dragReliefIcon))
    .classed("draggable", true);
  selectedRelief = select<SVGElement, unknown>(element) as unknown as typeof selectedRelief;

  renderDialog();
  restoreEditMode();
  updateReliefIconSelected();
  updateReliefSizeInput();

  $("#reliefEditor").dialog({
    title: "编辑地形图标",
    resizable: false,
    width: "27em",
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeReliefEditor
  });
}

function renderDialog(): void {
  destroyDialogIfExists("reliefEditor");
  const html = /* html */ `<div id="reliefEditor" class="dialog">
    <div id="reliefTools" data-tip="选择操作模式">
      <div class="reliefEditorLabel">模式：</div>
      <button id="reliefIndividual" data-tip="编辑单个所选图标" class="icon-info pressed"></button>
      <button id="reliefBulkAdd" data-tip="批量放置图标" class="icon-brush"></button>
      <button id="reliefBulkRemove" data-tip="批量移除图标" class="icon-eraser"></button>
      <div style="margin-left: 4.6em">图标集：</div>
      <select id="reliefEditorSet">
        <option value="simple">简单</option>
        <option value="colored">彩色</option>
        <option value="gray">灰度</option>
      </select>
    </div>
    <div id="reliefSizeDiv" data-tip="设置单个图标或批量放置的图标大小">
      <div class="reliefEditorLabel">大小：</div>
      <input
        id="reliefSize"
        oninput="reliefSizeNumber.value = this.value"
        type="range"
        min="2"
        max="50"
        value="5"
      />
      <input id="reliefSizeNumber" oninput="reliefSize.value = this.value" type="number" min="2" value="5" />
    </div>
    <div id="reliefRadiusDiv" data-tip="设置删除时图标放置的笔刷半径" style="display: none">
      <div class="reliefEditorLabel">半径：</div>
      <input
        id="reliefRadius"
        oninput="reliefRadiusNumber.value = this.value"
        type="range"
        min="1"
        max="100"
        value="15"
      />
      <input id="reliefRadiusNumber" oninput="reliefRadius.value = this.value" type="number" min="1" value="15" />
    </div>
    <div id="reliefSpacingDiv" data-tip="设置地形图标之间的间距" style="display: none">
      <div class="reliefEditorLabel">间距：</div>
      <input
        id="reliefSpacing"
        oninput="reliefSpacingNumber.value = this.value"
        type="range"
        min="2"
        max="20"
        value="5"
      />
      <input id="reliefSpacingNumber" oninput="reliefSpacing.value = this.value" type="number" min="2" value="5" />
    </div>
    <div id="reliefIconsDiv" data-tip="选择图标">
      <div data-type="simple" style="display: none">
        <svg data-type="#relief-mount-1" data-tip="选择山峰图标">
          <use href="#relief-mount-1" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-hill-1" data-tip="选择丘陵图标">
          <use href="#relief-hill-1" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-deciduous-1" data-tip="选择落叶树图标">
          <use href="#relief-deciduous-1" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-conifer-1" data-tip="选择针叶树图标">
          <use href="#relief-conifer-1" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-palm-1" data-tip="选择棕榈图标">
          <use href="#relief-palm-1" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-acacia-1" data-tip="选择金合欢图标">
          <use href="#relief-acacia-1" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-swamp-1" data-tip="选择沼泽图标">
          <use href="#relief-swamp-1" x="-50%" y="-50%" width="80" height="80"></use>
        </svg>
        <svg data-type="#relief-grass-1" data-tip="选择草地图标">
          <use href="#relief-grass-1" x="-100%" y="-100%" width="120" height="120"></use>
        </svg>
        <svg data-type="#relief-dune-1" data-tip="选择沙丘图标">
          <use href="#relief-dune-1" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
      </div>
      <div data-type="colored" style="display: none">
        <svg data-type="#relief-mount-2" data-tip="选择山峰图标">
          <use href="#relief-mount-2" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-3" data-tip="选择山峰图标">
          <use href="#relief-mount-3" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-4" data-tip="选择山峰图标">
          <use href="#relief-mount-4" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-5" data-tip="选择山峰图标">
          <use href="#relief-mount-5" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-6" data-tip="选择山峰图标">
          <use href="#relief-mount-6" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-7" data-tip="选择山峰图标">
          <use href="#relief-mount-7" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-1" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-1" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-2" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-2" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-3" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-3" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-4" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-4" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-5" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-5" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-6" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-6" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-vulcan-1" data-tip="选择火山图标">
          <use href="#relief-vulcan-1" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-vulcan-2" data-tip="选择火山图标">
          <use href="#relief-vulcan-2" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-vulcan-3" data-tip="选择火山图标">
          <use href="#relief-vulcan-3" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-hill-2" data-tip="选择丘陵图标">
          <use href="#relief-hill-2" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-hill-3" data-tip="选择丘陵图标">
          <use href="#relief-hill-3" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-hill-4" data-tip="选择丘陵图标">
          <use href="#relief-hill-4" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-hill-5" data-tip="选择丘陵图标">
          <use href="#relief-hill-5" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-dune-2" data-tip="选择沙丘图标">
          <use href="#relief-dune-2" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-deciduous-2" data-tip="选择落叶树图标">
          <use href="#relief-deciduous-2" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-deciduous-3" data-tip="选择落叶树图标">
          <use href="#relief-deciduous-3" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-conifer-2" data-tip="选择针叶树图标">
          <use href="#relief-conifer-2" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-coniferSnow-1" data-tip="选择雪松图标">
          <use href="#relief-coniferSnow-1" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-acacia-2" data-tip="选择金合欢图标">
          <use href="#relief-acacia-2" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-palm-2" data-tip="选择棕榈图标">
          <use href="#relief-palm-2" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-grass-2" data-tip="选择草地图标">
          <use href="#relief-grass-2" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-swamp-2" data-tip="选择沼泽图标">
          <use href="#relief-swamp-2" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-swamp-3" data-tip="选择沼泽图标">
          <use href="#relief-swamp-3" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-cactus-1" data-tip="选择仙人掌图标">
          <use href="#relief-cactus-1" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-cactus-2" data-tip="选择仙人掌图标">
          <use href="#relief-cactus-2" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-cactus-3" data-tip="选择仙人掌图标">
          <use href="#relief-cactus-3" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-deadTree-1" data-tip="选择枯树图标">
          <use href="#relief-deadTree-1" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-deadTree-2" data-tip="选择枯树图标">
          <use href="#relief-deadTree-2" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
      </div>
      <div data-type="gray" style="display: none">
        <svg data-type="#relief-mount-2-bw" data-tip="选择山峰图标">
          <use href="#relief-mount-2-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-3-bw" data-tip="选择山峰图标">
          <use href="#relief-mount-3-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-4-bw" data-tip="选择山峰图标">
          <use href="#relief-mount-4-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-5-bw" data-tip="选择山峰图标">
          <use href="#relief-mount-5-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-6-bw" data-tip="选择山峰图标">
          <use href="#relief-mount-6-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mount-7-bw" data-tip="选择山峰图标">
          <use href="#relief-mount-7-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-1-bw" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-1-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-2-bw" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-2-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-3-bw" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-3-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-4-bw" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-4-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-5-bw" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-5-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-mountSnow-6-bw" data-tip="选择雪山图标">
          <use href="#relief-mountSnow-6-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-vulcan-1-bw" data-tip="选择火山图标">
          <use href="#relief-vulcan-1-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-vulcan-2-bw" data-tip="选择火山图标">
          <use href="#relief-vulcan-2-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-vulcan-3-bw" data-tip="选择火山图标">
          <use href="#relief-vulcan-3-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-hill-2-bw" data-tip="选择丘陵图标">
          <use href="#relief-hill-2-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-hill-3-bw" data-tip="选择丘陵图标">
          <use href="#relief-hill-3-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-hill-4-bw" data-tip="选择丘陵图标">
          <use href="#relief-hill-4-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-hill-5-bw" data-tip="选择丘陵图标">
          <use href="#relief-hill-5-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-dune-2-bw" data-tip="选择沙丘图标">
          <use href="#relief-dune-2-bw" width="40" height="40"></use>
        </svg>
        <svg data-type="#relief-deciduous-2-bw" data-tip="选择落叶树图标">
          <use href="#relief-deciduous-2-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-deciduous-3-bw" data-tip="选择落叶树图标">
          <use href="#relief-deciduous-3-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-conifer-2-bw" data-tip="选择针叶树图标">
          <use href="#relief-conifer-2-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-coniferSnow-1-bw" data-tip="选择雪松图标">
          <use href="#relief-coniferSnow-1-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-acacia-2-bw" data-tip="选择金合欢图标">
          <use href="#relief-acacia-2-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-palm-2-bw" data-tip="选择棕榈图标">
          <use href="#relief-palm-2-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-grass-2-bw" data-tip="选择草地图标">
          <use href="#relief-grass-2-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-swamp-2-bw" data-tip="选择沼泽图标">
          <use href="#relief-swamp-2-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-swamp-3-bw" data-tip="选择沼泽图标">
          <use href="#relief-swamp-3-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-cactus-1-bw" data-tip="选择仙人掌图标">
          <use href="#relief-cactus-1-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-cactus-2-bw" data-tip="选择仙人掌图标">
          <use href="#relief-cactus-2-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-cactus-3-bw" data-tip="选择仙人掌图标">
          <use href="#relief-cactus-3-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-deadTree-1-bw" data-tip="选择枯树图标">
          <use href="#relief-deadTree-1-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
        <svg data-type="#relief-deadTree-2-bw" data-tip="选择枯树图标">
          <use href="#relief-deadTree-2-bw" x="-25%" y="-25%" width="60" height="60"></use>
        </svg>
      </div>
      <svg id="reliefIconsSeletionAny" data-tip="选择任意类型图标"><text x="50%" y="50%">任意</text></svg>
    </div>
    <div id="reliefBottom">
      <button id="reliefEditStyle" data-tip="在样式编辑器中编辑地形图标样式" class="icon-adjust"></button>
      <button id="reliefCopy" data-tip="复制所选地形图标" class="icon-clone"></button>
      <button id="reliefMoveFront" data-tip="将所选地形图标移至最前" class="icon-level-up"></button>
      <button id="reliefMoveBack" data-tip="将所选地形图标移至最后" class="icon-level-down"></button>
      <button
        id="reliefRemove"
        data-tip="移除所选地形图标或图标类型"
        data-shortcut="Delete"
        class="icon-trash fastDelete"
      ></button>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("reliefIndividual").on("click", enterIndividualMode);
  ensureEl("reliefBulkAdd").on("click", enterBulkAddMode);
  ensureEl("reliefBulkRemove").on("click", enterBulkRemoveMode);

  ensureEl("reliefSize").on("input", changeIconSize);
  ensureEl("reliefSizeNumber").on("input", changeIconSize);
  ensureEl("reliefEditorSet").on("change", changeIconsSet);
  ensureEl("reliefIconsDiv")
    .querySelectorAll("svg")
    .forEach(el => {
      el.addEventListener("click", changeIcon);
    });

  ensureEl("reliefEditStyle").on("click", () => editStyle("terrain"));
  ensureEl("reliefCopy").on("click", copyIcon);
  ensureEl("reliefMoveFront").on("click", () => selectedRelief.raise());
  ensureEl("reliefMoveBack").on("click", () => selectedRelief.lower());
  ensureEl("reliefRemove").on("click", removeIcon);
}

function dragReliefIcon(this: SVGUseElement, event: any): void {
  const dx = +this.getAttribute("x")! - event.x;
  const dy = +this.getAttribute("y")! - event.y;

  event.on("drag", function (this: SVGUseElement, dragEvent: any) {
    this.setAttribute("x", String(dx + dragEvent.x));
    this.setAttribute("y", String(dy + dragEvent.y));
  });
}

function restoreEditMode(): void {
  if (!ensureEl("reliefTools").querySelector("button.pressed")) enterIndividualMode();
  else if (ensureEl("reliefBulkAdd").classList.contains("pressed")) enterBulkAddMode();
  else if (ensureEl("reliefBulkRemove").classList.contains("pressed")) enterBulkRemoveMode();
}

function updateReliefIconSelected(): void {
  const type = selectedRelief.attr("href") || selectedRelief.attr("data-type");
  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  const button = reliefIconsDiv.querySelector(`svg[data-type='${type}']`);
  if (!button) return;

  reliefIconsDiv.querySelectorAll("svg.pressed").forEach(b => {
    b.classList.remove("pressed");
  });
  button.classList.add("pressed");
  reliefIconsDiv.querySelectorAll<HTMLElement>("div").forEach(b => {
    b.style.display = "none";
  });
  const parent = button.parentNode as HTMLElement;
  parent.style.display = "block";
  ensureEl<HTMLSelectElement>("reliefEditorSet").value = parent.dataset.type!;
}

function updateReliefSizeInput(): void {
  const size = +selectedRelief.attr("width");
  ensureEl<HTMLInputElement>("reliefSize").value = ensureEl<HTMLInputElement>("reliefSizeNumber").value = String(
    rn(size)
  );
}

function enterIndividualMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefIndividual").classList.add("pressed");

  ensureEl("reliefSizeDiv").style.display = "block";
  ensureEl("reliefRadiusDiv").style.display = "none";
  ensureEl("reliefSpacingDiv").style.display = "none";
  ensureEl("reliefIconsSeletionAny").style.display = "none";

  removeCircle();
  updateReliefSizeInput();
  applyDefaultViewboxEvents();
  clearMainTip();
}

function enterBulkAddMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefBulkAdd").classList.add("pressed");

  ensureEl("reliefSizeDiv").style.display = "block";
  ensureEl("reliefRadiusDiv").style.display = "block";
  ensureEl("reliefSpacingDiv").style.display = "block";
  ensureEl("reliefIconsSeletionAny").style.display = "none";

  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  const pressedType = reliefIconsDiv.querySelector("svg.pressed");
  if (pressedType?.id === "reliefIconsSeletionAny") {
    // if "any" is pressed, select first type
    ensureEl("reliefIconsSeletionAny").classList.remove("pressed");
    reliefIconsDiv.querySelector("svg")?.classList.add("pressed");
  }

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(drag<SVGElement, unknown>().on("start", dragToAdd))
    .on("touchmove mousemove", moveBrush);
  tip("拖动以在半径内放置地形图标", true);
}

function moveBrush(this: SVGElement, event: any): void {
  showMainTip();
  const point = getPointer(event, this);
  const radius = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  moveCircle(point[0], point[1], radius);
}

function dragToAdd(this: SVGElement, event: any): void {
  const pressed = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed");
  if (!pressed) {
    tip("请选择一个图标", false, "error");
    return;
  }

  const type = pressed.dataset.type!;
  const r = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  const spacing = +ensureEl<HTMLInputElement>("reliefSpacingNumber").value;
  const size = +ensureEl<HTMLInputElement>("reliefSizeNumber").value;

  // build a quadtree
  const tree = quadtree<[number, number, number?]>();
  const positions: number[] = [];
  select<SVGGElement, unknown>("#terrain")
    .selectAll<SVGUseElement, unknown>("use")
    .each(function () {
      const x = +this.getAttribute("x")! + +this.getAttribute("width")! / 2;
      const y = +this.getAttribute("y")! + +this.getAttribute("height")! / 2;
      tree.add([x, y, x]);
      const box = this.getBBox();
      positions.push(box.y + box.height);
    });

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const p = getPointer(dragEvent, this);
    moveCircle(p[0], p[1], r);

    range(Math.ceil(r / 10)).forEach(() => {
      const a = Math.PI * 2 * Math.random();
      const rad = r * Math.random();
      const cx = p[0] + rad * Math.cos(a);
      const cy = p[1] + rad * Math.sin(a);

      if (tree.find(cx, cy, spacing)) return; // too close to existing icon
      if (pack.cells.h[findCell(cx, cy)!] < 20) return; // on water cell

      const h = rn((size / 2) * (Math.random() * 0.4 + 0.8), 2);
      const x = rn(cx - h, 2);
      const y = rn(cy - h, 2);
      const z = y + h * 2;
      const s = rn(h * 2, 2);

      let nth = 1;
      while (positions[nth] && z > positions[nth]) {
        nth++;
      }

      tree.add([cx, cy]);
      positions.push(z);
      select<SVGGElement, unknown>("#terrain")
        .insert("use", `:nth-child(${nth})`)
        .attr("href", type)
        .attr("x", x)
        .attr("y", y)
        .attr("width", s)
        .attr("height", s);
    });
  });
}

function enterBulkRemoveMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefBulkRemove").classList.add("pressed");

  ensureEl("reliefSizeDiv").style.display = "none";
  ensureEl("reliefRadiusDiv").style.display = "block";
  ensureEl("reliefSpacingDiv").style.display = "none";
  ensureEl("reliefIconsSeletionAny").style.display = "inline-block";

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(drag<SVGElement, unknown>().on("start", dragToRemove))
    .on("touchmove mousemove", moveBrush);
  tip("拖动以移除半径内的地形图标", true);
}

function dragToRemove(this: SVGElement, event: any): void {
  const pressed = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed");
  if (!pressed) {
    tip("请选择一个图标", false, "error");
    return;
  }

  const r = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  const type = pressed.dataset.type;
  const terrainLayer = select<SVGGElement, unknown>("#terrain");
  const icons = type
    ? terrainLayer.selectAll<SVGUseElement, unknown>(`use[href='${type}']`)
    : terrainLayer.selectAll<SVGUseElement, unknown>("use");
  const tree = quadtree<[number, number, SVGUseElement]>();
  icons.each(function () {
    const x = +this.getAttribute("x")! + +this.getAttribute("width")! / 2;
    const y = +this.getAttribute("y")! + +this.getAttribute("height")! / 2;
    tree.add([x, y, this]);
  });

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const p = getPointer(dragEvent, this);
    moveCircle(p[0], p[1], r);
    findAllInQuadtree(p[0], p[1], r, tree).forEach((f: any) => {
      f[2].remove();
    });
  });
}

function changeIconSize(): void {
  const size = +ensureEl<HTMLInputElement>("reliefSizeNumber").value;
  if (!ensureEl("reliefIndividual").classList.contains("pressed")) return;

  const shift = (size - +selectedRelief.attr("width")) / 2;
  selectedRelief.attr("width", size).attr("height", size);
  const x = +selectedRelief.attr("x");
  const y = +selectedRelief.attr("y");
  selectedRelief.attr("x", x - shift).attr("y", y - shift);
}

function changeIconsSet(): void {
  const set = ensureEl<HTMLSelectElement>("reliefEditorSet").value;
  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  reliefIconsDiv.querySelectorAll<HTMLElement>("div").forEach(b => {
    b.style.display = "none";
  });
  reliefIconsDiv.querySelector<HTMLElement>(`div[data-type='${set}']`)!.style.display = "block";
}

function changeIcon(this: SVGElement): void {
  if (this.classList.contains("pressed")) return;

  ensureEl("reliefIconsDiv")
    .querySelectorAll("svg.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  this.classList.add("pressed");

  if (ensureEl("reliefIndividual").classList.contains("pressed")) {
    const type = this.dataset.type!;
    selectedRelief.attr("href", type);
  }
}

function copyIcon(): void {
  const node = selectedRelief.node()!;
  const parent = node.parentNode as SVGGElement;
  const copy = node.cloneNode(true) as SVGElement;

  let x = +selectedRelief.attr("x") - 3;
  let y = +selectedRelief.attr("y") - 3;
  while (parent.querySelector(`[x='${x}']`)) {
    x -= 3;
    y -= 3;
  }

  copy.setAttribute("x", String(x));
  copy.setAttribute("y", String(y));
  parent.insertBefore(copy, null);
}

function removeIcon(): void {
  let selection: typeof selectedRelief | null = null;
  const pressed = ensureEl("reliefTools").querySelector("button.pressed");
  if (pressed?.id === "reliefIndividual") {
    alertMessage.innerHTML = "确定要移除该图标吗？";
    selection = selectedRelief;
  } else {
    const type = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed")?.dataset.type;
    const terrainLayer = select<SVGGElement, unknown>("#terrain");
    selection = (type
      ? terrainLayer.selectAll(`use[href='${type}']`)
      : terrainLayer.selectAll("use")) as unknown as typeof selectedRelief;
    const size = selection.size();
    alertMessage.innerHTML = type ? `确定要移除所有 ${type} 图标（${size}）吗？` : `确定要移除所有图标（${size}）吗？`;
  }

  $("#alert").dialog({
    resizable: false,
    title: "移除地形图标",
    buttons: {
      移除: function (this: HTMLElement) {
        if (selection) selection.remove();
        $(this).dialog("close");
        $("#reliefEditor").dialog("close");
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function closeReliefEditor(): void {
  const wasUsingBrush = !ensureEl("reliefIndividual").classList.contains("pressed");
  select<SVGGElement, unknown>("#terrain")
    .selectAll<SVGUseElement, unknown>("use")
    .on(".drag", null)
    .classed("draggable", false);
  removeCircle();
  if (wasUsingBrush) applyDefaultViewboxEvents();
  clearMainTip();
  $("#reliefEditor").dialog("destroy");
  ensureEl("reliefEditor").remove();
}

export const ReliefEditor = { open };
