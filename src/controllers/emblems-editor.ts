import { drag, select } from "d3";
import { clearMainTip, tip } from "@/components/tooltips";
import { highlightEmblemElement } from "@/renderers/overlays/highlight";
import { downloadFile, getFileName, openURL } from "@/utils";
import { destroyDialogIfExists, ensureEl, rn } from "../utils";

// el is a State | Province | Burg; coa is the untyped Armoria structure — kept loose here as
// this is a legacy interop boundary shared with classic callers.
type EmblemEl = any;

let currentType: string;
let currentId: string;
let currentEl: EmblemEl;

async function openDefault(): Promise<void> {
  const firstState = pack.states.find(state => state.i && !state.removed && state.coa);
  const firstBurg = pack.burgs.find(burg => burg.i && !burg.removed && burg.coa);
  const type = firstState ? "state" : "burg";
  const element = firstState ?? firstBurg;
  if (!element?.coa) {
    tip("No emblems to edit, please generate states and burgs first", false, "error");
    return;
  }

  const id = `${type}COA${element.i}`;
  await COArenderer.trigger(id, element.coa);
  open(type, id, element);
}

function open(type?: string, id?: string, el?: EmblemEl, target?: SVGElement): void {
  if (customization) return;
  if (!id && target) defineEmblemData(target);
  else {
    currentType = type!;
    currentId = id!;
    currentEl = el;
  }

  renderDialog();

  select<SVGElement, unknown>("#emblems")
    .selectAll<SVGUseElement, unknown>("use")
    .call(drag<SVGUseElement, unknown>().on("drag", dragEmblem))
    .classed("draggable", true);

  updateElementSelectors();

  $("#emblemEditor").dialog({
    title: "编辑纹章",
    resizable: true,
    width: "18.2em",
    height: "auto",
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" },
    close: closeEmblemEditor
  });
}

