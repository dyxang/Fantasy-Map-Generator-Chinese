const $body = insertEditorHtml();
addListeners();

export function open() {
  closeDialogs("#statesEditor, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleReligions")) toggleReligions();

  refreshStatesEditor();

  $("#statesEditor").dialog({
    title: "国家编辑器",
    resizable: false,
    close: closeStatesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}

function insertEditorHtml() {
  const editorHtml = /* html */ `<div id="statesEditor" class="dialog stable">
    <div id="statesHeader" class="header" style="grid-template-columns: 11em 8em 7em 7em 6em 6em 8em 6em 7em 6em">
      <div data-tip="按国家名排序" class="sortable alphabetically" data-sortby="name">国家&nbsp;</div>
      <div data-tip="按国家构成排序" class="sortable alphabetically" data-sortby="form">政体&nbsp;</div>
      <div data-tip="按首都排序" class="sortable alphabetically hide" data-sortby="capital">首都&nbsp;</div>
      <div data-tip="按国家主流文化排序" class="sortable alphabetically hide" data-sortby="culture">文化&nbsp;</div>
      <div data-tip="按国家城市数进行排序" class="sortable hide" data-sortby="burgs">城市&nbsp;</div>
      <div data-tip="按国家区域进行排序" class="sortable hide icon-sort-number-down" data-sortby="area">面积&nbsp;</div>
      <div data-tip="按国家人口进行排序" class="sortable hide" data-sortby="population">人口&nbsp;</div>
      <div data-tip="按国家类型排序" class="sortable alphabetically hidden show hide" data-sortby="type">类型&nbsp;</div>
      <div data-tip="按国家扩张性排序" class="sortable hidden show hide" data-sortby="expansionism">扩张性&nbsp;</div>
      <div data-tip="按国家单元格计数进行排序" class="sortable hidden show hide" data-sortby="cells">单元格&nbsp;</div>
    </div>

    <div id="statesBodySection" class="table" data-type="absolute"></div>

    <div id="statesFooter" class="totalLine">
      <div data-tip="国家数" style="margin-left: 5px">国家:&nbsp;<span id="statesFooterStates">0</span></div>
      <div data-tip="土地单元格总数" style="margin-left: 12px">单元格:&nbsp;<span id="statesFooterCells">0</span></div>
      <div data-tip="总城市数" style="margin-left: 12px">城市:&nbsp;<span id="statesFooterBurgs">0</span></div>
      <div data-tip="土地总面积" style="margin-left: 12px">土地面积:&nbsp;<span id="statesFooterArea">0</span></div>
      <div data-tip="总人口" style="margin-left: 12px">人口:&nbsp;<span id="statesFooterPopulation">0</span></div>
    </div>

    <div id="statesBottom">
      <button id="statesEditorRefresh" data-tip="刷新编辑器" class="icon-cw"></button>
      <button id="statesEditStyle" data-tip="在样式编辑器中编辑国家样式" class="icon-adjust"></button>
      <button id="statesLegend" data-tip="切换图例框" class="icon-list-bullet"></button>
      <button id="statesPercentage" data-tip="切换百分比/绝对值视图" class="icon-percent"></button>
      <button id="statesChart" data-tip="显示各国家的气泡图" class="icon-chart-area"></button>

      <button id="statesRegenerate" data-tip="显示重生菜单和更多数据" class="icon-cog-alt"></button>
      <div id="statesRegenerateButtons" style="display: none">
        <button id="statesRegenerateBack" data-tip="隐藏重生菜单" class="icon-cog-alt"></button>
        <button id="statesRandomize" data-tip="随机化国家扩张性并重新统计国家与省" class="icon-shuffle"></button>
        <div data-tip="附加增长率。确定有多少土地将保持中性" style="display: inline-block">
          <slider-input id="statesGrowthRate" min=".1" max="3" step=".05" value="1">增长率:</slider-input>
        </div>
        <button id="statesRecalculate" data-tip="根据增长相关属性的当前值重新计算国家" class="icon-retweet"></button>
        <div data-tip="允许国家中立的差距，扩展和类型的变化立即生效" style="display: inline-block">
          <input id="statesAutoChange" class="checkbox" type="checkbox" />
          <label for="statesAutoChange" class="checkbox-label"><i>自动应用更改</i></label>
        </div>
        <div data-tip="允许系统在国家数据更改时更改国家标签" style="display: inline-block">
          <input id="adjustLabels" class="checkbox" type="checkbox" />
          <label for="adjustLabels" class="checkbox-label"><i>自动更改标签</i></label>
        </div>
      </div>

      <button id="statesManually" data-tip="手动重新分配国家" class="icon-brush"></button>
      <div id="statesManuallyButtons" style="display: none">
        <div data-tip="改变笔刷大小. 快捷键: + 增加; – 减小" style="margin-block: 0.3em;">
          <slider-input id="statesBrush" min="1" max="100" value="15">笔刷大小：</slider-input>
        </div>
        <button id="statesManuallyApply" data-tip="应用分配" class="icon-check"></button>
        <button id="statesManuallyCancel" data-tip="取消分配" class="icon-cancel"></button>
      </div>

      <button id="statesAdd" data-tip="添加一个新国家。按住 Shift 添加多个" class="icon-plus"></button>
      <button id="statesMerge" data-tip="合并多个国家为一个" class="icon-layer-group"></button>
      <button id="statesExport" data-tip="把与国家相关的数据保存为文本文件(.csv)" class="icon-download"></button>
    </div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  return byId("statesBodySection");
}

function addListeners() {
  applySortingByHeader("statesHeader");

  byId("statesEditorRefresh").on("click", refreshStatesEditor);
  byId("statesEditStyle").on("click", () => editStyle("regions"));
  byId("statesLegend").on("click", toggleLegend);
  byId("statesPercentage").on("click", togglePercentageMode);
  byId("statesChart").on("click", showStatesChart);
  byId("statesRegenerate").on("click", openRegenerationMenu);
  byId("statesRegenerateBack").on("click", exitRegenerationMenu);
  byId("statesRecalculate").on("click", () => recalculateStates(true));
  byId("statesRandomize").on("click", randomizeStatesExpansion);
  byId("statesGrowthRate").on("input", () => recalculateStates(false));
  byId("statesManually").on("click", enterStatesManualAssignent);
  byId("statesManuallyApply").on("click", applyStatesManualAssignent);
  byId("statesManuallyCancel").on("click", () => exitStatesManualAssignment(false));
  byId("statesAdd").on("click", enterAddStateMode);
  byId("statesMerge").on("click", openStateMergeDialog);
  byId("statesExport").on("click", downloadStatesCsv);

  $body.on("click", event => {
    const $element = event.target;
    const classList = $element.classList;
    const stateId = +$element.parentNode?.dataset?.id;
    if ($element.tagName === "FILL-BOX") stateChangeFill($element);
    else if (classList.contains("name")) editStateName(stateId);
    else if (classList.contains("coaIcon")) editEmblem("state", "stateCOA" + stateId, pack.states[stateId]);
    else if (classList.contains("icon-star-empty")) stateCapitalZoomIn(stateId);
    else if (classList.contains("icon-dot-circled")) overviewBurgs({stateId});
    else if (classList.contains("statePopulation")) changePopulation(stateId);
    else if (classList.contains("icon-pin")) toggleFog(stateId, classList);
    else if (classList.contains("icon-trash-empty")) stateRemovePrompt(stateId);
    else if (classList.contains("icon-lock") || classList.contains("icon-lock-open"))
      updateLockStatus(stateId, classList);
  });

  $body.on("input", function (ev) {
    const $element = ev.target;
    const classList = $element.classList;
    const line = $element.parentNode;
    const state = +line.dataset.id;
    if (classList.contains("stateCapital")) stateChangeCapitalName(state, line, $element.value);
  });

  $body.on("change", function (ev) {
    const $element = ev.target;
    const classList = $element.classList;
    const line = $element.parentNode;
    const state = +line.dataset.id;
    if (classList.contains("stateCulture")) stateChangeCulture(state, line, $element.value);
    else if (classList.contains("cultureType")) stateChangeType(state, line, $element.value);
    else if (classList.contains("statePower")) stateChangeExpansionism(state, line, $element.value);
  });
}

function refreshStatesEditor() {
  BurgsAndStates.collectStatistics();
  statesEditorAddLines();
}

// add line for each state
function statesEditorAddLines() {
  const unit = getAreaUnit();
  const hidden = byId("statesRegenerateButtons").style.display === "block" ? "" : "hidden"; // toggle regenerate columns
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;
  let totalBurgs = 0;

  for (const s of pack.states) {
    if (s.removed) continue;
    const area = getArea(s.area);
    const rural = s.rural * populationRate;
    const urban = s.urban * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `总人口: ${si(population)}; 农村人口: ${si(rural)}; 城市人口: ${si(
      urban
    )}. 点击更改`;
    totalArea += area;
    totalPopulation += population;
    totalBurgs += s.burgs;
    const focused = defs.select("#fog #focusState" + s.i).size();

    if (!s.i) {
      // Neutral line
      lines += /* html */ `<div
        class="states"
        data-id=${s.i}
        data-name="${s.name}"
        data-cells=${s.cells}
        data-area=${area}
        data-population=${population}
        data-burgs=${s.burgs}
        data-color=""
        data-form=""
        data-capital=""
        data-culture=""
        data-type=""
        data-expansionism=""
      >
        <svg width="1em" height="1em" class="placeholder"></svg>
        <input data-tip="中性土地名称。点击可更改" class="stateName name pointer italic" value="${
          s.name
        }" readonly />
        <svg class="coaIcon placeholder"></svg>
        <input class="stateForm placeholder" value="none" />
        <span class="icon-star-empty placeholder"></span>
        <input class="stateCapital placeholder" />
        <select class="stateCulture placeholder hide">${getCultureOptions(0)}</select>
        <span data-tip="点击查看中性城市" class="icon-dot-circled pointer hide" style="padding-right: 1px"></span>
        <div data-tip="城市计数" class="stateBurgs hide">${s.burgs}</div>
        <span data-tip="中立地区" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="中立地区面积" class="stateArea hide" style="width: 6em">${si(area)} ${unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="statePopulation pointer hide" style="width: 5em">${si(population)}</div>
        <select class="cultureType ${hidden} placeholder show hide">${getTypeOptions(0)}</select>
        <span class="icon-resize-full ${hidden} placeholder show hide"></span>
        <input class="statePower ${hidden} placeholder show hide" type="number" value="0" />
        <span data-tip="单元格计数" class="icon-check-empty ${hidden} show hide"></span>
        <div data-tip="单元格计数" class="stateCells ${hidden} show hide">${s.cells}</div>
      </div>`;
      continue;
    }

    const capital = pack.burgs[s.capital].name;
    COArenderer.trigger("stateCOA" + s.i, s.coa);
    lines += /* html */ `<div
      class="states"
      data-id=${s.i}
      data-name="${s.name}"
      data-form="${s.formName}"
      data-capital="${capital}"
      data-color="${s.color}"
      data-cells=${s.cells}
      data-area=${area}
      data-population=${population}
      data-burgs=${s.burgs}
      data-culture=${pack.cultures[s.culture].name}
      data-type=${s.type}
      data-expansionism=${s.expansionism}
    >
      <fill-box fill="${s.color}"></fill-box>
      <input data-tip="国家名称。点击更改" class="stateName name pointer" value="${s.name}" readonly />
      <svg data-tip="点击显示和编辑国徽" class="coaIcon pointer hide" viewBox="0 0 200 200"><use href="#stateCOA${
        s.i
      }"></use></svg>
      <input data-tip="国家类型名称。点击以更改" class="stateForm name pointer" value="${
        s.formName
      }" readonly />
      <span data-tip="国家首府，点击放大" class="icon-star-empty pointer hide"></span>
      <input data-tip="首都名称。点击并键入以重命名" class="stateCapital hide" value="${capital}" autocorrect="off" spellcheck="false" />
      <select data-tip="主流文化，点击更改" class="stateCulture hide">${getCultureOptions(
        s.culture
      )}</select>
      <span data-tip="点击查看国家城市" style="padding-right: 1px" class="icon-dot-circled pointer hide"></span>
      <div data-tip="城市计数" class="stateBurgs hide">${s.burgs}</div>
      <span data-tip="国家面积" style="padding-right: 4px" class="icon-map-o hide"></span>
      <div data-tip="国家面积" class="stateArea hide" style="width: 6em">${si(area)} ${unit}</div>
      <span data-tip="${populationTip}" class="icon-male hide"></span>
      <div data-tip="${populationTip}" class="statePopulation pointer hide" style="width: 5em">${si(population)}</div>
      <select data-tip="国家类型。定义增长模型。点击更改" class="cultureType ${hidden} show hide">${getTypeOptions(
      s.type
    )}</select>
      <span data-tip="国家扩张性" class="icon-resize-full ${hidden} show hide"></span>
      <input data-tip="扩张主义(定义竞争规模)。更改为基于新值重新计算国家"
        class="statePower ${hidden} show hide" type="number" min="0" max="99" step=".1" value=${s.expansionism} />
      <span data-tip="单元格计数" class="icon-check-empty ${hidden} show hide"></span>
      <div data-tip="单元格计数" class="stateCells ${hidden} show hide">${s.cells}</div>
      <span data-tip="聚焦于该国家" class="icon-pin ${focused ? "" : " inactive"} hide"></span>
      <span data-tip="锁定国家（保护不受重新生成影响）" class="icon-lock${
        s.lock ? "" : "-open"
      } hide"></span>
      <span data-tip="删除国家" class="icon-trash-empty hide"></span>
    </div>`;
  }
  $body.innerHTML = lines;

  // update footer
  byId("statesFooterStates").innerHTML = pack.states.filter(s => s.i && !s.removed).length;
  byId("statesFooterCells").innerHTML = pack.cells.h.filter(h => h >= 20).length;
  byId("statesFooterBurgs").innerHTML = totalBurgs;
  byId("statesFooterArea").innerHTML = si(totalArea) + unit;
  byId("statesFooterArea").dataset.area = totalArea;
  byId("statesFooterPopulation").innerHTML = si(totalPopulation);
  byId("statesFooterPopulation").dataset.population = totalPopulation;

  // add listeners
  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", stateHighlightOn);
    $line.on("mouseleave", stateHighlightOff);
    $line.on("click", selectStateOnLineClick);
  });

  if ($body.dataset.type === "percentage") {
    $body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(statesHeader);
  $("#statesEditor").dialog({width: fitContent()});
}

function getCultureOptions(culture) {
  let options = "";
  pack.cultures.forEach(c => {
    if (!c.removed) {
      options += `<option ${c.i === culture ? "selected" : ""} value="${c.i}">${c.name}</option>`;
    }
  });
  return options;
}

function getTypeOptions(type) {
  let options = "";
  const types = ["Generic", "River", "Lake", "Naval", "Nomadic", "Hunting", "Highland"];
  types.forEach(t => (options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`));
  return options;
}

