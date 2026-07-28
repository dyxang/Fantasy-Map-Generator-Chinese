import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { drawGoods } from "@/renderers/draw-goods";
import { drawMarkets } from "@/renderers/draw-markets";
import { tradeAnimation } from "@/renderers/trade-animation";
import { capitalize, rn } from "@/utils";
import { CULTURE_TYPES } from "../generators/cultures-generator";
import type { DemandCategory, Good } from "../generators/goods-generator";
import { DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY } from "../generators/goods-generator";
import { destroyDialogIfExists, ensureEl, getRandomColor, unique } from "../utils";

function open(editedGood?: Good, onUpdate?: () => void) {
  const icons = Array.from(ensureEl("good-icons").querySelectorAll("symbol")).map(el => el.id);
  const demandCoverageState: Partial<Record<DemandCategory, number>> = { ...(editedGood?.demandCoverage || {}) };
  const biomeOutputState: Partial<Record<number, number>> = { ...(editedGood?.biomeOutput || {}) };

  const demandCoverageSummary = (): string => {
    const entries = DEMAND_PRIORITY.map(cat => [cat, demandCoverageState[cat] ?? 0] as const).filter(([, v]) => v > 0);
    if (!entries.length) return "无";
    return entries.map(([cat, v]) => `${DEMAND_CATEGORY_ICONS[cat]} ${capitalize(cat)}: ${v}`).join(", ");
  };

  const biomeOutputSummary = (): string => {
    const entries = Object.entries(biomeOutputState).filter(([, v]) => (v ?? 0) > 0);
    if (!entries.length) return "无";
    return entries.map(([id, v]) => `${pack.biomes[Number(id)].name}: ${v}`).join(", ");
  };

  const multipliers: { [K in MultiplierDimKey]?: Partial<Record<string, number>> } = {
    cultureType: { ...(editedGood?.multipliers?.cultureType ?? {}) },
    culture: { ...(editedGood?.multipliers?.culture ?? {}) },
    state: { ...(editedGood?.multipliers?.state ?? {}) },
    religion: { ...(editedGood?.multipliers?.religion ?? {}) },
    biome: { ...(editedGood?.multipliers?.biome ?? {}) },
    zone: { ...(editedGood?.multipliers?.zone ?? {}) }
  };

  const multiplierSummary = (dim: MultiplierDimKey): string => {
    const vals = multipliers[dim] ?? {};
    const entries = Object.entries(vals).filter(([, v]) => v !== 1);
    if (!entries.length) return "无";
    return entries.map(([id, v]) => `${getMultiplierEntityName(dim, id)} ×${rn(v!, 2)}`).join(", ");
  };

  const renderMultiplierRow = (dim: MultiplierDimKey, label: string) => /*html*/ `
      <label data-tip="按${label}的生产乘数。1 = 无影响，0 = 完全抑制。">${label}</label>
      <div class="ge-edit-row">
        <span id="mSummary_${dim}">${multiplierSummary(dim)}</span>
        <button class="mEdit icon-pencil ge-edit" data-dim="${dim}" data-tip="编辑 ${label} 乘数"></button>
      </div>`;

  const recipes: Record<number, number>[] = editedGood?.recipes || [];

  let dialog: HTMLElement;
  renderDialog();

  $(dialog!).dialog({
    width: "30em",
    resizable: false,
    title: editedGood ? "编辑货物" : "添加新货物",
    open: function (this: HTMLElement) {
      if (!editedGood) return; // only edits can recompute the economy
      const pane = this.parentElement?.querySelector(".ui-dialog-buttonpane");
      pane?.insertAdjacentHTML(
        "afterbegin",
        /*html*/ `<div class="dontAsk" data-tip="重新放置此货物并重新计算生产、贸易和税收。取消勾选可仅更新货物，不影响当前经济。">
          <input id="goodRegenerateEconomy" class="checkbox" type="checkbox" checked />
          <label for="goodRegenerateEconomy" class="checkbox-label"><i>应用时重新生成经济</i></label>
        </div>`
      );
    },
    close: () => {
      destroyDialogIfExists("goodEditor");
    },
    buttons: {
      取消: function () {
        $(this).dialog("close");
      },
      [editedGood ? "应用" : "添加"]: () => {
        const errors: string[] = [];

        const name = ensureEl<HTMLInputElement>("newGoodName").value.trim();
        const tagsInput = ensureEl<HTMLInputElement>("newGoodTags").value.trim();
        const tags = unique(tagsInput.split(",").map(tag => tag.trim().toLocaleLowerCase()));
        const value = +ensureEl<HTMLInputElement>("newGoodValue").value;
        const chance = +ensureEl<HTMLInputElement>("newGoodChance").value;
        const unit = ensureEl<HTMLInputElement>("newGoodUnit").value.trim();
        const icon = ensureEl<HTMLSelectElement>("newGoodIcon").value;
        const color = ensureEl<HTMLInputElement>("newGoodColor").value;
        const distribution = ensureEl("newGoodDistribution").textContent?.trim() ?? "";

        if (!name) errors.push("名称为必填项");
        if (!Number.isFinite(value) || value < 0) errors.push("值必须是有效的非负数");
        if (!Number.isFinite(chance) || chance < 0 || chance > 100) errors.push("概率必须在 0 到 100 之间");

        if (distribution) {
          try {
            const methods = Goods.getMethods();
            const allMethods = `{${Object.keys(methods).join(", ")}}`;
            new Function(allMethods, `return ${distribution}`)(methods);
          } catch (err) {
            errors.push(`分布函数无效：${(err as Error).message || err}`);
          }
        }

        for (const recipe of recipes) {
          for (const [ingredientId, ingredientAmount] of Object.entries(recipe)) {
            const id = Number(ingredientId);
            const good = Goods.get(id);
            if (!good) errors.push(`配方引用了未知的货物 ID：${id}`);
            const amount = Number(ingredientAmount);
            if (Number.isNaN(amount) || !Number.isFinite(amount) || amount <= 0)
              errors.push(`货物 ${good?.name} 的配方数量无效`);
          }

          if (!Object.keys(recipe).length) errors.push("每个配方必须至少包含一种原料");
        }

        ensureEl("newGoodError").textContent = errors.join(". ");
        if (errors.length) return;

        function buildFinalMultipliers(): Good["multipliers"] {
          const result: Good["multipliers"] = {};
          for (const [dimKey, vals] of Object.entries(multipliers) as [
            MultiplierDimKey,
            Partial<Record<string, number>>
          ][]) {
            const nonDefault = Object.fromEntries(
              Object.entries(vals ?? {}).filter(([, v]) => v !== undefined && v !== 1)
            );
            if (Object.keys(nonDefault).length) (result as any)[dimKey] = nonDefault;
          }
          return Object.keys(result).length ? result : undefined;
        }

        if (editedGood) {
          editedGood.name = name;
          editedGood.tags = tags;
          editedGood.icon = icon;
          editedGood.color = color;
          editedGood.value = value;
          editedGood.chance = chance;
          editedGood.unit = unit;
          editedGood.demandCoverage = demandCoverageState;
          editedGood.multipliers = buildFinalMultipliers();
          editedGood.distribution = distribution || undefined;
          editedGood.biomeOutput = Object.keys(biomeOutputState).length ? biomeOutputState : undefined;
          editedGood.recipes = recipes.length ? recipes : undefined;

          // opt-out: by default re-place the good and recompute the economy to reflect the change
          if (ensureEl<HTMLInputElement>("goodRegenerateEconomy").checked) {
            Goods.regeneratePlacement(editedGood.i);
            Production.regenerateEconomy();
            if (layerIsOn("toggleMarketsLayer")) drawMarkets();
            if (layerIsOn("toggleGoods")) drawGoods();
            if (layerIsOn("toggleTrade")) tradeAnimation.restart();
            refreshEditors();
          } else {
            Goods.sync();
          }
        } else {
          const getNextId = () => {
            let nextId = pack.goods?.at(-1)?.i ?? 1;
            while (Goods.get(nextId)) nextId++;
            return nextId;
          };

          pack.goods.push({
            i: getNextId(),
            name,
            tags,
            icon,
            color,
            value,
            chance,
            unit,
            demandCoverage: demandCoverageState,
            multipliers: buildFinalMultipliers(),
            distribution: distribution || undefined,
            biomeOutput: Object.keys(biomeOutputState).length ? biomeOutputState : undefined,
            recipes: recipes.length ? recipes : undefined
          });
          Goods.sync();
        }

        tip(editedGood ? "货物已更新" : "货物已添加", false, "success", 5000);
        onUpdate?.();
        $(dialog).dialog("close");
      }
    }
  });

  function renderDialog(): void {
    destroyDialogIfExists("goodEditor");
    ensureEl("dialogs").insertAdjacentHTML(
      "beforeend",
      /*html*/ `<div id="goodEditor" class="dialog">
    <style>
      .ge                 { display:flex; width: auto !important; flex-direction:column; gap:9px; max-height:72vh; overflow-y:auto; padding-right:2px; }
      .ge-section-title   { display:flex; align-items:center; justify-content:space-between; font-weight:bold; text-transform:uppercase; font-size:.8em; letter-spacing:.06em; margin-bottom:7px; padding-bottom:4px; border-bottom:1px solid #666; }
      .ge-grid            { display:grid; grid-template-columns:9em minmax(0, 1fr); gap:.2em; align-items:center; }
      .ge-grid--top       { align-items:start; }
      .ge-grid > *        { min-width:0; }
      .ge-grid > label    { color:#555; }
      .ge-field           { width:100%; }
      input.ge-num        { width:6em; }
      .ge-inline          { display:flex; align-items:center; gap:.4em; }
      .ge-icon-select     { flex:1; min-width:0; }
      .ge-icon-preview    { flex-shrink:0; }
      .ge-color           { width:2.4em; height:1.4em; padding:0; border:none; flex-shrink:0; }
      .ge-edit-row        { display:flex; align-items:flex-start; justify-content:space-between; gap:6px; }
      .ge-edit-row > span { flex:1; min-width:0; }
      .ge-edit            { flex-shrink:0; }
      .ge-dist            { flex:1; min-width:0; color:#555; font-size:.9em; font-family:var(--monospace); word-break:break-all; }
      .ge-note            { color:#777; font-style:italic; font-size:.9em; }
      .ge-error           { color:#b20000; min-height:1.2em; }
      .ge-recipe-list     { display:flex; flex-direction:column; gap:.45em; }
      .ge-recipe          { border:1px solid #ccc; border-radius:3px; }
      .ge-recipe-head     { display:flex; align-items:center; justify-content:space-between; padding:.2em .3em; }
      .ge-recipe-actions  { display:flex; gap:.3em; }
      .ge-recipe-ings     { display:flex; flex-direction:column; gap:.2em; padding:.3em .4em; }
      .ge-recipe-ing      { display:grid; grid-template-columns:1fr 5em 1.5em; gap:.25em; align-items:center; }
    </style>

    <div class="ge">
      <div>
        <div class="ge-section-title">常规</div>
        <div class="ge-grid">
          <label for="newGoodName">名称*</label>
          <input id="newGoodName" class="ge-field" value="${editedGood?.name || ""}" />

          <label for="newGoodTags">标签</label>
          <input id="newGoodTags" class="ge-field" value="${editedGood?.tags.join(", ") || ""}" placeholder="以逗号分隔" />

          <label for="newGoodValue">基础价格*</label>
          <span class="ge-inline"><input id="newGoodValue" class="ge-num" type="number" min="0" step="1" value="${editedGood?.value ?? 1}" /> 🟡</span>

          <label for="newGoodChance">概率</label>
          <input id="newGoodChance" class="ge-num" type="number" min="0" max="100" step="0.1" value="${editedGood?.chance ?? 1}" />

          <label for="newGoodUnit">单位</label>
          <input id="newGoodUnit" class="ge-field" placeholder="例如：wagon、barrel" value="${editedGood?.unit || ""}" />

          <label for="newGoodIcon">图标*</label>
          <div class="ge-inline">
            <select id="newGoodIcon" class="ge-icon-select">${icons.map(icon => `<option value="${icon}" ${editedGood?.icon === icon ? "selected" : ""}>${icon}</option>`).join("")}</select>
            <svg class="ge-icon-preview" width="2em" height="2em">
              <circle id="newGoodIconCircle" cx="50%" cy="50%" r="42%" fill="${editedGood?.color || "#ff5959"}" stroke="${Goods.getStroke(editedGood?.color || "#ff5959")}"/>
              <use id="newGoodIconPreview" href="#${editedGood?.icon || "good-unknown"}" x="10%" y="10%" width="80%" height="80%"/>
            </svg>
            <button id="newGoodUploadIconRaster" class="icon-upload" data-tip="上传栅格图标"></button>
            <button id="newGoodUploadIconVector" class="icon-upload-cloud" data-tip="上传矢量（SVG）图标"></button>
            <input id="newGoodColor" class="ge-color" type="color" data-tip="设置描边颜色" value="${editedGood?.color || "#ff5959"}" />
          </div>

          <label data-tip="此货物满足各需求类别的程度。点击铅笔图标编辑。">需求覆盖</label>
          <div class="ge-edit-row">
            <span id="demandCoverageSummary" >${demandCoverageSummary()}</span>
            <button class="dcEdit icon-pencil ge-edit" data-tip="编辑需求覆盖"></button>
          </div>
        </div>
      </div>

      <div>
        <div class="ge-section-title">原料生产</div>
        <div class="ge-grid ge-grid--top">
          <label data-tip="对于原料资源：设置每个生物群系的基础产能">乡村产能</label>
          <div class="ge-edit-row">
            <span id="biomeProductionSummary">${biomeOutputSummary()}</span>
            <button class="bpEdit icon-pencil ge-edit" data-tip="编辑生物群系基础产能"></button>
          </div>

          <label data-tip="对于原料资源：控制此货物直接从环境（如生物群系、海拔、温度）生产的位置和方式">奖励分布</label>
          <div class="ge-edit-row">
            <div id="newGoodDistribution" class="ge-dist">${editedGood?.distribution || ""}</div>
            <button id="newGoodDistributionEditor" class="icon-pencil ge-edit" data-tip="打开分布可视化编辑器"></button>
          </div>
        </div>
        <div id="newGoodRawNote" class="ge-note"></div>
      </div>

      <div>
        <div class="ge-section-title">
          <span data-tip="对于制造货物：配方定义了生产此货物所需的其他货物">配方</span>
          <button id="newGoodAddRecipe" class="icon-plus" data-tip="添加配方"></button>
        </div>
        <div id="newGoodRecipeList" class="ge-recipe-list"></div>
        <div id="newGoodRecipeNote" class="ge-note"></div>
      </div>

      <div>
        <div class="ge-section-title">
          <span data-tip="按维度的生产乘数。1 = 无影响，0 = 完全抑制。">乘数</span>
        </div>
        <div class="ge-grid ge-grid--top">
          ${renderMultiplierRow("cultureType", "文化类型")}
          ${renderMultiplierRow("culture", "文化")}
          ${renderMultiplierRow("state", "国家")}
          ${renderMultiplierRow("religion", "宗教")}
          ${renderMultiplierRow("biome", "生物群系")}
          ${renderMultiplierRow("zone", "区域")}
        </div>
      </div>

      <div id="newGoodError" class="ge-error"></div>
    </div>
  </div>`
    );
    dialog = ensureEl("goodEditor");

    const recipeList = ensureEl("newGoodRecipeList");

    const defaultGoodId = pack.goods[0]?.i ?? 0;
    const sortedGoods = [...pack.goods].sort((a, b) => a.name.localeCompare(b.name));

    const isRawProductionEmpty = () =>
      !Object.values(biomeOutputState).some(v => (v ?? 0) > 0) &&
      !document.getElementById("newGoodDistribution")?.textContent?.trim();

    // a good is either gathered (raw) or made from recipes (manufactured)
    const updateTypeNotes = () => {
      const rawEmpty = isRawProductionEmpty();
      const recipesEmpty = recipes.length === 0;

      const recipeNote = ensureEl("newGoodRecipeNote");
      recipeNote.textContent = "此货物为纯原料：从环境中采集。";
      recipeNote.style.display = recipesEmpty && !rawEmpty ? "" : "none";

      const rawNote = ensureEl("newGoodRawNote");
      rawNote.textContent = "此货物为纯制造：在城镇中由配方制作。";
      rawNote.style.display = rawEmpty && !recipesEmpty ? "" : "none";
    };

    const renderRecipes = () => {
      recipeList.innerHTML = recipes
        .map(
          (recipe, recipeIndex) => /*html*/ `
          <div class="recipeOption ge-recipe" data-recipe-index="${recipeIndex}" >
            <div class="ge-recipe-head">
              <span>配方 ${recipeIndex + 1}</span>
              <div class="ge-recipe-actions">
                <span class="recipeAddIngredient icon-plus pointer" data-recipe-index="${recipeIndex}" data-tip="添加原料"></span>
                <span class="recipeRemoveOption icon-trash-empty pointer" data-recipe-index="${recipeIndex}" data-tip="移除配方"></span>
              </div>
            </div>
            <div class="recipeIngredients ge-recipe-ings">
              ${Object.entries(recipe)
                .map(
                  ([ingredientId, amount], ingredientIndex) => /*html*/ `
                    <div class="ge-recipe-ing" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">
                      <select class="recipeGoodSelect" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">${sortedGoods.map(good => `<option value="${good.i}" ${good.i === Number(ingredientId) ? "selected" : ""}>${good.name}</option>`).join("")}</select>
                      <input class="recipeAmountInput" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" type="number" min="1" step="1" value="${amount}" />
                      <span class="recipeRemoveIngredient icon-trash-empty pointer" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" data-tip="移除原料" />
                    </div>`
                )
                .join("")}
            </div>
          </div>
        `
        )
        .join("");

      recipeList.querySelectorAll<HTMLSelectElement>(".recipeGoodSelect").forEach(select => {
        select.onchange = () => {
          const selectedGoodId = +select.value;
          const recipeIndex = +select.dataset.recipeIndex!;
          const ingredientIndex = +select.dataset.ingredientIndex!;
          const recipe = recipes[recipeIndex];

          const oldAmount = recipe[ingredientIndex] || 0;
          delete recipe[ingredientIndex];
          recipe[selectedGoodId] = oldAmount;
          renderRecipes();
        };
      });

      recipeList.querySelectorAll<HTMLInputElement>(".recipeAmountInput").forEach(input => {
        input.onchange = () => {
          const recipeIndex = +input.dataset.recipeIndex!;
          const ingredientIndex = +input.dataset.ingredientIndex!;
          const recipe = recipes[recipeIndex];
          const ingredientId = Number(Object.keys(recipe)[ingredientIndex]);
          recipe[ingredientId] = +input.value;
        };
      });

      recipeList.querySelectorAll<HTMLButtonElement>(".recipeAddIngredient").forEach(button => {
        button.onclick = event => {
          event.preventDefault();
          const recipeIndex = +button.dataset.recipeIndex!;
          const recipe = recipes[recipeIndex];
          const newIngredientId = Object.keys(recipe).length
            ? Math.max(...Object.keys(recipe).map(id => +id)) + 1
            : defaultGoodId;
          recipe[newIngredientId] = 1;
          renderRecipes();
        };
      });

      recipeList.querySelectorAll<HTMLButtonElement>(".recipeRemoveIngredient").forEach(button => {
        button.onclick = event => {
          event.preventDefault();
          const recipeIndex = +button.dataset.recipeIndex!;
          const ingredientIndex = +button.dataset.ingredientIndex!;
          const recipe = recipes[recipeIndex];
          if (Object.keys(recipe).length > 1) {
            const ingredientId = Number(Object.keys(recipe)[ingredientIndex]);
            delete recipe[ingredientId];
            renderRecipes();
          }
        };
      });

      recipeList.querySelectorAll<HTMLButtonElement>(".recipeRemoveOption").forEach(button => {
        button.onclick = event => {
          event.preventDefault();
          const recipeIndex = +button.dataset.recipeIndex!;
          recipes.splice(recipeIndex, 1);
          renderRecipes();
        };
      });

      updateTypeNotes();
    };
    renderRecipes();

    dialog.querySelectorAll<HTMLButtonElement>(".mEdit").forEach(btn => {
      btn.addEventListener("click", () => {
        const dim = btn.dataset.dim as MultiplierDimKey;
        openMultiplierPopup(dim, multipliers[dim] ?? {}, values => {
          multipliers[dim] = values;
          const summaryEl = document.getElementById(`mSummary_${dim}`);
          if (summaryEl) summaryEl.textContent = multiplierSummary(dim);
        });
      });
    });

    dialog.querySelector<HTMLButtonElement>(".dcEdit")!.addEventListener("click", () => {
      openDemandCoveragePopup({ ...demandCoverageState }, values => {
        (Object.keys(demandCoverageState) as DemandCategory[]).forEach(k => void delete demandCoverageState[k]);
        Object.assign(demandCoverageState, values);
        const summaryEl = document.getElementById("demandCoverageSummary");
        if (summaryEl) summaryEl.textContent = demandCoverageSummary();
      });
    });

    dialog.querySelector<HTMLButtonElement>(".bpEdit")!.addEventListener("click", () => {
      openBiomeProductionPopup({ ...biomeOutputState }, values => {
        Object.keys(biomeOutputState).forEach(k => void delete biomeOutputState[+k]);
        Object.assign(biomeOutputState, values);
        const summaryEl = document.getElementById("biomeProductionSummary");
        if (summaryEl) summaryEl.textContent = biomeOutputSummary();
        updateTypeNotes();
      });
    });

    ensureEl("newGoodAddRecipe").on("click", event => {
      event.preventDefault();
      recipes.push({ [defaultGoodId]: 1 });
      renderRecipes();
    });

    ensureEl("newGoodDistributionEditor").on("click", () => {
      const distEl = ensureEl("newGoodDistribution");
      Controllers.DistributionEditor.open((dist: string) => {
        distEl.textContent = dist;
        updateTypeNotes();
      }, distEl.textContent?.trim() ?? "");
    });

    const iconSelect = ensureEl<HTMLSelectElement>("newGoodIcon");
    iconSelect.onchange = () => ensureEl("newGoodIconPreview").setAttribute("href", `#${iconSelect.value}`);

    const colorInput = ensureEl<HTMLInputElement>("newGoodColor");
    colorInput.oninput = () => {
      const circle = ensureEl("newGoodIconCircle");
      circle.setAttribute("fill", colorInput.value);
      circle.setAttribute("stroke", Goods.getStroke(colorInput.value));
    };

    const onIconUpload = (_type: string, id: string) => {
      ensureEl("newGoodIconPreview").setAttribute("href", `#${id}`);
      iconSelect.innerHTML += `<option value="${id}">${id}</option>`;
      iconSelect.value = id;
    };
    ensureEl("newGoodUploadIconRaster").onclick = () => (ensureEl("imageToLoad") as HTMLInputElement).click();
    ensureEl("newGoodUploadIconVector").onclick = () => (ensureEl("svgToLoad") as HTMLInputElement).click();
    ensureEl("imageToLoad").onchange = () => uploadImage("image", onIconUpload);
    ensureEl("svgToLoad").onchange = () => uploadImage("svg", onIconUpload);
  }
}