function renderDialog(): void {
  destroyDialogIfExists("emblemEditor");
  const editorHtml = /* html */ `<div id="emblemEditor" class="dialog stable">
      <svg viewBox="0 0 200 200"><use id="emblemImage"></use></svg>
      <div id="emblemBody">
        <div>
          <b id="emblemArmiger"></b>
        </div>
        <hr />
        <div data-tip="选择国家">
          <div class="label">国家：</div>
          <select id="emblemStates"></select>
        </div>
        <div data-tip="选择该国家的省份">
          <div class="label">省份：</div>
          <select id="emblemProvinces"></select>
        </div>
        <div data-tip="选择省份或国家中的城镇">
          <div class="label">城镇：</div>
          <select id="emblemBurgs"></select>
        </div>
        <hr />
        <div data-tip="选择纹章形状">
          <div class="label">形状：</div>
          <select id="emblemShapeSelector">
            <optgroup label="基础">
              <option value="heater">炉壁盾</option>
              <option value="spanish">西班牙式</option>
              <option value="french">法式</option>
            </optgroup>
            <optgroup label="地域">
              <option value="horsehead">马头形</option>
              <option value="horsehead2">马头尖角形</option>
              <option value="polish">波兰式</option>
              <option value="hessen">黑森式</option>
              <option value="swiss">瑞士式</option>
            </optgroup>
            <optgroup label="历史">
              <option value="boeotian">维奥蒂亚式</option>
              <option value="roman">罗马式</option>
              <option value="kite">鸢盾</option>
              <option value="oldFrench">古法语式</option>
              <option value="renaissance">文艺复兴式</option>
              <option value="baroque">巴洛克式</option>
            </optgroup>
            <optgroup label="特定">
              <option value="targe">圆盾</option>
              <option value="targe2">圆盾2</option>
              <option value="pavise">长盾</option>
              <option value="wedged">楔形</option>
            </optgroup>
            <optgroup label="旗帜">
              <option value="flag">旗帜</option>
              <option value="pennon">长尖旗</option>
              <option value="guidon">骑兵旗</option>
              <option value="banner">横幅</option>
              <option value="dovetail">燕尾旗</option>
              <option value="gonfalon">悬旗</option>
              <option value="pennant">三角旗</option>
            </optgroup>
            <optgroup label="简约">
              <option value="round">圆角</option>
              <option value="oval">椭圆</option>
              <option value="vesicaPiscis">圣鱼形</option>
              <option value="square">方角</option>
              <option value="diamond">菱形</option>
            </optgroup>
            <optgroup label="奇幻">
              <option value="fantasy1">奇幻1</option>
              <option value="fantasy2">奇幻2</option>
              <option value="fantasy3">奇幻3</option>
              <option value="fantasy4">奇幻4</option>
              <option value="fantasy5">奇幻5</option>
            </optgroup>
            <optgroup label="中土">
              <option value="noldor">诺多族</option>
              <option value="gondor">刚铎</option>
              <option value="easterling">东方人</option>
              <option value="erebor">伊鲁伯</option>
              <option value="ironHills">钢铁山</option>
              <option value="urukHai">强兽人</option>
              <option value="moriaOrc">摩瑞亚半兽人</option>
            </optgroup>
          </select>
        </div>
        <div
          data-tip="设置单个纹章的尺寸。设为 0 则隐藏。要更改整个类别，请前往菜单 ⭢ 样式 ⭢ 纹章"
        >
          <div class="label" style="width: 2.8em">尺寸：</div>
          <input id="emblemSizeSlider" type="range" min="0" max="5" step=".1" style="width: 7em" />
          <input id="emblemSizeNumber" type="number" min="0" max="5" step=".1" />
        </div>
      </div>
      <div id="emblemsBottom">
        <button id="emblemsRegenerate" data-tip="重新生成纹章" class="icon-shuffle"></button>
        <button
          id="emblemsArmoria"
          data-tip="在 Armoria（专用纹章编辑器）中编辑纹章。下载纹章并上传回生成器"
          class="icon-brush"
        ></button>
        <button
          id="emblemsDownload"
          data-tip="设置尺寸，选择文件格式并下载纹章图像"
          class="icon-download"
        ></button>
        <button
          id="emblemsUpload"
          data-tip="上传来自 Armoria 或其他来源的 png、jpg 或 svg 图像作为纹章"
          class="icon-upload"
        ></button>
        <button
          id="emblemsGallery"
          data-tip="下载纹章库为 HTML 文档（在浏览器中打开；下载需要一些时间）"
          class="icon-layer-group"
        ></button>
        <button id="emblemsFocus" data-tip="显示纹章关联的区域或地点" class="icon-target"></button>
      </div>
      <div id="emblemUploadControl" class="hidden">
        <button
          id="emblemsUploadImage"
          data-tip="上传来自任意来源的 SVG 或 PNG 图像。确保背景透明"
        >
          任意图像
        </button>
        <button
          id="emblemsUploadSVG"
          data-tip="上传已准备的 SVG 图像（来自 Armoria 的 SVG 或经'优化矢量'工具处理的 SVG）"
        >
          已准备的 SVG
        </button>
        <a
          href="https://www.iloveimg.com/compress-image"
          target="_blank"
          data-tip="上传前使用外部工具压缩或调整栅格图像尺寸"
          >压缩栅格图</a
        >
        <span> | </span>
        <a
          href="https://jakearchibald.github.io/svgomg"
          target="_blank"
          data-tip="上传前使用外部工具优化矢量图像"
          >优化矢量图</a
        >
      </div>
      <div id="emblemDownloadControl" class="hidden">
        <input
          id="emblemsDownloadSize"
          data-tip="以像素为单位设置图像尺寸"
          type="number"
          value="500"
          step="100"
          min="100"
          max="10000"
        />
        <button
          id="emblemsDownloadSVG"
          data-tip="下载为 SVG：可缩放矢量图像。质量最佳，可在浏览器或 Inkscape 中打开"
        >
          SVG
        </button>
        <button id="emblemsDownloadPNG" data-tip="下载为 PNG：无损栅格图像，透明背景">
          PNG
        </button>
        <button
          id="emblemsDownloadJPG"
          data-tip="下载为 JPG：有损压缩栅格图像，纯白背景"
        >
          JPG
        </button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl<HTMLSelectElement>("emblemStates").oninput = selectState;
  ensureEl<HTMLSelectElement>("emblemProvinces").oninput = selectProvince;
  ensureEl<HTMLSelectElement>("emblemBurgs").oninput = selectBurg;
  ensureEl<HTMLSelectElement>("emblemShapeSelector").oninput = changeShape;
  ensureEl("emblemSizeSlider").oninput = changeSize;
  ensureEl("emblemSizeNumber").oninput = changeSize;
  ensureEl("emblemsRegenerate").onclick = regenerate;
  ensureEl("emblemsArmoria").onclick = openInArmoria;
  ensureEl("emblemsUpload").onclick = toggleUpload;
  ensureEl("emblemsUploadImage").onclick = () => ensureEl("emblemImageToLoad").click();
  ensureEl("emblemsUploadSVG").onclick = () => ensureEl("emblemSVGToLoad").click();
  ensureEl("emblemImageToLoad").onchange = () => upload("image");
  ensureEl("emblemSVGToLoad").onchange = () => upload("svg");
  ensureEl("emblemsDownload").onclick = toggleDownload;
  ensureEl("emblemsDownloadSVG").onclick = () => download("svg");
  ensureEl("emblemsDownloadPNG").onclick = () => download("png");
  ensureEl("emblemsDownloadJPG").onclick = () => download("jpeg");
  ensureEl("emblemsGallery").onclick = downloadGallery;
  ensureEl("emblemsFocus").onclick = showArea;
}

function defineEmblemData(target: SVGElement): void {
  const parent = target.parentNode as SVGElement;
  const [g, t] =
    parent.id === "burgEmblems"
      ? [pack.burgs, "burg"]
      : parent.id === "provinceEmblems"
        ? [pack.provinces, "province"]
        : [pack.states, "state"];
  const i = +target.dataset.i!;
  currentType = t as string;
  currentId = `${currentType}COA${i}`;
  currentEl = (g as EmblemEl[])[i];
}

function updateElementSelectors(): void {
  const type = currentType;
  const el = currentEl;
  const emblemStates = ensureEl<HTMLSelectElement>("emblemStates");
  const emblemProvinces = ensureEl<HTMLSelectElement>("emblemProvinces");
  const emblemBurgs = ensureEl<HTMLSelectElement>("emblemBurgs");

  let state = 0;
  let province = 0;
  let burg = 0;

  // set active type
  (emblemStates.parentElement as HTMLElement).className = type === "state" ? "active" : "";
  (emblemProvinces.parentElement as HTMLElement).className = type === "province" ? "active" : "";
  (emblemBurgs.parentElement as HTMLElement).className = type === "burg" ? "active" : "";

  // define selected values
  if (type === "state") state = el.i;
  else if (type === "province") {
    province = el.i;
    state = pack.states[el.state].i;
  } else {
    burg = el.i;
    province = pack.cells.province[el.cell] ? pack.provinces[pack.cells.province[el.cell]].i : 0;
    state = el.state;
  }

  const validBurgs = pack.burgs.filter(b => b.i && !b.removed && b.coa);

  // update option list and select actual values
  emblemStates.options.length = 0;
  const neutralBurgs = validBurgs.filter(b => !b.state);
  if (neutralBurgs.length) emblemStates.options.add(new Option(pack.states[0].name, "0", false, !state));
  const stateList = pack.states.filter(s => s.i && !s.removed);
  stateList.forEach(s => {
    emblemStates.options.add(new Option(s.name, String(s.i), false, s.i === state));
  });

  emblemProvinces.options.length = 0;
  emblemProvinces.options.add(new Option("", "0", false, !province));
  const provinceList = pack.provinces.filter(p => !p.removed && p.state === state);
  provinceList.forEach(p => {
    emblemProvinces.options.add(new Option(p.name, String(p.i), false, p.i === province));
  });

  emblemBurgs.options.length = 0;
  emblemBurgs.options.add(new Option("", "0", false, !burg));
  const burgList = validBurgs.filter(b => (province ? pack.cells.province[b.cell] === province : b.state === state));
  burgList.forEach(b => {
    emblemBurgs.options.add(new Option(b.capital ? `👑 ${b.name}` : b.name, String(b.i), false, b.i === burg));
  });
  emblemBurgs.options[0].disabled = true;

  COArenderer.trigger(currentId, el.coa);
  updateEmblemData();
}

function updateEmblemData(): void {
  const el = currentEl;
  if (!el.coa) return;
  ensureEl("emblemImage").setAttribute("href", `#${currentId}`);
  let name = el.fullName || el.name;
  if (currentType === "burg") name = `${name} 城镇`;
  ensureEl("emblemArmiger").innerText = name;

  const emblemShapeSelector = ensureEl<HTMLSelectElement>("emblemShapeSelector");
  if (el.coa.custom) emblemShapeSelector.disabled = true;
  else {
    emblemShapeSelector.disabled = false;
    emblemShapeSelector.value = el.coa.shield;
  }

  const size = el.coa.size || 1;
  ensureEl<HTMLInputElement>("emblemSizeSlider").value = size;
  ensureEl<HTMLInputElement>("emblemSizeNumber").value = size;
}

