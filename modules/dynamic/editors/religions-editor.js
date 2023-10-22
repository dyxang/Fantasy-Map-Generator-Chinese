const $body = insertEditorHtml();
addListeners();

export function open() {
  closeDialogs("#religionsEditor, .stable");
  if (!layerIsOn("toggleReligions")) toggleReligions();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleProvinces")) toggleProvinces();

  refreshReligionsEditor();
  drawReligionCenters();

  $("#religionsEditor").dialog({
    title: "宗教编辑器",
    resizable: false,
    close: closeReligionsEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });
  $body.focus();
}

function insertEditorHtml() {
  const editorHtml = /* html */ `<div id="religionsEditor" class="dialog stable">
    <div id="religionsHeader" class="header" style="grid-template-columns: 13em 6em 7em 18em 6em 7em 6em 7em">
      <div data-tip="按宗教名称排序" class="sortable alphabetically" data-sortby="name">宗教&nbsp;</div>
      <div data-tip="按宗教类型进行排序" class="sortable alphabetically icon-sort-name-down" data-sortby="type">类型&nbsp;</div>
      <div data-tip="按宗教构成排序" class="sortable alphabetically hide" data-sortby="form">构成&nbsp;</div>
      <div data-tip="按至高神排序" class="sortable alphabetically hide" data-sortby="deity">至高神&nbsp;</div>
      <div data-tip="按宗教地区分类" class="sortable hide" data-sortby="area">地区&nbsp;</div>
      <div data-tip="按信徒人数(宗教地区人口)排序" class="sortable hide" data-sortby="population">信徒&nbsp;</div>
      <div data-tip="点击可按潜在区段类型排序" class="sortable alphabetically hide" data-sortby="expansion">潜在&nbsp;</div>
      <div data-tip="按扩张主义排序" class="sortable hide" data-sortby="expansionism">扩张&nbsp;</div>
    </div>
    <div id="religionsBody" class="table" data-type="absolute"></div>

    <div id="religionsFooter" class="totalLine">
      <div data-tip="有组织的宗教总数" style="margin-left: 12px">
        有组织:&nbsp;<span id="religionsOrganized">0</span>
      </div>
      <div data-tip="异教总数" style="margin-left: 12px">
        异教:&nbsp;<span id="religionsHeresies">0</span>
      </div>
      <div data-tip="密教总数" style="margin-left: 12px">
        密教:&nbsp;<span id="religionsCults">0</span>
      </div>
      <div data-tip="民间宗教总数" style="margin-left: 12px">
      民间:&nbsp;<span id="religionsFolk">0</span>
      </div>
      <div data-tip="土地总面积" style="margin-left: 12px">
      土地面积:&nbsp;<span id="religionsFooterArea">0</span>
      </div>
      <div data-tip="信徒总数(人口)" style="margin-left: 12px">
      信徒:&nbsp;<span id="religionsFooterPopulation">0</span>
      </div>
    </div>

    <div id="religionsBottom">
      <button id="religionsEditorRefresh" data-tip="刷新编辑器" class="icon-cw"></button>
      <button id="religionsEditStyle" data-tip="在样式编辑器中编辑宗教样式" class="icon-adjust"></button>
      <button id="religionsLegend" data-tip="切换图例框" class="icon-list-bullet"></button>
      <button id="religionsPercentage" data-tip="切换百分比/绝对值显示模式" class="icon-percent"></button>
      <button id="religionsHeirarchy" data-tip="显示宗教等级树" class="icon-sitemap"></button>
      <button id="religionsExtinct" data-tip="显示/隐藏已灭绝的宗教(没有单元格的宗教)" class="icon-eye-off"></button>

      <button id="religionsManually" data-tip="手动重新分配宗教信仰" class="icon-brush"></button>
      <div id="religionsManuallyButtons" style="display: none">
        <label data-tip="改变笔刷大小" data-shortcut="+ (increase), – (decrease)" class="italic">笔刷大小:
          <input
            id="religionsManuallyBrush"
            oninput="tip('笔刷大小: '+this.value); religionsManuallyBrushNumber.value = this.value"
            type="range"
            min="5"
            max="99"
            value="15"
            style="width: 7em"
          />
          <input
            id="religionsManuallyBrushNumber"
            oninput="tip('笔刷大小: '+this.value); religionsManuallyBrush.value = this.value"
            type="number"
            min="5"
            max="99"
            value="15"
          /> </label
        ><br />
        <button id="religionsManuallyApply" data-tip="应用分配" class="icon-check"></button>
        <button id="religionsManuallyCancel" data-tip="取消分配" class="icon-cancel"></button>
      </div>
      <button id="religionsAdd" data-tip="添加一个新的宗教。按住 Shift 添加多个" class="icon-plus"></button>
      <button id="religionsExport" data-tip="下载与宗教有关的数据" class="icon-download"></button>
      <button id="religionsRecalculate" data-tip="根据增长相关属性的当前值重新计算宗教" class="icon-retweet"></button>
      <span data-tip="让宗教的中心、范围和扩张性变化立即生效">
        <input id="religionsAutoChange" class="checkbox" type="checkbox" />
        <label for="religionsAutoChange" class="checkbox-label"><i>自动应用更改</i></label>
      </span>
    </div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  return byId("religionsBody");
}

function addListeners() {
  applySortingByHeader("religionsHeader");

  byId("religionsEditorRefresh").on("click", refreshReligionsEditor);
  byId("religionsEditStyle").on("click", () => editStyle("relig"));
  byId("religionsLegend").on("click", toggleLegend);
  byId("religionsPercentage").on("click", togglePercentageMode);
  byId("religionsHeirarchy").on("click", showHierarchy);
  byId("religionsExtinct").on("click", toggleExtinct);
  byId("religionsManually").on("click", enterReligionsManualAssignent);
  byId("religionsManuallyApply").on("click", applyReligionsManualAssignent);
  byId("religionsManuallyCancel").on("click", () => exitReligionsManualAssignment());
  byId("religionsAdd").on("click", enterAddReligionMode);
  byId("religionsExport").on("click", downloadReligionsCsv);
  byId("religionsRecalculate").on("click", () => recalculateReligions(true));
}

function refreshReligionsEditor() {
  religionsCollectStatistics();
  religionsEditorAddLines();
}

function religionsCollectStatistics() {
  const {cells, religions, burgs} = pack;
  religions.forEach(r => {
    r.cells = r.area = r.rural = r.urban = 0;
  });

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue;
    const religionId = cells.religion[i];
    religions[religionId].cells += 1;
    religions[religionId].area += cells.area[i];
    religions[religionId].rural += cells.pop[i];
    const burgId = cells.burg[i];
    if (burgId) religions[religionId].urban += burgs[burgId].population;
  }
}

// add line for each religion
function religionsEditorAddLines() {
  const unit = " " + getAreaUnit();
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;

  for (const r of pack.religions) {
    if (r.removed) continue;
    if (r.i && !r.cells && $body.dataset.extinct !== "show") continue; // hide extinct religions

    const area = getArea(r.area);
    const rural = r.rural * populationRate;
    const urban = r.urban * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `信徒: ${si(population)}; 农村地区: ${si(rural)}; 市区: ${si(
      urban
    )}. 点击更换`;
    totalArea += area;
    totalPopulation += population;

    if (!r.i) {
      // No religion (neutral) line
      lines += /* html */ `<div
        class="states"
        data-id="${r.i}"
        data-name="${r.name}"
        data-color=""
        data-area="${area}"
        data-population="${population}"
        data-type=""
        data-form=""
        data-deity=""
        data-expansion=""
        data-expansionism=""
      >
        <svg width="9" height="9" class="placeholder"></svg>
        <input data-tip="宗教名称。点击并键入以更改" class="religionName italic" style="width: 11em"
          value="${r.name}" autocorrect="off" spellcheck="false" />
        <select data-tip="宗教类型" class="religionType placeholder" style="width: 5em">
          ${getTypeOptions(r.type)}
        </select>
        <input data-tip="宗教形式" class="religionForm placeholder hide" style="width: 6em" value="" autocorrect="off" spellcheck="false" />
        <span data-tip="重生成至高神" class="icon-arrows-cw placeholder hide"></span>
        <input data-tip="宗教至高神" class="religionDeity placeholder hide" style="width: 17em" value="" autocorrect="off" spellcheck="false" />
        <span data-tip="宗教地区" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="宗教地区" class="religionArea hide" style="width: 6em">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="religionPopulation hide pointer" style="width: 5em">${si(
        population
      )}</div>
      </div>`;
      continue;
    }

    lines += /* html */ `<div
      class="states"
      data-id=${r.i}
      data-name="${r.name}"
      data-color="${r.color}"
      data-area=${area}
      data-population=${population}
      data-type="${r.type}"
      data-form="${r.form}"
      data-deity="${r.deity || ""}"
      data-expansion="${r.expansion}"
      data-expansionism="${r.expansionism}"
    >
      <fill-box fill="${r.color}"></fill-box>
      <input data-tip="宗教名称。点击并键入以更改" class="religionName" style="width: 11em"
        value="${r.name}" autocorrect="off" spellcheck="false" />
      <select data-tip="宗教类型" class="religionType" style="width: 5em">
        ${getTypeOptions(r.type)}
      </select>
      <input data-tip="宗教形式" class="religionForm hide" style="width: 6em"
        value="${r.form}" autocorrect="off" spellcheck="false" />
      <span data-tip="重生至高神" class="icon-arrows-cw hide"></span>
      <input data-tip="宗教至高神" class="religionDeity hide" style="width: 17em"
        value="${r.deity || ""}" autocorrect="off" spellcheck="false" />
      <span data-tip="宗教地区" style="padding-right: 4px" class="icon-map-o hide"></span>
      <div data-tip="宗教地区" class="religionArea hide" style="width: 6em">${si(area) + unit}</div>
      <span data-tip="${populationTip}" class="icon-male hide"></span>
      <div data-tip="${populationTip}" class="religionPopulation hide pointer" style="width: 5em">${si(
      population
    )}</div>
      ${getExpansionColumns(r)}
      <span data-tip="锁定宗教" class="icon-lock${r.lock ? "" : "-open"} hide"></span>
      <span data-tip="删除宗教" class="icon-trash-empty hide"></span>
    </div>`;
  }
  $body.innerHTML = lines;

  // update footer
  const validReligions = pack.religions.filter(r => r.i && !r.removed);
  byId("religionsOrganized").innerHTML = validReligions.filter(r => r.type === "Organized").length;
  byId("religionsHeresies").innerHTML = validReligions.filter(r => r.type === "Heresy").length;
  byId("religionsCults").innerHTML = validReligions.filter(r => r.type === "Cult").length;
  byId("religionsFolk").innerHTML = validReligions.filter(r => r.type === "Folk").length;
  byId("religionsFooterArea").innerHTML = si(totalArea) + unit;
  byId("religionsFooterPopulation").innerHTML = si(totalPopulation);
  byId("religionsFooterArea").dataset.area = totalArea;
  byId("religionsFooterPopulation").dataset.population = totalPopulation;

  // add listeners
  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", religionHighlightOn);
    $line.on("mouseleave", religionHighlightOff);
    $line.on("click", selectReligionOnLineClick);
  });
  $body.querySelectorAll("fill-box").forEach(el => el.on("click", religionChangeColor));
  $body.querySelectorAll("div > input.religionName").forEach(el => el.on("input", religionChangeName));
  $body.querySelectorAll("div > select.religionType").forEach(el => el.on("change", religionChangeType));
  $body.querySelectorAll("div > input.religionForm").forEach(el => el.on("input", religionChangeForm));
  $body.querySelectorAll("div > input.religionDeity").forEach(el => el.on("input", religionChangeDeity));
  $body.querySelectorAll("div > span.icon-arrows-cw").forEach(el => el.on("click", regenerateDeity));
  $body.querySelectorAll("div > div.religionPopulation").forEach(el => el.on("click", changePopulation));
  $body.querySelectorAll("div > select.religionExtent").forEach(el => el.on("change", religionChangeExtent));
  $body.querySelectorAll("div > input.religionExpantion").forEach(el => el.on("change", religionChangeExpansionism));
  $body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.on("click", religionRemovePrompt));
  $body.querySelectorAll("div > span.icon-lock").forEach($el => $el.on("click", updateLockStatus));
  $body.querySelectorAll("div > span.icon-lock-open").forEach($el => $el.on("click", updateLockStatus));

  if ($body.dataset.type === "percentage") {
    $body.dataset.type = "absolute";
    togglePercentageMode();
  }

  applySorting(religionsHeader);
  $("#religionsEditor").dialog({width: fitContent()});
}

function getTypeOptions(type) {
  let options = "";
  const types = ["Folk", "Organized", "Cult", "Heresy"];
  types.forEach(t => (options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`));
  return options;
}