type MultiplierDimKey = "cultureType" | "culture" | "state" | "religion" | "biome" | "zone";

function getMultiplierEntityName(dim: MultiplierDimKey, id: string): string {
  if (dim === "cultureType") return id;
  if (dim === "culture") return pack.cultures[+id]?.name ?? `文化 ${id}`;
  if (dim === "state") return pack.states[+id]?.name ?? `国家 ${id}`;
  if (dim === "religion") return pack.religions[+id]?.name ?? `宗教 ${id}`;
  if (dim === "zone") return pack.zones.find(z => z.i === +id)?.name ?? `区域 ${id}`;
  return pack.biomes[+id]?.name ?? `生物群系 ${id}`;
}

function uploadImage(type: "image" | "svg", callback: (type: string, id: string) => void) {
  const input = ensureEl<HTMLInputElement>(type === "image" ? "imageToLoad" : "svgToLoad");
  const file = input.files![0];
  input.value = "";

  if (file.size > 200000) {
    tip(
      `文件过大，请将文件大小优化至 200kB 以下并重新上传。推荐尺寸为 48x48 像素，大小不超过 10kB`,
      true,
      "error",
      5000
    );
    return;
  }

  const reader = new FileReader();
  reader.onload = readerEvent => {
    const target = readerEvent.target;
    if (!target) return;

    const result = target.result as string;
    const id = `good-custom-${Math.random().toString(36).slice(-6)}`;
    const goodIcons = ensureEl("good-icons");

    if (type === "image") {
      const svg = /*html*/ `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><image x="0" y="0" width="200" height="200" href="${result}"/></svg>`;
      goodIcons.insertAdjacentHTML("beforeend", svg);
    } else {
      const el = document.createElement("html");
      el.innerHTML = result;

      el.querySelectorAll("*").forEach(el => {
        const attributes = el.getAttributeNames();
        attributes.forEach(attr => {
          if (attr.includes("inkscape") || attr.includes("sodipodi")) el.removeAttribute(attr);
        });
      });

      if (result.includes("from the Noun Project")) el.querySelectorAll("text").forEach(textEl => void textEl.remove());

      const svg = el.querySelector("svg");
      if (!svg) return void tip("该文件需经过处理才能加载到 FMG。如果不确定原因，请尝试上传位图图像", false, "error");

      const icon = goodIcons.appendChild(svg);
      icon.id = id;
      icon.setAttribute("width", "200");
      icon.setAttribute("height", "200");
    }

    callback(type, id);
  };

  if (type === "image") reader.readAsDataURL(file);
  else reader.readAsText(file);
}

