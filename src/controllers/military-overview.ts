import { interpolateString, select, sum } from "d3";
import { Controllers } from "@/controllers";
import { capitalize, ensureEl, rn, sanitizeId, si, wiki } from "../utils";

function open(): void {
  if (customization) return;
  closeDialogs("#militaryOverview, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (!layerIsOn("toggleMilitary")) toggleMilitary();

  renderDialog();
  updateHeaders();
  refreshMilitaryOverview();

  $("#militaryOverview").dialog({
    title: "军事总览",
    resizable: false,
    width: fitContent(),
    close: closeMilitaryOverview,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  document.getElementById("militaryOverview")?.remove();
  const editorHtml = /* html */ `<div id="militaryOverview" class="dialog stable">
      <div id="militaryHeader" class="header">
        <div data-tip="国家名称。点击排序" class="sortable alphabetically" data-sortby="state">
          国家&nbsp;
        </div>
        <div
          data-tip="总军事人员（含船员）。点击排序"
          id="militaryTotal"
          class="sortable icon-sort-number-down"
          data-sortby="total"
        >
          总数&nbsp;
        </div>
        <div data-tip="国家人口。点击排序" class="sortable" data-sortby="population">
          人口&nbsp;
        </div>
        <div
          data-tip="军事人员比率（占国家人口百分比）。取决于战争警戒。点击排序"
          class="sortable"
          data-sortby="rate"
        >
          比率&nbsp;
        </div>
        <div
          data-tip="战争警戒。军事力量数量的修正值，取决于政治形势。点击排序"
          class="sortable"
          data-sortby="alert"
        >
          战争警戒&nbsp;
        </div>
      </div>
      <div id="militaryBody" class="table" data-type="absolute"></div>
      <div id="militaryFooter" class="totalLine">
        <div data-tip="国家数量" style="margin-left: 4px">
          国家:&nbsp;<span id="militaryFooterStates">0</span>
        </div>
        <div data-tip="总军事力量" style="margin-left: 14px">
          总力量:&nbsp;<span id="militaryFooterForcesTotal">0</span>
        </div>
        <div data-tip="每国平均军事力量" style="margin-left: 14px">
          平均力量:&nbsp;<span id="militaryFooterForces">0</span>
        </div>
        <div data-tip="每国平均力量比率" style="margin-left: 14px">
          平均比率:&nbsp;<span id="militaryFooterRate">0%</span>
        </div>
        <div data-tip="平均战争警戒" style="margin-left: 14px">
          平均警戒:&nbsp;<span id="militaryFooterAlert">0</span>
        </div>
      </div>
      <div id="militaryBottom">
        <button id="militaryOverviewRefresh" data-tip="刷新总览界面" class="icon-cw"></button>
        <button id="militaryOptionsButton" data-tip="编辑军事单位" class="icon-cog"></button>
        <button id="militaryRegimentsList" data-tip="显示军团列表" class="icon-list-bullet"></button>
        <button
          id="militaryPercentage"
          data-tip="切换百分比/绝对值视图"
          class="icon-percent"
        ></button>
        <button
          id="militaryOverviewRecalculate"
          data-tip="基于当前选项重新计算军事力量"
          class="icon-retweet"
        ></button>
        <button
          id="militaryExport"
          data-tip="将军事相关数据保存为文本文件 (.csv)"
          class="icon-download"
        ></button>
        <button id="militaryWiki" data-tip="打开军事力量教程" class="icon-info"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  applySortingByHeader("militaryHeader");

  const body = ensureEl("militaryBody");

  ensureEl("militaryOverviewRefresh").addEventListener("click", refreshMilitaryOverview);
  ensureEl("militaryPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("militaryOptionsButton").addEventListener("click", militaryCustomize);
  ensureEl("militaryRegimentsList").addEventListener("click", () => openRegimentsOverview(-1));
  ensureEl("militaryOverviewRecalculate").addEventListener("click", militaryRecalculate);
  ensureEl("militaryExport").addEventListener("click", downloadMilitaryData);
  ensureEl("militaryWiki").addEventListener("click", () => wiki("Military-Forces"));

  body.addEventListener("change", event => {
    const el = event.target as HTMLInputElement;
    const line = el.parentNode as HTMLElement;
    const state = +line.dataset.id!;
    changeAlert(state, line, +el.value);
  });

  body.addEventListener("click", event => {
    const el = event.target as HTMLElement;
    const line = el.parentNode as HTMLElement;
    const state = +line.dataset.id!;
    if (el.tagName === "SPAN") openRegimentsOverview(state);
  });
}

function closeMilitaryOverview(): void {
  $("#militaryOverview").dialog("destroy");
  ensureEl("militaryOverview").remove();
}

async function openRegimentsOverview(state: number): Promise<void> {
  Controllers.RegimentsOverview.open(state);
}

// update military types in header and tooltips
function updateHeaders(): void {
  const header = ensureEl("militaryHeader");
  const units = options.military.length;
  header.style.gridTemplateColumns = `8em repeat(${units}, 5.2em) 4em 7em 5em 6em`;

  header.querySelectorAll(".removable").forEach(el => {
    el.remove();
  });
  const insert = (html: string) => ensureEl("militaryTotal").insertAdjacentHTML("beforebegin", html);
  for (const u of options.military) {
    const label = capitalize(u.name.replace(/_/g, " "));
    insert(
      `<div data-tip="国家 ${
        u.name
      } 单位数量。点击排序" class="sortable removable" data-sortby="${u.name.toLowerCase()}">${label}&nbsp;</div>`
    );
  }
  header.querySelectorAll<HTMLElement>(".removable").forEach(el => {
    el.addEventListener("click", () => sortLines(el));
  });
}

