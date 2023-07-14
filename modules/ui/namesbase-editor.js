"use strict";
function editNamesbase() {
  if (customization) return;
  closeDialogs("#namesbaseEditor, .stable");
  $("#namesbaseEditor").dialog();

  if (modules.editNamesbase) return;
  modules.editNamesbase = true;

  // add listeners
  document.getElementById("namesbaseSelect").addEventListener("change", updateInputs);
  document.getElementById("namesbaseTextarea").addEventListener("change", updateNamesData);
  document.getElementById("namesbaseUpdateExamples").addEventListener("click", updateExamples);
  document.getElementById("namesbaseExamples").addEventListener("click", updateExamples);
  document.getElementById("namesbaseName").addEventListener("input", updateBaseName);
  document.getElementById("namesbaseMin").addEventListener("input", updateBaseMin);
  document.getElementById("namesbaseMax").addEventListener("input", updateBaseMax);
  document.getElementById("namesbaseDouble").addEventListener("input", updateBaseDublication);
  document.getElementById("namesbaseAdd").addEventListener("click", namesbaseAdd);
  document.getElementById("namesbaseAnalyze").addEventListener("click", analyzeNamesbase);
  document.getElementById("namesbaseDefault").addEventListener("click", namesbaseRestoreDefault);
  document.getElementById("namesbaseDownload").addEventListener("click", namesbaseDownload);

  const uploader = document.getElementById("namesbaseToLoad");
  document.getElementById("namesbaseUpload").addEventListener("click", () => {
    uploader.addEventListener("change", e => uploadFile(e.target, d => namesbaseUpload(d, true)), {once: true});
    uploader.click();
  });
  document.getElementById("namesbaseUploadExtend").addEventListener("click", () => {
    uploader.addEventListener("change", e => uploadFile(e.target, d => namesbaseUpload(d, false)), {once: true});
    uploader.click();
  });

  document.getElementById("namesbaseCA").addEventListener("click", () => {
    openURL("https://cartographyassets.com/asset-category/specific-assets/azgaars-generator/namebases/");
  });
  document.getElementById("namesbaseSpeak").addEventListener("click", () => speak(namesbaseExamples.textContent));

  createBasesList();
  updateInputs();

  $("#namesbaseEditor").dialog({
    title: "名称库编辑器",
    width: "auto",
    position: {my: "center", at: "center", of: "svg"}
  });

  function createBasesList() {
    const select = document.getElementById("namesbaseSelect");
    select.innerHTML = "";
    nameBases.forEach((b, i) => select.options.add(new Option(b.name, i)));
  }

  function updateInputs() {
    const base = +document.getElementById("namesbaseSelect").value;
    if (!nameBases[base]) return tip(`名称库 ${base} 未定义`, false, "error");

    document.getElementById("namesbaseTextarea").value = nameBases[base].b;
    document.getElementById("namesbaseName").value = nameBases[base].name;
    document.getElementById("namesbaseMin").value = nameBases[base].min;
    document.getElementById("namesbaseMax").value = nameBases[base].max;
    document.getElementById("namesbaseDouble").value = nameBases[base].d;
    updateExamples();
  }

  function updateExamples() {
    const base = +document.getElementById("namesbaseSelect").value;
    let examples = "";
    for (let i = 0; i < 10; i++) {
      const example = Names.getBase(base);
      if (example === undefined) {
        examples = "无法生成示例。请验证数据";
        break;
      }
      if (i) examples += ", ";
      examples += example;
    }
    document.getElementById("namesbaseExamples").innerHTML = examples;
  }

  function updateNamesData() {
    const base = +document.getElementById("namesbaseSelect").value;
    const input = document.getElementById("namesbaseTextarea");
    if (input.value.split(",").length < 3)
      return tip("所提供的名称数据不正确", false, "error");

    const securedNamesData = input.value.replace(/[/|]/g, "");
    nameBases[base].b = securedNamesData;
    input.value = securedNamesData;
    Names.updateChain(base);
  }

  function updateBaseName() {
    const base = +document.getElementById("namesbaseSelect").value;
    const select = document.getElementById("namesbaseSelect");

    const rawName = this.value;
    const name = rawName.replace(/[/|]/g, "");

    select.options[namesbaseSelect.selectedIndex].innerHTML = name;
    nameBases[base].name = name;
  }

  function updateBaseMin() {
    const base = +document.getElementById("namesbaseSelect").value;
    if (+this.value > nameBases[base].max) return tip("最小长度不能大于最大长度", false, "error");
    nameBases[base].min = +this.value;
  }

  function updateBaseMax() {
    const base = +document.getElementById("namesbaseSelect").value;
    if (+this.value < nameBases[base].min) return tip("最大长度应大于最小长度", false, "error");
    nameBases[base].max = +this.value;
  }

  function updateBaseDublication() {
    const base = +document.getElementById("namesbaseSelect").value;
    nameBases[base].d = this.value;
  }

  function analyzeNamesbase() {
    const namesSourceString = document.getElementById("namesbaseTextarea").value;
    const namesArray = namesSourceString.toLowerCase().split(",");
    const length = namesArray.length;
    if (!namesSourceString || !length) return tip("名称数据不应为空", false, "error");

    const chain = Names.calculateChain(namesSourceString);
    const variety = rn(d3.mean(Object.values(chain).map(keyValue => keyValue.length)));

    const wordsLength = namesArray.map(n => n.length);

    const nonLatin = namesSourceString.match(/[^\u0000-\u007f]/g);
    const nonBasicLatinChars = nonLatin
      ? unique(
          namesSourceString
            .match(/[^\u0000-\u007f]/g)
            .join("")
            .toLowerCase()
        ).join("")
      : "none";

    const geminate = namesArray.map(name => name.match(/[^\w\s]|(.)(?=\1)/g) || []).flat();
    const doubled = unique(geminate).filter(
      char => geminate.filter(doudledChar => doudledChar === char).length > 3
    ) || ["none"];

    const duplicates = unique(namesArray.filter((e, i, a) => a.indexOf(e) !== i)).join(", ") || "none";
    const multiwordRate = d3.mean(namesArray.map(n => +n.includes(" ")));

    const getLengthQuality = () => {
      if (length < 30)
        return "<span data-tip='名称库包含小于30个名称——不足以生成合理的数据' style='color:red'>[not enough]</span>";
      if (length < 100)
        return "<span data-tip='名称库包含小于100个名称——不足以生成好的名称' style='color:darkred'>[low]</span>";
      if (length <= 400)
        return "<span data-tip='名称库包含合理数量的示例的命名' style='color:green'>[good]</span>";
      return "<span data-tip='名称库名称过多，大于400个名称。尽量减少到大约300个名称' style='color:darkred'>[overmuch]</span>";
    };

    const getVarietyLevel = () => {
      if (variety < 15) return "<span data-tip='名称库平均品种小于15-生成的名称将太重复' style='color:red'>[low]</span>";
      if (variety < 30) return "<span data-tip='名称库平均品种小于30-名称可能过于重复' style='color:orange'>[mean]</span>";
      return "<span data-tip='名称库的多样性良好' style='color:green'>[good]</span>";
    };

    alertMessage.innerHTML = /* html */ `<div style="line-height: 1.6em; max-width: 20em">
      <div data-tip="提供的名称数量">名称库长度: ${length} ${getLengthQuality()}</div>
      <div data-tip="链中每个键的平均生成变量数">名称库多样性: ${variety} ${getVarietyLevel()}</div>
      <hr />
      <div data-tip="最短的名字长度">最小名称长度: ${d3.min(wordsLength)}</div>
      <div data-tip="最长的名称长度">最大名字长度: ${d3.max(wordsLength)}</div>
      <div data-tip="平均名称长度">平均名字长度: ${rn(d3.mean(wordsLength), 1)}</div>
      <div data-tip="常见名称长度">中位名字长度: ${d3.median(wordsLength)}</div>
      <hr />
      <div data-tip="基本拉丁文以外的字符的字体支持很差">非基本字符: ${nonBasicLatinChars}</div>
      <div data-tip="经常翻倍(超过3倍)使用的字符">双倍字符: ${doubled.join(
        ""
      )}</div>
      <div data-tip="多次使用名称">复用: ${duplicates}</div>
      <div data-tip="包含空格字符的名称百分比">复数词名字: ${rn(
        multiwordRate * 100,
        2
      )}%</div>
    </div>`;

    $("#alert").dialog({
      resizable: false,
      title: "数据分析",
      position: {my: "left top-30", at: "right+10 top", of: "#namesbaseEditor"},
      buttons: {
        好的: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function namesbaseAdd() {
    const base = nameBases.length;
    const b =
      "This,is,an,example,of,name,base,showing,correct,format,It,should,have,at,least,one,hundred,names,separated,with,comma";
    nameBases.push({name: "Base" + base, min: 5, max: 12, d: "", m: 0, b});
    document.getElementById("namesbaseSelect").add(new Option("Base" + base, base));
    document.getElementById("namesbaseSelect").value = base;
    document.getElementById("namesbaseTextarea").value = b;
    document.getElementById("namesbaseName").value = "Base" + base;
    document.getElementById("namesbaseMin").value = 5;
    document.getElementById("namesbaseMax").value = 12;
    document.getElementById("namesbaseDouble").value = "";
    document.getElementById("namesbaseExamples").innerHTML = "请提供名称数据";
  }

  function namesbaseRestoreDefault() {
    alertMessage.innerHTML = /* html */ `确实要还原默认名称库吗？`;
    $("#alert").dialog({
      resizable: false,
      title: "还原默认数据",
      buttons: {
        Restore: function () {
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

  function namesbaseDownload() {
    const data = nameBases.map((b, i) => `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${b.b}`).join("\r\n");
    const name = getFileName("Namesbase") + ".txt";
    downloadFile(data, name);
  }

  function namesbaseUpload(dataLoaded, override = true) {
    const data = dataLoaded.split("\r\n");
    if (!data || !data[0]) return tip("无法加载名称库。请检查数据格式", false, "error");

    Names.clearChains();
    if (override) nameBases = [];

    data.forEach(base => {
      const [name, min, max, d, m, names] = base.split("|");
      const secureNames = names.replace(/[/|]/g, "");
      nameBases.push({name, min, max, d, m, b: secureNames});
    });

    createBasesList();
    updateInputs();
  }
}