function selectState(): void {
  const state = +ensureEl<HTMLSelectElement>("emblemStates").value;
  if (state) {
    currentType = "state";
    currentEl = pack.states[state];
    currentId = `stateCOA${state}`;
  } else {
    // select neutral burg if state is changed to Neutrals
    const neutralBurgs = pack.burgs.filter(b => b.i && !b.removed && !b.state);
    if (!neutralBurgs.length) return;
    currentType = "burg";
    currentEl = neutralBurgs[0];
    currentId = `burgCOA${neutralBurgs[0].i}`;
  }
  updateElementSelectors();
}

function selectProvince(): void {
  const province = +ensureEl<HTMLSelectElement>("emblemProvinces").value;

  if (province) {
    currentType = "province";
    currentEl = pack.provinces[province];
    currentId = `provinceCOA${province}`;
  } else {
    // select state if province is changed to null value
    const state = +ensureEl<HTMLSelectElement>("emblemStates").value;
    currentType = "state";
    currentEl = pack.states[state];
    currentId = `stateCOA${state}`;
  }

  updateElementSelectors();
}

function selectBurg(): void {
  const burg = +ensureEl<HTMLSelectElement>("emblemBurgs").value;
  currentType = "burg";
  currentEl = pack.burgs[burg];
  currentId = `burgCOA${burg}`;
  updateElementSelectors();
}