// add line for each state
function refreshMilitaryOverview(): void {
  const body = ensureEl("militaryBody");
  body.innerHTML = "";
  let lines = "";
  const states = pack.states.filter(s => s.i && !s.removed);

  for (const s of states) {
    const population = rn((s.rural! + s.urban! * urbanization) * populationRate);
    const getForces = (u: MilitaryUnit) => (s.military || []).reduce((acc, r) => acc + (r.u[u.name] || 0), 0);
    const total = options.military.reduce((acc, u) => acc + getForces(u) * u.crew, 0);
    const rate = (total / population) * 100;

    const sortData = options.military.map(u => `data-${u.name.toLowerCase()}="${getForces(u)}"`).join(" ");
    const lineData = options.military
      .map(u => `<div data-type="${u.name}" data-tip="国家 ${u.name} 单位数量">${getForces(u)}</div>`)
      .join(" ");

    lines += /* html */ `<div
        class="states"
        data-id=${s.i}
        data-state="${s.name}"
        ${sortData}
        data-total="${total}"
        data-population="${population}"
        data-rate="${rate}"
        data-alert="${s.alert}"
      >
        <fill-box data-tip="${s.fullName}" fill="${s.color}" disabled></fill-box>
        <input data-tip="${s.fullName}" style="width:6em" value="${s.name}" readonly />
        ${lineData}
        <div data-type="total" data-tip="国家军事人员总数（含船员）" style="font-weight: bold">${si(total)}</div>
        <div data-type="population" data-tip="国家人口">${si(population)}</div>
        <div data-type="rate" data-tip="军事人员比率（占国家人口百分比）。取决于战争警戒">${rn(rate, 2)}%</div>
        <input
          data-tip="战争警戒。可编辑的军事力量数量修正值，取决于政治形势"
          style="width:4.1em"
          type="number"
          min="0"
          step=".01"
          value="${rn(s.alert ?? 0, 2)}"
        />
        <span data-tip="显示军团列表" class="icon-list-bullet pointer"></span>
      </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);
  updateFooter();

  // add listeners
  body.querySelectorAll<HTMLElement>("div.states").forEach(el => {
    el.addEventListener("mouseenter", event => stateHighlightOn(event));
  });
  body.querySelectorAll<HTMLElement>("div.states").forEach(el => {
    el.addEventListener("mouseleave", event => stateHighlightOff(event));
  });

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(ensureEl("militaryHeader"));
}

function changeAlert(state: number, line: HTMLElement, alert: number): void {
  const s = pack.states[state];
  const prevAlert = s.alert ?? 1;
  const dif = prevAlert ? alert / prevAlert : 0; // modifier
  s.alert = alert;
  line.dataset.alert = String(alert);

  (s.military || []).forEach(r => {
    Object.keys(r.u).forEach(u => {
      r.u[u] = rn(r.u[u] * dif);
    });
    r.a = sum(Object.values(r.u)); // change total
    select<SVGGElement, unknown>(`#armies > g > g#regiment${s.i}-${r.i} > text`).text(Military.getTotal(r)); // change icon text
  });

  const getForces = (u: MilitaryUnit) => (s.military || []).reduce((acc, r) => acc + (r.u[u.name] || 0), 0);
  options.military.forEach(u => {
    const forces = getForces(u);
    line.dataset[u.name] = String(forces);
    line.querySelector(`div[data-type='${u.name}']`)!.innerHTML = String(forces);
  });

  const population = rn((s.rural! + s.urban! * urbanization) * populationRate);
  const total = options.military.reduce((acc, u) => acc + getForces(u) * u.crew, 0);
  line.dataset.total = String(total);
  const rate = (total / population) * 100;
  line.dataset.rate = String(rate);
  line.querySelector("div[data-type='total']")!.innerHTML = si(total);
  line.querySelector("div[data-type='rate']")!.innerHTML = `${rn(rate, 2)}%`;

  updateFooter();
}