function openMultiplierPopup(
  dim: MultiplierDimKey,
  currentValues: Partial<Record<string, number>>,
  onApply: (values: Partial<Record<string, number>>) => void
) {
  type Entity = { id: string; name: string; color?: string };

  let entities: Entity[];
  let label: string;

  switch (dim) {
    case "cultureType":
      entities = CULTURE_TYPES.map(ct => ({ id: ct, name: ct }));
      label = "文化类型";
      break;
    case "culture":
      entities = pack.cultures
        .filter(c => c.i && !c.removed)
        .map(c => ({ id: String(c.i), name: c.name, color: c.color }));
      label = "文化";
      break;
    case "state":
      entities = pack.states
        .filter(s => s.i && !s.removed)
        .map(s => ({ id: String(s.i), name: s.fullName || s.name, color: s.color }));
      label = "国家";
      break;
    case "religion":
      entities = pack.religions
        .filter(r => r.i && !r.removed)
        .map(r => ({ id: String(r.i), name: r.name, color: r.color }));
      label = "宗教";
      break;
    case "biome":
      entities = pack.biomes
        .filter(biome => !biome.removed)
        .map(({ i, name, color }) => ({ id: String(i), name, color }));
      label = "生物群系";
      break;
    case "zone":
      // zone colors are hatch pattern refs (url(#...)); fill-box renders them, a plain dot can't
      entities = pack.zones.map(z => ({ id: String(z.i), name: z.name, color: z.color }));
      label = "区域";
      break;
  }

  const rows = entities.map(entity => {
    const val = currentValues[entity.id] ?? 1;
    const box = `<fill-box fill="${entity.color || getRandomColor()}" size="1em" disabled data-tip="${entity.name}"></fill-box>`;
    return `${box}<span>${entity.name}</span><input type="number" class="mPopupInput" data-id="${entity.id}" min="0" step="0.1" style="width:5em;" value="${val}" />`;
  });

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  const body = rows.length
    ? `<div style="display:grid; grid-template-columns:auto 1fr 5em; gap:.3em .5em; align-items:center;">${rows.join("")}</div>`
    : `<div style="color:#777; font-style:italic;">无可用${label}</div>`;
  popupEl.innerHTML = `<div style="max-height:320px; overflow-y:auto; padding:.2em;">${body}</div>`;

  $(popupEl).dialog({
    title: `${label}乘数`,
    width: "22em",
    resizable: false,
    buttons: {
      取消: function () {
        $(this).dialog("close");
      },
      应用: function () {
        const inputs = Array.from(popupEl.querySelectorAll<HTMLInputElement>(".mPopupInput"));
        const result: Partial<Record<string, number>> = {};
        for (const input of inputs) {
          const id = input.dataset.id!;
          const v = Number(input.value);
          if (Number.isFinite(v) && v >= 0 && v !== 1) result[id] = v;
        }
        onApply(result);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

function openDemandCoveragePopup(
  currentValues: Partial<Record<DemandCategory, number>>,
  onApply: (values: Partial<Record<DemandCategory, number>>) => void
) {
  const rows = DEMAND_PRIORITY.map(cat => {
    const val = currentValues[cat] ?? 0;
    return `<span>${DEMAND_CATEGORY_ICONS[cat]} ${capitalize(cat)}</span><input type="number" class="dcPopupInput" data-cat="${cat}" min="0" step="0.05" style="width:5em;" value="${val}" />`;
  }).join("");

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  popupEl.innerHTML = `<div style="display:grid;grid-template-columns:1fr 5em;gap:.3em .5em;align-items:center;padding:.2em;">${rows}</div>`;

  $(popupEl).dialog({
    title: "需求覆盖",
    width: "18em",
    resizable: false,
    buttons: {
      取消: function () {
        $(this).dialog("close");
      },
      应用: function () {
        const result: Partial<Record<DemandCategory, number>> = {};
        popupEl.querySelectorAll<HTMLInputElement>(".dcPopupInput").forEach(input => {
          const cat = input.dataset.cat as DemandCategory;
          const v = Number(input.value);
          if (Number.isFinite(v) && v > 0) result[cat] = v;
        });
        onApply(result);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

function openBiomeProductionPopup(
  currentValues: Partial<Record<number, number>>,
  onApply: (values: Partial<Record<number, number>>) => void
) {
  const rows = pack.biomes
    .filter(biome => !biome.removed)
    .map(({ i, name }) => {
      const val = currentValues[i] ?? 0;
      return `<span>${name}</span><input type="number" class="bpPopupInput" data-id="${i}" min="0" step="0.01" style="width:5em;" value="${val}" />`;
    })
    .join("");

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  popupEl.innerHTML = `<div style="max-height:320px;overflow-y:auto;padding:.2em;"><div style="display:grid;grid-template-columns:1fr 5em;gap:.3em .5em;align-items:center;">${rows}</div></div>`;

  $(popupEl).dialog({
    title: "生物群系基础产量",
    width: "22em",
    resizable: false,
    buttons: {
      取消: function () {
        $(this).dialog("close");
      },
      应用: function () {
        const result: Partial<Record<number, number>> = {};
        popupEl.querySelectorAll<HTMLInputElement>(".bpPopupInput").forEach(input => {
          const id = Number(input.dataset.id!);
          const v = Number(input.value);
          if (Number.isFinite(v) && v > 0) result[id] = v;
        });
        onApply(result);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

export const GoodEditor = { open };