function changeShape(): void {
  currentEl.coa.shield = ensureEl<HTMLSelectElement>("emblemShapeSelector").value;
  const coaEl = document.getElementById(currentId);
  if (coaEl) coaEl.remove();
  COArenderer.trigger(currentId, currentEl.coa);
}

function showArea(): void {
  highlightEmblemElement(currentType, currentEl);
}

function changeSize(ev: Event): void {
  const size = +(ev.currentTarget as HTMLInputElement).value;
  currentEl.coa.size = size;

  ensureEl<HTMLInputElement>("emblemSizeSlider").value = String(size);
  ensureEl<HTMLInputElement>("emblemSizeNumber").value = String(size);

  const g = select<SVGElement, unknown>("#emblems").select(`#${currentType}Emblems`);
  g.select(`[data-i='${currentEl.i}']`).remove();
  if (!size) return;

  // re-append use element
  const categotySize = +g.attr("font-size");
  const shift = (categotySize * size) / 2;
  const x = currentEl.coa.x || currentEl.x || currentEl.pole[0];
  const y = currentEl.coa.y || currentEl.y || currentEl.pole[1];

  g.append("use")
    .attr("data-i", currentEl.i)
    .attr("x", rn(x - shift, 2))
    .attr("y", rn(y - shift, 2))
    .attr("width", `${size}em`)
    .attr("height", `${size}em`)
    .attr("href", `#${currentId}`);
}