function updateFooter(): void {
  const body = ensureEl("militaryBody");
  const lines = Array.from(body.querySelectorAll<HTMLElement>(":scope > div"));
  const statesNumber = pack.states.filter(s => s.i && !s.removed).length;
  ensureEl("militaryFooterStates").innerHTML = String(statesNumber);
  const total = sum(lines.map(el => +el.dataset.total!));
  ensureEl("militaryFooterForcesTotal").innerHTML = si(total);
  ensureEl("militaryFooterForces").innerHTML = si(total / statesNumber);
  ensureEl("militaryFooterRate").innerHTML = `${rn(sum(lines.map(el => +el.dataset.rate!)) / statesNumber, 2)}%`;
  ensureEl("militaryFooterAlert").innerHTML = String(rn(sum(lines.map(el => +el.dataset.alert!)) / statesNumber, 2));
}

function stateHighlightOn(event: Event): void {
  const target = event.target as HTMLElement;
  const state = +target.dataset.id!;
  if (customization || !state) return;
  select<SVGGElement, unknown>(`#armies > g > g#army${state}`).transition().duration(2000).style("fill", "#ff0000");

  if (!layerIsOn("toggleStates")) return;
  const d = select<SVGGElement, unknown>("#regions").select(`#state${state}`).attr("d");

  const path = select<SVGGElement, unknown>("#debug")
    .append("path")
    .attr("class", "highlight")
    .attr("d", d)
    .attr("fill", "none")
    .attr("stroke", "red")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("filter", "url(#blur1)");

  const l = path.node()!.getTotalLength();
  const dur = (l + 5000) / 2;
  const i = interpolateString(`0,${l}`, `${l},${l}`);
  path
    .transition()
    .duration(dur)
    .attrTween("stroke-dasharray", () => t => i(t));
}

function stateHighlightOff(event: Event): void {
  select<SVGGElement, unknown>("#debug")
    .selectAll(".highlight")
    .each(function () {
      select(this).transition().duration(1000).attr("opacity", 0).remove();
    });

  const target = event.target as HTMLElement;
  const state = +target.dataset.id!;
  select<SVGGElement, unknown>(`#armies > g > g#army${state}`).transition().duration(1000).style("fill", null);
}

function togglePercentageMode(): void {
  const body = ensureEl("militaryBody");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const lines = body.querySelectorAll<HTMLElement>(":scope > div");
    const array = Array.from(lines);
    const cache: Record<string, number> = {};

    const total = (type: string): number => {
      if (cache[type]) return cache[type];
      cache[type] = sum(array.map(el => +(el.dataset[type] || 0)));
      return cache[type];
    };

    lines.forEach(el => {
      el.querySelectorAll<HTMLElement>("div").forEach(div => {
        const type = div.dataset.type!;
        if (type === "rate") return;
        const elTotal = total(type);
        div.textContent = elTotal ? `${rn((+(el.dataset[type] || 0) / elTotal) * 100)}%` : "0%";
      });
    });
  } else {
    body.dataset.type = "absolute";
    refreshMilitaryOverview();
  }
}