function stateHighlightOn(event) {
  if (!layerIsOn("toggleStates")) return;
  if (defs.select("#fog path").size()) return;

  const state = +event.target.dataset.id;
  if (customization || !state) return;
  const d = regions.select("#state" + state).attr("d");

  const path = debug
    .append("path")
    .attr("class", "highlight")
    .attr("d", d)
    .attr("fill", "none")
    .attr("stroke", "red")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("filter", "url(#blur1)");

  const totalLength = path.node().getTotalLength();
  const duration = (totalLength + 5000) / 2;
  const interpolate = d3.interpolateString(`0, ${totalLength}`, `${totalLength}, ${totalLength}`);
  path
    .transition()
    .duration(duration)
    .attrTween("stroke-dasharray", () => interpolate);
}

function stateHighlightOff() {
  debug.selectAll(".highlight").each(function () {
    d3.select(this).transition().duration(1000).attr("opacity", 0).remove();
  });
}

function stateChangeFill(el) {
  const currentFill = el.getAttribute("fill");
  const state = +el.parentNode.dataset.id;

  const callback = function (newFill) {
    el.fill = newFill;
    pack.states[state].color = newFill;
    statesBody.select("#state" + state).attr("fill", newFill);
    statesBody.select("#state-gap" + state).attr("stroke", newFill);
    const halo = d3.color(newFill) ? d3.color(newFill).darker().hex() : "#666666";
    statesHalo.select("#state-border" + state).attr("stroke", halo);

    // recolor regiments
    const solidColor = newFill[0] === "#" ? newFill : "#999";
    const darkerColor = d3.color(solidColor).darker().hex();
    armies.select("#army" + state).attr("fill", solidColor);
    armies
      .select("#army" + state)
      .selectAll("g > rect:nth-of-type(2)")
      .attr("fill", darkerColor);
  };

  openPicker(currentFill, callback);
}

