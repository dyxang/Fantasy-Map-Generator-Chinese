import { pack as packLayout, select, stratify } from "d3";
import { Controllers } from "@/controllers";
import { convertTemperature, ensureEl, getPointer, getTemperatureLikeness, rn, si } from "../utils";

type Filters = { stateId?: number | null; cultureId?: number | null };

function open(filters: Filters = { stateId: null, cultureId: null }): void {
  if (customization) return;
  closeDialogs("#burgsOverview, .stable");
  if (!layerIsOn("toggleBurgIcons")) toggleBurgIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  renderDialog();
  updateFilter(filters);
  updateLockAllIcon();
  burgsOverviewAddLines();

  $("#burgsOverview").dialog({
    title: "城镇总览",
    resizable: false,
    close: closeBurgsOverview,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  document.getElementById("burgsOverview")?.remove();
  const HTML = /* html */ `<div id="burgsOverview" class="dialog stable">
      <div id="burgsHeader" class="header" style="grid-template-columns: 9em 7em 7.5em 7.2em 6.5em 8em 6.5em 6.5em 5.5em 6em">
        <div data-tip="点击按城镇名称排序" class="sortable alphabetically" data-sortby="name">城镇</div>
        <div data-tip="点击按省份名称排序" class="sortable alphabetically" data-sortby="province">
          省份
        </div>
        <div data-tip="点击按国家名称排序" class="sortable alphabetically" data-sortby="state">国家</div>
        <div data-tip="点击按文化名称排序" class="sortable alphabetically" data-sortby="culture">
          文化
        </div>
        <div data-tip="点击按文化组排序" class="sortable alphabetically" data-sortby="group">组</div>
        <div
          data-tip="点击按城镇人口排序"
          class="sortable icon-sort-number-down"
          data-sortby="population"
        >
          人口
        </div>
        <div data-tip="点击按城镇产值排序" class="sortable" data-sortby="grossproduct">
          产值&nbsp;
        </div>
        <div data-tip="点击按城镇财富（人均产值）排序" class="sortable" data-sortby="productpercapita">
          财富&nbsp;
        </div>
        <div data-tip="点击按城镇国库排序" class="sortable" data-sortby="treasury">
          国库&nbsp;
        </div>
        <div data-tip="点击按城镇特征排序" class="sortable alphabetically" data-sortby="features">
          特征&nbsp;
        </div>
      </div>
      <div id="burgsBody" class="table"></div>
      <div
        id="burgsFilters"
        data-tip="应用筛选器"
        style="padding-block: 0.1em; display: flex; gap: 0.5em; width: 100%"
      >
        <label for="burgsSearch" data-tip="按名称、省份、国家、文化或分组筛选"
          >搜索：<input id="burgsSearch" type="search"
        /></label>
        <label for="burgsFilterState"
          >国家：
          <select id="burgsFilterState"></select
        ></label>
        <label for="burgsFilterCulture"
          >文化：
          <select id="burgsFilterCulture"></select
        ></label>
      </div>
      <div id="burgsFooter" class="totalLine">
        <div data-tip="显示的城镇数" style="margin-left: 5px">
          城镇:&nbsp;<span id="burgsFooterBurgs">0 / 0</span>
        </div>
        <div data-tip="平均人口" style="margin-left: 12px">
          平均人口:&nbsp;<span id="burgsFooterPopulation">0</span>
        </div>
        <div data-tip="平均总产值" style="margin-left: 12px">
          平均产值:&nbsp;<span id="burgsFooterGrossProduct">0</span> 🟡
        </div>
        <div data-tip="平均财富（人均产值）" style="margin-left: 12px">
          平均财富:&nbsp;<span id="burgsFooterProductPerCapita">0</span> 🟡
        </div>
        <div data-tip="平均国库" style="margin-left: 12px">
          平均国库:&nbsp;<span id="burgsFooterTreasury">0</span> 🟡
        </div>
      </div>
      <div id="burgsBottom">
        <button id="burgsOverviewRefresh" data-tip="刷新编辑器" class="icon-cw"></button>
        <button id="burgsGroupsEditorButton" data-tip="编辑城镇组" class="icon-cog"></button>
        <button id="burgsChart" data-tip="显示城镇气泡图" class="icon-chart-area"></button>
        <button
          id="regenerateBurgNames"
          data-tip="基于已分配文化重新生成城镇名称"
          class="icon-retweet"
        ></button>
        <button id="addNewBurg" data-tip="添加新城镇。按住 Shift 添加多个" class="icon-plus"></button>
        <button
          id="burgsExport"
          data-tip="将城镇相关数据保存为文本文件 (.csv)"
          class="icon-download"
        ></button>
        <button id="burgNamesImport" data-tip="批量重命名城镇" class="icon-upload"></button>
        <button id="burgsLockAll" data-tip="锁定或解锁所有城镇" class="icon-lock"></button>
        <button
          id="burgsRemoveAll"
          data-tip="移除所有未锁定的非首都城镇。要移除首都，请先移除其国家"
          class="icon-trash"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", HTML);
  applySortingByHeader("burgsHeader");

  ensureEl("burgsOverviewRefresh").addEventListener("click", refreshBurgsEditor);
  ensureEl("burgsGroupsEditorButton").addEventListener("click", () => Controllers.BurgGroupEditor.open());
  ensureEl("burgsChart").addEventListener("click", showBurgsChart);
  ensureEl("burgsFilterState").addEventListener("change", burgsOverviewAddLines);
  ensureEl("burgsFilterCulture").addEventListener("change", burgsOverviewAddLines);
  ensureEl("burgsSearch").addEventListener("input", burgsOverviewAddLines);
  ensureEl("regenerateBurgNames").addEventListener("click", regenerateNames);
  ensureEl("addNewBurg").addEventListener("click", enterAddBurgMode);
  ensureEl("burgsExport").addEventListener("click", downloadBurgsData);
  ensureEl("burgNamesImport").addEventListener("click", renameBurgsInBulk);
  ensureEl("burgsListToLoad").addEventListener("change", function (this: HTMLInputElement) {
    uploadFile(this, importBurgNames);
  });
  ensureEl("burgsLockAll").addEventListener("click", toggleLockAll);
  ensureEl("burgsRemoveAll").addEventListener("click", triggerAllBurgsRemove);
}

function closeBurgsOverview(): void {
  exitAddBurgMode();
  $("#burgsOverview").dialog("destroy");
  ensureEl("burgsOverview").remove();
}

function refreshBurgsEditor(): void {
  updateFilter();
  burgsOverviewAddLines();
}

function updateFilter(filters: { stateId?: number | null; cultureId?: number | null } = {}): void {
  const stateFilter = ensureEl<HTMLSelectElement>("burgsFilterState");
  const selectedState = filters.stateId != null ? filters.stateId : +stateFilter.value || -1;
  stateFilter.options.length = 0; // remove all options
  stateFilter.options.add(new Option("全部", "-1", false, selectedState === -1));
  stateFilter.options.add(new Option(pack.states[0].name, "0", false, selectedState === 0));
  const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
  statesSorted.forEach(
    s => void stateFilter.options.add(new Option(s.name, String(s.i), false, s.i === selectedState))
  );

  const cultureFilter = ensureEl<HTMLSelectElement>("burgsFilterCulture");
  const selectedCulture = filters.cultureId != null ? filters.cultureId : +cultureFilter.value || -1;
  cultureFilter.options.length = 0; // remove all options
  cultureFilter.options.add(new Option(`全部`, "-1", false, selectedCulture === -1));
  cultureFilter.options.add(new Option(pack.cultures[0].name, "0", false, selectedCulture === 0));
  const culturesSorted = pack.cultures.filter(c => c.i && !c.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
  culturesSorted.forEach(
    c => void cultureFilter.options.add(new Option(c.name, String(c.i), false, c.i === selectedCulture))
  );
}

// add line for each burg
function burgsOverviewAddLines(): void {
  const body = ensureEl("burgsBody");
  const searchText = ensureEl<HTMLInputElement>("burgsSearch").value.toLowerCase().trim();
  const selectedStateId = +ensureEl<HTMLSelectElement>("burgsFilterState").value;
  const selectedCultureId = +ensureEl<HTMLSelectElement>("burgsFilterCulture").value;

  const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
  let filtered = validBurgs;

  if (searchText) {
    // filter by search text
    filtered = filtered.filter(b => {
      const name = b.name!.toLowerCase();
      const state = (pack.states[b.state!]?.name || "").toLowerCase();
      const prov = pack.cells.province[b.cell];
      const province = prov ? pack.provinces[prov]?.name.toLowerCase() : "";
      const culture = (pack.cultures[b.culture!]?.name || "").toLowerCase();
      return (
        name.includes(searchText) ||
        state.includes(searchText) ||
        province.includes(searchText) ||
        culture.includes(searchText) ||
        b.group!.toLowerCase().includes(searchText)
      );
    });
  }
  if (selectedStateId !== -1) filtered = filtered.filter(b => b.state === selectedStateId); // filtered by state
  if (selectedCultureId !== -1) filtered = filtered.filter(b => b.culture === selectedCultureId); // filtered by culture

  body.innerHTML = "";
  let lines = "";
  let totalPopulation = 0;
  let totalProduct = 0;
  let totalProductPerCapita = 0;
  let totalTreasury = 0;

  for (const b of filtered) {
    const population = b.population! * populationRate * urbanization;
    const grossProduct = rn(b.product || 0, 2);
    const productPerCapita = rn(b.population! > 0 ? (b.product || 0) / b.population! : 0, 2);
    const treasury = rn(b.treasury || 0, 2);
    totalPopulation += population;
    totalProduct += grossProduct;
    totalProductPerCapita += productPerCapita;
    totalTreasury += treasury;
    const features = b.capital && b.port ? "a-capital-port" : b.capital ? "c-capital" : b.port ? "p-port" : "z-burg";
    const state = pack.states[b.state!].name;
    const prov = pack.cells.province[b.cell];
    const province = prov ? pack.provinces[prov].name : "";
    const culture = pack.cultures[b.culture!].name;

    lines += /* html */ `<div
        class="states"
        data-id=${b.i}
        data-name="${b.name}"
        data-state="${state}"
        data-province="${province}"
        data-culture="${culture}"
        data-group="${b.group}"
        data-population=${population}
        data-grossproduct=${grossProduct}
        data-productpercapita=${productPerCapita}
        data-treasury=${treasury}
        data-features="${features}"
      >
        <span data-tip="点击缩放查看" class="icon-dot-circled pointer"></span>
        <input data-tip="城镇名称" class="burgName" value="${b.name}" disabled />
        <input data-tip="城镇所属省份" value="${province}" disabled />
        <input data-tip="城镇所属国家" value="${state}" disabled />
        <input data-tip="主导文化" value="${culture}" disabled />
        <input data-tip="城镇分组" value="${b.group}" disabled />
        <span data-tip="城镇人口" class="icon-male"></span>
        <input data-tip="城镇人口" value=${si(population)} style="width: 5em" disabled />
        <span data-tip="总产值：生产过程中的本地销售收入减去购买的原料成本。">🟡</span>
        <input data-tip="总产值：生产过程中的本地销售收入减去购买的原料成本。" value=${grossProduct} style="width: 5em" disabled />
        <span data-tip="财富：总产值除以人口">🟡</span>
        <input data-tip="财富：总产值除以人口" value=${productPerCapita} style="width: 5em" disabled />
        <span data-tip="国库：累计现金余额">🟡</span>
        <input data-tip="国库：累计现金余额" value=${treasury} style="width: 5em" disabled />
        <div style="width: 3em">
          <span
            data-tip="${b.capital ? " 该城镇是国家首都" : "该城镇不是国家首都"}"
            class="icon-star-empty${b.capital ? "" : " inactive"}" style="padding: 0 1px;"></span>
          <span data-tip="${b.port ? " 该城镇是港口" : "该城镇不是港口"}"
          class="icon-anchor${b.port ? "" : " inactive"}" style="font-size: .9em; padding: 0 1px;"></span>
        </div>
        <span data-tip="编辑城镇" class="icon-pencil"></span>
        <span class="locks pointer ${
          b.lock ? "icon-lock" : "icon-lock-open inactive"
        }" onmouseover="showElementLockTip(event)"></span>
        <span data-tip="移除城镇" class="icon-trash-empty"></span>
      </div>`;
  }
  if (!filtered.length) body.innerHTML = /* html */ `<div style="padding-block: 0.3em;">未找到城镇</div>`;
  body.insertAdjacentHTML("beforeend", lines);

  // update footer
  ensureEl("burgsFooterBurgs").innerHTML = `${filtered.length} / ${validBurgs.length}`;
  ensureEl("burgsFooterPopulation").innerHTML = filtered.length ? si(totalPopulation / filtered.length) : "0";
  ensureEl("burgsFooterGrossProduct").innerHTML = filtered.length ? String(rn(totalProduct / filtered.length, 2)) : "0";
  ensureEl("burgsFooterProductPerCapita").innerHTML = filtered.length
    ? String(rn(totalProductPerCapita / filtered.length, 2))
    : "0";
  ensureEl("burgsFooterTreasury").innerHTML = filtered.length ? String(rn(totalTreasury / filtered.length, 2)) : "0";

  // add listeners
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseenter", ev => burgHighlightOn(ev)));
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseleave", () => burgHighlightOff()));
  body.querySelectorAll("div > span.icon-dot-circled").forEach(el => void el.addEventListener("click", zoomIntoBurg));
  body.querySelectorAll("div > span.locks").forEach(el => void el.addEventListener("click", toggleBurgLockStatus));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.addEventListener("click", openBurgEditor));
  body
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach(el => void el.addEventListener("click", triggerBurgRemove));

  applySorting(ensureEl("burgsHeader"));
}

function burgHighlightOn(event: Event): void {
  const burg = +(event.target as HTMLElement).dataset.id!;
  const label = select("#burgLabels").select(`[data-id='${burg}']`);
  if (label.size()) label.classed("drag", true);
}

function burgHighlightOff(): void {
  select("#burgLabels").selectAll("text.drag").classed("drag", false);
}

function zoomIntoBurg(this: HTMLElement): void {
  const burg = +(this.parentNode as HTMLElement).dataset.id!;
  const label = document.querySelector(`#burgLabels [data-id='${burg}']`)!;
  const x = +label.getAttribute("x")!;
  const y = +label.getAttribute("y")!;
  zoomTo(x, y, 8, 2000);
}

function toggleBurgLockStatus(this: HTMLElement): void {
  const burgId = +(this.parentNode as HTMLElement).dataset.id!;

  const burg = pack.burgs[burgId];
  burg.lock = !burg.lock;

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

function openBurgEditor(this: HTMLElement): void {
  const burg = +(this.parentNode as HTMLElement).dataset.id!;
  Controllers.BurgEditor.open(burg);
}

function triggerBurgRemove(this: HTMLElement): void {
  const burgId = +(this.parentNode as HTMLElement).dataset.id!;
  if (pack.burgs[burgId].capital) {
    tip("无法移除首都。请先更改国家首都", false, "error");
    return;
  }

  confirmationDialog({
    title: "移除城镇",
    message: "确定要移除该城镇吗？<br>此操作无法撤销",
    confirm: "移除",
    onConfirm: () => {
      Burgs.remove(burgId);
      burgsOverviewAddLines();
    }
  });
}

function regenerateNames(): void {
  ensureEl("burgsBody")
    .querySelectorAll<HTMLElement>(":scope > div")
    .forEach(el => {
      const burg = +el.dataset.id!;
      if (pack.burgs[burg].lock) return;

      const culture = pack.burgs[burg].culture!;
      const name = Names.getCulture(culture);

      el.querySelector<HTMLInputElement>(".burgName")!.value = name;
      pack.burgs[burg].name = el.dataset.name = name;
      select("#burgLabels").select(`[data-id='${burg}']`).text(name);
    });
}

function enterAddBurgMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddBurgMode();
    return;
  }
  customization = 3;
  this.classList.add("pressed");
  tip("在地图上点击以创建新城镇。按住 Shift 可添加多个", true, "warn");
  select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addBurgOnClick);
}

