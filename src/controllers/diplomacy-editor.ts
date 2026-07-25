import { color as d3Color, interpolateString, select } from "d3";
import { destroyDialogIfExists, ensureEl, findEl, getAdjective, getPointer } from "../utils";

interface Relation {
  inText: string;
  color: string;
  tip: string;
}

const relations: Record<string, Relation> = {
  Ally: {
    inText: "结盟",
    color: "#00b300",
    tip: "盟国达成防御协定，在第三方进犯时互相保护"
  },
  Friendly: {
    inText: "友好",
    color: "#d4f8aa",
    tip: "当两个国家存在某些共同利益时即为友好关系"
  },
  Neutral: {
    inText: "中立",
    color: "#edeee8",
    tip: "中立表示两国关系既非正面也非负面"
  },
  Suspicion: {
    inText: "怀疑",
    color: "#eeafaa",
    tip: "怀疑表示国家对另一国持有谨慎的不信任态度"
  },
  Enemy: { inText: "交战", color: "#e64b40", tip: "敌对即处于战争状态的国家" },
  Unknown: {
    inText: "未知",
    color: "#a9a9a9",
    tip: "当两国彼此情报不足时关系即为未知"
  },
  Rival: {
    inText: "竞争",
    color: "#ad5a1f",
    tip: "对手关系即两国争夺该地区的主导权"
  },
  Vassal: { inText: "臣属于", color: "#87CEFA", tip: "藩属国是对其宗主国负有义务的国家" },
  Suzerain: {
    inText: "宗主",
    color: "#00008B",
    tip: "宗主国是对其藩属国拥有一定控制权的国家"
  }
};

// state 0 stores the diplomacy chronicle (array of [title, ...messages]) rather than relations
const getChronicle = () => pack.states[0].diplomacy as unknown as string[][];