function editStateName(state) {
  // reset input value and close add mode
  stateNameEditorCustomForm.value = "";
  const addModeActive = stateNameEditorCustomForm.style.display === "inline-block";
  if (addModeActive) {
    stateNameEditorCustomForm.style.display = "none";
    stateNameEditorSelectForm.style.display = "inline-block";
  }

  const s = pack.states[state];
  byId("stateNameEditor").dataset.state = state;
  byId("stateNameEditorShort").value = s.name || "";
  applyOption(stateNameEditorSelectForm, s.formName);
  byId("stateNameEditorFull").value = s.fullName || "";

  $("#stateNameEditor").dialog({
    resizable: false,
    title: "更改国家名",
    buttons: {
      应用: function () {
        applyNameChange(s);
        $(this).dialog("close");
      },
      取消: function () {
        $(this).dialog("close");
      }
    },
    position: {my: "center", at: "center", of: "svg"}
  });

  if (modules.editStateName) return;
  modules.editStateName = true;

  // add listeners
  byId("stateNameEditorShortCulture").on("click", regenerateShortNameCulture);
  byId("stateNameEditorShortRandom").on("click", regenerateShortNameRandom);
  byId("stateNameEditorAddForm").on("click", addCustomForm);
  byId("stateNameEditorCustomForm").on("change", addCustomForm);
  byId("stateNameEditorFullRegenerate").on("click", regenerateFullName);

  function regenerateShortNameCulture() {
    const state = +stateNameEditor.dataset.state;
    const culture = pack.states[state].culture;
    const name = Names.getState(Names.getCultureShort(culture), culture);
    byId("stateNameEditorShort").value = name;
  }

  function regenerateShortNameRandom() {
    const base = rand(nameBases.length - 1);
    const name = Names.getState(Names.getBase(base), undefined, base);
    byId("stateNameEditorShort").value = name;
  }

  function addCustomForm() {
    const value = stateNameEditorCustomForm.value;
    const addModeActive = stateNameEditorCustomForm.style.display === "inline-block";
    stateNameEditorCustomForm.style.display = addModeActive ? "none" : "inline-block";
    stateNameEditorSelectForm.style.display = addModeActive ? "inline-block" : "none";
    if (value && addModeActive) applyOption(stateNameEditorSelectForm, value);
    stateNameEditorCustomForm.value = "";
  }

  function regenerateFullName() {
    const short = byId("stateNameEditorShort").value;
    const form = byId("stateNameEditorSelectForm").value;
    byId("stateNameEditorFull").value = getFullName();

    function getFullName() {
      if (!form) return short;
      if (!short && form) return "The " + form;
      const tick = +stateNameEditorFullRegenerate.dataset.tick;
      stateNameEditorFullRegenerate.dataset.tick = tick + 1;
      return tick % 2 ? getAdjective(short) + " " + form : form + " of " + short;
    }
  }

  function applyNameChange(s) {
    const nameInput = byId("stateNameEditorShort");
    const formSelect = byId("stateNameEditorSelectForm");
    const fullNameInput = byId("stateNameEditorFull");

    const nameChanged = nameInput.value !== s.name;
    const formChanged = formSelect.value !== s.formName;
    const fullNameChanged = fullNameInput.value !== s.fullName;
    const changed = nameChanged || formChanged || fullNameChanged;

    if (formChanged) {
      const selected = formSelect.selectedOptions[0];
      const form = selected.parentElement.label || null;
      if (form) s.form = form;
    }

    s.name = nameInput.value;
    s.formName = formSelect.value;
    s.fullName = fullNameInput.value;
    if (changed && stateNameEditorUpdateLabel.checked) drawStateLabels([s.i]);
    refreshStatesEditor();
  }
}

