import { color, drag, select } from "d3";
import { Controllers } from "@/controllers";
import type { Burg } from "../generators/burgs-generator";
import type { Deal, Market } from "../generators/markets-generator";
import { highlightMarketOff, highlightMarketOn } from "../renderers/draw-markets";
import {
  ensureEl,
  findAllCellsInRadius,
  findClosestCell,
  formatPrice,
  getIsolines,
  getPointer,
  getVertexPath,
  rn
} from "../utils";

// Working copy of pack.cells.market mutated during manual assignment; applied on commit.
let marketsWorking: Uint16Array | null = null;
let marketsManualHistory: Uint16Array[] = [];

function open(): void {
  if (customization) return;
  closeDialogs("#marketsOverview, .stable");
  if (!layerIsOn("toggleMarketsLayer")) toggleMarketsLayer();

  renderDialog();
  marketsOverviewAddLines();

  $("#marketsOverview").dialog({
    title: "市场总览",
    resizable: false,
    width: "auto",
    close: closeMarketsOverview,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  document.getElementById("marketsOverview")?.remove();
  const editorHtml = /* html */ `<div id="marketsOverview" class="dialog stable">
      <div id="marketsOverviewHeader" class="header" style="grid-template-columns: 1.6em 7.2em 8em 3.5em 4.5em 6.5em 6.4em 6em 6em 1.2em;">
        <div></div>
        <div data-tip="市场中心城镇名称。点击排序" class="sortable alphabetically" data-sortby="market" style="margin-left:0">市场&nbsp;</div>
        <div data-tip="所属国家。点击排序" class="sortable alphabetically" data-sortby="owner">所有者&nbsp;</div>
        <div data-tip="市场领土中的单元格数。点击排序" class="sortable" data-sortby="cells">单元格&nbsp;</div>
        <div data-tip="市场领土中的城镇数。点击排序" class="sortable hide" data-sortby="burgs">城镇&nbsp;</div>
        <div data-tip="所有货物总库存。点击排序" class="sortable hide" data-sortby="stock">库存&nbsp;</div>
        <div data-tip="销售总收入。点击排序" class="sortable hide" data-sortby="sales">销售&nbsp;</div>
        <div data-tip="采购总支出。点击排序" class="sortable hide" data-sortby="buys">采购&nbsp;</div>
        <div data-tip="市场价值：净贸易流量加未售库存价值减去税。点击排序" class="sortable hide icon-sort-number-down" data-sortby="value">价值&nbsp;</div>
        <div></div>
      </div>
      <div id="marketsOverviewBody" class="table" data-type="absolute" style="max-height:40em; cursor:pointer"></div>
      <div id="marketsOverviewFooter" class="totalLine">
        <div data-tip="市场总数" style="margin-left:5px">市场:&nbsp;<span id="marketsOverviewFooterMarkets">0</span></div>
        <div data-tip="每个市场平均销售总收入" style="margin-left:12px">平均销售:&nbsp;<span id="marketsOverviewFooterSales">0</span></div>
        <div data-tip="每个市场平均采购支出" style="margin-left:12px">平均采购:&nbsp;<span id="marketsOverviewFooterBuys">0</span></div>
        <div data-tip="每个市场平均市场价值" style="margin-left:12px">平均价值:&nbsp;<span id="marketsOverviewFooterValue">0</span></div>
      </div>
      <div id="marketsOverviewBottom">
        <button id="marketsOverviewRefresh" data-tip="刷新总览" class="icon-cw"></button>
        <button id="marketsOverviewPercentage" data-tip="切换百分比/绝对值视图" class="icon-percent"></button>
        <button id="marketsOverviewCompare" data-tip="跨市场对比货物库存" class="icon-chart-bar"></button>
        <button id="marketsOverviewExport" data-tip="将市场数据保存为 CSV 文件" class="icon-download"></button>
        <slider-input id="marketsBrush" min="1" max="100" value="15" data-tip="更改笔刷大小。快捷键：+ / ] 增大；- / [ 减小" style="display: none;"></slider-input>
        <button id="marketsManually" data-tip="手动重新分配市场领土" class="icon-brush"></button>
        <div id="marketsManuallyButtons" style="display: none">
          <button id="marketsManuallyUndo" data-tip="撤销上次笔刷" class="icon-ccw"></button>
          <button id="marketsManuallyApply" data-tip="应用分配" class="icon-check"></button>
          <button id="marketsManuallyCancel" data-tip="取消分配" class="icon-cancel"></button>
        </div>
        <button id="marketsAdd" data-tip="添加新市场。点击地图上的城镇。按住 Shift 添加多个" class="icon-plus"></button>
        <button id="marketsRegenerate" data-tip="重新生成市场及其领土" class="icon-arrows-cw"></button>
        <button id="marketsRegenerateProduction" data-tip="重新生成生产和贸易交易" class="icon-retweet"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  applySortingByHeader("marketsOverviewHeader");

  ensureEl("marketsOverviewRefresh").on("click", marketsOverviewAddLines);
  ensureEl("marketsOverviewExport").on("click", downloadMarketsCsv);
  ensureEl("marketsOverviewCompare").on("click", () => Controllers.ComparePrices.open());
  ensureEl("marketsOverviewPercentage").on("click", togglePercentageMode);
  ensureEl("marketsManually").on("click", () => {
    if (customization === 15) exitMarketsManualAssignment(false);
    else enterMarketsManualAssignment();
  });
  ensureEl("marketsManuallyUndo").on("click", undoMarketsManualStep);
  ensureEl("marketsManuallyApply").on("click", () => exitMarketsManualAssignment(true));
  ensureEl("marketsManuallyCancel").on("click", () => exitMarketsManualAssignment(false));
  ensureEl("marketsAdd").on("click", () => {
    if (customization === 16) exitAddMarketMode();
    else enterAddMarketMode();
  });
  ensureEl("marketsRegenerate").on("click", regenerateMarkets);
  ensureEl("marketsRegenerateProduction").on("click", regenerateProduction);
  ensureEl("marketsOverviewBody").on("click", (ev: Event) => {
    const target = ev.target as HTMLElement;

    const fillBox = target.closest<HTMLElement>("fill-box");
    if (fillBox) {
      const row = fillBox.closest<HTMLElement>(".states.market");
      const marketId = row ? +row.dataset.id! : 0;
      // marketId 0 is the "No market" row — it has no color to edit
      if (marketId) marketChangeFill(fillBox, marketId);
      return;
    }

    if (target.classList.contains("icon-trash-empty")) {
      const line = target.closest<HTMLElement>(".states.market");
      if (!line) return;
      confirmRemoveMarket(+line.dataset.id!);
      return;
    }

    const line = target.closest<HTMLElement>(".states.market");
    if (!line) return;
    const marketId = +line.dataset.id!;

    if (customization === 15) {
      ensureEl("marketsOverviewBody")
        .querySelector<HTMLElement>(".states.market.selected")
        ?.classList.remove("selected");
      line.classList.add("selected");
    } else if (marketId) {
      // marketId 0 is the non-editable "No market" summary row — no detail dialog
      Controllers.MarketOverview.open(marketId);
    }
  });
}

function marketsOverviewAddLines(): void {
  const markets = pack.markets;
  const body = ensureEl("marketsOverviewBody");

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
  }

  if (!markets.length) {
    body.innerHTML = "无可用市场";
    updateFooter(0, 0, 0, 0);
    return;
  }

  let lines = "";
  let totalSales = 0;
  let totalBuys = 0;
  let totalValue = 0;

  for (const market of markets) {
    const centerName = Markets.getName(market);
    const ownerName = getOwnerStateName(market);
    const cells = getMarketCells(market.i);
    const burgs = getMarketBurgs(market.i);
    const stock = rn(getMarketTotalStock(market), 2);
    const { sales, buys, value } = getMarketFinancials(market);

    totalSales += sales;
    totalBuys += buys;
    totalValue += value;

    lines += /*html*/ `<div class="states market" data-id="${market.i}"
        data-market="${centerName}" data-owner="${ownerName}"
        data-cells="${cells}" data-burgs="${burgs}"
        data-stock="${stock}" data-sales="${sales}" data-buys="${buys}" data-value="${value}">
      <fill-box fill="${market.color}"></fill-box>
      <div data-tip="市场名称。点击查看详情" class="marketName" style="width:7em">${centerName}</div>
      <div data-tip="所属国家" class="marketOwner" style="width:8em">${ownerName}</div>
      <div data-tip="市场领土中的单元格数" data-type="cells" class="marketCells" style="width:3.5em">${cells}</div>
      <div data-tip="市场领土中的城镇数" data-type="burgs" class="marketBurgs hide" style="width:3.5em">${burgs}</div>
      <div data-tip="此市场中所有货物的总库存" data-type="stock" class="marketStock hide" style="width:5em">${stock}</div>
      <div data-tip="销售总收入" data-type="sales" class="marketSales hide" style="width:6em">${formatPrice(rn(sales))}</div>
      <div data-tip="采购总支出" data-type="buys" class="marketBuysCol hide" style="width:6em">${formatPrice(rn(buys))}</div>
      <div data-tip="市场价值：净贸易流量加未售库存价值减去税" data-type="value" class="marketValue hide" style="width:6em">${formatPrice(rn(value))}</div>
      <span data-tip="移除该市场" class="icon-trash-empty hiddenIcon hide" style="visibility:hidden"></span>
    </div>`;
  }

  lines += renderNoMarketRow();

  body.innerHTML = lines;

  body.querySelectorAll<HTMLElement>(".states.market").forEach(row => {
    const marketId = row.dataset.id!;
    if (marketId === "0") return; // "No market" row: not a real market, no hover highlight
    row.on("mouseenter", () => highlightMarketOn(marketId));
    row.on("mouseleave", () => highlightMarketOff(marketId));
  });

  const count = markets.length;
  updateFooter(
    count,
    count ? rn(totalSales / count, 2) : 0,
    count ? rn(totalBuys / count, 2) : 0,
    count ? rn(totalValue / count, 2) : 0
  );
  applySorting(ensureEl("marketsOverviewHeader"));

  $("#marketsOverview").dialog({ width: fitContent() });
}

function enterMarketsManualAssignment(): void {
  if (!layerIsOn("toggleMarketsLayer")) toggleMarketsLayer();
  customization = 15;
  marketsManualHistory = [];

  document.getElementById("marketsTemp")?.remove();
  select("#markets").append("g").attr("id", "marketsTemp").style("fill-opacity", "0.7");
  marketsWorking = Uint16Array.from(pack.cells.market);
  renderMarketsTemp();

  document.querySelectorAll<HTMLElement>("#marketsOverviewBottom > button").forEach(b => {
    b.style.display = "none";
  });
  ensureEl("marketsManuallyButtons").style.display = "block";
  ensureEl("marketsBrush").style.display = "inline-block";
  ensureEl("marketsManually").classList.add("pressed");
  ensureEl("marketsOverviewFooter").style.display = "none";

  ensureEl("marketsOverviewHeader").style.gridTemplateColumns = "1.6em 7.2em 8em 3.5em";
  ensureEl("marketsOverview")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });

  tip('点击市场行（或"无市场"）以选中，然后在地图上拖动以重绘领地', true);

  const firstRow = ensureEl("marketsOverviewBody").querySelector<HTMLElement>('.states.market:not([data-id="0"])');
  if (firstRow) firstRow.classList.add("selected");

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", selectMarketOnMapClick)
    .call(drag<SVGElement, unknown>().on("start", startMarketsBrushDrag))
    .on("touchmove mousemove", onMarketsBrushMove);

  $("#marketsOverview").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });
}

function saveMarketsManualSnapshot(): void {
  if (marketsWorking) marketsManualHistory.push(Uint16Array.from(marketsWorking));
}

function renderNoMarketRow(): string {
  const cells = getMarketCells(0);
  const burgs = getMarketBurgs(0);
  return /*html*/ `<div class="states market" data-id="0"  data-market="无市场" data-owner="" data-cells="${cells}" data-burgs="${burgs}" data-stock="0" data-sales="0" data-buys="0" data-value="0">
    <fill-box fill="none" data-tip="未分配到市场的单元格"></fill-box>
    <div data-tip="无市场的单元格；其城镇被排除在生产之外" class="marketName" style="width:7em">无市场</div>
    <div class="marketOwner" style="width:8em">—</div>
    <div data-tip="无市场的单元格数" data-type="cells" class="marketCells" style="width:3.5em">${cells}</div>
    <div data-tip="无市场的城镇数" data-type="burgs" class="marketBurgs hide" style="width:3.5em">${burgs}</div>
    <div data-type="stock" class="marketStock hide" style="width:5em">—</div>
    <div data-type="sales" class="marketSales hide" style="width:6em">—</div>
    <div data-type="buys" class="marketBuysCol hide" style="width:6em">—</div>
    <div data-type="value" class="marketValue hide" style="width:6em">—</div>
    <span class="hide" style="width:1.2em"></span>
  </div>`;
}

function selectMarketOnMapClick(this: SVGElement, event: MouseEvent): void {
  const [x, y] = getPointer(event, this);
  const cellId = findCell(x, y);
  if (cellId === undefined) return;

  const marketId = (marketsWorking ?? pack.cells.market)[cellId];

  const body = ensureEl("marketsOverviewBody");
  body.querySelector<HTMLElement>(".states.market.selected")?.classList.remove("selected");
  body.querySelector<HTMLElement>(`.states.market[data-id="${marketId}"]`)?.classList.add("selected");
}

function startMarketsBrushDrag(this: SVGElement, event: any): void {
  const selectedRow = ensureEl("marketsOverviewBody").querySelector<HTMLElement>(".states.market.selected");
  if (!selectedRow) return;
  const marketId = +selectedRow.dataset.id!;
  // marketId 0 = "no market" (erase assignment); any other id must be an existing market.
  if (marketId !== 0 && !Markets.get(marketId)) return;

  saveMarketsManualSnapshot();
  const r = +ensureEl<HTMLInputElement>("marketsBrush").value;

  event.on("drag", (dragEvent: any) => {
    if (!dragEvent.dx && !dragEvent.dy) return;
    const [x, y] = getPointer(dragEvent, this);
    moveCircle(x, y, r);

    const found = r > 5 ? findAllCellsInRadius(x, y, r, pack) : [findClosestCell(x, y, Infinity, pack)];
    const selection = found.filter(cellId => cellId !== undefined);
    if (!selection.length) return;
    paintMarketCells(selection, marketId);
  });
}

function paintMarketCells(selection: number[], targetMarketId: number) {
  if (!marketsWorking) return;

  const affected = new Set<number>([targetMarketId]);
  let changed = false;
  for (const cellId of selection) {
    const prev = marketsWorking[cellId];
    if (prev === targetMarketId) continue;
    if (prev) affected.add(prev); // previous owner loses a cell
    marketsWorking[cellId] = targetMarketId;
    changed = true;
  }

  if (changed) updateMarketTempPaths(affected);
}

// Render every market's territory as a single combined path (one DOM node per market).
function renderMarketsTemp(): void {
  const temp = document.getElementById("marketsTemp");
  if (!temp || !marketsWorking) return;

  const working = marketsWorking;
  const isolines = getIsolines(pack, cellId => working[cellId] || null, { fill: true });
  temp.innerHTML = pack.markets
    .map(market => `<path data-market="${market.i}" fill="${market.color}" d="${isolines[market.i]?.fill || ""}"/>`)
    .join("");
}

// Recompute the combined path only for the markets whose territory changed.
function updateMarketTempPaths(marketIds: Iterable<number>): void {
  const temp = document.getElementById("marketsTemp");
  if (!temp || !marketsWorking) return;

  const cellsByMarket = new Map<number, number[]>();
  for (const id of marketIds) cellsByMarket.set(id, []);

  for (let cellId = 0; cellId < marketsWorking.length; cellId++) {
    const cells = cellsByMarket.get(marketsWorking[cellId]);
    if (cells) cells.push(cellId);
  }

  for (const [marketId, cells] of cellsByMarket) {
    if (!marketId) continue; // market 0 = "no market": those cells are left unpainted
    const d = cells.length ? getVertexPath(cells, pack) : "";
    setMarketTempPath(temp, marketId, d);
  }
}

function setMarketTempPath(temp: HTMLElement, marketId: number, d: string): void {
  let path = temp.querySelector<SVGPathElement>(`path[data-market="${marketId}"]`);
  if (!path) {
    path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("data-market", String(marketId));
    const market = Markets.get(marketId);
    if (market) path.setAttribute("fill", market.color);
    temp.appendChild(path);
  }
  path.setAttribute("d", d);
}

function onMarketsBrushMove(this: SVGElement, event: MouseEvent): void {
  showMainTip();
  const [x, y] = getPointer(event, this);
  const r = +ensureEl<HTMLInputElement>("marketsBrush").value;
  moveCircle(x, y, r);
}

function undoMarketsManualStep(): void {
  if (!marketsManualHistory.length) return;
  marketsWorking = marketsManualHistory.pop()!;
  renderMarketsTemp();
}

function exitMarketsManualAssignment(apply: boolean): void {
  customization = 0;

  if (apply && marketsWorking) {
    for (let cellId = 0; cellId < marketsWorking.length; cellId++) {
      const marketId = marketsWorking[cellId];
      pack.cells.market[cellId] = marketId;
      const burgId = pack.cells.burg[cellId];
      if (burgId) (pack.burgs as Burg[])[burgId].market = marketId;
    }
  }

  marketsWorking = null;
  marketsManualHistory = [];
  document.getElementById("marketsTemp")?.remove();

  ensureEl("marketsOverviewHeader").style.gridTemplateColumns = "1.6em 7.2em 8em 3.5em 4.5em 6.5em 6.4em 6em 6em 1.2em";
  ensureEl("marketsOverview")
    .querySelectorAll(".hide")
    .forEach(el => void el.classList.remove("hidden"));
  ensureEl("marketsOverviewFooter").style.display = "block";

  document.querySelectorAll<HTMLElement>("#marketsOverviewBottom > button").forEach(b => {
    b.style.display = "";
  });
  ensureEl("marketsManuallyButtons").style.display = "none";
  ensureEl("marketsBrush").style.display = "none";
  ensureEl("marketsManually").classList.remove("pressed");
  ensureEl("marketsOverviewBody").querySelector<HTMLElement>(".states.market.selected")?.classList.remove("selected");

  restoreDefaultEvents();
  clearMainTip();
  removeCircle();

  if (apply) {
    drawMarketsLayer();
    marketsOverviewAddLines();
  }

  $("#marketsOverview").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });
}

function enterAddMarketMode(): void {
  customization = 16;
  ensureEl("marketsAdd").classList.add("pressed");
  tip("点击地图上的城镇以在那里创建新市场。按住 Shift 可添加多个", true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addMarketOnClick);
}

function exitAddMarketMode(): void {
  customization = 0;
  ensureEl("marketsAdd").classList.remove("pressed");
  restoreDefaultEvents();
  clearMainTip();
}

function addMarketOnClick(this: SVGElement, ev: MouseEvent): void {
  const [x, y] = getPointer(ev, this);
  const cellId = findCell(x, y);
  if (cellId === undefined) return;

  const burgId = pack.cells.burg[cellId];
  if (!burgId) {
    tip("点击城镇以创建新市场——此处未找到城镇", false, "error");
    return;
  }

  const newMarket = Markets.addMarket(burgId);
  if (!newMarket) return;

  if (!ev.shiftKey) exitAddMarketMode();

  if (layerIsOn("toggleMarketsLayer")) drawMarketsLayer();
  marketsOverviewAddLines();
}

function confirmRemoveMarket(marketId: number): void {
  const market = Markets.get(marketId);
  if (!market) return;
  const name = Markets.getName(market);

  confirmationDialog({
    title: "移除市场",
    message: `确定要移除市场"${name}"吗？<br>此操作无法撤销`,
    confirm: "移除",
    onConfirm: () => {
      Markets.removeMarket(marketId);
      if (layerIsOn("toggleMarketsLayer")) drawMarketsLayer();
      marketsOverviewAddLines();
    }
  });
}

function marketChangeFill(fillBox: HTMLElement, marketId: number): void {
  const market = Markets.get(marketId);
  if (!market) return;

  const callback = (newFill: string) => {
    (fillBox as unknown as { fill: string }).fill = newFill;
    market.color = newFill;
    applyMarketColor(marketId, newFill);
  };

  openPicker(market.color, callback);
}

// Recolor a single market's rendered shapes in place, matching draw-markets output.
function applyMarketColor(marketId: number, fill: string): void {
  const strokeColor = color(fill)?.darker().hex() || "#000";

  const group = document.getElementById(`market${marketId}`);
  if (group) {
    group.querySelector<SVGPathElement>("path.fill")?.setAttribute("fill", fill);
    group.querySelector<SVGPathElement>("path.border")?.setAttribute("stroke", strokeColor);
    const circle = group.querySelector<SVGCircleElement>("circle");
    if (circle) {
      circle.setAttribute("fill", fill);
      circle.setAttribute("stroke", strokeColor);
    }
  }

  document.querySelector<SVGPathElement>(`#marketsTemp path[data-market="${marketId}"]`)?.setAttribute("fill", fill);
}

function getMarketTotalStock(market: Market): number {
  return Object.values(market.goods).reduce((sum, g) => sum + (g.stock || 0), 0);
}

function getMarketCells(marketId: number): number {
  const marketArr = pack.cells.market;
  if (!marketArr) return 0;
  let count = 0;
  for (let i = 0; i < marketArr.length; i++) {
    if (marketArr[i] === marketId) count++;
  }
  return count;
}

function getMarketBurgs(marketId: number): number {
  const marketArr = pack.cells.market;
  if (!marketArr) return 0;
  return (pack.burgs as Burg[]).filter(b => b.i && !b.removed && marketArr[b.cell] === marketId).length;
}

function getMarketFinancials(market: Market): {
  sales: number;
  buys: number;
  value: number;
} {
  const marketId = market.i;
  const deals: Deal[] = (pack.deals || []).filter(
    (deal: Deal) =>
      (deal.sellerType === "market" && deal.seller === marketId) ||
      (deal.buyerType === "market" && deal.buyer === marketId)
  );
  let sales = 0;
  let buys = 0;
  let tax = 0;

  for (const deal of deals) {
    const amount = deal.units * deal.price;
    const marketIsSeller = deal.sellerType === "market" && deal.seller === marketId;
    if (marketIsSeller) {
      sales += amount;
      tax += deal.tax || 0;
    } else {
      buys += amount;
    }
  }

  const stockValue = Object.values(market.goods).reduce((sum, g) => sum + (g.stock || 0) * (g.price || 0), 0);

  return {
    sales: rn(sales, 2),
    buys: rn(buys, 2),
    value: rn(buys - sales + stockValue - tax, 2)
  };
}

function togglePercentageMode(): void {
  const body = ensureEl("marketsOverviewBody");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const rows = Array.from(body.querySelectorAll<HTMLElement>(":scope > div"));
    const totals: Record<string, number> = {};
    const numericTypes = ["cells", "burgs", "stock", "sales", "buys", "value"];
    for (const type of numericTypes) {
      totals[type] = rows.reduce((sum, row) => sum + (+row.dataset[type]! || 0), 0);
    }
    rows.forEach(row => {
      row.querySelectorAll<HTMLElement>("div[data-type]").forEach(cell => {
        const type = cell.dataset.type!;
        const val = +row.dataset[type]! || 0;
        cell.textContent = totals[type] ? `${rn((val / totals[type]) * 100, 2)}%` : "0%";
      });
    });
  } else {
    body.dataset.type = "absolute";
    marketsOverviewAddLines();
  }
}

function updateFooter(count: number, avgSales: number, avgBuys: number, avgValue: number): void {
  ensureEl("marketsOverviewFooterMarkets").innerHTML = String(count);
  ensureEl("marketsOverviewFooterSales").innerHTML = formatPrice(avgSales);
  ensureEl("marketsOverviewFooterBuys").innerHTML = formatPrice(avgBuys);
  ensureEl("marketsOverviewFooterValue").innerHTML = formatPrice(avgValue);
}

function getOwnerStateName(market: Market): string {
  const center = pack.burgs[market.centerBurgId];
  if (!center) return "未知";
  if (!center.state) return "独立";
  return pack.states[center.state]?.name || `国家 ${center.state}`;
}

function regenerateMarkets() {
  confirmationDialog({
    title: "重新生成市场",
    message: /* html */ `确定要重新生成市场及其领土吗？
      <label style="display:flex; align-items:center; gap:.4em; margin-top:.6em;">
        <input id="marketsRegenerateProductionToggle" type="checkbox" class="native" checked />
        重新生成生产和贸易
      </label>`,
    confirm: "重新生成",
    onConfirm: () => {
      const regenProduction = ensureEl<HTMLInputElement>("marketsRegenerateProductionToggle").checked;
      window.regenerateMarkets();
      if (regenProduction) window.regenerateProduction();
    }
  });
}

function regenerateProduction() {
  confirmationDialog({
    title: "重新生成生产",
    message: "确定要为所有货物重新生成生产和贸易吗？生成将基于当前货物设置和奖励货物分布",
    confirm: "重新生成",
    onConfirm: window.regenerateProduction
  });
}

function downloadMarketsCsv(): void {
  let csv = "Market,Owner,Cells,Burgs,Total Stock,Sales,Buys,Value\n";
  for (const market of pack.markets) {
    const { sales, buys, value } = getMarketFinancials(market);
    const cells = getMarketCells(market.i);
    const burgs = getMarketBurgs(market.i);
    const stock = rn(getMarketTotalStock(market), 2);
    csv += `${[Markets.getName(market), getOwnerStateName(market), cells, burgs, stock, sales, buys, value].join(",")}\n`;
  }
  downloadFile(csv, `${getFileName("Markets_Overview")}.csv`);
}

function closeMarketsOverview(): void {
  if (customization === 15) exitMarketsManualAssignment(false);
  if (customization === 16) exitAddMarketMode();
  $("#marketsOverview").dialog("destroy");
  ensureEl("marketsOverview").remove();
}

export const MarketsOverview = { open };
