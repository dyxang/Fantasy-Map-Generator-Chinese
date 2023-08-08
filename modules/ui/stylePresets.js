// UI module to control the style presets
"use strict";

const systemPresets = [
  "default",
  "ancient",
  "gloom",
  "pale",
  "light",
  "watercolor",
  "clean",
  "atlas",
  "cyberpunk",
  "monochrome"
];
const customPresetPrefix = "fmgStyle_";

// add style presets to list
{
  const systemOptions = systemPresets.map(styleName => `<option value="${styleName}">${styleName}</option>`);
  const storedStyles = Object.keys(localStorage).filter(key => key.startsWith(customPresetPrefix));
  const customOptions = storedStyles.map(
    styleName => `<option value="${styleName}">${styleName.replace(customPresetPrefix, "")} [custom]</option>`
  );
  const options = systemOptions.join("") + customOptions.join("");
  document.getElementById("stylePreset").innerHTML = options;
}

async function applyStyleOnLoad() {
  const desiredPreset = localStorage.getItem("presetStyle") || "default";
  const styleData = await getStylePreset(desiredPreset);
  const [appliedPreset, style] = styleData;

  applyStyle(style);
  updateMapFilter();
  stylePreset.value = stylePreset.dataset.old = appliedPreset;
  setPresetRemoveButtonVisibiliy();
}

async function getStylePreset(desiredPreset) {
  let presetToLoad = desiredPreset;

  const isCustom = !systemPresets.includes(desiredPreset);
  if (isCustom) {
    const storedStyleJSON = localStorage.getItem(desiredPreset);
    if (!storedStyleJSON) {
      ERROR && console.error(`定制风格 ${desiredPreset} 在 localStorage 中找不到. 应用默认样式`);
      presetToLoad = "default";
    } else {
      const isValid = JSON.isValid(storedStyleJSON);
      if (isValid) return [desiredPreset, JSON.parse(storedStyleJSON)];

      ERROR && console.error(`定制风格 ${desiredPreset} 存储在 localStorage 中无效. 应用默认样式`);
      presetToLoad = "default";
    }
  }

  const style = await fetchSystemPreset(presetToLoad);
  return [presetToLoad, style];
}

async function fetchSystemPreset(preset) {
  const style = await fetch(`./styles/${preset}.json`)
    .then(res => res.json())
    .catch(err => {
      ERROR && console.error("加载样式预设错误", preset, err);
      return null;
    });

  if (!style) throw new Error("无法获取样式预设", preset);
  return style;
}

function applyStyle(style) {
  for (const selector in style) {
    const el = document.querySelector(selector);
    if (!el) continue;
    for (const attribute in style[selector]) {
      const value = style[selector][attribute];

      if (value === "null" || value === null) {
        el.removeAttribute(attribute);
        continue;
      }

      if (attribute === "text-shadow") {
        el.style[attribute] = value;
      } else {
        el.setAttribute(attribute, value);
      }
      if (layerIsOn("toggleTexture") && selector === "#textureImage" && attribute === "src") {
        el.setAttribute("href", value);
      }
    }
  }
}

function requestStylePresetChange(preset) {
  const isConfirmed = sessionStorage.getItem("styleChangeConfirmed");
  if (isConfirmed) {
    changeStyle(preset);
    return;
  }

  confirmationDialog({
    title: "更改样式预设",
    message: "确实要更改样式预设吗? 所有未保存的样式更改都将丢失",
    confirm: "更改",
    onConfirm: () => {
      sessionStorage.setItem("styleChangeConfirmed", true);
      changeStyle(preset);
    },
    onCancel: () => {
      stylePreset.value = stylePreset.dataset.old;
    }
  });
}

async function changeStyle(desiredPreset) {
  const styleData = await getStylePreset(desiredPreset);
  const [appliedPreset, style] = styleData;
  localStorage.setItem("presetStyle", appliedPreset);
  applyStyleWithUiRefresh(style);
}

function applyStyleWithUiRefresh(style) {
  applyStyle(style);
  updateElements();
  selectStyleElement(); // re-select element to trigger values update
  updateMapFilter();
  stylePreset.dataset.old = stylePreset.value;

  invokeActiveZooming();
  setPresetRemoveButtonVisibiliy();
}