function stateChangeCapitalName(state, line, value) {
  line.dataset.capital = value;
  const capital = pack.states[state].capital;
  if (!capital) return;
  pack.burgs[capital].name = value;
  document.querySelector("#burgLabel" + capital).textContent = value;
}

function changePopulation(stateId) {
  const state = pack.states[stateId];
  if (!state.cells) return tip("国家没有任何单元格，不能改变人口", false, "error");

  const rural = rn(state.rural * populationRate);
  const urban = rn(state.urban * populationRate * urbanization);
  const total = rural + urban;
  const format = n => Number(n).toLocaleString();

  alertMessage.innerHTML = /* html */ `<div>
    <i>更改分配给国家的所有单元格的填充</i>
    <div style="margin: 0.5em 0">
      农村: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" />
      城市: <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" />
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
    title: "改变国家人口",
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
      const cells = pack.cells.i.filter(i => pack.cells.state[i] === stateId);
      cells.forEach(i => (pack.cells.pop[i] *= ruralChange));
    }
    if (!isFinite(ruralChange) && +ruralPop.value > 0) {
      const points = ruralPop.value / populationRate;
      const cells = pack.cells.i.filter(i => pack.cells.state[i] === stateId);
      const pop = points / cells.length;
      cells.forEach(i => (pack.cells.pop[i] = pop));
    }

    const urbanChange = urbanPop.value / urban;
    if (isFinite(urbanChange) && urbanChange !== 1) {
      const burgs = pack.burgs.filter(b => !b.removed && b.state === stateId);
      burgs.forEach(b => (b.population = rn(b.population * urbanChange, 4)));
    }
    if (!isFinite(urbanChange) && +urbanPop.value > 0) {
      const points = urbanPop.value / populationRate / urbanization;
      const burgs = pack.burgs.filter(b => !b.removed && b.state === stateId);
      const population = rn(points / burgs.length, 4);
      burgs.forEach(b => (b.population = population));
    }

    if (layerIsOn("togglePopulation")) drawPopulation();
    refreshStatesEditor();
  }
}

function stateCapitalZoomIn(state) {
  const capital = pack.states[state].capital;
  const l = burgLabels.select("[data-id='" + capital + "']");
  const x = +l.attr("x"),
    y = +l.attr("y");
  zoomTo(x, y, 8, 2000);
}

function stateChangeCulture(state, line, value) {
  line.dataset.base = pack.states[state].culture = +value;
}

function stateChangeType(state, line, value) {
  line.dataset.type = pack.states[state].type = value;
  recalculateStates();
}

function stateChangeExpansionism(state, line, value) {
  line.dataset.expansionism = pack.states[state].expansionism = value;
  recalculateStates();
}

function toggleFog(state, cl) {
  if (customization) return;
  const path = statesBody.select("#state" + state).attr("d"),
    id = "focusState" + state;
  cl.contains("inactive") ? fog(id, path) : unfog(id);
  cl.toggle("inactive");
}

function stateRemovePrompt(state) {
  if (customization) return;

  confirmationDialog({
    title: "删除国家",
    message: "确实要删除该国家吗? <br> 无法恢复此操作",
    confirm: "删除",
    onConfirm: () => stateRemove(state)
  });
}

function stateRemove(stateId) {
  statesBody.select("#state" + stateId).remove();
  statesBody.select("#state-gap" + stateId).remove();
  statesHalo.select("#state-border" + stateId).remove();
  labels.select("#stateLabel" + stateId).remove();
  defs.select("#textPath_stateLabel" + stateId).remove();

  unfog("focusState" + stateId);

  pack.burgs.forEach(burg => {
    if (burg.state === stateId) {
      burg.state = 0;
      if (burg.capital) {
        burg.capital = 0;
        moveBurgToGroup(burg.i, "towns");
      }
    }
  });

  pack.cells.state.forEach((s, i) => {
    if (s === stateId) pack.cells.state[i] = 0;
  });

  // remove emblem
  const coaId = "stateCOA" + stateId;
  byId(coaId).remove();
  emblems.select(`#stateEmblems > use[data-i='${stateId}']`).remove();

  // remove provinces
  pack.states[stateId].provinces.forEach(p => {
    pack.provinces[p] = {i: p, removed: true};
    pack.cells.province.forEach((pr, i) => {
      if (pr === p) pack.cells.province[i] = 0;
    });

    const coaId = "provinceCOA" + p;
    if (byId(coaId)) byId(coaId).remove();
    emblems.select(`#provinceEmblems > use[data-i='${p}']`).remove();
    const g = provs.select("#provincesBody");
    g.select("#province" + p).remove();
    g.select("#province-gap" + p).remove();
  });

  // remove military
  pack.states[stateId].military.forEach(m => {
    const id = `regiment${stateId}-${m.i}`;
    const index = notes.findIndex(n => n.id === id);
    if (index != -1) notes.splice(index, 1);
  });
  armies.select("g#army" + stateId).remove();

  pack.states[stateId] = {i: stateId, removed: true};

  debug.selectAll(".highlight").remove();

  if (layerIsOn("toggleStates")) drawStates();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();

  refreshStatesEditor();
}