function regenerate(): void {
  const el = currentEl;
  let parent: EmblemEl = null;
  if (currentType === "province") parent = pack.states[el.state];
  else if (currentType === "burg") {
    const province = pack.cells.province[el.cell];
    parent = province ? pack.provinces[province] : pack.states[el.state];
  }

  const shield = el.coa.shield || COA.getShield(el.culture || parent?.culture || 0, el.state);
  el.coa = COA.generate(parent ? parent.coa : null, 0.3, 0.1, undefined);
  el.coa.shield = shield;
  const emblemShapeSelector = ensureEl<HTMLSelectElement>("emblemShapeSelector");
  emblemShapeSelector.disabled = false;
  emblemShapeSelector.value = el.coa.shield;

  const coaEl = document.getElementById(currentId);
  if (coaEl) coaEl.remove();
  COArenderer.trigger(currentId, el.coa);
}

function openInArmoria(): void {
  const coa = currentEl.coa && !currentEl.coa.custom ? currentEl.coa : { t1: "sable" };
  const json = JSON.stringify(coa).replaceAll("#", "%23");
  const url = `https://azgaar.github.io/Armoria/?coa=${json}&from=FMG`;
  openURL(url);
}

function toggleUpload(): void {
  ensureEl("emblemDownloadControl").classList.add("hidden");
  ensureEl("emblemUploadControl").classList.toggle("hidden");
}

function upload(type: "image" | "svg"): void {
  const el = currentEl;
  const input =
    type === "image" ? ensureEl<HTMLInputElement>("emblemImageToLoad") : ensureEl<HTMLInputElement>("emblemSVGToLoad");
  const file = input.files![0];
  input.value = "";

  if (file.size > 500000) {
    const message = "文件过大，请将文件大小优化至 500kB 以下后重新上传。推荐尺寸为 200x200 像素，大小不超过 100kB";
    tip(message, true, "error", 5000);
    return;
  }

  const reader = new FileReader();

  reader.onload = readerEvent => {
    const result = readerEvent.target!.result as string;
    const defsEmblems = ensureEl("defs-emblems");
    const oldEmblem = document.getElementById(currentId);

    let href = result; // raster images
    if (type === "svg") {
      const wrapper = document.createElement("html");
      wrapper.innerHTML = result;

      wrapper.querySelectorAll("*").forEach(node => {
        if (node.id === "adobe_illustrator_pgf") node.remove(); // remove Adobe Illustrator inner data

        node.getAttributeNames().forEach(attr => {
          // remove sodipodi and inkscape attributes
          if (attr.includes("inkscape") || attr.includes("sodipodi")) node.removeAttribute(attr);
        });
      });

      const svgEl = wrapper.querySelector("svg");
      if (!svgEl) {
        tip("该文件不是有效的 SVG。请使用 Armoria 或其他相关工具", false, "error");
        return;
      }

      const serialized = new XMLSerializer().serializeToString(svgEl);
      href = `data:image/svg+xml;base64,${window.btoa(serialized)}`;
    }

    const svg = `<svg id="${currentId}" viewBox="0 0 200 200"><image width="200" height="200" href="${href}"/></svg>`;
    defsEmblems.insertAdjacentHTML("beforeend", svg);

    if (oldEmblem) oldEmblem.remove();

    const customCoa: { custom: true; size?: number; x?: number; y?: number } = { custom: true };
    if (el.coa.size) customCoa.size = el.coa.size;
    if (el.coa.x) customCoa.x = el.coa.x;
    if (el.coa.y) customCoa.y = el.coa.y;
    el.coa = customCoa;

    ensureEl<HTMLSelectElement>("emblemShapeSelector").disabled = true;
  };

  if (type === "image") reader.readAsDataURL(file);
  else reader.readAsText(file);
}

function toggleDownload(): void {
  ensureEl("emblemUploadControl").classList.add("hidden");
  ensureEl("emblemDownloadControl").classList.toggle("hidden");
}

