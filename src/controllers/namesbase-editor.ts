import { max as d3max, min as d3min, mean, median } from "d3";
import { destroyDialogIfExists, ensureEl, openURL, rn, unique } from "../utils";

function open(): void {
  if (customization) return;
  closeDialogs("#namesbaseEditor, .stable");

  renderDialog();
  createBasesList();
  updateInputs();

  $("#namesbaseEditor").dialog({
    title: "名称库编辑器",
    width: "60vw",
    position: { my: "center", at: "center", of: "svg" },
    close: closeNamesbaseEditor
  });
}

function renderDialog(): void {
  destroyDialogIfExists("namesbaseEditor");
  const editorHtml = /* html */ `<div id="namesbaseEditor" class="dialog stable textual">
      <div id="namesbaseBasesTop">
        <span>选择命名库：</span>
        <select id="namesbaseSelect" data-tip="选择要编辑的命名库" style="width: 12em" value="0"></select>
        <span style="margin-left: 2px">名称数据：</span>
      </div>
      <div id="namesbaseBody" style="margin-block: 2px; width: auto">
        <textarea
          id="namesbaseTextarea"
          data-base="0"
          rows="13"
          data-tip="名称数据：用于名称生成的逗号分隔的源名称列表"
          placeholder="提供名称数据：逗号分隔的源名称列表"
          autocorrect="off"
          spellcheck="false"
          style="resize: none"
        ></textarea>
        <div>
          <span>名称：</span>
          <input
            id="namesbaseName"
            data-tip="输入以更改命名库名称"
            placeholder="命名库名称"
            autocorrect="off"
            spellcheck="false"
            style="width: 12em"
          />
          <span>长度：</span>
          <input id="namesbaseMin" data-tip="推荐的最小名称长度" type="number" min="2" max="100" />
          <input id="namesbaseMax" data-tip="推荐的最大名称长度" type="number" min="2" value="10" />
          <span>双写：</span>
          <input
            id="namesbaseDouble"
            data-tip="填写可连续使用两次的字母（叠音字母）"
            autocorrect="off"
            spellcheck="false"
            style="width: 10em"
          />
        </div>
        <fieldset>
          <legend>生成示例：</legend>
          <div id="namesbaseExamples" data-tip="示例。点击重新生成"></div>
        </fieldset>
      </div>
      <div id="namesbaseBottom">
        <button
          id="namesbaseUpdateExamples"
          data-tip="基于提供的数据重新生成示例"
          class="icon-arrows-cw"
        ></button>
        <button id="namesbaseAdd" data-tip="添加新名称库" class="icon-plus"></button>
        <button id="namesbaseDefault" data-tip="恢复默认名称库" class="icon-cancel"></button>
        <button id="namesbaseDownload" data-tip="下载名称库到电脑" class="icon-download"></button>
        <button
          id="namesbaseUpload"
          data-tip="从电脑上传名称库，替换当前集合"
          class="icon-upload"
        ></button>
        <button
          id="namesbaseUploadExtend"
          data-tip="从电脑上传名称库，扩展当前集合"
          class="icon-up-circled2"
        ></button>
        <button
          id="namesbaseCA"
          data-tip="在 Cartography Assets 门户查找或分享自定义名称库"
          class="icon-drafting-compass"
        ></button>
        <button
          id="namesbaseAnalyze"
          data-tip="分析名称库以获取有效性和质量总览"
          class="icon-flask"
        ></button>
        <button
          id="namesbaseSpeak"
          data-tip="朗读示例。可在选项中更改语音和语言"
          class="icon-voice"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  const uploader = ensureEl<HTMLInputElement>("namesbaseToLoad");

  ensureEl("namesbaseSelect").on("change", updateInputs);
  ensureEl("namesbaseTextarea").on("change", updateNamesData);
  ensureEl("namesbaseUpdateExamples").on("click", updateExamples);
  ensureEl("namesbaseExamples").on("click", updateExamples);
  ensureEl("namesbaseName").on("input", e => updateBaseName((e.target as HTMLInputElement).value));
  ensureEl("namesbaseMin").on("input", e => updateBaseMin((e.target as HTMLInputElement).value));
  ensureEl("namesbaseMax").on("input", e => updateBaseMax((e.target as HTMLInputElement).value));
  ensureEl("namesbaseDouble").on("input", e => updateBaseDuplication((e.target as HTMLInputElement).value));
  ensureEl("namesbaseAdd").on("click", namesbaseAdd);
  ensureEl("namesbaseAnalyze").on("click", analyzeNamesbase);
  ensureEl("namesbaseDefault").on("click", namesbaseRestoreDefault);
  ensureEl("namesbaseDownload").on("click", namesbaseDownload);
  ensureEl("namesbaseUpload").on("click", () => {
    uploader.on("change", e => uploadFile(e.target as HTMLInputElement, d => namesbaseUpload(d, true)), { once: true });
    uploader.click();
  });
  ensureEl("namesbaseUploadExtend").on("click", () => {
    uploader.on("change", e => uploadFile(e.target as HTMLInputElement, d => namesbaseUpload(d, false)), {
      once: true
    });
    uploader.click();
  });
  ensureEl("namesbaseCA").on("click", () =>
    openURL("https://cartographyassets.com/asset-category/specific-assets/azgaars-generator/namebases/")
  );
  ensureEl("namesbaseSpeak").on("click", () => speak(ensureEl("namesbaseExamples").textContent ?? ""));
}

function closeNamesbaseEditor(): void {
  $("#namesbaseEditor").dialog("destroy");
  ensureEl("namesbaseEditor").remove();
}

function createBasesList(): void {
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  select.innerHTML = "";
  nameBases.forEach((b, i) => {
    select.options.add(new Option(b.name, String(i)));
  });
}

function updateInputs(): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  if (!nameBases[base]) {
    tip(`名称库 ${base} 未定义`, false, "error");
    return;
  }
  (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value = nameBases[base].b;
  (ensureEl("namesbaseName") as HTMLInputElement).value = nameBases[base].name;
  (ensureEl("namesbaseMin") as HTMLInputElement).value = String(nameBases[base].min);
  (ensureEl("namesbaseMax") as HTMLInputElement).value = String(nameBases[base].max);
  (ensureEl("namesbaseDouble") as HTMLInputElement).value = nameBases[base].d;
  updateExamples();
}

function updateExamples(): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  let examples = "";
  for (let i = 0; i < 7; i++) {
    const example = Names.getBase(base);
    if (example === undefined) {
      examples = "无法生成示例。请检查数据";
      break;
    }
    if (i) examples += ", ";
    examples += example;
  }
  ensureEl("namesbaseExamples").innerHTML = examples;
}

function updateNamesData(): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  const input = ensureEl<HTMLTextAreaElement>("namesbaseTextarea");
  if (input.value.split(",").length < 3) {
    tip("提供的名称数据过短或不正确", false, "error");
    return;
  }
  const securedNamesData = input.value.replace(/[/|]/g, "");
  nameBases[base].b = securedNamesData;
  input.value = securedNamesData;
  Names.updateChain(base);
}

function updateBaseName(rawName: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  const select = ensureEl<HTMLSelectElement>("namesbaseSelect");
  const name = rawName.replace(/[/|]/g, "");
  select.options[select.selectedIndex].innerHTML = name;
  nameBases[base].name = name;
}

function updateBaseMin(value: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  if (+value > nameBases[base].max) {
    tip("最小长度不能大于最大长度", false, "error");
    return;
  }
  nameBases[base].min = +value;
}

function updateBaseMax(value: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  if (+value < nameBases[base].min) {
    tip("最大长度应大于最小长度", false, "error");
    return;
  }
  nameBases[base].max = +value;
}

function updateBaseDuplication(value: string): void {
  const base = +ensureEl<HTMLSelectElement>("namesbaseSelect").value;
  nameBases[base].d = value;
}

function analyzeNamesbase(): void {
  const namesSourceString = (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value;
  const namesArray = namesSourceString.toLowerCase().split(",");
  const length = namesArray.length;
  if (!namesSourceString || !length) {
    tip("名称数据不能为空", false, "error");
    return;
  }

  const chain = Names.calculateChain(namesSourceString);
  const chainValues = Object.values(chain) as string[][];
  const variety = rn(mean(chainValues.map(kv => kv.length)) ?? 0);

  const wordsLength = namesArray.map(n => n.length);

  const nonLatin = namesSourceString.match(/[\u0080-\uFFFF]/gu);
  const nonBasicLatinChars = nonLatin
    ? unique(
        namesSourceString
          .match(/[\u0080-\uFFFF]/gu)!
          .join("")
          .toLowerCase()
          .split("")
      ).join("")
    : "无";

  const geminate = namesArray.flatMap(name => name.match(/[^\w\s]|(.)(?=\1)/g) ?? []);
  const doubled = unique(geminate).filter(char => geminate.filter(d => d === char).length > 3);
  const doubledStr = doubled.length ? doubled.join("") : "无";

  const duplicates = unique(namesArray.filter((e, i, a) => a.indexOf(e) !== i)).join(", ") || "无";
  const multiwordRate = mean(namesArray.map(n => +n.includes(" "))) ?? 0;

  const getLengthQuality = (): string => {
    if (length < 30)
      return "<span data-tip='命名库包含少于 30 个名称——不足以生成合理数据' style='color:red'>[不足]</span>";
    if (length < 100)
      return "<span data-tip='命名库包含少于 100 个名称——不足以生成优质名称' style='color:darkred'>[偏低]</span>";
    if (length <= 400) return "<span data-tip='命名库包含合理数量的样本' style='color:green'>[良好]</span>";
    return "<span data-tip='命名库包含超过 400 个名称。数量过多，建议精简至约 300 个名称' style='color:darkred'>[过多]</span>";
  };

  const getVarietyLevel = (): string => {
    if (variety < 15)
      return "<span data-tip='命名库平均多样性 < 15——生成的名称将过于重复' style='color:red'>[偏低]</span>";
    if (variety < 30)
      return "<span data-tip='命名库平均多样性 < 30——名称可能过于重复' style='color:orange'>[中等]</span>";
    return "<span data-tip='命名库多样性良好' style='color:green'>[良好]</span>";
  };

  alertMessage.innerHTML = /* html */ `<div style="line-height: 1.6em; max-width: 20em">
      <div data-tip="提供的名称数量">命名库长度：${length} ${getLengthQuality()}</div>
      <div data-tip="链中每个键的平均生成变体数">命名库多样性：${variety} ${getVarietyLevel()}</div>
      <hr />
      <div data-tip="最短名称长度">最小名称长度：${d3min(wordsLength)}</div>
      <div data-tip="最长名称长度">最大名称长度：${d3max(wordsLength)}</div>
      <div data-tip="平均名称长度">平均名称长度：${rn(mean(wordsLength) ?? 0, 1)}</div>
      <div data-tip="常见名称长度">中位名称长度：${median(wordsLength)}</div>
      <hr />
      <div data-tip="基本拉丁字母之外的字符字体支持较差">非基本字符：${nonBasicLatinChars}</div>
      <div data-tip="频繁（超过 3 次）双写的字符">双写字符：${doubledStr}</div>
      <div data-tip="使用超过一次的名称">重复项：${duplicates}</div>
      <div data-tip="包含空格字符的名称百分比">多词名称：${rn(multiwordRate * 100, 2)}%</div>
    </div>`;

  $("#alert").dialog({
    resizable: false,
    title: "数据分析",
    width: "auto",
    position: { my: "left top-30", at: "right+10 top", of: "#namesbaseEditor" },
    buttons: {
      确定: function () {
        $(this).dialog("close");
      }
    }
  });
}

function namesbaseAdd(): void {
  const baseId = nameBases.length;
  const b =
    "This,is,an,example,of,name,base,showing,correct,format,It,should,have,at,least,one,hundred,names,separated,with,comma";
  nameBases.push({
    name: `Base${baseId}`,
    i: baseId,
    min: 5,
    max: 12,
    d: "",
    m: 0,
    b
  });
  ensureEl<HTMLSelectElement>("namesbaseSelect").add(new Option(`Base${baseId}`, String(baseId)));
  (ensureEl("namesbaseSelect") as HTMLSelectElement).value = String(baseId);
  (ensureEl("namesbaseTextarea") as HTMLTextAreaElement).value = b;
  (ensureEl("namesbaseName") as HTMLInputElement).value = `Base${baseId}`;
  (ensureEl("namesbaseMin") as HTMLInputElement).value = "5";
  (ensureEl("namesbaseMax") as HTMLInputElement).value = "12";
  (ensureEl("namesbaseDouble") as HTMLInputElement).value = "";
  ensureEl("namesbaseExamples").innerHTML = "请提供名称数据";
}

function namesbaseRestoreDefault(): void {
  alertMessage.innerHTML = /* html */ `确定要恢复默认命名库吗？`;
  $("#alert").dialog({
    resizable: false,
    title: "恢复默认数据",
    buttons: {
      恢复: function () {
        $(this).dialog("close");
        Names.clearChains();
        nameBases = Names.getNameBases();
        createBasesList();
        updateInputs();
      },
      取消: function () {
        $(this).dialog("close");
      }
    }
  });
}

function namesbaseDownload(): void {
  const data = nameBases.map(b => `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${b.b}`).join("\r\n");
  const name = `${getFileName("Namesbase")}.txt`;
  downloadFile(data, name);
}

function namesbaseUpload(dataLoaded: string, override = true): void {
  const lines = dataLoaded
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .filter(Boolean);
  if (!lines.length) {
    tip("无法加载名称库。请检查数据格式", false, "error");
    return;
  }

  Names.clearChains();
  if (override) nameBases = [];

  const errors: ParseError[] = [];
  lines.forEach((line, index) => {
    try {
      const [rawName, min, max, d, m, rawNames] = line.split("|");
      const name = rawName?.replace(unsafe, "");
      if (!name) throw new Error("名称缺失");
      const names = rawNames?.replace(unsafe, "");
      if (!names) throw new Error("名称数据缺失");
      nameBases.push({
        name,
        i: nameBases.length,
        min: +min,
        max: +max,
        d,
        m: +m,
        b: names
      });
    } catch (e) {
      errors.push({ id: index + 1, line, error: (e as Error).message });
      ERROR && console.error(e);
    }
  });

  if (errors.length > 0) {
    ERROR && console.error("名称库上传错误", errors);
    const errorItems = errors
      .map(
        ({ id, line, error }) => /* html */ `<li style="padding:0.6em 0;border-top:1px solid #ddd;">
            <div>
              第 ${id} 行：
              <span style="color:#8b0000">${escapeHtml(error)}。</span> 数据：
            </div>
            <div style="margin-top:0.35em;font-family:var(--font-monospace,monospace);font-size:0.95em;line-height:1.4;word-break:break-word;color:#333;">
              ${escapeHtml(line) || "<空行>"}
            </div>
          </li>`
      )
      .join("");

    alertMessage.innerHTML = /* html */ `<div>
        <p style="margin:0.75em;">
          <strong>文件解析错误。仅添加了 ${lines.length} 个命名库中的 ${lines.length - errors.length} 个。</strong>
          每个命名库应单独占一行并遵循格式：<code>name|min|max|duplication|m|names</code>。参数应使用 <code>|</code> 字符分隔，且该字符不应在参数内部使用。另一个禁止的字符是 <code>/</code>。最常见的问题是名称和其他参数位于两个独立的行上。
          <ul style="margin:0.5em;">
            <li><code>name</code>：命名库的名称。</li>
            <li><code>min</code>：生成名称的推荐最小长度。应为数字。</li>
            <li><code>max</code>：生成名称的推荐最大长度。应为大于最小长度的数字。</li>
            <li><code>duplication</code>：生成名称中可以双写的字符。例如 <code>lkd</code> 表示可以生成类似 "Kalla"、"Mikkor"、"Dalddur" 的名称。此参数可以为空。</li>
            <li><code>m</code>：未使用的参数，请填写 <code>0</code>。</li>
            <li><code>names</code>：名称数据，以逗号分隔。应至少包含 3 个名称才有效。</li>
          </ul>
        </p>
        <div>
          <ul style="margin:0;padding-left:1.5em;">
            ${errorItems}
          </ul>
        </div>
      </div>`;

    $("#alert").dialog({
      resizable: false,
      title: "解析错误",
      width: "min(72vw, 68em)",
      position: { my: "center center-4em", at: "center", of: "svg" },
      buttons: {
        继续: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  createBasesList();
  updateInputs();
}

const unsafe = /[|/]/g;

const escapeHtml = (str: string): string =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

interface ParseError {
  id: number;
  line: string;
  error: string;
}

export const NamesbaseEditor = { open };