function toggleLegend() {
  if (legend.selectAll("*").size()) return clearLegend(); // hide legend

  const data = pack.states
    .filter(s => s.i && !s.removed && s.cells)
    .sort((a, b) => b.area - a.area)
    .map(s => [s.i, s.color, s.name]);
  drawLegend("States", data);
}

function togglePercentageMode() {
  if ($body.dataset.type === "absolute") {
    $body.dataset.type = "percentage";
    const totalCells = +byId("statesFooterCells").innerText;
    const totalBurgs = +byId("statesFooterBurgs").innerText;
    const totalArea = +byId("statesFooterArea").dataset.area;
    const totalPopulation = +byId("statesFooterPopulation").dataset.population;

    $body.querySelectorAll(":scope > div").forEach(function (el) {
      const {cells, burgs, area, population} = el.dataset;
      el.querySelector(".stateCells").innerText = rn((+cells / totalCells) * 100) + "%";
      el.querySelector(".stateBurgs").innerText = rn((+burgs / totalBurgs) * 100) + "%";
      el.querySelector(".stateArea").innerText = rn((+area / totalArea) * 100) + "%";
      el.querySelector(".statePopulation").innerText = rn((+population / totalPopulation) * 100) + "%";
    });
  } else {
    $body.dataset.type = "absolute";
    statesEditorAddLines();
  }
}

function showStatesChart() {
  const statesData = pack.states.filter(s => !s.removed);
  if (statesData.length < 2) return tip("没有国家可以显示", false, "error");

  const root = d3
    .stratify()
    .id(d => d.i)
    .parentId(d => (d.i ? 0 : null))(statesData)
    .sum(d => d.area)
    .sort((a, b) => b.value - a.value);

  const size = 150 + 200 * uiSize.value;
  const margin = {top: 0, right: -50, bottom: 0, left: -50};
  const w = size - margin.left - margin.right;
  const h = size - margin.top - margin.bottom;
  const treeLayout = d3.pack().size([w, h]).padding(3);

  // prepare svg
  alertMessage.innerHTML = /* html */ `<select id="statesTreeType" style="display:block; margin-left:13px; font-size:11px">
    <option value="area" selected>面积</option>
    <option value="population">总人口</option>
    <option value="rural">农村人口</option>
    <option value="urban">城市人口</option>
    <option value="burgs">城市数量</option>
  </select>`;
  alertMessage.innerHTML += `<div id='statesInfo' class='chartInfo'>&#8205;</div>`;

  const svg = d3
    .select("#alertMessage")
    .insert("svg", "#statesInfo")
    .attr("id", "statesTree")
    .attr("width", size)
    .attr("height", size)
    .style("font-family", "Almendra SC")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central");
  const graph = svg.append("g").attr("transform", `translate(-50, 0)`);
  byId("statesTreeType").on("change", updateChart);

  treeLayout(root);

  const node = graph
    .selectAll("g")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("transform", d => `translate(${d.x},${d.y})`)
    .attr("data-id", d => d.data.i)
    .on("mouseenter", d => showInfo(event, d))
    .on("mouseleave", d => hideInfo(event, d));

  node
    .append("circle")
    .attr("fill", d => d.data.color)
    .attr("r", d => d.r);

  const exp = /(?=[A-Z][^A-Z])/g;
  const lp = n => d3.max(n.split(exp).map(p => p.length)) + 1; // longest name part + 1

  node
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .style("font-size", d => rn((d.r ** 0.97 * 4) / lp(d.data.name), 2) + "px")
    .selectAll("tspan")
    .data(d => d.data.name.split(exp))
    .join("tspan")
    .attr("x", 0)
    .text(d => d)
    .attr("dy", (d, i, n) => `${i ? 1 : (n.length - 1) / -2}em`);

  function showInfo(ev, d) {
    d3.select(ev.target).select("circle").classed("selected", 1);
    const state = d.data.fullName;

    const area = getArea(d.data.area) + " " + getAreaUnit();
    const rural = rn(d.data.rural * populationRate);
    const urban = rn(d.data.urban * populationRate * urbanization);

    const option = statesTreeType.value;
    const value =
      option === "area"
        ? "面积: " + area
        : option === "rural"
        ? "农村人口: " + si(rural)
        : option === "urban"
        ? "城市人口: " + si(urban)
        : option === "burgs"
        ? "城市数量: " + d.data.burgs
        : "人口: " + si(rural + urban);

    statesInfo.innerHTML = /* html */ `${state}. ${value}`;
    stateHighlightOn(ev);
  }

  function hideInfo(ev) {
    stateHighlightOff(ev);
    if (!byId("statesInfo")) return;
    statesInfo.innerHTML = "&#8205;";
    d3.select(ev.target).select("circle").classed("selected", 0);
  }

  function updateChart() {
    const value =
      this.value === "area"
        ? d => d.area
        : this.value === "rural"
        ? d => d.rural
        : this.value === "urban"
        ? d => d.urban
        : this.value === "burgs"
        ? d => d.burgs
        : d => d.rural + d.urban;

    root.sum(value);
    node.data(treeLayout(root).leaves());

    node
      .transition()
      .duration(1500)
      .attr("transform", d => `translate(${d.x},${d.y})`);
    node
      .select("circle")
      .transition()
      .duration(1500)
      .attr("r", d => d.r);
    node
      .select("text")
      .transition()
      .duration(1500)
      .style("font-size", d => rn((d.r ** 0.97 * 4) / lp(d.data.name), 2) + "px");
  }

  $("#alert").dialog({
    title: "国家气泡图",
    width: fitContent(),
    position: {my: "left bottom", at: "left+10 bottom-10", of: "svg"},
    buttons: {},
    close: () => {
      alertMessage.innerHTML = "";
    }
  });
}