async function download(format: string): Promise<void> {
  const coa = document.getElementById(currentId)!;
  const size = +ensureEl<HTMLInputElement>("emblemsDownloadSize").value;
  const url = await getURL(coa, size);
  const link = document.createElement("a");
  link.download = `${getFileName(`Emblem ${currentEl.fullName || currentEl.name}`)}.${format}`;

  if (format === "svg") downloadSVG(url, link);
  else downloadRaster(format, url, link, size);
  ensureEl("emblemDownloadControl").classList.add("hidden");
}

function downloadSVG(url: string, link: HTMLAnchorElement): void {
  link.href = url;
  link.click();
}

function downloadRaster(format: string, url: string, link: HTMLAnchorElement, size: number): void {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = size;
  canvas.height = size;

  const img = new Image();
  img.src = url;
  img.onload = () => {
    if (format === "jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL(`image/${format}`, 0.92);
    link.href = dataURL;
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(dataURL), 6000);
  };
}

async function getURL(svg: Element, size: number): Promise<string> {
  const serialized = getSVG(svg, size);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 6000);
  return url;
}

function getSVG(svg: Element, size: number): string {
  const clone = svg.cloneNode(true) as Element;
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  return new XMLSerializer().serializeToString(clone);
}

async function downloadGallery(): Promise<void> {
  const name = getFileName("Emblems Gallery");
  const validStates = pack.states.filter(s => s.i && !s.removed && s.coa);
  const validProvinces = pack.provinces.filter(p => p.i && !p.removed && p.coa);
  const validBurgs = pack.burgs.filter(b => b.i && !b.removed && b.coa);
  await renderAllEmblems(validStates, validProvinces, validBurgs);

  const back = `<a href="javascript:history.back()">返回</a>`;

  const stateSection = `<div><h2>国家</h2>${validStates
    .map(state => {
      const el = document.getElementById(`stateCOA${state.i}`)!;
      return `<figure id="state_${state.i}"><a href="#provinces_${state.i}"><figcaption>${state.fullName}</figcaption>${getSVG(el, 200)}</a></figure>`;
    })
    .join("")}</div>`;

  const provinceSections = validStates
    .map(state => {
      const stateProvinces = validProvinces.filter(p => p.state === state.i);
      const figures = stateProvinces
        .map(province => {
          const el = document.getElementById(`provinceCOA${province.i}`)!;
          return `<figure id="province_${province.i}"><a href="#burgs_${province.i}"><figcaption>${province.fullName}</figcaption>${getSVG(el, 200)}</a></figure>`;
        })
        .join("");
      return stateProvinces.length
        ? `<div id="provinces_${state.i}">${back}<h2>${state.fullName} 省份</h2>${figures}</div>`
        : "";
    })
    .join("");

  const burgSections = validStates
    .map(state => {
      const stateBurgs = validBurgs.filter(b => b.state === state.i);
      let stateBurgSections = validProvinces
        .filter(p => p.state === state.i)
        .map(province => {
          const provinceBurgs = stateBurgs.filter(b => pack.cells.province[b.cell] === province.i);
          const provinceBurgFigures = provinceBurgs
            .map(burg => {
              const el = document.getElementById(`burgCOA${burg.i}`);
              if (!el) return "";
              return `<figure id="burg_${burg.i}"><figcaption>${burg.name}</figcaption>${getSVG(el, 200)}</figure>`;
            })
            .join("");
          return provinceBurgs.length
            ? `<div id="burgs_${province.i}">${back}<h2>${province.fullName} 城镇</h2>${provinceBurgFigures}</div>`
            : "";
        })
        .join("");

      const stateBurgOutOfProvinces = stateBurgs.filter(b => !pack.cells.province[b.cell]);
      const stateBurgOutOfProvincesFigures = stateBurgOutOfProvinces
        .map(burg => {
          const el = document.getElementById(`burgCOA${burg.i}`);
          if (!el) return "";
          return `<figure id="burg_${burg.i}"><figcaption>${burg.name}</figcaption>${getSVG(el, 200)}</figure>`;
        })
        .join("");
      if (stateBurgOutOfProvincesFigures)
        stateBurgSections += `<div><h2>${state.fullName} 直辖城镇</h2>${stateBurgOutOfProvincesFigures}</div>`;
      return stateBurgSections;
    })
    .join("");

  const neutralBurgs = validBurgs.filter(b => !b.state);
  const neutralsSection = neutralBurgs.length
    ? `<div><h2>独立城镇</h2>${neutralBurgs
        .map(burg => {
          const el = document.getElementById(`burgCOA${burg.i}`);
          if (!el) return "";
          return `<figure id="burg_${burg.i}"><figcaption>${burg.name}</figcaption>${getSVG(el, 200)}</figure>`;
        })
        .join("")}</div>`
    : "";

  const FMG = `<a href="https://8desk.top" target="_blank">Azgaar's Fantasy Map Generator</a>`;
  const license = `<a target="_blank" href="https://github.com/Azgaar/Armoria#license">许可证</a>`;
  const html = /* html */ `<!DOCTYPE html>
    <html>
      <head>
        <title>${mapName.value} 纹章图库</title>
      </head>
      <style type="text/css">
        body { margin: 0; padding: 1em; font-family: serif; }
        h1, h2 { font-family: "Forum"; }
        div { width: 100%; max-width: 1018px; margin: 0 auto; border-bottom: 1px solid #ddd; }
        figure { margin: 0 0 2em; display: inline-block; transition: 0.2s; }
        figure:hover { background-color: #f6f6f6; }
        figcaption { text-align: center; margin: 0.4em 0; width: 200px; font-family: "Overlock SC"; }
        address { width: 100%; max-width: 1018px; margin: 0 auto; }
        a { color: black; }
        figure > a { text-decoration: none; }
        div > a { float: right; font-family: var(--monospace); margin-top: 0.8em; }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Forum&family=Overlock+SC" rel="stylesheet" />
      <body>
        <div><h1>${mapName.value} 纹章图库</h1></div>
        ${stateSection} ${provinceSections} ${burgSections} ${neutralsSection}
        <address>由 ${FMG} 生成。本工具免费，但图像可能受版权保护，详见 ${license}</address>
      </body>
    </html>`;
  downloadFile(html, `${name}.html`, "text/plain");
}