function open(): void {
  if (customization) return;
  if (pack.states.filter(s => s.i && !s.removed).length < 2) {
    tip("至少需要 2 个国家才能编辑外交", false, "error");
    return;
  }

  closeDialogs("#diplomacyEditor, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleProvinces")) toggleProvinces();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleReligions")) toggleReligions();

  renderDialog();
  refreshDiplomacyEditor();
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", selectStateOnMapClick);

  $("#diplomacyEditor").dialog({
    title: "外交编辑器",
    resizable: false,
    width: fitContent(),
    close: closeDiplomacyEditor,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("diplomacyEditor");
  const editorHtml = /* html */ `<div id="diplomacyEditor" class="dialog stable">
      <div id="diplomacyHeader" class="header" style="grid-template-columns: 15em 6em">
        <div data-tip="点击按国家名称排序" class="sortable alphabetically" data-sortby="name">
          国家&nbsp;
        </div>
        <div
          data-tip="点击按外交关系排序"
          class="sortable alphabetically"
          data-sortby="relations"
        >
          关系&nbsp;
        </div>
      </div>
      <div id="diplomacyBodySection" class="table"></div>
      <div class="info-line">点击国家名称查看关系。<br />点击关系名称可修改</div>
      <div id="diplomacyBottom" style="margin-top: 0.1em">
        <button id="diplomacyEditorRefresh" data-tip="刷新编辑器" class="icon-cw"></button>
        <button
          id="diplomacyEditStyle"
          data-tip="在样式编辑器中编辑国家（含外交视图）样式"
          class="icon-adjust"
        ></button>
        <button id="diplomacyRegenerate" data-tip="重新生成外交关系" class="icon-retweet"></button>
        <button
          id="diplomacyReset"
          data-tip="将所选国家的外交关系重置为中立"
          class="icon-eraser"
        ></button>
        <button id="diplomacyHistory" data-tip="显示关系历史" class="icon-hourglass-1"></button>
        <button id="diplomacyShowMatrix" data-tip="显示关系矩阵" class="icon-list-bullet"></button>
        <button
          id="diplomacyExport"
          data-tip="将国家关系矩阵保存为文本文件 (.csv)"
          class="icon-download"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  applySortingByHeader("diplomacyHeader");

  ensureEl("diplomacyEditorRefresh").on("click", refreshDiplomacyEditor);
  ensureEl("diplomacyEditStyle").on("click", () => editStyle("regions"));
  ensureEl("diplomacyRegenerate").on("click", regenerateRelations);
  ensureEl("diplomacyReset").on("click", resetRelations);
  ensureEl("diplomacyShowMatrix").on("click", showRelationsMatrix);
  ensureEl("diplomacyHistory").on("click", showRelationsHistory);
  ensureEl("diplomacyExport").on("click", downloadDiplomacyData);

  ensureEl("diplomacyBodySection").addEventListener("click", ev => {
    const el = ev.target as HTMLElement;
    if ((el.parentElement as HTMLElement).classList.contains("Self")) return;

    if (el.classList.contains("changeRelations")) {
      const line = el.parentElement as HTMLElement;
      const subjectId = +line.dataset.id!;
      const objectId = +ensureEl("diplomacyBodySection").querySelector<HTMLElement>("div.Self")!.dataset.id!;
      const currentRelation = line.dataset.relations!;

      selectRelation(subjectId, objectId, currentRelation);
      return;
    }

    // select state of clicked line
    ensureEl("diplomacyBodySection").querySelector("div.Self")!.classList.remove("Self");
    (el.parentElement as HTMLElement).classList.add("Self");
    refreshDiplomacyEditor();
  });
}

function refreshDiplomacyEditor(): void {
  diplomacyEditorAddLines();
  showStateRelations();
}

// add line for each state
function diplomacyEditorAddLines(): void {
  const body = ensureEl("diplomacyBodySection");
  const states = pack.states;
  const selectedLine = body.querySelector<HTMLElement>("div.Self");
  const selectedId = selectedLine ? +selectedLine.dataset.id! : states.find(s => s.i && !s.removed)!.i;
  const selectedName = states[selectedId].name;

  COArenderer.trigger(`stateCOA${selectedId}`, states[selectedId].coa);
  let lines = /* html */ `<div class="states Self" data-id=${selectedId} data-tip="下方列表显示与 ${selectedName} 的关系">
    <div style="width: max-content">${states[selectedId].fullName}</div>
    <svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${selectedId}"></use></svg>
  </div>`;

  for (const state of states) {
    if (!state.i || state.removed || state.i === selectedId) continue;
    const relation = state.diplomacy![selectedId];
    const { color, inText } = relations[relation];

    const tipText = `${state.name} ${inText} ${selectedName}`;
    const tipSelect = `${tipText}。点击查看与 ${state.name} 的关系`;
    const tipChange = `点击更改关系。${tipText}`;

    const name = state.fullName!.length < 23 ? state.fullName : state.name;
    COArenderer.trigger(`stateCOA${state.i}`, state.coa);

    lines += /* html */ `<div class="states" data-id=${state.i} data-name="${name}" data-relations="${relation}">
      <svg data-tip="${tipSelect}" class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${state.i}"></use></svg>
      <div data-tip="${tipSelect}" style="width: 12em">${name}</div>
      <div data-tip="${tipChange}" class="changeRelations" style="width: 6em">
        <fill-box fill="${color}" size=".9em"></fill-box>
        ${relation}
      </div>
    </div>`;
  }
  body.innerHTML = lines;

  // add listeners
  body.querySelectorAll("div.states").forEach(el => {
    el.addEventListener("mouseenter", stateHighlightOn);
  });
  body.querySelectorAll("div.states").forEach(el => {
    el.addEventListener("mouseleave", stateHighlightOff);
  });

  applySorting(ensureEl("diplomacyHeader"));
  $("#diplomacyEditor").dialog();
}

function stateHighlightOn(event: Event): void {
  if (!layerIsOn("toggleStates")) return;
  const state = +(event.target as HTMLElement).dataset.id!;
  if (customization || !state) return;
  const d = select<SVGGElement, unknown>("#regions").select(`#state${state}`).attr("d");

  const path = select("#debug")
    .append("path")
    .attr("class", "highlight")
    .attr("d", d)
    .attr("fill", "none")
    .attr("stroke", "red")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("filter", "url(#blur1)");

  const l = (path.node() as SVGPathElement).getTotalLength();
  const dur = (l + 5000) / 2;
  const i = interpolateString(`0,${l}`, `${l},${l}`);
  path
    .transition()
    .duration(dur)
    .attrTween("stroke-dasharray", () => t => i(t));
}

function stateHighlightOff(): void {
  select("#debug")
    .selectAll<SVGElement, unknown>(".highlight")
    .each(function () {
      select(this).transition().duration(1000).attr("opacity", 0).remove();
    });
}

function showStateRelations(): void {
  const selectedLine = ensureEl("diplomacyBodySection").querySelector<HTMLElement>("div.Self");
  const sel = selectedLine ? +selectedLine.dataset.id! : pack.states.find(s => s.i && !s.removed)!.i;
  if (!sel) return;
  if (!layerIsOn("toggleStates")) toggleStates();

  select<SVGGElement, unknown>("#statesBody")
    .selectAll<SVGPathElement, unknown>("path")
    .each(function () {
      if (this.id.slice(0, 9) === "state-gap") return; // exclude state gap element
      const id = +this.id.slice(5); // state id

      const relation = pack.states[id].diplomacy![sel];
      const color = relations[relation]?.color || "#4682b4";

      this.setAttribute("fill", color);
      select<SVGGElement, unknown>("#statesBody").select(`#state-gap${id}`).attr("stroke", color);
      select<SVGGElement, unknown>("#statesHalo")
        .select(`#state-border${id}`)
        .attr("stroke", d3Color(color)!.darker().hex());
    });
}

function selectStateOnMapClick(this: SVGElement, event: any): void {
  const point = getPointer(event, this);
  const i = findCell(point[0], point[1])!;
  const state = pack.cells.state[i];
  if (!state) return;
  const selectedLine = ensureEl("diplomacyBodySection").querySelector<HTMLElement>("div.Self")!;
  if (+selectedLine.dataset.id! === state) return;

  selectedLine.classList.remove("Self");
  ensureEl("diplomacyBodySection").querySelector(`div[data-id='${state}']`)!.classList.add("Self");
  refreshDiplomacyEditor();
}

function selectRelation(subjectId: number, objectId: number, currentRelation: string): void {
  const states = pack.states;
  const subject = states[subjectId];

  const relationsSelector = Object.entries(relations)
    .map(
      ([relation, { color, inText, tip }]) => /* html */ `
        <div data-tip="${tip}">
          <label class="pointer">
            <input type="radio" name="relationSelect" value="${relation}"
            ${currentRelation === relation ? "checked" : ""} >
            <fill-box fill="${color}" size=".8em"></fill-box>
            ${inText}
        </label>
        </div>
      `
    )
    .join("");

  const objectsSelector = states
    .filter(s => s.i && !s.removed && s.i !== subjectId)
    .map(
      s => /* html */ `
        <div data-tip="${s.fullName}">
          <input id="selectState${s.i}" class="checkbox" type="checkbox" name="objectSelect" value="${s.i}"
          ${s.i === objectId ? "checked" : ""} />
          <label for="selectState${s.i}" class="checkbox-label">
            <svg class="coaIcon" viewBox="0 0 200 200">
              <use href="#stateCOA${s.i}"></use>
            </svg>
            ${s.fullName}
          </label>
        </div>
      `
    )
    .join("");

  alertMessage.innerHTML = /* html */ `
    <form id='relationsForm' style="overflow: hidden; display: flex; flex-direction: column; gap: .3em; padding: 0.1em 0;">
      <header>
        <svg class="coaIcon" viewBox="0 0 200 200">
          <use href="#stateCOA${subject.i}"></use>
        </svg>
        <b>${subject.fullName}</b>
      </header>

      <main style='display: flex; gap: 1em;'>
        <section style="display: flex; flex-direction: column; gap: .3em;">${relationsSelector}</section>
        <section style="display: flex; flex-direction: column; gap: .3em;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3em;">
            <label style="font-weight: 500; font-size: 0.95em;">国家：</label>
            <button id="selectAllNoneBtn" type="button" style="padding: 0.3em 0.8em; cursor: pointer; font-size: 0.9em;" data-tip="切换全选/取消全选国家。也支持 Ctrl+A。">全选 / 取消</button>
          </div>
          <div id="stateSelectionContainer" style="display: flex; flex-direction: column; gap: .3em;">${objectsSelector}</div>
        </section>
      </main>
    </form>
  `;

  $("#alert").dialog({
    width: fitContent(),
    title: `更改关系`,
    buttons: {
      应用: function (this: HTMLElement) {
        const formData = new FormData(ensureEl<HTMLFormElement>("relationsForm"));
        const newRelation = formData.get("relationSelect") as string;
        const objectIds = [...formData.getAll("objectSelect")].map(Number);

        for (const oid of objectIds) {
          changeRelation(subjectId, oid, currentRelation, newRelation);
        }
        $(this).dialog("close");
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });

  // Setup Select All / None toggle functionality
  const selectAllNoneBtn = ensureEl("selectAllNoneBtn");
  const stateCheckboxes = () =>
    document.querySelectorAll<HTMLInputElement>("#stateSelectionContainer input[name='objectSelect']");

  function updateButtonState(): void {
    const checkboxes = stateCheckboxes();
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    if (allChecked && checkboxes.length > 0) selectAllNoneBtn.classList.add("pressed");
    else selectAllNoneBtn.classList.remove("pressed");
  }

  function toggleSelectAll(): void {
    const checkboxes = stateCheckboxes();
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const newState = !allChecked;
    checkboxes.forEach(cb => {
      cb.checked = newState;
    });
    updateButtonState();
  }

  selectAllNoneBtn.addEventListener("click", e => {
    e.preventDefault();
    toggleSelectAll();
  });

  updateButtonState();
}

function changeRelation(subjectId: number, objectId: number, oldRelation: string, newRelation: string): void {
  if (newRelation === oldRelation) return;
  const states = pack.states;
  const chronicle = getChronicle();

  const subjectName = states[subjectId].name;
  const objectName = states[objectId].name;

  states[subjectId].diplomacy![objectId] = newRelation;
  states[objectId].diplomacy![subjectId] =
    newRelation === "Vassal" ? "Suzerain" : newRelation === "Suzerain" ? "Vassal" : newRelation;

  // update relation history
  const change = (): string[] => [
    `关系变化`,
    `${subjectName} 与 ${objectName} 的关系变为 ${newRelation.toLowerCase()}`
  ];
  const ally = (): string[] => [`防御协定`, `${subjectName} 与 ${objectName} 缔结了防御协定`];
  const vassal = (): string[] => [`臣属`, `${subjectName} 成为 ${objectName} 的藩属国`];
  const suzerain = (): string[] => [`臣属`, `${subjectName} 将 ${objectName} 收为藩属`];
  const rival = (): string[] => [`竞争对手`, `${subjectName} 与 ${objectName} 成为竞争对手`];
  const unknown = (): string[] => [
    `关系断绝`,
    `${subjectName} 召回了大使并销毁了所有关于 ${objectName} 的记录`
  ];
  const war = (): string[] => [`宣战`, `${subjectName} 向其敌人 ${objectName} 宣战`];
  const peace = (): string[] => {
    const treaty = `${subjectName} 与 ${objectName} 同意停火并签署了和平条约`;
    const changed =
      newRelation === "Ally"
        ? ally()
        : newRelation === "Vassal"
          ? vassal()
          : newRelation === "Suzerain"
            ? suzerain()
            : newRelation === "Unknown"
              ? unknown()
              : change();
    return [`战争终止`, treaty, changed[1]];
  };

  if (oldRelation === "Enemy") chronicle.push(peace());
  else if (newRelation === "Enemy") chronicle.push(war());
  else if (newRelation === "Vassal") chronicle.push(vassal());
  else if (newRelation === "Suzerain") chronicle.push(suzerain());
  else if (newRelation === "Ally") chronicle.push(ally());
  else if (newRelation === "Unknown") chronicle.push(unknown());
  else if (newRelation === "Rival") chronicle.push(rival());
  else chronicle.push(change());

  refreshDiplomacyEditor();
  if (findEl("diplomacyMatrix")) showRelationsMatrix();
}

function regenerateRelations(): void {
  States.generateDiplomacy();
  refreshDiplomacyEditor();
}

function resetRelations(): void {
  const selectedId = +ensureEl("diplomacyBodySection").querySelector<HTMLElement>("div.Self")!.dataset.id!;
  if (!selectedId) return;
  const states = pack.states;

  states[selectedId].diplomacy!.forEach((relation, index) => {
    if (relation !== "x") {
      states[selectedId].diplomacy![index] = "Neutral";
      states[index].diplomacy![selectedId] = "Neutral";
    }
  });

  refreshDiplomacyEditor();
}

function showRelationsHistory(): void {
  const chronicle = getChronicle();

  let message = /* html */ `<div autocorrect="off" spellcheck="false">`;
  chronicle.forEach((entry, index) => {
    message += `<div>`;
    entry.forEach((line, entryIndex) => {
      message += /* html */ `<div contenteditable="true" data-id="${index}-${entryIndex}"
        ${entryIndex ? "" : "style='font-weight:bold'"}>${line}</div>`;
    });
    message += `&#8205;</div>`;
  });

  if (!chronicle.length) {
    pack.states[0].diplomacy = [[]] as unknown as string[];
    message += /* html */ `<div><div contenteditable="true" data-id="0-0">无历史记录</div>&#8205;</div>`;
  }

  alertMessage.innerHTML = `${message}</div><div class="info-line">输入以编辑。按 Enter 添加新行，清空内容以移除</div>`;
  alertMessage.querySelectorAll("div[contenteditable='true']").forEach(el => {
    el.addEventListener("input", changeReliationsHistory);
  });

  $("#alert").dialog({
    title: "关系历史",
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      保存: function (this: HTMLElement) {
        const data = this.querySelector("div")!.innerText.split("\n").join("\r\n");
        const name = `${getFileName("关系历史")}.txt`;
        downloadFile(data, name);
      },
      清空: function (this: HTMLElement) {
        pack.states[0].diplomacy = [] as unknown as string[];
        $(this).dialog("close");
      },
      关闭: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function changeReliationsHistory(this: HTMLElement): void {
  const i = this.dataset.id!.split("-");
  const group = getChronicle()[+i[0]];
  if (this.innerHTML === "") {
    group.splice(+i[1], 1);
    this.remove();
  } else group[+i[1]] = this.innerHTML;
}

function showRelationsMatrix(): void {
  renderMatrix();
  const states = pack.states.filter(s => s.i && !s.removed);
  const valid = states.map(state => state.i);
  const diplomacyMatrixBody = ensureEl("diplomacyMatrixBody");

  let table = `<table><thead><tr><th data-tip='&#8205;'></th>`;
  table += `${states.map(state => `<th data-tip='与 ${state.fullName} 的关系'>${state.name}</th>`).join("")}</tr>`;
  table += `<tbody>`;

  states.forEach(state => {
    table += `<tr data-id=${state.i}><th data-tip='${state.fullName} 的关系'>${state.name}</th>${state
      .diplomacy!.filter((_v, i) => valid.includes(i))
      .map((relation, index) => {
        const relationObj = relations[relation];
        if (!relationObj) return `<td class='${relation}'>${relation}</td>`;

        const objectState = pack.states[valid[index]];
        const t = `${state.fullName} ${relationObj.inText} ${objectState.fullName}`;
        return `<td data-id=${objectState.i} data-tip='${t}' class='${relation}'>${relation}</td>`;
      })
      .join("")}</tr>`;
  });

  table += `</tbody></table>`;
  diplomacyMatrixBody.innerHTML = table;

  const tableEl = diplomacyMatrixBody.querySelector("table")!;
  tableEl.addEventListener("click", event => {
    const el = event.target as HTMLElement;
    if (el.tagName !== "TD") return;

    const currentRelation = el.innerText;
    if (!relations[currentRelation]) return;

    const subjectId = +el.closest<HTMLElement>("tr")!.dataset.id!;
    const objectId = +el.dataset.id!;

    selectRelation(subjectId, objectId, currentRelation);
  });

  $("#diplomacyMatrix").dialog({
    title: "关系矩阵",
    position: { my: "center", at: "center", of: "svg" },
    close: closeDiplomacyMatrix,
    buttons: {}
  });
}

function renderMatrix(): void {
  destroyDialogIfExists("diplomacyMatrix");
  const matrixHtml = /* html */ `<div id="diplomacyMatrix" class="dialog">
      <div id="diplomacyMatrixBody" class="matrix-table"></div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", matrixHtml);
}

function closeDiplomacyMatrix(): void {
  $("#diplomacyMatrix").dialog("destroy");
  ensureEl("diplomacyMatrix").remove();
}

function downloadDiplomacyData(): void {
  const states = pack.states.filter(s => s.i && !s.removed);
  const valid = states.map(s => s.i);

  let data = `,${states.map(s => s.name).join(",")}\n`; // headers
  states.forEach(s => {
    const rels = s.diplomacy!.filter((_v, i) => valid.includes(i));
    data += `${s.name},${rels.join(",")}\n`;
  });

  const name = `${getFileName("关系")}.csv`;
  downloadFile(data, name);
}

function closeDiplomacyEditor(): void {
  restoreDefaultEvents();
  clearMainTip();
  const selected = ensureEl("diplomacyBodySection").querySelector("div.Self");
  if (selected) selected.classList.remove("Self");
  if (layerIsOn("toggleStates")) drawStates();
  else toggleStates();
  select("#debug").selectAll(".highlight").remove();
  $("#diplomacyEditor").dialog("destroy");
  ensureEl("diplomacyEditor").remove();
}

export const DiplomacyEditor = { open };