function openRegenerationMenu() {
  byId("statesBottom")
    .querySelectorAll(":scope > button")
    .forEach(el => (el.style.display = "none"));
  byId("statesRegenerateButtons").style.display = "block";

  byId("statesEditor")
    .querySelectorAll(".show")
    .forEach(el => el.classList.remove("hidden"));
  $("#statesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});
}

function recalculateStates(must) {
  if (!must && !statesAutoChange.checked) return;

  BurgsAndStates.expandStates();
  Provinces.generate();
  Provinces.getPoles();
  BurgsAndStates.getPoles();

  if (layerIsOn("toggleStates")) drawStates();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  if (adjustLabels.checked) drawStateLabels();

  refreshStatesEditor();
}

function randomizeStatesExpansion() {
  pack.states.forEach(s => {
    if (!s.i || s.removed) return;
    const expansionism = rn(Math.random() * 4 + 1, 1);
    s.expansionism = expansionism;
    $body.querySelector("div.states[data-id='" + s.i + "'] > input.statePower").value = expansionism;
  });
  recalculateStates(true, true);
}

function exitRegenerationMenu() {
  byId("statesBottom")
    .querySelectorAll(":scope > button")
    .forEach(el => (el.style.display = "inline-block"));
  byId("statesRegenerateButtons").style.display = "none";
  byId("statesEditor")
    .querySelectorAll(".show")
    .forEach(el => el.classList.add("hidden"));
  $("#statesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});
}

function enterStatesManualAssignent() {
  if (!layerIsOn("toggleStates")) toggleStates();
  customization = 2;
  statesBody.append("g").attr("id", "temp");
  document.querySelectorAll("#statesBottom > button").forEach(el => (el.style.display = "none"));
  byId("statesManuallyButtons").style.display = "inline-block";
  byId("statesHalo").style.display = "none";

  byId("statesEditor")
    .querySelectorAll(".hide")
    .forEach(el => el.classList.add("hidden"));
  statesFooter.style.display = "none";
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "none"));
  $("#statesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

  tip("点击国家选择，拖动圆圈改变国家", true);
  viewbox
    .style("cursor", "crosshair")
    .on("click", selectStateOnMapClick)
    .call(d3.drag().on("start", dragStateBrush))
    .on("touchmove mousemove", moveStateBrush);

  $body.querySelector("div").classList.add("selected");
}

function selectStateOnLineClick() {
  if (customization !== 2) return;
  if (this.parentNode.id !== "statesBodySection") return;
  $body.querySelector("div.selected").classList.remove("selected");
  this.classList.add("selected");
}

function selectStateOnMapClick() {
  const point = d3.mouse(this);
  const i = findCell(point[0], point[1]);
  if (pack.cells.h[i] < 20) return;

  const assigned = statesBody.select("#temp").select("polygon[data-cell='" + i + "']");
  const state = assigned.size() ? +assigned.attr("data-state") : pack.cells.state[i];

  $body.querySelector("div.selected").classList.remove("selected");
  $body.querySelector("div[data-id='" + state + "']").classList.add("selected");
}

function dragStateBrush() {
  const r = +statesBrush.value;

  d3.event.on("drag", () => {
    if (!d3.event.dx && !d3.event.dy) return;
    const p = d3.mouse(this);
    moveCircle(p[0], p[1], r);

    const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1])];
    const selection = found.filter(isLand);
    if (selection) changeStateForSelection(selection);
  });
}

// change state within selection
function changeStateForSelection(selection) {
  const temp = statesBody.select("#temp");

  const $selected = $body.querySelector("div.selected");
  const stateNew = +$selected.dataset.id;
  const color = pack.states[stateNew].color || "#ffffff";

  selection.forEach(function (i) {
    const exists = temp.select("polygon[data-cell='" + i + "']");
    const stateOld = exists.size() ? +exists.attr("data-state") : pack.cells.state[i];
    if (stateNew === stateOld) return;
    if (i === pack.states[stateOld].center) return;

    // change of append new element
    if (exists.size()) exists.attr("data-state", stateNew).attr("fill", color).attr("stroke", color);
    else
      temp
        .append("polygon")
        .attr("data-cell", i)
        .attr("data-state", stateNew)
        .attr("points", getPackPolygon(i))
        .attr("fill", color)
        .attr("stroke", color);
  });
}

function moveStateBrush() {
  showMainTip();
  const point = d3.mouse(this);
  const radius = +statesBrush.value;
  moveCircle(point[0], point[1], radius);
}

function applyStatesManualAssignent() {
  const {cells} = pack;
  const affectedStates = [];
  const affectedProvinces = [];

  statesBody
    .select("#temp")
    .selectAll("polygon")
    .each(function () {
      const i = +this.dataset.cell;
      const c = +this.dataset.state;
      affectedStates.push(cells.state[i], c);
      affectedProvinces.push(cells.province[i]);
      cells.state[i] = c;
      if (cells.burg[i]) pack.burgs[cells.burg[i]].state = c;
    });

  if (affectedStates.length) {
    refreshStatesEditor();
    BurgsAndStates.getPoles();
    layerIsOn("toggleStates") ? drawStates() : toggleStates();
    if (adjustLabels.checked) drawStateLabels([...new Set(affectedStates)]);
    adjustProvinces([...new Set(affectedProvinces)]);
    layerIsOn("toggleBorders") ? drawBorders() : toggleBorders();
    if (layerIsOn("toggleProvinces")) drawProvinces();
  }

  exitStatesManualAssignment(false);
}

