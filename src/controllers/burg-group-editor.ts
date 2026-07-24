import { destroyDialogIfExists, ensureEl, findEl } from "../utils";

const GROUP_NAME_REGEXP = /^[\p{L}_][\p{L}\p{N}_-]*$/u;

function editBurgGroups(): void {
  if (customization) return;
  renderDialog();
  addLines();

  $("#burgGroupsEditor").dialog({
    title: "配置城镇分组",
    resizable: false,
    position: { my: "center", at: "center", of: "svg" },
    close: closeBurgGroupsEditor,
    buttons: {
      应用: () => {
        ensureEl<HTMLFormElement>("burgGroupsForm").requestSubmit();
      },
      添加: () => {
        ensureEl("burgGroupsBody").insertAdjacentHTML("beforeend", createLine({ name: "", active: true }));
      },
      恢复: () => {
        options.burgs.groups = Burgs.getDefaultGroups() as typeof options.burgs.groups;
        addLines();
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("burgGroupsEditor");
  const html = /* html */ `<div id="burgGroupsEditor" class="dialog stable">
    <form id="burgGroupsForm">
      <table class="table">
        <thead>
          <tr>
            <th data-tip="渲染顺序：值越大越在上层渲染">顺序</th>
            <th data-tip="输入分组名称">名称</th>
            <th data-tip="城镇预览生成器">预览生成器</th>
            <th data-tip="设置最小人口约束" colspan="3">人口</th>
            <th data-tip="选择允许的生物群系">生物群系</th>
            <th data-tip="选择允许的国家">国家</th>
            <th data-tip="选择允许的文化">文化</th>
            <th data-tip="选择允许的宗教">宗教</th>
            <th data-tip="选择允许的特征">特征</th>
            <th data-tip="分组中的城镇数量">数量</th>
            <th data-tip="激活/停用分组">激活</th>
            <th data-tip="当城镇不符合其他分组条件时分配的分组">
              默认
            </th>
          </tr>
        </thead>
        <tbody id="burgGroupsBody"></tbody>
      </table>
    </form>
    <div style="padding: 0.5em 0; font-style: italic;">锁定的城镇不受分组更改的影响。</div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("burgGroupsForm")
    .on("change", validateForm)
    .on("submit", submitForm as EventListener);
  ensureEl("burgGroupsBody").on("click", (ev: Event) => {
    const el = ev.target as HTMLElement;
    const line = el.closest("tr");
    if (!line) return;

    if (el.getAttribute("name") === "biomes") {
      const biomes = Array(biomesData.i.length)
        .fill(null)
        .map((_, i) => ({ i, name: biomesData.name[i], color: biomesData.color[i] }));
      return selectLimitation(el, biomes);
    }
    if (el.getAttribute("name") === "states") return selectLimitation(el, pack.states);
    if (el.getAttribute("name") === "cultures") return selectLimitation(el, pack.cultures);
    if (el.getAttribute("name") === "religions") return selectLimitation(el, pack.religions);
    if (el.getAttribute("name") === "features") return selectFeaturesLimitation(el);
    if (el.getAttribute("name") === "up") {
      const prev = line.previousElementSibling;
      if (prev) line.parentNode!.insertBefore(line, prev);
      return;
    }
    if (el.getAttribute("name") === "down") {
      const next = line.nextElementSibling;
      if (next) line.parentNode!.insertBefore(next, line);
      return;
    }
    if (el.getAttribute("name") === "remove") return removeLine(line);
  });
}

function closeBurgGroupsEditor(): void {
  $("#burgGroupsEditor").dialog("destroy");
  ensureEl("burgGroupsEditor").remove();
}

function addLines(): void {
  const lines = options.burgs.groups.map(createLine);
  ensureEl("burgGroupsBody").innerHTML = lines.join("");
}

function createLine(group: any): string {
  const count = pack.burgs.filter(burg => !burg.removed && burg.group === group.name).length;
  // prettier-ignore
  return /* html */ `<tr name="${group.name}">
      <td data-tip="渲染顺序：值越大越在上层渲染"><input type="number" name="order" min="1" max="999" step="1" required value="${group.order || ""}" /></td>
      <td data-tip="输入分组名称。必须以字母或下划线开头，后跟字母、数字、下划线或连字符。不允许空格"><input type="text" name="name" value="${group.name}" required /></td>
      <td data-tip="城镇预览生成器">
        <select name="preview">
          <option value="" ${!group.preview ? "selected" : ""}>无</option>
          <option value="watabou-city" ${group.preview === "watabou-city" ? "selected" : ""}>Watabou City</option>
          <option value="watabou-village" ${group.preview === "watabou-village" ? "selected" : ""}>Watabou Village</option>
          <option value="watabou-dwelling" ${group.preview === "watabou-dwelling" ? "selected" : ""}>Watabou Dwelling</option>
        </select>
      </td>
      <td data-tip="以人口点数设置最小人口约束（参见单位编辑器中的乘数）"><input type="number" name="min" min="0" step="any" value="${group.min || ""}" /></td>
      <td data-tip="以人口点数设置最大人口约束（参见单位编辑器中的乘数）"><input type="number" name="max" min="0" step="any" value="${group.max || ""}" /></td>
      <td data-tip="设置人口百分位数：0-100，其中 90 表示该城镇人口必须高于 90% 的城镇"><input type="number" name="percentile" min="0" max="100" step="any" value="${group.percentile || ""}" /></td>
      <td data-tip="选择允许的生物群系">
        <input type="hidden" name="biomes" value="${group.biomes || ""}">
        <button type="button" name="biomes">${group.biomes ? "部分" : "全部"}</button>
      </td>
      <td data-tip="选择允许的国家">
        <input type="hidden" name="states" value="${group.states || ""}">
        <button type="button" name="states">${group.states ? "部分" : "全部"}</button>
      </td>
      <td data-tip="选择允许的文化">
        <input type="hidden" name="cultures" value="${group.cultures || ""}">
        <button type="button" name="cultures">${group.cultures ? "部分" : "全部"}</button>
      </td>
      <td data-tip="选择允许的宗教">
        <input type="hidden" name="religions" value="${group.religions || ""}">
        <button type="button" name="religions">${group.religions ? "部分" : "全部"}</button>
      </td>
      <td data-tip="选择允许的特征" >
        <input type="hidden" name="features" value='${JSON.stringify(group.features || {})}'>
        <button type="button" name="features">${Object.keys(group.features || {}).length ? "部分" : "任意"}</button>
      </td>
      <td data-tip="分组中的城镇数量">${count}</td>
      <td data-tip="激活/停用分组"><input type="checkbox" name="active" class="native" ${group.active && "checked"} /></td>
      <td data-tip="当其他分组未通过时分配的分组"><input type="radio" name="isDefault" ${group.isDefault && "checked"}></td>
      <td data-tip="分配顺序：上移分组"><button type="button" name="up" class="icon-up-big"></button></td>
      <td data-tip="分配顺序：下移分组"><button type="button" name="down" class="icon-down-big"></button></td>
      <td data-tip="移除分组"><button type="button" name="remove" class="icon-trash"></button></td>
    </tr>`;
}

function selectLimitation(
  el: HTMLElement,
  data: { i: number; name: string; fullName?: string; color?: string; removed?: boolean }[]
): void {
  const value = (el.previousElementSibling as HTMLInputElement).value;
  const initial = value ? value.split(",").map(v => +v) : [];

  const filtered = data.filter(datum => datum.i && !datum.removed);
  const lines = filtered.map(
    ({ i, name, fullName, color }) => /* html */ `
        <tr data-tip="${name}">
          <td>
            <span style="color:${color}">⬤</span>
          </td>
          <td>
            <input data-i="${i}" id="el${i}" type="checkbox" class="checkbox" ${
              !initial.length || initial.includes(i) ? "checked" : ""
            } >
            <label for="el${i}" class="checkbox-label">${fullName || name}</label>
          </td>
        </tr>`
  );

  alertMessage.innerHTML = /* html */ `<b>按 ${el.getAttribute("name")} 限制分组：</b>
      <table style="margin-top:.3em">
        <tbody>
          ${lines.join("")}
        </tbody>
      </table>`;

  $("#alert").dialog({
    width: fitContent(),
    title: "限制分组",
    buttons: {
      反转: () => {
        alertMessage.querySelectorAll<HTMLInputElement>("input").forEach(input => {
          input.checked = !input.checked;
        });
      },
      应用: function (this: HTMLElement) {
        const inputs = Array.from(alertMessage.querySelectorAll<HTMLInputElement>("input"));
        const selected = inputs.reduce<string[]>((acc, input) => {
          if (input.checked) acc.push(input.dataset.i!);
          return acc;
        }, []);

        if (!selected.length) return tip("至少选择一个元素", false, "error");

        const allAreSelected = selected.length === inputs.length;
        (el.previousElementSibling as HTMLInputElement).value = allAreSelected ? "" : selected.join(",");
        el.innerHTML = allAreSelected ? "全部" : "部分";
        $(this).dialog("close");
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function selectFeaturesLimitation(el: HTMLElement): void {
  const value = (el.previousElementSibling as HTMLInputElement).value;
  const initial: Record<string, boolean> = value ? JSON.parse(value) : {};

  const features = [
    { name: "capital", icon: "icon-star" },
    { name: "port", icon: "icon-anchor" },
    { name: "citadel", icon: "icon-chess-rook" },
    { name: "walls", icon: "icon-fort-awesome" },
    { name: "plaza", icon: "icon-store" },
    { name: "temple", icon: "icon-chess-bishop" },
    { name: "shanty", icon: "icon-campground" }
  ];

  const lines = features.map(
    // prettier-ignore
    ({ name, icon }) => /* html */ `
        <tr data-tip="选择城镇特征的限制：${name}">
          <td>
            <span class="${icon}"></span>
            <span style="margin-left:.2em">${name}</span>
          </td>
          <td>
            <input type="radio" name="${name}" value="true" ${initial[name] === true ? "checked" : ""} style="margin:0" >
          </td>
          <td>
            <input type="radio" name="${name}" value="false" ${initial[name] === false ? "checked" : ""} style="margin:0">
          </td>
          <td>
            <input type="radio" name="${name}" value="undefined" ${initial[name] === undefined ? "checked" : ""} style="margin:0">
          </td>
        </tr>`
  );

  alertMessage.innerHTML = /* html */ `
      <form id="featuresLimitationForm">
        <table>
          <thead style="font-weight:bold">
            <td style="width:6em">特征</td>
            <td style="width:3em">是</td>
            <td style="width:3em">否</td>
            <td style="width:3em">任意</td>
          </thead>
          <tbody>
            ${lines.join("")}
          </tbody>
        </table>
      </form>`;

  $("#alert").dialog({
    width: fitContent(),
    title: "按特征限制分组",
    buttons: {
      应用: function (this: HTMLElement) {
        const form = ensureEl<HTMLFormElement>("featuresLimitationForm");
        const values = features.reduce<Record<string, boolean>>((acc, { name }) => {
          const featureValue = (form[name] as RadioNodeList).value;
          if (featureValue !== "undefined") acc[name] = featureValue === "true";
          return acc;
        }, {});

        (el.previousElementSibling as HTMLInputElement).value = JSON.stringify(values);
        el.innerHTML = Object.keys(values).length ? "部分" : "任意";

        $(this).dialog("close");
      },
      取消: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function removeLine(line: HTMLElement): void {
  const lines = ensureEl("burgGroupsBody").children;
  if (lines.length < 2) {
    tip("至少需要定义一个分组", false, "error");
    return;
  }

  confirmationDialog({
    title: "移除分组",
    message: "确定要移除该分组吗？<br>除非应用更改，否则不会影响城镇",
    confirm: "移除",
    onConfirm: () => {
      line.remove();
      validateForm();
    }
  });
}

function validateForm(): boolean {
  const form = ensureEl<HTMLFormElement>("burgGroupsForm");

  const nameField = form.name as unknown as HTMLInputElement & RadioNodeList;
  if (nameField.length) {
    const names = Array.from(nameField).map(input => (input as HTMLInputElement).value);
    (nameField as unknown as NodeListOf<HTMLInputElement>).forEach(nameInput => {
      const value = nameInput.value;
      const isFormatValid = GROUP_NAME_REGEXP.test(value);
      const isUnique = names.filter(n => n === value).length === 1;
      const message = !isFormatValid
        ? "分组名称必须以字母或下划线开头，然后只能包含字母、数字、下划线或连字符"
        : !isUnique
          ? "分组名称必须唯一"
          : "";
      nameInput.setCustomValidity(message);
    });
  } else {
    const value = nameField.value;
    const isFormatValid = GROUP_NAME_REGEXP.test(value);
    const message = isFormatValid ? "" : "分组名称必须以字母或下划线开头，然后只能包含字母、数字、下划线或连字符";
    nameField.setCustomValidity(message);
  }

  const activeField = form.active as unknown as HTMLInputElement & RadioNodeList;
  if (activeField.length) {
    const active = Array.from(activeField).map(input => (input as HTMLInputElement).checked);
    (activeField[0] as HTMLInputElement).setCustomValidity(active.includes(true) ? "" : "至少应有一个分组处于激活状态");
  } else {
    activeField.setCustomValidity(activeField.checked ? "" : "至少应有一个分组处于激活状态");
  }

  const isDefaultField = form.isDefault as unknown as HTMLInputElement & RadioNodeList;
  if (isDefaultField.length) {
    const checked = Array.from(isDefaultField).map(input => (input as HTMLInputElement).checked);
    (isDefaultField[0] as HTMLInputElement).setCustomValidity(checked.includes(true) ? "" : "至少应有一个默认分组");
  } else {
    isDefaultField.setCustomValidity(isDefaultField.checked ? "" : "至少应有一个默认分组");
  }

  const isValid = form.checkValidity();
  if (!isValid) form.reportValidity();
  return isValid;
}

function submitForm(event: Event): void {
  event.preventDefault();
  if (!validateForm()) return;

  const lines = Array.from(ensureEl("burgGroupsBody").children);
  if (!lines.length) {
    tip("至少需要定义一个分组", false, "error");
    return;
  }

  function parseInput(input: HTMLInputElement | HTMLSelectElement): unknown {
    if (input.name === "name") return input.value;
    if (input.name === "features") {
      const isValid = JSON.isValid(input.value);
      const parsed = isValid ? JSON.parse(input.value) : {};
      if (Object.keys(parsed).length) return parsed;
      return null;
    }
    if ((input as HTMLInputElement).type === "hidden") return input.value || null;
    if ((input as HTMLInputElement).type === "radio") return (input as HTMLInputElement).checked;
    if ((input as HTMLInputElement).type === "checkbox") return (input as HTMLInputElement).checked;
    if ((input as HTMLInputElement).type === "number") {
      const value = (input as HTMLInputElement).valueAsNumber;
      if (value === 0 || Number.isNaN(value)) return null;
      return value;
    }
    return input.value || null;
  }

  options.burgs.groups = lines.map(line => {
    const inputs = line.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select");
    const group = Array.from(inputs).reduce<Record<string, unknown>>((obj, input) => {
      const value = parseInput(input);
      if (value !== null) obj[input.name] = value;
      return obj;
    }, {});
    return group;
  }) as typeof options.burgs.groups;
  localStorage.setItem("burg-groups", JSON.stringify(options.burgs.groups));

  // put burgs to new groups
  const validBurgs = pack.burgs.filter(b => b.i && !b.removed);
  const populations = validBurgs.map(b => b.population!).sort((a, b) => a - b);
  validBurgs.forEach(burg => void Burgs.defineGroup(burg, populations));

  if (layerIsOn("toggleBurgIcons")) drawBurgIcons();
  if (layerIsOn("toggleLabels")) drawBurgLabels();
  findEl<HTMLButtonElement>("burgsOverviewRefresh")?.click();

  $("#burgGroupsEditor").dialog("close");
}

export const BurgGroupEditor = { open: editBurgGroups };
