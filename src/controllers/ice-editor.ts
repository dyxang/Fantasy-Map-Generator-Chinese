import { drag, select } from "d3";
import { destroyDialogIfExists, ensureEl, findGridCell, getPointer, parseTransform } from "../utils";

function open(element: SVGElement): void {
  if (customization) return;
  if (elSelected && element === elSelected.node()) return;

  closeDialogs(".stable");
  if (!layerIsOn("toggleIce")) toggleIce();

  elSelected = select<SVGElement, unknown>(element) as unknown as typeof elSelected;
  const id = +elSelected.attr("data-id");
  const iceElement = pack.ice.find(el => el.i === id);
  const isGlacier = elSelected.attr("type") === "glacier";
  const type = isGlacier ? "冰川" : "冰山";

  renderDialog();

  const randomizeBtn = ensureEl("iceRandomize");
  const sizeInput = ensureEl<HTMLInputElement>("iceSize");
  randomizeBtn.style.display = isGlacier ? "none" : "inline-block";
  sizeInput.style.display = isGlacier ? "none" : "inline-block";
  if (!isGlacier) sizeInput.value = String(iceElement && "size" in iceElement ? iceElement.size : "");

  select<SVGGElement, unknown>("#ice")
    .selectAll<SVGElement, unknown>("*")
    .classed("draggable", true)
    .call(drag<SVGElement, unknown>().on("drag", dragElement));

  $("#iceEditor").dialog({
    title: `编辑${type}`,
    resizable: false,
    position: { my: "center top+60", at: "top", of: "svg", collision: "fit" },
    close: closeEditor
  });
}

function renderDialog(): void {
  destroyDialogIfExists("iceEditor");

  const html = /* html */ `<div id="iceEditor" class="dialog">
    <button id="iceEditStyle" data-tip="在样式编辑器中编辑样式" class="icon-brush"></button>
    <button id="iceRandomize" data-tip="随机生成冰山形状" class="icon-shuffle"></button>
    <input id="iceSize" data-tip="更改冰山大小" type="range" min=".05" max="2" step=".01" />
    <button id="iceNew" data-tip="添加冰山（点击地图）" class="icon-plus"></button>
    <button id="iceRemove" data-tip="移除该元素" data-shortcut="Delete" class="icon-trash fastDelete"></button>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("iceEditStyle").on("click", () => editStyle("ice"));
  ensureEl("iceRandomize").on("click", randomizeShape);
  ensureEl<HTMLInputElement>("iceSize").on("input", changeSize);
  ensureEl("iceNew").on("click", toggleAdd);
  ensureEl("iceRemove").on("click", removeIce);
}

function randomizeShape(): void {
  const selectedId = +elSelected.attr("data-id");
  Ice.randomizeIcebergShape(selectedId);
  redrawIceberg(selectedId);
}

function changeSize(this: HTMLInputElement): void {
  const newSize = +this.value;
  const selectedId = +elSelected.attr("data-id");
  Ice.changeIcebergSize(selectedId, newSize);
  redrawIceberg(selectedId);
}

function toggleAdd(): void {
  const iceNewBtn = ensureEl("iceNew");
  iceNewBtn.classList.toggle("pressed");
  if (iceNewBtn.classList.contains("pressed")) {
    select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addIcebergOnClick);
    tip("点击地图以创建冰山。按住 Shift 可添加多个", true);
  } else {
    clearMainTip();
    select<SVGElement, unknown>("#viewbox").on("click", clicked).style("cursor", "default");
  }
}

function addIcebergOnClick(event: PointerEvent): void {
  const [x, y] = getPointer(event, select<SVGElement, unknown>("#viewbox").node());
  const i = findGridCell(x, y, grid);
  const size = +ensureEl<HTMLInputElement>("iceSize").value || 1;

  Ice.addIceberg(i, size);

  if (event.shiftKey === false) toggleAdd();
}

function removeIce(): void {
  const type = elSelected.attr("type") === "glacier" ? "冰川" : "冰山";
  alertMessage.innerHTML = /* html */ `确定要移除该${type}吗？`;
  $("#alert").dialog({
    resizable: false,
    title: `移除${type}`,
    buttons: {
      移除: function (this: HTMLElement) {
        $(this).dialog("close");
        Ice.removeIce(+elSelected.attr("data-id"));
        $("#iceEditor").dialog("close");
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function dragElement(this: SVGElement, event: any): void {
  const selectedId = +elSelected.attr("data-id");
  const initialTransform = parseTransform(this.getAttribute("transform") ?? "");
  const dx = +initialTransform[0] - event.x;
  const dy = +initialTransform[1] - event.y;

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const x = dragEvent.x;
    const y = dragEvent.y;
    this.setAttribute("transform", `translate(${dx + x},${dy + y})`);

    // Store offset for visual positioning; actual geometry stays in points
    const iceData = pack.ice.find(el => el.i === selectedId);
    if (iceData) iceData.offset = [dx + x, dy + y];
  });
}

function closeEditor(): void {
  select<SVGGElement, unknown>("#ice")
    .selectAll<SVGElement, unknown>("*")
    .classed("draggable", false)
    .call(drag<SVGElement, unknown>().on("drag", null));
  clearMainTip();
  ensureEl("iceNew").classList.remove("pressed");
  unselect();
  destroyDialogIfExists("iceEditor");
}

export const IceEditor = { open };