function adjustProvinces(affectedProvinces) {
  const {cells, provinces, states, burgs} = pack;

  affectedProvinces.forEach(provinceId => {
    if (!provinces[provinceId]) return; // lands without province captured => do nothing

    // find states owning at least 1 province cell
    const provCells = cells.i.filter(i => cells.province[i] === provinceId);
    const provStates = [...new Set(provCells.map(i => cells.state[i]))];

    // province is captured completely => change owner or remove
    if (provinceId && provStates.length === 1) return changeProvinceOwner(provinceId, provStates[0], provCells);

    // province is captured partially => split province
    splitProvince(provinceId, provStates, provCells);
  });

  function changeProvinceOwner(provinceId, newOwnerId, provinceCells) {
    const province = provinces[provinceId];
    const prevOwner = states[province.state];

    // remove province from old owner list
    prevOwner.provinces = prevOwner.provinces.filter(province => province !== provinceId);

    if (newOwnerId) {
      // new owner is a state => change owner
      province.state = newOwnerId;
      states[newOwnerId].provinces.push(provinceId);
    } else {
      // new owner is neutral => remove province
      provinces[provinceId] = {i: provinceId, removed: true};
      provinceCells.forEach(i => {
        cells.province[i] = 0;
      });
    }
  }

  function splitProvince(provinceId, provinceStates, provinceCells) {
    const province = provinces[provinceId];
    const prevOwner = states[province.state];
    const provinceCenterOwner = cells.state[province.center];

    provinceStates.forEach(stateId => {
      const stateProvinceCells = provinceCells.filter(i => cells.state[i] === stateId);

      if (stateId === provinceCenterOwner) {
        // province center is owned by the same state => do nothing for this state
        if (stateId === prevOwner.i) return;

        // province center is captured by neutrals => remove province
        if (!stateId) {
          provinces[provinceId] = {i: provinceId, removed: true};
          stateProvinceCells.forEach(i => {
            cells.province[i] = 0;
          });
          return;
        }

        // reassign province ownership to province center owner
        prevOwner.provinces = prevOwner.provinces.filter(province => province !== provinceId);
        province.state = stateId;
        province.color = getMixedColor(states[stateId].color);
        states[stateId].provinces.push(provinceId);
        return;
      }

      // province cells captured by neutrals => remove captured cells from province
      if (!stateId) {
        stateProvinceCells.forEach(i => {
          cells.province[i] = 0;
        });
        return;
      }

      // a few province cells owned by state => add to closes province
      if (stateProvinceCells.length < 20) {
        const closestProvince = findClosestProvince(provinceId, stateId, stateProvinceCells);
        if (closestProvince) {
          stateProvinceCells.forEach(i => {
            cells.province[i] = closestProvince;
          });
          return;
        }
      }

      // some province cells owned by state => create new province
      createProvince(province, stateId, stateProvinceCells);
    });
  }

  function createProvince(oldProvince, stateId, provinceCells) {
    const newProvinceId = provinces.length;
    const burgCell = provinceCells.find(i => cells.burg[i]);
    const center = burgCell ? burgCell : provinceCells[0];
    const burgId = burgCell ? cells.burg[burgCell] : 0;
    const burg = burgId ? burgs[burgId] : null;
    const culture = cells.culture[center];

    const nameByBurg = burgCell && P(0.5);
    const name = nameByBurg ? burg.name : oldProvince.name || Names.getState(Names.getCultureShort(culture), culture);

    const formOptions = ["Zone", "Area", "Territory", "Province"];
    const formName = burgCell && oldProvince.formName ? oldProvince.formName : ra(formOptions);

    const color = getMixedColor(states[stateId].color);

    const kinship = nameByBurg ? 0.8 : 0.4;
    const type = BurgsAndStates.getType(center, burg?.port);
    const coa = COA.generate(burg?.coa || states[stateId].coa, kinship, burg ? null : 0.9, type);
    coa.shield = COA.getShield(culture, stateId);

    provinces.push({
      i: newProvinceId,
      state: stateId,
      center,
      burg: burgId,
      name,
      formName,
      fullName: `${name} ${formName}`,
      color,
      coa
    });

    provinceCells.forEach(i => {
      cells.province[i] = newProvinceId;
    });

    states[stateId].provinces.push(newProvinceId);
  }

  function findClosestProvince(provinceId, stateId, sourceCells) {
    const borderCell = sourceCells.find(i =>
      cells.c[i].some(c => {
        return cells.state[c] === stateId && cells.province[c] && cells.province[c] !== provinceId;
      })
    );

    const closesProvince =
      borderCell &&
      cells.c[borderCell].map(c => cells.province[c]).find(province => province && province !== provinceId);
    return closesProvince;
  }
}

function exitStatesManualAssignment(close) {
  customization = 0;
  statesBody.select("#temp").remove();
  removeCircle();
  document.querySelectorAll("#statesBottom > button").forEach(el => (el.style.display = "inline-block"));
  byId("statesManuallyButtons").style.display = "none";
  byId("statesHalo").style.display = "block";

  byId("statesEditor")
    .querySelectorAll(".hide:not(.show)")
    .forEach(el => el.classList.remove("hidden"));
  statesFooter.style.display = "block";
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "all"));
  if (!close)
    $("#statesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

  restoreDefaultEvents();
  clearMainTip();
  const selected = $body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

function enterAddStateMode() {
  if (this.classList.contains("pressed")) {
    exitAddStateMode();
    return;
  }
  customization = 3;
  this.classList.add("pressed");
  tip("点击地图创建一个新的首都或推广一个现有的城市", true);
  viewbox.style("cursor", "crosshair").on("click", addState);
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "none"));
}

function addState() {
  const {cells, states, burgs} = pack;
  const point = d3.mouse(this);
  const center = findCell(point[0], point[1]);
  if (cells.h[center] < 20)
    return tip("你不能把国家放入水中。请点击陆地单元格", false, "error");

  let burg = cells.burg[center];
  if (burg && burgs[burg].capital)
    return tip("现有首都不能被选为新的国家首都! 选择其他单元", false, "error");

  if (!burg) burg = addBurg(point); // add new burg

  const oldState = cells.state[center];
  const newState = states.length;

  // turn burg into a capital
  burgs[burg].capital = 1;
  burgs[burg].state = newState;
  moveBurgToGroup(burg, "cities");

  if (d3.event.shiftKey === false) exitAddStateMode();

  const culture = cells.culture[center];
  const basename = center % 5 === 0 ? burgs[burg].name : Names.getCulture(culture);
  const name = Names.getState(basename, culture);
  const color = getRandomColor();

  // generate emblem
  const cultureType = pack.cultures[culture].type;
  const coa = COA.generate(burgs[burg].coa, 0.4, null, cultureType);
  coa.shield = COA.getShield(culture, null);

  // update diplomacy and reverse relations
  const diplomacy = states.map(s => {
    if (!s.i || s.removed) return "x";
    if (!oldState) {
      s.diplomacy.push("Neutral");
      return "Neutral";
    }

    let relations = states[oldState].diplomacy[s.i]; // relations between Nth state and old overlord
    if (s.i === oldState) relations = "Enemy";
    // new state is Enemy to its old overlord
    else if (relations === "Ally") relations = "Suspicion";
    else if (relations === "Friendly") relations = "Suspicion";
    else if (relations === "Suspicion") relations = "Neutral";
    else if (relations === "Enemy") relations = "Friendly";
    else if (relations === "Rival") relations = "Friendly";
    else if (relations === "Vassal") relations = "Suspicion";
    else if (relations === "Suzerain") relations = "Enemy";
    s.diplomacy.push(relations);
    return relations;
  });
  diplomacy.push("x");
  states[0].diplomacy.push([
    `独立宣言`,
    `${name} 宣布从 ${states[oldState].name} 独立`
  ]);

  cells.state[center] = newState;
  cells.province[center] = 0;

  states.push({
    i: newState,
    name,
    diplomacy,
    provinces: [],
    color,
    expansionism: 0.5,
    capital: burg,
    type: "Generic",
    center,
    culture,
    military: [],
    alert: 1,
    coa
  });
  BurgsAndStates.getPoles();
  BurgsAndStates.collectStatistics();
  BurgsAndStates.defineStateForms([newState]);
  adjustProvinces([cells.province[center]]);

  drawStateLabels([newState]);
  COArenderer.add("state", newState, coa, states[newState].pole[0], states[newState].pole[1]);

  layerIsOn("toggleProvinces") && toggleProvinces();
  layerIsOn("toggleStates") ? drawStates() : toggleStates();
  layerIsOn("toggleBorders") ? drawBorders() : toggleBorders();

  statesEditorAddLines();
}