function getExpansionColumns(r) {
  if (r.type === "Folk") {
    const tip =
      "传统宗教没有竞争力，也没有扩张。最初，它们覆盖了母体文化的所有，但当它们扩张时，就会被有组织的宗教所取代";
    return /* html */ `
      <span data-tip="${tip}" class="icon-resize-full-alt hide" style="padding-right: 2px"></span>
      <span data-tip="${tip}" class="religionExtent hide" style="width: 5em">culture</span>
      <span data-tip="${tip}" class="icon-resize-full hide"></span>
      <input data-tip="${tip}" class="religionExpantion hide" disabled type="number" value='0' />`;
  }

  return /* html */ `
    <span data-tip="潜在宗教范围" class="icon-resize-full-alt hide" style="padding-right: 2px"></span>
    <select data-tip="潜在宗教范围" class="religionExtent hide" style="width: 5em">
      ${getExtentOptions(r.expansion)}
    </select>
    <span data-tip="宗教扩张。定义竞争规模" class="icon-resize-full hide"></span>
    <input
      data-tip="宗教扩张。定义竞争规模。点击以更改，然后点击“重新计算”以应用更改"
      class="religionExpantion hide"
      type="number"
      min="0"
      max="99"
      step=".1"
      value=${r.expansionism}
    />`;
}

