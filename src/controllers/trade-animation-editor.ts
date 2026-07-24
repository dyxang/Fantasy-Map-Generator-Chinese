import { destroyDialogIfExists, ensureEl } from "../utils";

const DEFAULTS = TradeAnimation.getDefaultOptions();
const INPUTS = [
  {
    type: "select",
    id: "tradeAnimDisplayType",
    label: "贸易类型",
    tip: "要显示的贸易类型：本地（城镇-市场）、全球（市场-市场）或两者",
    key: "displayType",
    default: DEFAULTS.displayType,
    selectOptions: ["local", "global", "both"]
  },
  {
    type: "slider",
    id: "tradeAnimConcurrent",
    label: "动画",
    tip: "同时可见的贸易动画目标数量。旧的结束后生成新的。越高 = 同时进行的动画越多，可能在较慢的设备上导致卡顿",
    min: 1,
    max: 500,
    step: 1,
    key: "concurrent",
    default: DEFAULTS.concurrent
  },
  {
    type: "slider",
    id: "tradeAnimDuration",
    label: "行进时长",
    tip: "每地图单位的行进毫秒数。越低 = 动画越快",
    min: 1,
    max: 1000,
    step: 1,
    key: "duration",
    default: DEFAULTS.duration
  },
  {
    type: "slider",
    id: "tradeAnimLandDurationModifier",
    label: "陆地减速",
    tip: "应用于陆地段行进时长的乘数。越高 = 陆地动画越慢",
    min: 0.1,
    max: 20,
    step: 0.1,
    key: "landDurationModifier",
    default: DEFAULTS.landDurationModifier
  },
  {
    type: "slider",
    id: "tradeAnimSegmentChangePause",
    label: "段落暂停",
    tip: "一次行程中陆地与水域段之间的暂停毫秒数。越高 = 暂停越长",
    min: 0,
    max: 5000,
    step: 100,
    key: "segmentChangePause",
    default: DEFAULTS.segmentChangePause
  },
  {
    type: "slider",
    id: "tradeAnimMarkerSize",
    label: "标记大小",
    tip: "标记图标大小（地图单位）。马车以该大小的一半渲染。越高 = 图标越大",
    min: 1,
    max: 50,
    step: 0.5,
    key: "markerSize",
    default: DEFAULTS.markerSize
  }
];

function open(): void {
  if (customization) return;
  closeDialogs("#tradeAnimationEditor, .stable");
  renderDialog();

  $("#tradeAnimationEditor").dialog({
    title: "贸易动画编辑器",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    close: () => {
      destroyDialogIfExists("tradeAnimationEditor");
    }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("tradeAnimationEditor");
  document.body.insertAdjacentHTML("beforeend", buildDialogHTML());

  for (const def of INPUTS) {
    const key = def.key as keyof typeof options.trade.animation;
    const input = ensureEl<HTMLInputElement | HTMLSelectElement>(def.id);
    const resetBtn = ensureEl(`${def.id}Reset`);

    const current = options.trade.animation[key] ?? def.default;
    input.value = String(current);

    input.on("input", e => {
      // slider-input re-dispatches a bubbling event from its inner controls; ignore those duplicates
      if (e.target !== e.currentTarget) return;
      const value =
        def.type === "slider" ? (input as HTMLInputElement).valueAsNumber : (input as HTMLSelectElement).value;
      options.trade.animation = { ...options.trade.animation, [key]: value };
      localStorage.setItem("trade-animation", JSON.stringify(options.trade.animation));
      TradeAnimation.restart();
    });

    resetBtn.on("click", () => {
      options.trade.animation = { ...options.trade.animation, [key]: def.default };
      input.value = String(def.default);
      localStorage.setItem("trade-animation", JSON.stringify(options.trade.animation));
      TradeAnimation.restart();
    });
  }
}

function buildDialogHTML(): string {
  const rows = INPUTS.map(({ id, label, type, selectOptions, tip, min, max, step, key, default: def }) => {
    const current = options.trade.animation[key as keyof typeof options.trade.animation] ?? def;
    const input =
      type === "select" && selectOptions
        ? `<select id="${id}" style="width: 100%; font-size: smaller;">${selectOptions.map((opt: string) => `<option value="${opt}" ${opt === current ? "selected" : ""}>${opt}</option>`).join("")}</select>`
        : `<slider-input id="${id}" min="${min}" max="${max}" step="${step}" value="${current}"></slider-input>`;
    return /* html */ `
      <tr data-tip="${tip}">
        <td style="padding: 0">${label}</td>
        <td style="padding: 0">${input}</td>
        <td style="padding: 0">
          <button id="${id}Reset" data-tip="重置为默认值"
            style="font-size:.85em; padding:1px 5px; margin-left: 0.3em">↺</button>
        </td>
      </tr>`;
  }).join("");

  return /* html */ `
    <div id="tradeAnimationEditor" class="dialog" style="display:none">
      <style>
        #tradeAnimationEditor slider-input { width: 100%; }
        #tradeAnimationEditor slider-input input[type=range] { flex: 1; min-width: 0; }
      </style>
      <table style="border-collapse: collapse;width:100%">
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export const TradeAnimationEditor = { open };