function exitAddStateMode() {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "all"));
  if (statesAdd.classList.contains("pressed")) statesAdd.classList.remove("pressed");
}

function openStateMergeDialog() {
  const emblem = i => /* html */ `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${i}"></use></svg>`;
  const validStates = pack.states.filter(s => s.i && !s.removed);

  const statesSelector = validStates
    .map(
      s => /* html */ `
      <div data-tip="${s.fullName}">
        <input type="radio" name="rulingState" value="${s.i}" />
        <input id="selectState${s.i}" class="checkbox" type="checkbox" name="statesToMerge" value="${s.i}"} />
        <label for="selectState${s.i}" class="checkbox-label">${emblem(s.i)}${s.fullName}</label>
      </div>
    `
    )
    .join("");

  alertMessage.innerHTML = /* html */ `
    <form id='mergeStatesForm' style="overflow: hidden; display: flex; flex-direction: column; gap: 1em;">
      <header style='font-weight:bold;'>选择要并入的多个国家和合并后的统治国家</header>
      <main style='display: grid; grid-template-columns: 1fr 1fr; gap: .3em;'>
        ${statesSelector}
      </main>
    </form>
  `;

  $("#alert").dialog({
    width: fitContent(),
    title: `合并国家`,
    buttons: {
      并入: function () {
        const formData = new FormData(byId("mergeStatesForm"));

        const rulingStateId = Number(formData.get("rulingState"));
        if (!rulingStateId) return tip("请选择并入后的统治国家", false, "error");
        const rullingState = pack.states[rulingStateId];

        const statesToMerge = formData
          .getAll("statesToMerge")
          .map(Number)
          .filter(stateId => stateId !== rulingStateId);
        if (!statesToMerge.length) return tip("请选择被合并的几个国家", false, "error");

        confirmationDialog({
          title: "合并国家",
          // prettier-ignore
          message: /* html */ `
            <p>以下国家将被 <strong>移除</strong>: ${statesToMerge.map(stateId => `${emblem(stateId)}${pack.states[stateId].name}`).join(", ")}.</p>
            <p>删除的国家数据(市镇、省、军队)将分配给以下国家: ${emblem(rullingState.i)}${rullingState.name}.</p>
            <p>你确定要合并国家吗?此操作<strong>无法恢复</strong>。</p>`,
          confirm: "并入",
          onConfirm: () => {
            mergeStates(statesToMerge, rulingStateId);
            $(this).dialog("close");
          }
        });
      },
      取消: function () {
        $(this).dialog("close");
      }
    }
  });

  function mergeStates(statesToMerge, rulingStateId) {
    const rulingState = pack.states[rulingStateId];
    const rulingStateArmy = byId("army" + rulingStateId);

    // remove states to be merged
    statesToMerge.forEach(stateId => {
      const state = pack.states[stateId];
      state.removed = true;

      statesBody.select("#state" + stateId).remove();
      statesBody.select("#state-gap" + stateId).remove();
      statesHalo.select("#state-border" + stateId).remove();
      labels.select("#stateLabel" + stateId).remove();
      defs.select("#textPath_stateLabel" + stateId).remove();

      byId("stateCOA" + stateId).remove();
      emblems.select(`#stateEmblems > use[data-i='${stateId}']`).remove();

      // add merged state regiments to the ruling state
      state.military.forEach(regiment => {
        const oldId = `regiment${stateId}-${regiment.i}`;
        const newIndex = rulingState.military.length;
        rulingState.military.push({...regiment, i: newIndex});
        const newId = `regiment${rulingStateId}-${newIndex}`;

        const note = notes.find(n => n.id === oldId);
        if (note) note.id = newId;

        const element = byId(oldId);
        if (element) {
          element.id = newId;
          element.dataset.state = rulingStateId;
          element.dataset.id = newIndex;
          rulingStateArmy.appendChild(element);
        }
      });

      armies.select("g#army" + stateId).remove();
    });

    // reassing burgs
    pack.burgs.forEach(b => {
      if (statesToMerge.includes(b.state)) {
        if (b.capital) {
          moveBurgToGroup(b.i, "towns");
          b.capital = 0;
        }
        b.state = rulingStateId;
      }
    });

    // reassign provinces
    pack.provinces.forEach((p, i) => {
      if (statesToMerge.includes(p.state)) p.state = rulingStateId;
    });

    // reassing cells
    pack.cells.state.forEach((s, i) => {
      if (statesToMerge.includes(s)) pack.cells.state[i] = rulingStateId;
    });

    unfog();
    debug.selectAll(".highlight").remove();

    BurgsAndStates.getPoles();
    layerIsOn("toggleStates") ? drawStates() : toggleStates();
    layerIsOn("toggleBorders") ? drawBorders() : toggleBorders();
    layerIsOn("toggleProvinces") && drawProvinces();
    drawStateLabels([rulingStateId]);

    refreshStatesEditor();
  }
}

function downloadStatesCsv() {
  const unit = getAreaUnit("2");
  const headers = `Id,State,Full Name,Form,Color,Capital,Culture,Type,Expansionism,Cells,Burgs,Area ${unit},Total Population,Rural Population,Urban Population`;
  const lines = Array.from($body.querySelectorAll(":scope > div"));
  const data = lines.map($line => {
    const {id, name, form, color, capital, culture, type, expansionism, cells, burgs, area, population} = $line.dataset;
    const {fullName = "", rural, urban} = pack.states[+id];
    const ruralPopulation = Math.round(rural * populationRate);
    const urbanPopulation = Math.round(urban * populationRate * urbanization);
    return [
      id,
      name,
      fullName,
      form,
      color,
      capital,
      culture,
      type,
      expansionism,
      cells,
      burgs,
      area,
      population,
      ruralPopulation,
      urbanPopulation
    ].join(",");
  });
  const csvData = [headers].concat(data).join("\n");

  const name = getFileName("States") + ".csv";
  downloadFile(csvData, name);
}

function closeStatesEditor() {
  if (customization === 2) exitStatesManualAssignment(true);
  if (customization === 3) exitAddStateMode();
  debug.selectAll(".highlight").remove();
  $body.innerHTML = "";
}

function updateLockStatus(stateId, classList) {
  const s = pack.states[stateId];
  s.lock = !s.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}