function addStylePreset() {
  $("#styleSaver").dialog({title: "Style Saver", width: "26em", position: {my: "center", at: "center", of: "svg"}});

  const styleName = stylePreset.value.replace(customPresetPrefix, "");
  document.getElementById("styleSaverName").value = styleName;
  styleSaverJSON.value = JSON.stringify(collectStyleData(), null, 2);
  checkName();

  if (modules.saveStyle) return;
  modules.saveStyle = true;

  // add listeners
  document.getElementById("styleSaverName").addEventListener("input", checkName);
  document.getElementById("styleSaverSave").addEventListener("click", saveStyle);
  document.getElementById("styleSaverDownload").addEventListener("click", styleDownload);
  document.getElementById("styleSaverLoad").addEventListener("click", () => styleToLoad.click());
  document.getElementById("styleToLoad").addEventListener("change", loadStyleFile);

  function collectStyleData() {
    const style = {};
    const attributes = {
      "#map": ["background-color", "filter", "data-filter"],
      "#armies": ["font-size", "box-size", "stroke", "stroke-width", "fill-opacity", "filter"],
      "#biomes": ["opacity", "filter", "mask"],
      "#stateBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#provinceBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#cells": ["opacity", "stroke", "stroke-width", "filter", "mask"],
      "#gridOverlay": [
        "opacity",
        "scale",
        "dx",
        "dy",
        "type",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap",
        "transform",
        "filter",
        "mask"
      ],
      "#coordinates": [
        "opacity",
        "data-size",
        "font-size",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap",
        "filter",
        "mask"
      ],
      "#compass": ["opacity", "transform", "filter", "mask", "shape-rendering"],
      "#rose": ["transform"],
      "#relig": ["opacity", "stroke", "stroke-width", "filter"],
      "#cults": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#landmass": ["opacity", "fill", "filter"],
      "#markers": ["opacity", "rescale", "filter"],
      "#prec": ["opacity", "stroke", "stroke-width", "fill", "filter"],
      "#population": ["opacity", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#rural": ["stroke"],
      "#urban": ["stroke"],
      "#freshwater": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#salt": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#sinkhole": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#frozen": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#lava": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#dry": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#sea_island": ["opacity", "stroke", "stroke-width", "filter", "auto-filter"],
      "#lake_island": ["opacity", "stroke", "stroke-width", "filter"],
      "#terrain": ["opacity", "set", "size", "density", "filter", "mask"],
      "#rivers": ["opacity", "filter", "fill"],
      "#ruler": ["opacity", "filter"],
      "#roads": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#trails": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#searoutes": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#statesBody": ["opacity", "filter"],
      "#statesHalo": ["opacity", "data-width", "stroke-width", "filter"],
      "#provs": ["opacity", "fill", "font-size", "font-family", "filter"],
      "#temperature": [
        "opacity",
        "font-size",
        "fill",
        "fill-opacity",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap",
        "filter"
      ],
      "#ice": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#emblems": ["opacity", "stroke-width", "filter"],
      "#texture": ["opacity", "filter", "mask"],
      "#textureImage": ["x", "y", "src"],
      "#zones": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#oceanLayers": ["filter", "layers"],
      "#oceanBase": ["fill"],
      "#oceanicPattern": ["href", "opacity"],
      "#terrs": ["opacity", "scheme", "terracing", "skip", "relax", "curve", "filter", "mask"],
      "#legend": [
        "data-size",
        "font-size",
        "font-family",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap",
        "data-x",
        "data-y",
        "data-columns"
      ],
      "#legendBox": ["fill", "fill-opacity"],
      "#burgLabels > #cities": ["opacity", "fill", "text-shadow", "data-size", "font-size", "font-family"],
      "#burgIcons > #cities": [
        "opacity",
        "fill",
        "fill-opacity",
        "size",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap"
      ],
      "#anchors > #cities": ["opacity", "fill", "size", "stroke", "stroke-width"],
      "#burgLabels > #towns": ["opacity", "fill", "text-shadow", "data-size", "font-size", "font-family"],
      "#burgIcons > #towns": [
        "opacity",
        "fill",
        "fill-opacity",
        "size",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap"
      ],
      "#anchors > #towns": ["opacity", "fill", "size", "stroke", "stroke-width"],
      "#labels > #states": [
        "opacity",
        "fill",
        "stroke",
        "stroke-width",
        "text-shadow",
        "data-size",
        "font-size",
        "font-family",
        "filter"
      ],
      "#labels > #addedLabels": [
        "opacity",
        "fill",
        "stroke",
        "stroke-width",
        "text-shadow",
        "data-size",
        "font-size",
        "font-family",
        "filter"
      ],
      "#fogging": ["opacity", "fill", "filter"]
    };

    for (const selector in attributes) {
      const el = document.querySelector(selector);
      if (!el) continue;

      style[selector] = {};
      for (const attr of attributes[selector]) {
        let value = el.style[attr] || el.getAttribute(attr);
        if (attr === "font-size" && el.hasAttribute("data-size")) value = el.getAttribute("data-size");
        style[selector][attr] = parseValue(value);
      }
    }

    function parseValue(value) {
      if (value === "null" || value === null) return null;
      if (value === "") return "";
      if (!isNaN(+value)) return +value;
      return value;
    }

    return style;
  }

  function checkName() {
    const styleName = customPresetPrefix + styleSaverName.value;

    const isSystem = systemPresets.includes(styleName) || systemPresets.includes(styleSaverName.value);
    if (isSystem) return (styleSaverTip.innerHTML = "default");

    const isExisting = Array.from(stylePreset.options).some(option => option.value == styleName);
    if (isExisting) return (styleSaverTip.innerHTML = "existing");

    styleSaverTip.innerHTML = "new";
  }

  function saveStyle() {
    const styleJSON = styleSaverJSON.value;
    const desiredName = styleSaverName.value;

    if (!styleJSON) return tip("请提供样式 JSON", false, "error");
    if (!JSON.isValid(styleJSON)) return tip("JSON 字符串无效，请检查格式", false, "error");
    if (!desiredName) return tip("请提供预设名称", false, "error");
    if (styleSaverTip.innerHTML === "default") return tip("你不能覆盖默认预设，请更改名称", false, "error");

    const presetName = customPresetPrefix + desiredName;
    applyOption(stylePreset, presetName, desiredName + " [custom]");
    localStorage.setItem("presetStyle", presetName);
    localStorage.setItem(presetName, styleJSON);

    applyStyleWithUiRefresh(JSON.parse(styleJSON));
    tip("样式预设保存并应用", false, "success", 4000);
    $("#styleSaver").dialog("close");
  }

  function styleDownload() {
    const styleJSON = styleSaverJSON.value;
    const styleName = styleSaverName.value;

    if (!styleJSON) return tip("请提供样式 JSON", false, "error");
    if (!JSON.isValid(styleJSON)) return tip("JSON 字符串无效，请检查格式", false, "error");
    if (!styleName) return tip("请提供预设名称", false, "error");

    downloadFile(styleJSON, styleName + ".json", "application/json");
  }

  function loadStyleFile() {
    const fileName = this.files[0]?.name.replace(/\.[^.]*$/, "");
    uploadFile(this, styleUpload);

    function styleUpload(dataLoaded) {
      if (!dataLoaded) return tip("无法加载文件。请检查数据格式", false, "error");
      const isValid = JSON.isValid(dataLoaded);
      if (!isValid) return tip("加载的数据不是有效的 JSON，请检查格式", false, "error");

      styleSaverJSON.value = JSON.stringify(JSON.parse(dataLoaded), null, 2);
      styleSaverName.value = fileName;
      checkName();
      tip("样式预设已上载", false, "success", 4000);
    }
  }
}

function requestRemoveStylePreset() {
  const isDefault = systemPresets.includes(stylePreset.value);
  if (isDefault) return tip("无法删除系统预置", false, "error");

  confirmationDialog({
    title: "删除样式预设",
    message: "确实要删除样式预设吗? 此操作无法撤消.",
    confirm: "删除",
    onConfirm: removeStylePreset
  });
}

function removeStylePreset() {
  localStorage.removeItem("presetStyle");
  localStorage.removeItem(stylePreset.value);
  stylePreset.selectedOptions[0].remove();

  changeStyle("default");
}

function updateMapFilter() {
  const filter = svg.attr("data-filter");
  mapFilters.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  if (!filter) return;
  mapFilters.querySelector("#" + filter).classList.add("pressed");
}

function setPresetRemoveButtonVisibiliy() {
  const isDefault = systemPresets.includes(stylePreset.value);
  removeStyleButton.style.display = isDefault ? "none" : "inline-block";
}
