import { tip } from "@/components/tooltips";
import type { Burg } from "../generators/burgs-generator";
import type { DemandCategory } from "../generators/goods-generator";
import { DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY, DEMAND_TARGET_FACTORS } from "../generators/goods-generator";
import type { Deal } from "../generators/markets-generator";
import type { ProductionCandidate } from "../generators/production-generator";
import { isDealRecord, isMfgRecord } from "../generators/production-generator";
import { formatPrice, rn } from "../utils";

type Type = "MFG" | "BUY" | "SELL" | "LOCAL";

function open(burgId: number): void {
  if (customization) return;
  const burg = pack.burgs[burgId];
  if (!burg || burg.removed) {
    tip("城镇无效。所选城镇不存在或已被移除。", true, "error", 5000);
    return;
  }

  const market = Markets.get(burg.market);
  if (!market) {
    tip("无市场。该城镇未连接到任何市场。", true, "error", 5000);
    return;
  }

  const data = burg.production;
  if (!data) {
    tip("该城镇没有生产数据。", true, "error", 5000);
    return;
  }

  const isBurgSeller = (deal: Deal) => deal.sellerType === "burg" && deal.seller === burgId;
  const isBurgBuyer = (deal: Deal) => deal.buyerType === "burg" && deal.buyer === burgId;

  const getDealSpent = (deal: Deal) => deal.units * deal.price;

  const getDealTax = (deal: Deal) => {
    if (!isBurgSeller(deal)) return 0;
    if (deal.tax !== undefined) return deal.tax;
    return deal.units * deal.price * States.getSalesTax(pack.burgs[deal.seller]);
  };

  const getDealRevenue = (deal: Deal) => deal.units * deal.price;

  const getDealNetRevenue = (deal: Deal) => getDealRevenue(deal) - getDealTax(deal);

  const styles = {
    muted: "color:#777",
    subtle: "color:#999",
    divider: "color:#bbb",
    positive: "color:#2a6",
    negative: "color:#c44",
    warning: "color:#c84",
    sectionTitle: "font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.3em;margin-bottom:.45em",
    topBar: "margin-bottom:.85em;display:flex;flex-wrap:wrap;column-gap:.85em;align-items: center",
    table: "width:100%;table-layout:fixed;border-collapse:collapse;line-height:1",
    headRow: "background:#eee",
    bodyRow: "border-bottom:1px solid #f0f0f0",
    cell: "padding:.4em .5em;vertical-align:top",
    cellRight: "padding:.4em .5em;vertical-align:top;text-align:right",
    detailsCell: "padding:0.5em 0.5em 1em;",
    empty: "color:#888;font-style:italic"
  };

  const goodName = (id: number) => Goods.get(id)?.name ?? `#${id}`;

  const goodDot = (id: number) => {
    const good = Goods.get(id);
    if (!good) return "";

    return `<svg width="14" height="14" style="margin: -6px 2px -4px 0;">
              <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
              <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
            </svg>`;
  };

  const typeBadge = (type: Type) => {
    const commonStyles =
      "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35";
    if (type === "BUY")
      return `<span style="${commonStyles};background:#f5d9d6;color:#a33" data-tip="本地市场购买">BUY</span>`;
    if (type === "SELL")
      return `<span style="${commonStyles};background:#dff0e2;color:#2f8a46" data-tip="出售到本地市场">SELL</span>`;
    if (type === "LOCAL")
      return `<span style="${commonStyles};background:#d9e7f5;color:#346" data-tip="本地产物">LOCAL</span>`;
    return `<span style="${commonStyles};background:#f8e7bf;color:#b67a00" data-tip="制造步骤">MFG</span>`;
  };
  const modifierBadge = (modifier: number) =>
    `<span style="display:inline-block;margin-left:4px;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35;background:#edf1f4;color:#5f6f7a" data-tip="文化类型产物修正系数。产物数量会乘以此值。">x${rn(modifier, 2)}</span>`;

  const renderGoodLabel = (id: number, suffix = "") => `${goodDot(id)}${goodName(id)}${suffix}`;
  const renderDataCell = (content: string | number, align: "left" | "right" = "left", extra = "") =>
    `<td style="${align === "right" ? styles.cellRight : styles.cell}${extra ? `;${extra}` : ""}">${content}</td>`;
  const renderHeaderCell = (content: string, align: "left" | "right" = "left", title = "") =>
    `<th style="${align === "right" ? styles.cellRight : styles.cell}"${title ? ` data-tip="${title}"` : ""}>${content}</th>`;
  const renderSection = (title: string, content: string, tooltip = "") =>
    `<div style="margin-bottom:.9em"><div style="${styles.sectionTitle}"${tooltip ? ` data-tip="${tooltip}"` : ""}>${title}</div>${content}</div>`;
  const renderIncomeCell = (value: number) => {
    const extraStyle = value >= 0 ? styles.positive : styles.warning;
    return `<td style="${styles.cellRight};${extraStyle}">${formatPrice(value)}</td>`;
  };
  const renderTable = (params: {
    colWidths: string[];
    headers: Array<{ label: string; align?: "left" | "right"; title?: string }>;
    rows: string[];
    empty: string;
  }) => {
    const { colWidths, headers, rows, empty } = params;
    if (!rows.length) return `<i style="${styles.empty}">${empty}</i>`;

    return /*html*/ `<table style="${styles.table}">
      <colgroup>${colWidths.map(width => `<col style="width: ${width};">`).join("")}</colgroup>
      <thead><tr style="${styles.headRow}">${headers
        .map(header => renderHeaderCell(header.label, header.align || "left", header.title || ""))
        .join("")}</tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;
  };
  const renderTaggedGood = (id: number, type: Type, suffix = "") =>
    `${renderGoodLabel(id, suffix)} <span style="margin-left:4px">${typeBadge(type)}</span>`;
  const renderLogRow = (targetId: string, detailsHtml: string) =>
    detailsHtml
      ? /*html*/ `<tr id="${targetId}" style="display:none">
          <td colspan="4" style="${styles.detailsCell}">${detailsHtml}</td>
        </tr>`
      : "";
  const renderDemand = (values: number[] | Partial<Record<DemandCategory, number>>, onlyPositive = false) => {
    const entries = Array.isArray(values)
      ? DEMAND_PRIORITY.flatMap((category, index) => {
          const value = values[index] || 0;
          if (onlyPositive && value <= 0.001) return [];
          return `<span data-tip="${category}">${DEMAND_CATEGORY_ICONS[category]} ${rn(value, 2)}</span>`;
        })
      : (Object.entries(values) as [DemandCategory, number][]).flatMap(([category, value]) => {
          if (onlyPositive && value <= 0.001) return [];
          return `<span data-tip="${category}">${DEMAND_CATEGORY_ICONS[category]} ${rn(value, 2)}</span>`;
        });

    return entries.join(` <span style="${styles.divider}">•</span> `);
  };
  const calculateDemandCoverageTotals = (inventory: Record<number, number>) => {
    const totals: number[] = Array(DEMAND_PRIORITY.length).fill(0);

    for (const goodIdStr in inventory) {
      const goodId = +goodIdStr;
      const amount = inventory[goodId] || 0;
      if (amount <= 0) continue;

      const good = Goods.get(goodId);
      if (!good) continue;

      for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
        const category = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
        const coveredAmount = good.demandCoverage?.[category] || 0;
        if (!coveredAmount) continue;
        totals[categoryIndex] += amount * coveredAmount;
      }
    }

    return totals;
  };
  const renderCandidateScore = (score: number) => `<b style="${styles.positive}">分数 ${rn(score, 2)}</b>`;
  const renderDecisionCandidate = (candidate: ProductionCandidate) => {
    const ingredients = candidate.ingredients
      .map(ing => `${rn(ing.amount * candidate.units, 2)} ${goodDot(ing.goodId)}`)
      .join(", ");

    const prep = candidate.isPreparation ? `（为 ${goodDot(candidate.goalGoodId || -1)} 做准备）` : "";
    const demand =
      candidate.demandCategory && candidate.demandMultiplier !== 1
        ? `x 需求 ${DEMAND_CATEGORY_ICONS[candidate.demandCategory]} ${rn(candidate.demandMultiplier, 2)}`
        : "";
    const culture = candidate.cultureModifier !== 1 ? ` ${modifierBadge(candidate.cultureModifier)}` : "";

    let formula: string;
    if (candidate.isPreparation) {
      const workers = rn(candidate.workersNeeded || 1, 2);
      const gain = ((candidate.gainPerWorker || 0) / candidate.demandMultiplier) * workers;
      formula = `目标销售 ${formatPrice(gain)}${culture} ÷ ${workers} 名工人 ${demand} × 单位数 ${rn(candidate.units, 2)} = ${renderCandidateScore(candidate.score)}`;
    } else {
      formula = `销售 ${formatPrice(candidate.sellPrice)}${culture} - 成本 ${formatPrice(candidate.ingredientCost)} = ${renderCandidateScore(candidate.score)}`;
    }
    return `<div>${typeBadge("MFG")} <b>${goodName(candidate.goodId)}</b>${prep}：${formula}。<span style="${styles.muted}">原料：${ingredients}</span></div>`;
  };
  const renderDecisionDetails = (candidates?: readonly ProductionCandidate[]) => {
    if (!candidates || candidates.length === 0) return "";
    const candidatesHtml = `<ul style="margin:.2em 0 0 1.1em;padding:0">${[...candidates]
      .sort((a, b) => b.score - a.score)
      .map(
        (candidate: ProductionCandidate) => `<li style="margin-top:.25em">${renderDecisionCandidate(candidate)}</li>`
      )
      .join("")}</ul>`;
    return /*html*/ `<div><b>决策依据：</b>${candidates.length} 个可行选项中的最高分：</div>${candidatesHtml}`;
  };
  const renderCalculationDetails = (expression: string, value: number, label: string) =>
    /*html*/ `<div><b>交易计算：</b> ${expression} = <b>${formatPrice(value)}</b> ${label}</div>`;
  const renderBuyDetails = (units: number, unitPrice: number, totalCost: number) =>
    renderCalculationDetails(`数量 ${rn(units, 2)} × 购买价 ${rn(unitPrice, 2)}`, -totalCost, "支出");
  const renderSaleDetails = (deal: Deal) =>
    renderCalculationDetails(
      `数量 ${rn(deal.units, 2)} × 销售价 ${rn(deal.price, 2)} - 销售税 ${rn(getDealTax(deal), 2)}`,
      getDealNetRevenue(deal),
      "收入"
    );
  const renderExpandableDealRow = (params: {
    targetId: string;
    goodId: number;
    type: Type;
    units: number;
    details: string;
    income: number;
    detailsHtml: string;
  }) => {
    const { targetId, goodId, type, units, details, income, detailsHtml } = params;
    return [
      /*html*/ `<tr data-target="${targetId}" style="${styles.bodyRow};cursor:pointer" data-tip="点击展开交易详情">
        ${renderDataCell(renderTaggedGood(goodId, type))}
        ${renderDataCell(rn(units, 2), "right")}
        <td style="${styles.cell}">${details}</td>
        ${renderIncomeCell(income)}
      </tr>`,
      renderLogRow(targetId, detailsHtml)
    ];
  };
  const population = burg.population || 0;
  const treasuryAfter = burg.treasury || 0;

  // Derive process rank from sorted burg order (same order as production run)
  const sortedBurgIds = (pack.burgs as Burg[])
    .filter(b => b.i && !b.removed)
    .sort((a, b) => (a.population || 0) - (b.population || 0))
    .map(b => b.i!);
  const totalBurgs = sortedBurgIds.length;
  const processRank = sortedBurgIds.indexOf(burgId) + 1;

  const initialDemand = DEMAND_PRIORITY.map(category => population * DEMAND_TARGET_FACTORS[category]);
  const producedByGood: Record<number, number> = {};

  let totalTax = 0;
  let stepIndex = 0;
  const netInventory: Record<number, number> = {};

  const dealById = new Map(pack.deals.map(d => [d.i, d]));
  const allRows = data.flatMap(entry => {
    if (isMfgRecord(entry)) {
      const mfg = entry;
      producedByGood[mfg.goodId] = (producedByGood[mfg.goodId] || 0) + mfg.units;
      netInventory[mfg.goodId] = (netInventory[mfg.goodId] || 0) + mfg.units;
      for (const item of mfg.recipe) netInventory[item.goodId] = (netInventory[item.goodId] || 0) - item.units;

      const candidatesId = `candidates${stepIndex++}`;
      const candidatesHtml = renderDecisionDetails(mfg.candidates);
      const rowAttrs = candidatesHtml
        ? ` data-target="${candidatesId}" style="${styles.bodyRow};cursor:pointer" data-tip="点击展开决策详情"`
        : ` style="${styles.bodyRow}"`;
      const cultureModifier = mfg.cultureModifier ?? 1;
      const cultureSuffix = cultureModifier !== 1 ? ` ${modifierBadge(cultureModifier)}` : "";
      const allInputs = mfg.recipe.map(item => `${rn(item.units, 2)} ${goodDot(item.goodId)}`).join(` 和 `);

      return [
        /*html*/ `<tr${rowAttrs}>
           ${renderDataCell(renderTaggedGood(mfg.goodId, "MFG", cultureSuffix))}
           ${renderDataCell(rn(mfg.units, 2), "right")}
           <td style="${styles.cell}">从 ${allInputs} 制造</td>
           ${renderDataCell("", "right", styles.subtle)}
         </tr>`,
        renderLogRow(candidatesId, candidatesHtml)
      ];
    } else if (isDealRecord(entry)) {
      const deal = dealById.get(entry.dealId);
      if (!deal) return [];
      const detailsId = `deal-details-${stepIndex++}`;
      if (isBurgBuyer(deal)) {
        netInventory[deal.good] = (netInventory[deal.good] || 0) + deal.units;
        return renderExpandableDealRow({
          targetId: detailsId,
          goodId: deal.good,
          type: "BUY",
          units: deal.units,
          details: "市场购买",
          income: -getDealSpent(deal),
          detailsHtml: renderBuyDetails(deal.units, deal.price, getDealSpent(deal))
        });
      }
      if (isBurgSeller(deal)) {
        netInventory[deal.good] = (netInventory[deal.good] || 0) - deal.units;
        totalTax += getDealTax(deal);
        return renderExpandableDealRow({
          targetId: detailsId,
          goodId: deal.good,
          type: "SELL",
          units: deal.units,
          details: "出售到本地市场",
          income: getDealNetRevenue(deal),
          detailsHtml: renderSaleDetails(deal)
        });
      }
    } else {
      producedByGood[entry.goodId] = (producedByGood[entry.goodId] || 0) + entry.units;
      netInventory[entry.goodId] = (netInventory[entry.goodId] || 0) + entry.units;
      return /*html*/ `<tr style="${styles.bodyRow}">
           ${renderDataCell(renderTaggedGood(entry.goodId, "LOCAL"))}
           ${renderDataCell(entry.units, "right")}
           <td style="${styles.cell}">本地额外资源</td>
           ${renderDataCell("", "right", styles.subtle)}
         </tr>`;
    }
    return [];
  });

  const grossProduct = Math.max(0, burg.product || 0);
  const productPerCapita = population > 0 ? grossProduct / population : 0;

  const jobsTable = renderTable({
    colWidths: ["30%", "10%", "45%", "15%"],
    headers: [
      { label: "货物" },
      { label: "数量", align: "right" },
      { label: "详情" },
      {
        label: "收入",
        align: "right",
        title: "交易行的资金流：BUY 为负，SELL 为正。纯生产行为空。"
      }
    ],
    rows: allRows,
    empty: "无生产操作记录"
  });

  const finalDemandCoverage = calculateDemandCoverageTotals(netInventory);
  const uncoveredDemand = initialDemand.map((target, index) => Math.max(0, target - finalDemandCoverage[index]));

  const statsHtml = /*html*/ `
    <div style="${styles.topBar}">
      <div>
        <span><b>人口：</b> ${population}</span>
        <span><b>顺序：</b> 第 ${processRank} / 共 ${totalBurgs}</span>
        <span><b>市场：</b> ${market ? Markets.getName(market) : "未知"} (${market?.i})</span>
      </div>
      <div><b>初始需求：</b> ${renderDemand(initialDemand)}</div>
      <div><b>未满足需求：</b> ${renderDemand(uncoveredDemand, true) || "无"}</div>
      <div>
        <span data-tip="总产物是生产过程中的本地销售收入减去购买的原料成本。"><b>产物：</b> <span style="${styles.positive}">${formatPrice(grossProduct)}</span></span>
        <span data-tip="人均产物：总产物除以人口。"><b>财富：</b> <span style="${productPerCapita >= 0 ? styles.positive : styles.negative}">${formatPrice(productPerCapita)}</span></span>
        <span data-tip="销售税由卖方在本地销售交易中支付。从销售总额中扣除并转入国家国库。"><b>总税额：</b> <span style="${totalTax >= 0 ? styles.warning : styles.subtle}">${formatPrice(totalTax)}</span></span>
        <span data-tip="本地购买、本地销售和最终本地需求满足后的城镇国库净值。"><b>国库：</b> <span style="${treasuryAfter >= 0 ? styles.positive : styles.negative}">${formatPrice(treasuryAfter)}</span></span>
      </div>
    </div>`;

  const producedRows = Object.entries(producedByGood)
    .filter(([, units]) => units > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([goodIdStr, units]) => {
      const id = +goodIdStr;
      return /*html*/ `<tr style="${styles.bodyRow}">
        ${renderDataCell(renderGoodLabel(id))}
        ${renderDataCell(rn(units, 2), "right")}
      </tr>`;
    });

  const producedTable = renderTable({
    colWidths: ["80%", "20%"],
    headers: [{ label: "货物" }, { label: "数量", align: "right" }],
    rows: producedRows,
    empty: "无制造产物"
  });

  alertMessage.innerHTML = /*html*/ `
    <div id="productionOverviewContent">
      ${statsHtml}
      ${renderSection("已制造的货物", producedTable, "本城镇在此生产周期中制造的货物。")}
      ${renderSection("生产和交易历史", jobsTable, "本城镇按时间顺序排列的本地生产、市场购买、销售和需求满足操作。")}
    </div>
  `;

  const overviewContent = alertMessage.querySelector<HTMLElement>("#productionOverviewContent");
  if (overviewContent) {
    overviewContent.onclick = event => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLTableRowElement>("tr[data-target]");
      if (!row) return;

      const targetId = row.dataset.target;
      if (!targetId) return;
      const detailsRow = overviewContent.querySelector<HTMLTableRowElement>(`#${targetId}`);
      if (!detailsRow) return;

      const isOpen = detailsRow.style.display !== "none";
      detailsRow.style.display = isOpen ? "none" : "table-row";
    };
  }

  $("#alert").dialog({
    width: "48em",
    resizable: true,
    title: `产物总览：${burg.name}`,
    position: {
      my: "right top",
      at: "right-10 top+10",
      of: "svg",
      collision: "fit"
    }
  });
}

export const ProductionOverview = { open };