function militaryCustomize(): void {
  renderOptions();
  const types = ["melee", "ranged", "mounted", "machinery", "naval", "armored", "aviation", "magical"];
  const tableBody = ensureEl("militaryOptions").querySelector("tbody")!;
  removeUnitLines();
  options.military.map(unit => addUnitLine(unit));

  $("#militaryOptions").dialog({
    title: "编辑军事单位",
    resizable: false,
    width: fitContent(),
    position: { my: "center", at: "center", of: "svg" },
    close: closeMilitaryOptions,
    buttons: {
      应用: applyMilitaryOptions,
      添加: () =>
        addUnitLine({
          icon: "🛡️",
          name: `custom${ensureEl<HTMLTableElement>("militaryOptionsTable").rows.length}`,
          rural: 0.2,
          urban: 0.5,
          crew: 1,
          power: 1,
          type: "melee",
          separate: 0
        }),
      恢复: restoreDefaultUnits,
      取消: function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      const buttons = $(this).dialog("widget").find(".ui-dialog-buttonset > button");
      buttons[0].addEventListener("mousemove", () =>
        tip("应用军事单位设置。<span style='color:#cb5858'>所有兵力将被重新计算！</span>")
      );
      buttons[1].addEventListener("mousemove", () => tip("向表格添加新的军事单位"));
      buttons[2].addEventListener("mousemove", () => tip("恢复默认军事单位和设置"));
      buttons[3].addEventListener("mousemove", () => tip("关闭窗口且不保存更改"));
    }
  });

  if (modules.overviewMilitaryCustomize) return;
  modules.overviewMilitaryCustomize = true;

  tableBody.addEventListener("click", event => {
    const el = event.target as HTMLElement;
    if (el.tagName !== "BUTTON") return;
    const type = el.dataset.type;

    if (type === "icon") {
      selectIcon(el.textContent || "", value => {
        el.innerHTML =
          value.startsWith("http") || value.startsWith("data:image")
            ? `<img src="${value}" style="width:1.2em;height:1.2em;pointer-events:none;">`
            : value;
      });
      return;
    }

    if (type === "biomes") {
      const { i, name, color } = biomesData;
      const biomes = Array(i.length)
        .fill(null)
        .map((_, idx) => ({ i: idx, name: name[idx], color: color[idx] }));
      selectLimitation(el, biomes);
      return;
    }
    if (type === "states") return selectLimitation(el, pack.states);
    if (type === "cultures") return selectLimitation(el, pack.cultures);
    if (type === "religions") return selectLimitation(el, pack.religions);
  });

  function removeUnitLines(): void {
    tableBody.querySelectorAll("tr").forEach(el => {
      el.remove();
    });
  }

  function getLimitValue(attr?: number[]): string {
    return attr?.join(",") || "";
  }

  function getLimitText(attr?: number[]): string {
    return attr?.length ? "部分" : "全部";
  }

  function getLimitTip(attr: number[] | undefined, data: { name?: string }[] | undefined): string {
    if (!attr?.length) return "";
    return attr.map(i => data?.[i]?.name || "").join(", ");
  }

  function addUnitLine(unit: MilitaryUnit): void {
    const { type, icon, name, rural, urban, power, crew, separate } = unit;
    const row = document.createElement("tr");
    const typeOptions = types.map(t => `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`).join(" ");

    const getLimitButton = (attr: "biomes" | "states" | "cultures" | "religions"): string => {
      const data = attr === "biomes" ? [] : (pack[attr] as { name?: string }[]);
      return `<button
          data-tip="选择允许的 ${attr}"
          data-type="${attr}"
          title="${getLimitTip(unit[attr], data)}"
          data-value="${getLimitValue(unit[attr])}">
          ${getLimitText(unit[attr])}
        </button>`;
    };

    row.innerHTML = /* html */ `<td>
          <button data-type="icon" data-tip="点击选择单位图标">
            ${
              icon.startsWith("http") || icon.startsWith("data:image")
                ? `<img src="${icon}" style="width:1.2em;height:1.2em;pointer-events:none;">`
                : icon || ""
            }
          </button>
        </td>
        <td><input data-tip="输入单位名称。若更改现有单位名称，旧单位将被替换" value="${name}" /></td>
        <td>${getLimitButton("biomes")}</td>
        <td>${getLimitButton("states")}</td>
        <td>${getLimitButton("cultures")}</td>
        <td>${getLimitButton("religions")}</td>
        <td><input data-tip="输入农村人口的征召百分比" type="number" min="0" max="100" step=".01" value="${rural}" /></td>
        <td><input data-tip="输入城市人口的征召百分比" type="number" min="0" max="100" step=".01" value="${urban}" /></td>
        <td><input data-tip="输入船员平均人数（用于总人员计算）" type="number" min="1" step="1" value="${crew}" /></td>
        <td><input data-tip="输入军事力量（用于战斗模拟）" type="number" min="0" step=".1" value="${power}" /></td>
        <td>
          <select data-tip="选择单位类型以在兵力重算时应用特殊规则">
            ${typeOptions}
          </select>
        </td>
        <td data-tip="勾选表示单位是<b>独立</b>的，仅能与相同单位堆叠">
          <input id="${name}Separate" type="checkbox" class="checkbox" ${separate ? "checked" : ""} />
          <label for="${name}Separate" class="checkbox-label"></label>
        </td>
        <td data-tip="移除该单位">
          <span data-tip="移除单位类型" class="icon-trash-empty pointer" onclick="this.parentElement.parentElement.remove();"></span>
        </td>`;
    tableBody.appendChild(row);
  }

  function restoreDefaultUnits(): void {
    removeUnitLines();
    Military.getDefaultOptions().map((unit: MilitaryUnit) => addUnitLine(unit));
  }

  function selectLimitation(
    el: HTMLElement,
    data: { i: number; name?: string; fullName?: string; color?: string; removed?: boolean }[]
  ): void {
    const type = el.dataset.type!;
    const value = el.dataset.value;
    const initial = value ? value.split(",").map(v => +v) : [];

    const filtered = data.filter(datum => datum.i && !datum.removed);
    const lines = filtered.map(
      ({ i, name, fullName, color }) => /* html */ `
          <tr data-tip="${name}">
            <td><span style="color:${color}">⬤</span></td>
            <td>
              <input data-i="${i}" id="el${i}" type="checkbox" class="checkbox"
                ${!initial.length || initial.includes(i) ? "checked" : ""} >
              <label for="el${i}" class="checkbox-label">${fullName || name}</label>
            </td>
          </tr>`
    );

    ensureEl("alertMessage").innerHTML = /* html */ `<b>按 ${type} 限制单位：</b>
        <table style="margin-top:.3em">
          <tbody>
            ${lines.join("")}
          </tbody>
        </table>`;

    $("#alert").dialog({
      width: fitContent(),
      title: "限制单位",
      buttons: {
        反选: () => {
          alertMessage.querySelectorAll<HTMLInputElement>("input").forEach(el => {
            el.checked = !el.checked;
          });
        },
        应用: function () {
          const inputs = Array.from(alertMessage.querySelectorAll<HTMLInputElement>("input"));
          const selected = inputs.reduce<string[]>((acc, input) => {
            if (input.checked) acc.push(input.dataset.i!);
            return acc;
          }, []);

          if (!selected.length) {
            tip("至少选择一个元素", false, "error");
            return;
          }

          const allAreSelected = selected.length === inputs.length;
          el.dataset.value = allAreSelected ? "" : selected.join(",");
          el.innerHTML = allAreSelected ? "全部" : "部分";
          el.setAttribute("title", getLimitTip(selected.map(Number), data));
          $(this).dialog("close");
        },
        取消: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function applyMilitaryOptions(): void {
    const unitLines = Array.from(tableBody.querySelectorAll("tr"));
    const names = unitLines.map(r => sanitizeId(r.querySelector("input")!.value));
    if (new Set(names).size !== names.length) {
      tip("所有单位必须具有唯一名称", false, "error");
      return;
    }

    $("#militaryOptions").dialog("close");

    options.military = unitLines.map((r, i) => {
      const elements = Array.from(
        r.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input, button, select")
      );
      const values = elements.map(el => {
        const { type, value } = (el as HTMLElement).dataset || {};
        if (type === "icon") {
          const html = el.innerHTML.trim();
          const isImage = html.startsWith("<img");
          return isImage ? html.match(/src="([^"]*)"/)![1] : html || "⠀";
        }
        if (type) return value ? value.split(",").map(v => parseInt(v, 10)) : null;
        if ((el as HTMLInputElement).type === "number") return +(el as HTMLInputElement).value || 0;
        if ((el as HTMLInputElement).type === "checkbox") return +(el as HTMLInputElement).checked || 0;
        return (el as HTMLInputElement).value;
      }) as [
        string,
        undefined,
        number[] | null,
        number[] | null,
        number[] | null,
        number[] | null,
        number,
        number,
        number,
        number,
        string,
        number
      ];
      const [icon, , biomes, states, cultures, religions, rural, urban, crew, power, type, separate] = values;

      const unit: MilitaryUnit = {
        icon,
        name: names[i],
        rural,
        urban,
        crew,
        power,
        type,
        separate
      };
      if (biomes) unit.biomes = biomes;
      if (states) unit.states = states;
      if (cultures) unit.cultures = cultures;
      if (religions) unit.religions = religions;
      return unit;
    });
    localStorage.setItem("military", JSON.stringify(options.military));
    Military.generate();
    updateHeaders();
    refreshMilitaryOverview();
  }
}

function renderOptions(): void {
  document.getElementById("militaryOptions")?.remove();
  const optionsHtml = /* html */ `<div id="militaryOptions" class="dialog stable">
      <div class="table">
        <table id="militaryOptionsTable">
          <thead>
            <tr>
              <th data-tip="单位图标">图标</th>
              <th data-tip="单位名称。若更改现有单位名称，旧单位将被替换">单位名称</th>
              <th style="width: 5em" data-tip="选择允许的生物群落">生物群落</th>
              <th style="width: 5em" data-tip="选择允许的国家">国家</th>
              <th style="width: 5em" data-tip="选择允许的文化">文化</th>
              <th style="width: 5em" data-tip="选择允许的宗教">宗教</th>
              <th data-tip="农村人口的征召百分比">农村</th>
              <th data-tip="城市人口的征召百分比">城市</th>
              <th data-tip="船员平均人数（用于总人员计算）">船员</th>
              <th data-tip="单位军事力量（用于战斗模拟）">力量</th>
              <th data-tip="单位类型，用于在兵力重算时应用特殊规则">类型</th>
              <th data-tip="勾选表示单位是独立的，仅能与相同类型的单位堆叠">
                独立
              </th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", optionsHtml);
}

function closeMilitaryOptions(): void {
  $("#militaryOptions").dialog("destroy");
  ensureEl("militaryOptions").remove();
}

function militaryRecalculate(): void {
  ensureEl("alertMessage").innerHTML = "确定要为所有国家重新计算军事力量吗？<br>所有国家的军团将被重新生成";
  $("#alert").dialog({
    resizable: false,
    title: "重新计算军事",
    buttons: {
      重新计算: function () {
        $(this).dialog("close");
        Military.generate();
        refreshMilitaryOverview();
      },
      取消: function () {
        $(this).dialog("close");
      }
    }
  });
}

function downloadMilitaryData(): void {
  const body = ensureEl("militaryBody");
  const units = options.military.map(u => u.name);
  let data = `Id,State,${units.map(u => capitalize(u)).join(",")},Total,Population,Rate,War Alert\n`; // headers

  body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
    data += `${el.dataset.id},`;
    data += `${el.dataset.state},`;
    data += `${units.map(u => el.dataset[u.toLowerCase()]).join(",")},`;
    data += `${el.dataset.total},`;
    data += `${el.dataset.population},`;
    data += `${rn(Number(el.dataset.rate), 2)}%,`;
    data += `${el.dataset.alert}\n`;
  });

  const name = `${getFileName("Military")}.csv`;
  downloadFile(data, name);
}

export const MilitaryOverview = { open, refresh: refreshMilitaryOverview };
