import { select } from "d3";
import { Controllers } from "@/controllers";
import type { Burg } from "../generators/burgs-generator";
import type { Market } from "../generators/markets-generator";
import { ensureEl, formatPrice, getPointer, rn } from "../utils";

let activeMarketId = 0;

function open(marketId: number): void {
  if (customization) return;

  const market = Markets.get(marketId);
  if (!market) {
    tip("无效市场。所选市场不存在", true, "error", 5000);
    return;
  }
  activeMarketId = marketId;

  closeDialogs("#marketOverview, .stable");

  renderDialog();
  marketOverviewAddLines();
  refreshNameInput(market);

  $("#marketOverview").dialog({
    title: `市场库存：${Markets.getName(market)}`,
    width: "auto",
    close: closeMarketOverview,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  document.getElementById("marketOverview")?.remove();
  const html = /* html */ `<div id="marketOverview" class="dialog stable">
      <div id="marketOverviewNameLine" style="display: flex; align-items: center; margin-bottom: 0.4em">
        <div class="label">名称：</div>
        <input
          id="marketOverviewName"
          data-tip="输入以重命名市场。清空字段将恢复默认名称"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em; margin-left: 0.3em;"
        />
        <span
          id="marketOverviewNameReset"
          data-tip="恢复为默认名称（中心城镇名称）"
          class="icon-ccw pointer"
          style="margin-left: 0.3em"
        ></span>
      </div>
      <div id="marketOverviewHeader" class="header" style="grid-template-columns: 2.5em 9em 5.5em 3.2em;">
        <div></div>
        <div data-tip="点击按货物排序" class="sortable alphabetically" data-sortby="good" style="margin-left:0">货物&nbsp;</div>
        <div data-tip="点击按库存排序" class="sortable icon-sort-number-down" data-sortby="stock">库存&nbsp;</div>
        <div data-tip="点击按价格排序" class="sortable" data-sortby="price">价格&nbsp;</div>
      </div>
      <div id="marketOverviewGoodsBody" class="table" style="max-height:40em"></div>
      <div id="marketOverviewSummary" class="totalLine"></div>
      <div id="marketOverviewInfo" style="margin-bottom: 0.3em"></div>
      <div id="marketOverviewBottom">
        <button id="marketOverviewRefresh" data-tip="刷新总览界面" class="icon-cw"></button>
        <button id="marketOverviewOpenDeals" data-tip="查看市场交易" class="icon-list-bullet"></button>
        <button
          id="marketOverviewRelocate"
          data-tip="迁移市场。点击地图上的城镇以移动市场中心"
          class="icon-map-pin"
        ></button>
        <button id="marketOverviewExport" data-tip="将市场交易数据保存为文本文件 (.csv)" class="icon-download"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  applySortingByHeader("marketOverviewHeader");

  ensureEl("marketOverviewRefresh").on("click", marketOverviewAddLines);
  ensureEl("marketOverviewExport").on("click", downloadStockCsv);
  ensureEl("marketOverviewOpenDeals").on("click", () => Controllers.MarketDealsOverview.open(activeMarketId));
  ensureEl("marketOverviewRelocate").on("click", toggleRelocateMarket);
  ensureEl("marketOverviewName").on("input", onRenameInput);
  ensureEl("marketOverviewNameReset").on("click", resetMarketName);
}

// The input shows the custom name (empty when using the default); the placeholder shows the default.
function refreshNameInput(market: Market): void {
  const input = ensureEl<HTMLInputElement>("marketOverviewName");
  input.value = market.name || "";
  input.placeholder = pack.burgs[market.centerBurgId]?.name || `市场 ${market.i}`;
}

function onRenameInput(this: HTMLInputElement): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;
  const value = this.value.trim();
  market.name = value || undefined;
  $("#marketOverview").dialog("option", "title", `市场库存：${Markets.getName(market)}`);
}

function resetMarketName(): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;
  market.name = undefined;
  ensureEl<HTMLInputElement>("marketOverviewName").value = "";
  $("#marketOverview").dialog("option", "title", `市场库存：${Markets.getName(market)}`);
}

function marketOverviewAddLines() {
  const market = Markets.get(activeMarketId);
  if (!market) {
    tip("无效市场。所选市场不存在", true, "error", 5000);
    return;
  }

  const centerBurg = pack.burgs[market.centerBurgId] as Burg | undefined;
  if (!centerBurg || centerBurg.removed) {
    tip("无效市场。所选市场没有中心城镇", true, "error", 5000);
    return;
  }

  let lines = "";
  for (const [goodId, marketGood] of Object.entries(market.goods)) {
    const good = Goods.get(Number(goodId));
    if (!good) continue;
    const stroke = Goods.getStroke(good.color);

    lines += /*html*/ `<div class="states marketGood"
      data-good="${good.name}"
      data-stock="${rn(marketGood.stock, 2)}"
      data-price="${rn(marketGood.price, 2)}">
      <svg data-tip="货物图标" width="2em" height="2em" class="goodIcon">
        <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${stroke}"/>
        <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
      </svg>
      <div data-tip="货物名称" class="goodName">${good.name}</div>
      <div data-tip="货物库存" class="marketGoodStock">${rn(marketGood.stock, 2)}</div>
      <div data-tip="货物价格" class="marketGoodPrice">${formatPrice(marketGood.price)}</div>
    </div>`;
  }
  ensureEl("marketOverviewGoodsBody").innerHTML = lines || "无可用市场货物";

  const center = pack.burgs[market.centerBurgId];
  const state = pack.states[center?.state || 0];
  const coaId = `stateCOA${state.i}`;
  if (state) COArenderer.trigger(coaId, state.coa);

  ensureEl("marketOverviewInfo").innerHTML =
    `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#${coaId}"></use></svg><b>所有者：</b> ${state.fullName || state.name}`;

  const burgs = pack.burgs.filter(b => !b.removed && b.market === market.i);
  const totalUnits = Object.values(market.goods).reduce((sum, mg) => sum + mg.stock, 0);
  ensureEl("marketOverviewSummary").innerHTML = /*html*/ `
    <div style="margin-left:5px">单元格：${pack.cells.market.reduce((count, m) => count + (m === market.i ? 1 : 0), 0)}</div>
    <div style="margin-left:12px">城镇：${burgs.length}</div>
    <div style="margin-left:12px">库存：${rn(totalUnits, 2)}</div>`;

  applySorting(ensureEl("marketOverviewHeader"));
  $("#marketOverview").dialog({ width: fitContent() });
}

function toggleRelocateMarket(): void {
  const button = ensureEl("marketOverviewRelocate");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", relocateMarketOnClick);
    tip("点击地图上的城镇以重新定位市场中心", true);
  } else {
    clearMainTip();
    restoreDefaultEvents();
  }
}

function relocateMarketOnClick(this: SVGGElement, event: MouseEvent): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;

  const [x, y] = getPointer(event, this);
  const cellId = findCell(x, y);
  if (cellId === undefined) return;

  const burgId = pack.cells.burg[cellId];
  const burg = pack.burgs[burgId] as Burg | undefined;
  if (!burgId || !burg || burg.removed) {
    tip("此单元格中没有有效的城镇。请点击包含城镇的单元格", false, "error");
    return;
  }

  if (burgId === market.centerBurgId) {
    tip("此城镇已是该市场的中心", false, "error");
    return;
  }

  if (pack.markets.some(m => m.centerBurgId === burgId)) {
    tip("此城镇已是另一个市场的中心", false, "error");
    return;
  }

  if (!Markets.relocateMarket(activeMarketId, burgId)) return;

  toggleRelocateMarket();
  if (layerIsOn("toggleMarketsLayer")) drawMarketsLayer();

  refreshNameInput(market);
  $("#marketOverview").dialog("option", "title", `市场库存：${Markets.getName(market)}`);
  marketOverviewAddLines();
}

function downloadStockCsv() {
  const market = Markets.get(activeMarketId);
  if (!market) return;

  let csv = "Good,Stock,Buy Price,Sell Price\n";
  for (const [goodId, marketGood] of Object.entries(market.goods)) {
    const good = Goods.get(Number(goodId));
    if (!good) continue;
    const buyPrice = rn(Markets.customerBuyPrice(marketGood.price), 2);
    const sellPrice = rn(Markets.customerSellPrice(marketGood.price), 2);
    csv += `${[good.name, rn(marketGood.stock, 2), buyPrice, sellPrice].join(",")}\n`;
  }
  downloadFile(csv, `${getFileName("Market")}.csv`);
}

function closeMarketOverview() {
  if (ensureEl("marketOverviewRelocate").classList.contains("pressed")) toggleRelocateMarket();
  $("#marketOverview").dialog("destroy");
  ensureEl("marketOverview").remove();
}

export const MarketOverview = { open };