async function renderAllEmblems(states: EmblemEl[], provinces: EmblemEl[], burgs: EmblemEl[]): Promise<void> {
  tip("正在准备下载...", true, "warn");

  const statePromises = states.map(state => COArenderer.trigger(`stateCOA${state.i}`, state.coa));
  const provincePromises = provinces.map(province => COArenderer.trigger(`provinceCOA${province.i}`, province.coa));
  const burgPromises = burgs.map(burg => COArenderer.trigger(`burgCOA${burg.i}`, burg.coa));
  const promises = [...statePromises, ...provincePromises, ...burgPromises];

  await Promise.allSettled(promises);
  clearMainTip();
}

function dragEmblem(this: SVGUseElement, event: any): void {
  const x = Number(this.getAttribute("x")) - event.x;
  const y = Number(this.getAttribute("y")) - event.y;

  event.on("drag", function (this: SVGUseElement, dragEvent: any) {
    this.setAttribute("x", String(x + dragEvent.x));
    this.setAttribute("y", String(y + dragEvent.y));
  });

  event.on("end", function (this: SVGUseElement, endEvent: any) {
    const categotySize = Number((this.parentNode as SVGElement).getAttribute("font-size"));
    const size = currentEl.coa.size || 1;
    const shift = (categotySize * size) / 2;

    currentEl.coa.x = rn(x + endEvent.x + shift, 2);
    currentEl.coa.y = rn(y + endEvent.y + shift, 2);
  });
}

function closeEmblemEditor(): void {
  select<SVGElement, unknown>("#emblems")
    .selectAll<SVGUseElement, unknown>("use")
    .call(drag<SVGUseElement, unknown>().on("drag", null))
    .attr("class", null);
  $("#emblemEditor").dialog("destroy");
  ensureEl("emblemEditor").remove();
}

export const EmblemsEditor = { open, openDefault };