function getExtentOptions(type) {
  let options = "";
  const types = ["global", "state", "culture"];
  types.forEach(t => (options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`));
  return options;
}

const religionHighlightOn = debounce(event => {
  const religionId = Number(event.id || event.target.dataset.id);
  const $el = $body.querySelector(`div[data-id='${religionId}']`);
  if ($el) $el.classList.add("active");

  if (!layerIsOn("toggleReligions")) return;
  if (customization) return;

  const animate = d3.transition().duration(2000).ease(d3.easeSinIn);
  relig
    .select("#religion" + religionId)
    .raise()
    .transition(animate)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
  debug
    .select("#religionsCenter" + religionId)
    .raise()
    .transition(animate)
    .attr("r", 3)
    .attr("stroke", "#d0240f");
}, 200);

function religionHighlightOff(event) {
  const religionId = Number(event.id || event.target.dataset.id);
  const $el = $body.querySelector(`div[data-id='${religionId}']`);
  if ($el) $el.classList.remove("active");

  relig
    .select("#religion" + religionId)
    .transition()
    .attr("stroke-width", null)
    .attr("stroke", null);
  debug
    .select("#religionsCenter" + religionId)
    .transition()
    .attr("r", 2)
    .attr("stroke", null);
}

function religionChangeColor() {
  const $el = this;
  const currentFill = $el.getAttribute("fill");
  const religionId = +$el.parentNode.dataset.id;

  const callback = newFill => {
    $el.fill = newFill;
    pack.religions[religionId].color = newFill;
    relig.select("#religion" + religionId).attr("fill", newFill);
    debug.select("#religionsCenter" + religionId).attr("fill", newFill);
  };

  openPicker(currentFill, callback);
}

function religionChangeName() {
  const religionId = +this.parentNode.dataset.id;
  this.parentNode.dataset.name = this.value;
  pack.religions[religionId].name = this.value;
  pack.religions[religionId].code = abbreviate(
    this.value,
    pack.religions.map(c => c.code)
  );
}

function religionChangeType() {
  const religionId = +this.parentNode.dataset.id;
  this.parentNode.dataset.type = this.value;
  pack.religions[religionId].type = this.value;
}

function religionChangeForm() {
  const religionId = +this.parentNode.dataset.id;
  this.parentNode.dataset.form = this.value;
  pack.religions[religionId].form = this.value;
}

function religionChangeDeity() {
  const religionId = +this.parentNode.dataset.id;
  this.parentNode.dataset.deity = this.value;
  pack.religions[religionId].deity = this.value;
}

function regenerateDeity() {
  const religionId = +this.parentNode.dataset.id;
  const cultureId = pack.religions[religionId].culture;
  const deity = Religions.getDeityName(cultureId);
  this.parentNode.dataset.deity = deity;
  pack.religions[religionId].deity = deity;
  this.nextElementSibling.value = deity;
}

function changePopulation() {
  const religionId = +this.parentNode.dataset.id;
  const religion = pack.religions[religionId];
  if (!religion.cells) return tip("宗教没有任何单元格，不能改变人口", false, "error");

  const rural = rn(religion.rural * populationRate);
  const urban = rn(religion.urban * populationRate * urbanization);
  const total = rural + urban;
  const format = n => Number(n).toLocaleString();
  const burgs = pack.burgs.filter(b => !b.removed && pack.cells.religion[b.cell] === religionId);

  alertMessage.innerHTML = /* html */ `<div>
    <i>所有宗教领域的人口都被认为是该宗教的信徒，这意味着信徒数量的变化将直接影响人口</i>
    <div style="margin: 0.5em 0">
      农村: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" />
      城市: <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em"
        ${burgs.length ? "" : "disabled"} />
    </div>
    <div>总人口: ${format(total)} ⇒ <span id="totalPop">${format(total)}</span>
      (<span id="totalPopPerc">100</span>%)
    </div>
  </div>`;

  const update = function () {
    const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
    if (isNaN(totalNew)) return;
    totalPop.innerHTML = format(totalNew);
    totalPopPerc.innerHTML = rn((totalNew / total) * 100);
  };

  ruralPop.oninput = () => update();
  urbanPop.oninput = () => update();

  $("#alert").dialog({
    resizable: false,
    title: "改变信徒人数",
    width: "24em",
    buttons: {
      应用: function () {
        applyPopulationChange();
        $(this).dialog("close");
      },
      取消: function () {
        $(this).dialog("close");
      }
    },
    position: {my: "center", at: "center", of: "svg"}
  });

  function applyPopulationChange() {
    const ruralChange = ruralPop.value / rural;
    if (isFinite(ruralChange) && ruralChange !== 1) {
      const cells = pack.cells.i.filter(i => pack.cells.religion[i] === religionId);
      cells.forEach(i => (pack.cells.pop[i] *= ruralChange));
    }
    if (!isFinite(ruralChange) && +ruralPop.value > 0) {
      const points = ruralPop.value / populationRate;
      const cells = pack.cells.i.filter(i => pack.cells.religion[i] === religionId);
      const pop = rn(points / cells.length);
      cells.forEach(i => (pack.cells.pop[i] = pop));
    }

    const urbanChange = urbanPop.value / urban;
    if (isFinite(urbanChange) && urbanChange !== 1) {
      burgs.forEach(b => (b.population = rn(b.population * urbanChange, 4)));
    }
    if (!isFinite(urbanChange) && +urbanPop.value > 0) {
      const points = urbanPop.value / populationRate / urbanization;
      const population = rn(points / burgs.length, 4);
      burgs.forEach(b => (b.population = population));
    }

    refreshReligionsEditor();
  }
}

function religionChangeExtent() {
  const religion = +this.parentNode.dataset.id;
  this.parentNode.dataset.expansion = this.value;
  pack.religions[religion].expansion = this.value;
  recalculateReligions();
}

function religionChangeExpansionism() {
  const religion = +this.parentNode.dataset.id;
  this.parentNode.dataset.expansionism = this.value;
  pack.religions[religion].expansionism = +this.value;
  recalculateReligions();
}

function religionRemovePrompt() {
  if (customization) return;

  const religionId = +this.parentNode.dataset.id;
  confirmationDialog({
    title: "删除宗教信仰",
    message: "你确定你想要删除宗教信仰吗? <br> 这个行为不能被恢复",
    confirm: "删除",
    onConfirm: () => removeReligion(religionId)
  });
}

function removeReligion(religionId) {
  relig.select("#religion" + religionId).remove();
  relig.select("#religion-gap" + religionId).remove();
  debug.select("#religionsCenter" + religionId).remove();

  pack.cells.religion.forEach((r, i) => {
    if (r === religionId) pack.cells.religion[i] = 0;
  });
  pack.religions[religionId].removed = true;

  pack.religions
    .filter(r => r.i && !r.removed)
    .forEach(r => {
      r.origins = r.origins.filter(origin => origin !== religionId);
      if (!r.origins.length) r.origins = [0];
    });

  refreshReligionsEditor();
}

function drawReligionCenters() {
  debug.select("#religionCenters").remove();
  const religionCenters = debug
    .append("g")
    .attr("id", "religionCenters")
    .attr("stroke-width", 0.8)
    .attr("stroke", "#444444")
    .style("cursor", "move");

  let data = pack.religions.filter(r => r.i && r.center && !r.removed);
  const showExtinct = $body.dataset.extinct === "show";
  if (!showExtinct) data = data.filter(r => r.cells > 0);

  religionCenters
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("id", d => "religionsCenter" + d.i)
    .attr("data-id", d => d.i)
    .attr("r", 2)
    .attr("fill", d => d.color)
    .attr("cx", d => pack.cells.p[d.center][0])
    .attr("cy", d => pack.cells.p[d.center][1])
    .on("mouseenter", d => {
      tip(d.name + ". 拖动以移动宗教中心", true);
      religionHighlightOn(event);
    })
    .on("mouseleave", d => {
      tip("", true);
      religionHighlightOff(event);
    })
    .call(d3.drag().on("start", religionCenterDrag));
}

function religionCenterDrag() {
  const religionId = +this.dataset.id;
  const tr = parseTransform(this.getAttribute("transform"));
  const x0 = +tr[0] - d3.event.x;
  const y0 = +tr[1] - d3.event.y;

  function handleDrag() {
    const {x, y} = d3.event;
    this.setAttribute("transform", `translate(${x0 + x},${y0 + y})`);
    const cell = findCell(x, y);
    if (pack.cells.h[cell] < 20) return; // ignore dragging on water

    pack.religions[religionId].center = cell;
    recalculateReligions();
  }

  const dragDebounced = debounce(handleDrag, 50);
  d3.event.on("drag", dragDebounced);
}

function toggleLegend() {
  if (legend.selectAll("*").size()) return clearLegend(); // hide legend

  const data = pack.religions
    .filter(r => r.i && !r.removed && r.area)
    .sort((a, b) => b.area - a.area)
    .map(r => [r.i, r.color, r.name]);
  drawLegend("Religions", data);
}

function togglePercentageMode() {
  if ($body.dataset.type === "absolute") {
    $body.dataset.type = "percentage";
    const totalArea = +byId("religionsFooterArea").dataset.area;
    const totalPopulation = +byId("religionsFooterPopulation").dataset.population;

    $body.querySelectorAll(":scope > div").forEach($el => {
      const {area, population} = $el.dataset;
      $el.querySelector(".religionArea").innerText = rn((+area / totalArea) * 100) + "%";
      $el.querySelector(".religionPopulation").innerText = rn((+population / totalPopulation) * 100) + "%";
    });
  } else {
    $body.dataset.type = "absolute";
    religionsEditorAddLines();
  }
}

async function showHierarchy() {
  if (customization) return;
  const HeirarchyTree = await import("../hierarchy-tree.js?v=1.88.06");

  const getDescription = religion => {
    const {name, type, form, rural, urban} = religion;

    const getTypeText = () => {
      if (name.includes(type)) return "";
      if (form.includes(type)) return "";
      if (type === "Folk" || type === "Organized") return `. ${type} religion`;
      return `. ${type}`;
    };

    const formText = form === type ? "" : ". " + form;
    const population = rural * populationRate + urban * populationRate * urbanization;
    const populationText = population > 0 ? si(rn(population)) + " 人" : "灭绝";

    return `${name}${getTypeText()}${formText}. ${populationText}`;
  };

  const getShape = ({type}) => {
    if (type === "Folk") return "circle";
    if (type === "Organized") return "square";
    if (type === "Cult") return "hexagon";
    if (type === "Heresy") return "diamond";
  };

  HeirarchyTree.open({
    type: "religions",
    data: pack.religions,
    onNodeEnter: religionHighlightOn,
    onNodeLeave: religionHighlightOff,
    getDescription,
    getShape
  });
}

function toggleExtinct() {
  $body.dataset.extinct = $body.dataset.extinct !== "show" ? "show" : "hide";
  religionsEditorAddLines();
  drawReligionCenters();
}

function enterReligionsManualAssignent() {
  if (!layerIsOn("toggleReligions")) toggleReligions();
  customization = 7;
  relig.append("g").attr("id", "temp");
  document.querySelectorAll("#religionsBottom > *").forEach(el => (el.style.display = "none"));
  byId("religionsManuallyButtons").style.display = "inline-block";
  debug.select("#religionCenters").style("display", "none");

  religionsEditor.querySelectorAll(".hide").forEach(el => el.classList.add("hidden"));
  religionsFooter.style.display = "none";
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "none"));
  $("#religionsEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

  tip("点击宗教选择，拖动圆圈改变宗教", true);
  viewbox
    .style("cursor", "crosshair")
    .on("click", selectReligionOnMapClick)
    .call(d3.drag().on("start", dragReligionBrush))
    .on("touchmove mousemove", moveReligionBrush);

  $body.querySelector("div").classList.add("selected");
}

function selectReligionOnLineClick(i) {
  if (customization !== 7) return;
  $body.querySelector("div.selected").classList.remove("selected");
  this.classList.add("selected");
}

function selectReligionOnMapClick() {
  const point = d3.mouse(this);
  const i = findCell(point[0], point[1]);
  if (pack.cells.h[i] < 20) return;

  const assigned = relig.select("#temp").select("polygon[data-cell='" + i + "']");
  const religion = assigned.size() ? +assigned.attr("data-religion") : pack.cells.religion[i];

  $body.querySelector("div.selected").classList.remove("selected");
  $body.querySelector("div[data-id='" + religion + "']").classList.add("selected");
}

function dragReligionBrush() {
  const radius = +byId("religionsManuallyBrushNumber").value;

  d3.event.on("drag", () => {
    if (!d3.event.dx && !d3.event.dy) return;
    const [x, y] = d3.mouse(this);
    moveCircle(x, y, radius);

    const found = radius > 5 ? findAll(x, y, radius) : [findCell(x, y, radius)];
    const selection = found.filter(isLand);
    if (selection) changeReligionForSelection(selection);
  });
}

// change religion within selection
function changeReligionForSelection(selection) {
  const temp = relig.select("#temp");
  const selected = $body.querySelector("div.selected");
  const religionNew = +selected.dataset.id;
  const color = pack.religions[religionNew].color || "#ffffff";

  selection.forEach(function (i) {
    const exists = temp.select("polygon[data-cell='" + i + "']");
    const religionOld = exists.size() ? +exists.attr("data-religion") : pack.cells.religion[i];
    if (religionNew === religionOld) return;

    // change of append new element
    if (exists.size()) exists.attr("data-religion", religionNew).attr("fill", color);
    else
      temp
        .append("polygon")
        .attr("data-cell", i)
        .attr("data-religion", religionNew)
        .attr("points", getPackPolygon(i))
        .attr("fill", color);
  });
}

function moveReligionBrush() {
  showMainTip();
  const [x, y] = d3.mouse(this);
  const radius = +byId("religionsManuallyBrushNumber").value;
  moveCircle(x, y, radius);
}

function applyReligionsManualAssignent() {
  const changed = relig.select("#temp").selectAll("polygon");
  changed.each(function () {
    const i = +this.dataset.cell;
    const r = +this.dataset.religion;
    pack.cells.religion[i] = r;
  });

  if (changed.size()) {
    drawReligions();
    refreshReligionsEditor();
    drawReligionCenters();
  }
  exitReligionsManualAssignment();
}

function exitReligionsManualAssignment(close) {
  customization = 0;
  relig.select("#temp").remove();
  removeCircle();
  document.querySelectorAll("#religionsBottom > *").forEach(el => (el.style.display = "inline-block"));
  byId("religionsManuallyButtons").style.display = "none";

  byId("religionsEditor")
    .querySelectorAll(".hide")
    .forEach(el => el.classList.remove("hidden"));
  byId("religionsFooter").style.display = "block";
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "all"));
  if (!close) $("#religionsEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

  debug.select("#religionCenters").style("display", null);
  restoreDefaultEvents();
  clearMainTip();
  const $selected = $body.querySelector("div.selected");
  if ($selected) $selected.classList.remove("selected");
}

function enterAddReligionMode() {
  if (this.classList.contains("pressed")) return exitAddReligionMode();

  customization = 8;
  this.classList.add("pressed");
  tip("点击地图添加一个新的宗教", true);
  viewbox.style("cursor", "crosshair").on("click", addReligion);
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "none"));
}

function exitAddReligionMode() {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "all"));
  if (religionsAdd.classList.contains("pressed")) religionsAdd.classList.remove("pressed");
}

function addReligion() {
  const [x, y] = d3.mouse(this);
  const center = findCell(x, y);
  if (pack.cells.h[center] < 20)
    return tip("你不能把宗教中心放在水里，请点击陆地单元格", false, "error");

  const occupied = pack.religions.some(r => !r.removed && r.center === center);
  if (occupied) return tip("这个单元格已经是一个宗教中心了。请选择一个不同的单元格", false, "error");

  if (d3.event.shiftKey === false) exitAddReligionMode();
  Religions.add(center);

  drawReligions();
  refreshReligionsEditor();
  drawReligionCenters();
}

function downloadReligionsCsv() {
  const unit = getAreaUnit("2");
  const headers = `Id,Name,Color,Type,Form,Supreme Deity,Area ${unit},Believers,Origins,Potential,Expansionism`;
  const lines = Array.from($body.querySelectorAll(":scope > div"));
  const data = lines.map($line => {
    const {id, name, color, type, form, deity, area, population, expansion, expansionism} = $line.dataset;
    const deityText = '"' + deity + '"';
    const {origins} = pack.religions[+id];
    const originList = (origins || []).filter(origin => origin).map(origin => pack.religions[origin].name);
    const originText = '"' + originList.join(", ") + '"';
    return [id, name, color, type, form, deityText, area, population, originText, expansion, expansionism].join(",");
  });
  const csvData = [headers].concat(data).join("\n");

  const name = getFileName("Religions") + ".csv";
  downloadFile(csvData, name);
}

function closeReligionsEditor() {
  debug.select("#religionCenters").remove();
  exitReligionsManualAssignment("close");
  exitAddReligionMode();
}

function updateLockStatus() {
  if (customization) return;

  const religionId = +this.parentNode.dataset.id;
  const classList = this.classList;
  const r = pack.religions[religionId];
  r.lock = !r.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

function recalculateReligions(must) {
  if (!must && !religionsAutoChange.checked) return;

  Religions.recalculate();

  drawReligions();
  refreshReligionsEditor();
  drawReligionCenters();
}