function addBurgOnClick(this: SVGGElement, event: any): void {
  const point = getPointer(event, this);
  const cell = findCell(point[0], point[1])!;

  if (pack.cells.h[cell] < 20) {
    tip("无法将城镇放入水中。请点击陆地单元格", false, "error");
    return;
  }
  if (pack.cells.burg[cell]) {
    tip("此单元格中已存在城镇。请选择空闲单元格", false, "error");
    return;
  }

  Burgs.add(point as [number, number]); // add new burg

  if (event.shiftKey === false) {
    exitAddBurgMode();
    burgsOverviewAddLines();
  }
}

function exitAddBurgMode(): void {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  ensureEl("addBurgTool").classList.remove("pressed");
  ensureEl("addNewBurg").classList.remove("pressed");
}

function showBurgsChart(): void {
  // build hierarchy tree
  const states = pack.states.map(s => {
    const color = s.color ? s.color : "#ccc";
    const name = s.fullName ? s.fullName : s.name;
    return { id: s.i, state: s.i ? 0 : null, color, name };
  });

  const burgs = pack.burgs
    .filter(b => b.i && !b.removed)
    .map(b => {
      const id = b.i + states.length - 1;
      const population = b.population;
      const capital = b.capital;
      const province = pack.cells.province[b.cell];
      const parent = province ? province + states.length - 1 : b.state;
      return {
        id,
        i: b.i,
        state: b.state,
        culture: b.culture,
        province,
        parent,
        name: b.name,
        population,
        capital,
        x: b.x,
        y: b.y
      };
    });
  const data: any[] = (states as any[]).concat(burgs);
  if (data.length < 2) {
    tip("没有可显示的城镇", false, "error");
    return;
  }

  const root = (stratify() as any)
    .parentId((d: any) => d.state)(data)
    .sum((d: any) => d.population)
    .sort((a: any, b: any) => b.value - a.value);

  const uiSize = ensureEl<HTMLInputElement>("uiSize").valueAsNumber;
  const width = 150 + 200 * uiSize;
  const height = 150 + 200 * uiSize;
  const margin = { top: 0, right: -50, bottom: -10, left: -50 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;
  const treeLayout = packLayout().size([w, h]).padding(3);

  // prepare svg
  alertMessage.innerHTML = /* html */ `<select id="burgsTreeType" style="display:block; margin-left:13px; font-size:11px">
      <option value="states" selected>按国家分组</option>
      <option value="cultures">按文化分组</option>
      <option value="parent">按省份和国家分组</option>
      <option value="provinces">按省份分组</option>
    </select>`;
  alertMessage.innerHTML += `<div id='burgsInfo' class='chartInfo'>&#8205;</div>`;
  const svg = select("#alertMessage")
    .insert("svg", "#burgsInfo")
    .attr("id", "burgsTree")
    .attr("width", width)
    .attr("height", height - 10)
    .attr("stroke-width", 2);
  const graph = svg.append("g").attr("transform", `translate(-50, -10)`);
  ensureEl("burgsTreeType").addEventListener("change", updateChart);

  treeLayout(root);

  const node = graph
    .selectAll("circle")
    .data(root.leaves())
    .join("circle")
    .attr("data-id", (d: any) => d.data.i)
    .attr("r", (d: any) => d.r)
    .attr("fill", (d: any) => d.parent.data.color)
    .attr("cx", (d: any) => d.x)
    .attr("cy", (d: any) => d.y)
    .on("mouseenter", (event: any, d: any) => showInfo(event, d))
    .on("mouseleave", (event: any) => hideInfo(event))
    .on("click", (_event: any, d: any) => zoomTo(d.data.x, d.data.y, 8, 2000));

  function showInfo(ev: any, d: any): void {
    select(ev.target).transition().duration(1500).attr("stroke", "#c13119");
    const name = d.data.name;
    const parent = d.parent.data.name;
    const population = si(d.value * populationRate * urbanization);

    ensureEl("burgsInfo").innerHTML = /* html */ `${name}。${parent}。人口：${population}`;
    burgHighlightOn(ev);
    tip("点击以缩放查看");
  }

  function hideInfo(ev: any): void {
    burgHighlightOff();
    if (!ensureEl("burgsInfo")) return;
    ensureEl("burgsInfo").innerHTML = "&#8205;";
    select(ev.target).transition().attr("stroke", null);
    tip("");
  }

  function updateChart(this: HTMLSelectElement): void {
    const getStatesData = () =>
      pack.states.map(s => {
        const color = s.color ? s.color : "#ccc";
        const name = s.fullName ? s.fullName : s.name;
        return { id: s.i, state: s.i ? 0 : null, color, name };
      });

    const getCulturesData = () =>
      pack.cultures.map(c => {
        const color = c.color ? c.color : "#ccc";
        return { id: c.i, culture: c.i ? 0 : null, color, name: c.name };
      });

    const getParentData = () => {
      const states = pack.states.map(s => {
        const color = s.color ? s.color : "#ccc";
        const name = s.fullName ? s.fullName : s.name;
        return { id: s.i, parent: s.i ? 0 : null, color, name };
      });
      const provinces = pack.provinces
        .filter(p => p.i && !p.removed)
        .map(p => {
          return { id: p.i + states.length - 1, parent: p.state, color: p.color, name: p.fullName };
        });
      return (states as any[]).concat(provinces);
    };

    const getProvincesData = () =>
      pack.provinces.map(p => {
        const color = p.color ? p.color : "#ccc";
        const name = p.fullName ? p.fullName : p.name;
        return { id: p.i ? p.i : 0, province: p.i ? 0 : null, color, name };
      });

    const value = (d: any) => {
      if (this.value === "states") return d.state;
      if (this.value === "cultures") return d.culture;
      if (this.value === "parent") return d.parent;
      if (this.value === "provinces") return d.province;
    };

    const mapping: Record<string, () => any[]> = {
      states: getStatesData,
      cultures: getCulturesData,
      parent: getParentData,
      provinces: getProvincesData
    };

    const base = mapping[this.value]();
    burgs.forEach(b => {
      b.id = b.i + base.length - 1;
    });

    const data: any[] = base.concat(burgs);

    const root = (stratify() as any)
      .parentId((d: any) => value(d))(data)
      .sum((d: any) => d.population)
      .sort((a: any, b: any) => b.value - a.value);

    node
      .data((treeLayout(root) as any).leaves())
      .transition()
      .duration(2000)
      .attr("data-id", (d: any) => d.data.i)
      .attr("fill", (d: any) => d.parent.data.color)
      .attr("cx", (d: any) => d.x)
      .attr("cy", (d: any) => d.y)
      .attr("r", (d: any) => d.r);
  }

  $("#alert").dialog({
    title: "城镇气泡图",
    width: fitContent(),
    position: { my: "left bottom", at: "left+10 bottom-10", of: "svg" },
    buttons: {},
    close: () => (alertMessage.innerHTML = "")
  });
}

function downloadBurgsData(): void {
  let data = `Id,Burg,Province,Province Full Name,State,State Full Name,Culture,Religion,Group,Population,X,Y,Latitude,Longitude,Elevation (${heightUnit.value}),Temperature,Temperature likeness,Capital,Port,Citadel,Walls,Plaza,Temple,Shanty Town,Emblem,Preview link\n`; // headers
  const valid = pack.burgs.filter(b => b.i && !b.removed); // all valid burgs

  valid.forEach(b => {
    data += `${b.i},`;
    data += `${b.name},`;
    const province = pack.cells.province[b.cell];
    data += province ? `${pack.provinces[province].name},` : ",";
    data += province ? `${pack.provinces[province].fullName},` : ",";
    data += `${pack.states[b.state!].name},`;
    data += `${pack.states[b.state!].fullName},`;
    data += `${pack.cultures[b.culture!].name},`;
    data += `${pack.religions[pack.cells.religion[b.cell]].name},`;
    data += `${b.group},`;
    data += `${rn(b.population! * populationRate * urbanization)},`;

    // add geography data
    data += `${b.x},`;
    data += `${b.y},`;
    data += `${getLatitude(b.y, 2)},`;
    data += `${getLongitude(b.x, 2)},`;
    data += `${parseInt(getHeight(pack.cells.h[b.cell]), 10)},`;
    const temperature = grid.cells.temp[pack.cells.g[b.cell]];
    data += `${convertTemperature(temperature)},`;
    data += `${getTemperatureLikeness(temperature)},`;

    // add status data
    data += b.capital ? "capital," : ",";
    data += b.port ? "port," : ",";
    data += b.citadel ? "citadel," : ",";
    data += b.walls ? "walls," : ",";
    data += b.plaza ? "plaza," : ",";
    data += b.temple ? "temple," : ",";
    data += b.shanty ? "shanty town," : ",";
    data += b.coa ? `${JSON.stringify(b.coa).replace(/"/g, "").replace(/,/g, ";")},` : ",";
    data += Burgs.getPreview(b).link;

    data += "\n";
  });

  const name = `${getFileName("Burgs")}.csv`;
  downloadFile(data, name);
}

function renameBurgsInBulk(): void {
  alertMessage.innerHTML = /* html */ `下载城镇列表为文本文件，进行修改后重新上传。请确保文件为纯文本文档，每个名称单独一行（分隔符为 CRLF）。如果不想更改名称，保持原样即可`;

  $("#alert").dialog({
    title: "城镇批量重命名",
    width: "22em",
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      下载: () => {
        const data = pack.burgs
          .filter(b => b.i && !b.removed)
          .map(b => b.name)
          .join("\r\n");
        const name = `${getFileName("Burg names")}.txt`;
        downloadFile(data, name);
      },
      上传: () => ensureEl("burgsListToLoad").click(),
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function importBurgNames(dataLoaded: string): void {
  if (!dataLoaded) {
    tip("无法加载文件，请检查格式", false, "error");
    return;
  }
  const data = dataLoaded
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .filter(Boolean);
  if (!data.length) {
    tip("无法解析列表，请检查文件格式", false, "error");
    return;
  }

  const change: { id: number; name: string }[] = [];
  let message = `将按以下方式重命名城镇：`;
  message += `<table class="overflow-table"><tr><th>ID</th><th>当前名称</th><th>新名称</th></tr>`;

  const burgs = pack.burgs.filter(b => b.i && !b.removed);
  for (let i = 0; i < data.length && i <= burgs.length; i++) {
    const v = data[i];
    if (!v || !burgs[i] || v === burgs[i].name) continue;
    change.push({ id: burgs[i].i, name: v });
    message += `<tr><td style="width:20%">${burgs[i].i}</td><td style="width:40%">${burgs[i].name}</td><td style="width:40%">${v}</td></tr>`;
  }
  message += `</tr></table>`;

  if (!change.length) message = "文件中未找到更改。请修改一些名称以获得结果";
  alertMessage.innerHTML = message;

  const onConfirm = () => {
    for (let i = 0; i < change.length; i++) {
      const id = change[i].id;
      pack.burgs[id].name = change[i].name;
      select("#burgLabels").select(`[data-id='${id}']`).text(change[i].name);
    }
    burgsOverviewAddLines();
  };

  confirmationDialog({
    title: "城镇批量重命名",
    message,
    confirm: "重命名",
    onConfirm
  });
}

function triggerAllBurgsRemove(): void {
  const number = pack.burgs.filter(b => b.i && !b.removed && !b.capital && !b.lock).length;
  confirmationDialog({
    title: `移除 ${number} 座城镇`,
    message: `
        确定要移除除首都外的所有<i>未锁定</i>城镇吗？
        <br><i>要移除首都，必须先移除其所属国家</i>`,
    confirm: "移除",
    onConfirm: () => {
      pack.burgs.filter(b => b.i && !(b.capital || b.lock)).forEach(b => void Burgs.remove(b.i));
      burgsOverviewAddLines();
    }
  });
}

function toggleLockAll(): void {
  const activeBurgs = pack.burgs.filter(b => b.i && !b.removed);
  const allLocked = activeBurgs.every(burg => burg.lock);

  activeBurgs.forEach(burg => {
    burg.lock = !allLocked;
  });

  burgsOverviewAddLines();
  ensureEl("burgsLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
}

function updateLockAllIcon(): void {
  const allLocked = pack.burgs.every(({ lock, i, removed }) => lock || !i || removed);
  ensureEl("burgsLockAll").className = allLocked ? "icon-lock-open" : "icon-lock";
}

export const BurgsOverview = { open };
