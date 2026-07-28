import { tip } from "@/components/tooltips";
import { destroyDialogIfExists, ensureEl } from "@/utils";

/**
 * AI 文本生成器增强版（fmg-enhancer 低侵入插件）
 * 在原版 openai / anthropic / ollama 基础上，新增自定义 OpenAI Chat Completions 兼容端点
 * （DeepSeek、Moonshot、OpenRouter、one-api、LM Studio 等均可接入）。
 * 自定义模型配置持久化在 localStorage（fmg-ai-custom-models），不写入 .map 文件。
 * 经注册表重指向生效（见 src/controllers/index.ts），原 @/controllers/ai-generator 模块未改动。
 */

type BuiltinProvider = "openai" | "anthropic" | "ollama";

interface GenerationOptions {
  key: string;
  model: string;
  prompt: string;
  temperature: number;
  onContent: (content: string) => void;
}

interface CustomModel {
  id: string;
  name: string;
  baseUrl: string;
  fullUrl: boolean;
  model: string;
  key: string;
  multimodal: boolean;
}

const PROVIDERS: Record<BuiltinProvider, { keyLink: string; generate: (options: GenerationOptions) => Promise<void> }> =
  {
    openai: {
      keyLink: "https://platform.openai.com/account/api-keys",
      generate: generateWithOpenAI
    },
    anthropic: {
      keyLink: "https://console.anthropic.com/account/keys",
      generate: generateWithAnthropic
    },
    ollama: {
      keyLink: "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Ollama-text-generation",
      generate: generateWithOllama
    }
  };

const DEFAULT_MODEL = "gpt-5.6-luna";

const MODELS: Record<string, BuiltinProvider> = {
  "gpt-5.6-luna": "openai",
  "gpt-5.6-terra": "openai",
  "gpt-5.6-sol": "openai",
  "gpt-5-mini": "openai",
  "gpt-5-nano": "openai",
  "claude-opus-4-8": "anthropic",
  "claude-sonnet-5": "anthropic",
  "claude-haiku-4-5": "anthropic",
  "ollama (local models)": "ollama"
};

const FIXED_TEMPERATURE_MODELS = new Set([
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-5-mini",
  "gpt-5-nano",
  "claude-opus-4-8",
  "claude-sonnet-5"
]);

const SYSTEM_MESSAGE = "I'm working on my fantasy map.";

const CUSTOM_MODELS_KEY = "fmg-ai-custom-models";
const CUSTOM_PREFIX = "custom:";

const URL_HINT_BASE =
  "请填写兼容 OpenAI API 的服务端点地址，不要以斜杠结尾。/chat/completions 将会被补充到你填写的地址末尾。";
const URL_HINT_FULL = "已开启完整 URL：请求将原样发送到所填地址，不再自动补充 /chat/completions。";

// 自定义模型配置存取（localStorage，app 级偏好，不进 .map）
function isCustomModel(item: unknown): item is CustomModel {
  if (typeof item !== "object" || item === null) return false;
  const cfg = item as Record<string, unknown>;
  return (
    typeof cfg.id === "string" &&
    typeof cfg.name === "string" &&
    typeof cfg.baseUrl === "string" &&
    typeof cfg.fullUrl === "boolean" &&
    typeof cfg.model === "string" &&
    typeof cfg.key === "string" &&
    typeof cfg.multimodal === "boolean"
  );
}

function getCustomModels(): CustomModel[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCustomModel);
  } catch (error) {
    ERROR && console.error("解析自定义模型配置失败", error);
    return [];
  }
}

function saveCustomModels(models: CustomModel[]): void {
  localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models));
}

function updateCustomModel(updated: CustomModel): void {
  const models = getCustomModels();
  const index = models.findIndex(cfg => cfg.id === updated.id);
  if (index === -1) return;
  models[index] = updated;
  saveCustomModels(models);
}

function getSelectedCustom(value: string): CustomModel | undefined {
  if (!value.startsWith(CUSTOM_PREFIX)) return undefined;
  const id = value.slice(CUSTOM_PREFIX.length);
  return getCustomModels().find(cfg => cfg.id === id);
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, char => map[char]);
}

async function generateWithOpenAI({ key, model, prompt, temperature, onContent }: GenerationOptions): Promise<void> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`
  };

  const messages = [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: prompt }
  ];

  const body: Record<string, unknown> = { model, messages, stream: true };
  if (!FIXED_TEMPERATURE_MODELS.has(model)) body.temperature = temperature;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const getContent = (json: StreamChunk): void => {
    const content = json.choices?.[0]?.delta?.content;
    if (content) onContent(content);
  };

  await handleStream(response, getContent);
}

async function generateWithAnthropic({ key, model, prompt, temperature, onContent }: GenerationOptions): Promise<void> {
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true"
  };

  const messages = [{ role: "user", content: prompt }];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      system: SYSTEM_MESSAGE,
      messages,
      max_tokens: 4096,
      stream: true,
      ...(FIXED_TEMPERATURE_MODELS.has(model) ? {} : { temperature })
    })
  });

  const getContent = (json: StreamChunk): void => {
    const content = json.delta?.text;
    if (content) onContent(content);
  };

  await handleStream(response, getContent);
}

async function generateWithOllama({ key, model, prompt, temperature, onContent }: GenerationOptions): Promise<void> {
  const ollamaModelName = key; // for Ollama, 'key' is the actual model name entered by the user
  void model;

  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModelName,
      prompt,
      system: SYSTEM_MESSAGE,
      options: { temperature },
      stream: true
    })
  });

  const getContent = (json: StreamChunk): void => {
    if (json.response) onContent(json.response);
  };

  await handleStream(response, getContent);
}

// 自定义 OpenAI Chat Completions 兼容端点；密钥可留空（部分本地服务不校验）
async function generateWithCustom(
  cfg: CustomModel,
  { prompt, temperature, onContent }: Pick<GenerationOptions, "prompt" | "temperature" | "onContent">
): Promise<void> {
  const url = cfg.fullUrl ? cfg.baseUrl : `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;

  const messages = [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: prompt }
  ];

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: cfg.model, messages, stream: true, temperature })
  });

  // 优先解析 SSE 增量（delta.content），兼容部分代理返回的非流式完整 JSON（message.content）
  const getContent = (json: StreamChunk): void => {
    const content = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
    if (content) onContent(content);
  };

  await handleStream(response, getContent);
}

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
  delta?: { text?: string };
  response?: string;
}

async function handleStream(response: Response, getContent: (json: StreamChunk) => void): Promise<void> {
  if (!response.ok) {
    let errorMessage = `生成失败（${response.status} ${response.statusText}）`;
    try {
      const json = await response.json();
      errorMessage = json.error?.message || json.error || errorMessage;
    } catch (error) {
      ERROR && console.error("解析 AI 提供商错误响应失败", error);
    }
    throw new Error(errorMessage);
  }

  if (!response.body) throw new Error("响应没有可流式传输的正文");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line === "data: [DONE]") break;

      try {
        const parsed = line.startsWith("data: ") ? JSON.parse(line.slice(6)) : JSON.parse(line);
        getContent(parsed);
      } catch (error) {
        ERROR && console.error("解析行失败：", line, error);
      }
    }

    buffer = lines.at(-1) ?? "";
  }
}

function open(defaultPrompt: string, onApply: (result: string) => void): void {
  renderDialog();
  setInitialValues(defaultPrompt);

  $("#aiGenerator").dialog({
    title: "AI 文本生成器",
    position: { my: "center", at: "center", of: "svg" },
    resizable: false,
    close: () => {
      destroyDialogIfExists("aiCustomModels");
      destroyDialogIfExists("aiGenerator");
      document.getElementById("aiGeneratorPlusStyles")?.remove();
    },
    buttons: {
      生成: (e: Event) => {
        void generate(e.target as HTMLButtonElement);
      },
      应用: function (this: HTMLElement) {
        const result = ensureEl<HTMLTextAreaElement>("aiGeneratorResult").value;
        if (!result) return tip("无可应用的结果", true, "error", 4000);
        onApply(result);
        $(this).dialog("close");
      },
      关闭: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("aiGenerator");

  const html = /* html */ `<div id="aiGenerator" class="dialog stable">
    <div style="display: flex; flex-direction: column; gap: 0.3em; width: 100%">
      <textarea id="aiGeneratorResult" placeholder="生成的文本将显示在此处" cols="30" rows="10"></textarea>
      <textarea id="aiGeneratorPrompt" placeholder="在此处输入提示词" cols="30" rows="5"></textarea>
      <div style="display: flex; align-items: center; gap: 1em">
        <label for="aiGeneratorModel"
          >模型：
          <select id="aiGeneratorModel"></select>
        </label>
        <button id="aiGeneratorManageCustom" class="icon-cog" data-tip="管理自定义模型"></button>
        <label
          for="aiGeneratorTemperature"
          data-tip="温度控制响应的随机性；数值越高越有创造性，数值越低越具可预测性"
        >
          温度：
          <input id="aiGeneratorTemperature" type="number" min="-1" max="2" step=".1" class="icon-key" />
        </label>
        <label for="aiGeneratorKey"
          >密钥：
          <input
            id="aiGeneratorKey"
            placeholder="输入 API 密钥"
            class="icon-key"
            data-tip="输入 API 密钥。注意：密钥与自定义模型配置仅保存在浏览器 localStorage 中"
          />
          <button
            id="aiGeneratorKeyHelp"
            class="icon-help-circled"
            data-tip="点击查看使用说明"
          ></button>
        </label>
      </div>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  renderStyles();

  ensureEl("aiGeneratorKeyHelp").on("click", () => {
    const value = ensureEl<HTMLSelectElement>("aiGeneratorModel").value;
    const custom = getSelectedCustom(value);
    if (custom) {
      openCustomModelsManager();
      return;
    }
    const provider = MODELS[value];
    if (provider) openURL(PROVIDERS[provider].keyLink);
  });

  ensureEl("aiGeneratorManageCustom").on("click", openCustomModelsManager);
  ensureEl<HTMLSelectElement>("aiGeneratorModel").on("change", syncKeyField);
}

function renderStyles(): void {
  document.getElementById("aiGeneratorPlusStyles")?.remove();

  const style = document.createElement("style");
  style.id = "aiGeneratorPlusStyles";
  style.textContent = /* css */ `
    #aiGeneratorManageCustom { border: none; background: none; cursor: pointer; font-size: 1.1em; padding: 0; }
    #aiCustomModels { min-width: 30em; max-width: 36em; }
    #aiCustomList { display: flex; flex-direction: column; gap: 0.3em; max-height: 14em; overflow-y: auto; margin-bottom: 0.5em; }
    .aiCustomEmpty { opacity: 0.6; font-style: italic; padding: 0.4em; }
    .aiCustomRow { display: flex; align-items: center; gap: 0.4em; padding: 0.3em 0.5em; border: 1px solid #5a6070; border-radius: 4px; }
    .aiCustomRowInfo { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .aiCustomRowMeta { font-size: 0.85em; opacity: 0.65; }
    .aiCustomRow button { border: none; background: none; cursor: pointer; font-size: 1em; }
    .aiCustomBadge { font-size: 0.75em; border: 1px solid #6ea8fe; color: #6ea8fe; border-radius: 3px; padding: 0 0.3em; margin-left: 0.4em; }
    #aiCustomForm { flex-direction: column; gap: 0.25em; border-top: 1px solid #5a6070; margin-top: 0.5em; padding-top: 0.5em; }
    .aiCustomLabel { display: flex; justify-content: space-between; align-items: center; margin-top: 0.35em; font-weight: bold; }
    .aiCustomReq { color: #e05d5d; }
    .aiCustomToggle { font-weight: normal; cursor: pointer; }
    .aiCustomHint { font-size: 0.85em; color: #6ea8fe; background: rgba(110, 168, 254, 0.12); border-radius: 4px; padding: 0.4em 0.6em; }
    #aiCustomForm input[type="text"], #aiCustomForm select { width: 100%; box-sizing: border-box; }
    .aiCustomFormButtons { display: flex; gap: 0.5em; justify-content: flex-end; margin-top: 0.6em; }
  `;
  document.head.appendChild(style);
}

function rebuildModelOptions(preserveValue?: string): void {
  const select = ensureEl<HTMLSelectElement>("aiGeneratorModel");
  const value = preserveValue ?? select.value;

  select.options.length = 0;

  const builtinGroup = document.createElement("optgroup");
  builtinGroup.label = "内置模型";
  for (const model of Object.keys(MODELS)) builtinGroup.appendChild(new Option(model, model));
  select.appendChild(builtinGroup);

  const customs = getCustomModels();
  if (customs.length) {
    const customGroup = document.createElement("optgroup");
    customGroup.label = "自定义模型";
    for (const cfg of customs) customGroup.appendChild(new Option(cfg.name, CUSTOM_PREFIX + cfg.id));
    select.appendChild(customGroup);
  }

  select.value = value;
  if (!select.value) select.value = DEFAULT_MODEL;
}

function syncKeyField(): void {
  const value = ensureEl<HTMLSelectElement>("aiGeneratorModel").value;
  const keyInput = ensureEl<HTMLInputElement>("aiGeneratorKey");
  const helpButton = ensureEl("aiGeneratorKeyHelp");

  const custom = getSelectedCustom(value);
  if (custom) {
    keyInput.value = custom.key;
    helpButton.dataset.tip = "打开自定义模型管理";
    return;
  }

  const provider = MODELS[value];
  keyInput.value = provider ? localStorage.getItem(`fmg-ai-kl-${provider}`) || "" : "";
  helpButton.dataset.tip = "点击查看使用说明";
}

function setInitialValues(defaultPrompt: string): void {
  ensureEl<HTMLTextAreaElement>("aiGeneratorResult").value = "";
  ensureEl<HTMLTextAreaElement>("aiGeneratorPrompt").value = defaultPrompt;
  ensureEl<HTMLInputElement>("aiGeneratorTemperature").value = localStorage.getItem("fmg-ai-temperature") || "1";

  rebuildModelOptions(localStorage.getItem("fmg-ai-model") ?? DEFAULT_MODEL);
  syncKeyField();
}

async function generate(button: HTMLButtonElement): Promise<void> {
  const value = ensureEl<HTMLSelectElement>("aiGeneratorModel").value;
  if (!value) return tip("请选择一个模型", true, "error", 4000);

  const key = ensureEl<HTMLInputElement>("aiGeneratorKey").value;

  const prompt = ensureEl<HTMLTextAreaElement>("aiGeneratorPrompt").value;
  if (!prompt) return tip("请输入提示词", true, "error", 4000);

  const temperature = ensureEl<HTMLInputElement>("aiGeneratorTemperature").valueAsNumber;
  if (Number.isNaN(temperature)) return tip("温度必须是数字", true, "error", 4000);

  localStorage.setItem("fmg-ai-model", value);
  localStorage.setItem("fmg-ai-temperature", String(temperature));

  const custom = getSelectedCustom(value);
  let doGenerate: (onContent: (content: string) => void) => Promise<void>;

  if (custom) {
    const cfg = { ...custom, key };
    updateCustomModel(cfg); // 密钥输入框与配置双向同步
    doGenerate = onContent => generateWithCustom(cfg, { prompt, temperature, onContent });
  } else {
    if (!key) return tip("请输入 API 密钥", true, "error", 4000);
    const provider = MODELS[value];
    if (!provider) return tip("未知模型", true, "error", 4000);
    localStorage.setItem(`fmg-ai-kl-${provider}`, key);
    doGenerate = onContent => PROVIDERS[provider].generate({ key, model: value, prompt, temperature, onContent });
  }

  try {
    button.disabled = true;
    const resultArea = ensureEl<HTMLTextAreaElement>("aiGeneratorResult");
    resultArea.disabled = true;
    resultArea.value = "";

    await doGenerate(content => {
      resultArea.value += content;
    });
  } catch (error) {
    const message = (error instanceof Error && error.message) || String(error) || "文本生成失败";
    return tip(message, true, "error", 4000);
  } finally {
    button.disabled = false;
    ensureEl<HTMLTextAreaElement>("aiGeneratorResult").disabled = false;
  }
}

// 自定义模型管理子对话框
function openCustomModelsManager(): void {
  renderManagerDialog();

  $("#aiCustomModels").dialog({
    title: "自定义模型管理",
    position: { my: "center", at: "center", of: "svg" },
    resizable: false,
    close: () => destroyDialogIfExists("aiCustomModels"),
    buttons: {
      关闭: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });

  renderCustomModelList();
  updateUrlHint();
}

function renderManagerDialog(): void {
  destroyDialogIfExists("aiCustomModels");

  const html = /* html */ `<div id="aiCustomModels" class="dialog stable">
    <div id="aiCustomList"></div>
    <button id="aiCustomAdd" class="icon-plus"> 添加模型</button>
    <div id="aiCustomForm" style="display: none">
      <input type="hidden" id="aiCustomId" />
      <div class="aiCustomLabel"><span><span class="aiCustomReq">*</span> API 格式</span></div>
      <select id="aiCustomFormat" disabled>
        <option>OpenAI Chat Completions 格式</option>
      </select>
      <div class="aiCustomLabel">
        <span><span class="aiCustomReq">*</span> 自定义请求地址</span>
        <label class="aiCustomToggle">完整 URL <input id="aiCustomFullUrl" type="checkbox" /></label>
      </div>
      <input id="aiCustomBaseUrl" type="text" placeholder="e.g. https://api.openai.com/v1" />
      <div id="aiCustomUrlHint" class="aiCustomHint"></div>
      <div class="aiCustomLabel">
        <span><span class="aiCustomReq">*</span> 模型 ID</span>
        <label class="aiCustomToggle">多模态 <input id="aiCustomMultimodal" type="checkbox" /></label>
      </div>
      <input id="aiCustomModel" type="text" placeholder="输入模型 ID" />
      <div class="aiCustomLabel"><span>&nbsp;API 密钥</span></div>
      <input id="aiCustomKey" type="text" placeholder="输入 API 密钥，本地服务可留空" />
      <div class="aiCustomLabel"><span>&nbsp;显示名称</span></div>
      <input id="aiCustomName" type="text" placeholder="可选，留空则使用模型 ID" />
      <div class="aiCustomFormButtons">
        <button id="aiCustomSave" class="icon-floppy"> 保存</button>
        <button id="aiCustomCancel" class="icon-cancel"> 取消</button>
      </div>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("aiCustomAdd").on("click", () => openCustomForm(null));
  ensureEl("aiCustomCancel").on("click", closeCustomForm);
  ensureEl("aiCustomSave").on("click", saveCustomFromForm);
  ensureEl<HTMLInputElement>("aiCustomFullUrl").on("change", updateUrlHint);

  ensureEl("aiCustomList").on("click", (event: Event) => {
    const button = (event.target as HTMLElement).closest("button[data-act]");
    if (!button) return;
    const row = button.closest(".aiCustomRow") as HTMLElement | null;
    const id = row?.dataset.id;
    if (!id) return;

    if (button.getAttribute("data-act") === "edit") {
      const cfg = getCustomModels().find(item => item.id === id);
      if (cfg) openCustomForm(cfg);
    } else {
      deleteCustomModel(id);
    }
  });
}

function renderCustomModelList(): void {
  const list = ensureEl("aiCustomList");
  const models = getCustomModels();

  if (!models.length) {
    list.innerHTML = `<div class="aiCustomEmpty">尚未添加自定义模型，点击下方「添加模型」开始</div>`;
    return;
  }

  list.innerHTML = models
    .map(cfg => {
      let host = cfg.baseUrl;
      try {
        host = new URL(cfg.baseUrl).host;
      } catch {
        // 地址非法时原样展示
      }
      const badge = cfg.multimodal ? `<span class="aiCustomBadge">多模态</span>` : "";
      return /* html */ `<div class="aiCustomRow" data-id="${escapeHtml(cfg.id)}">
        <div class="aiCustomRowInfo">
          <span>${escapeHtml(cfg.name)}${badge}</span>
          <span class="aiCustomRowMeta">${escapeHtml(cfg.model)} @ ${escapeHtml(host)}</span>
        </div>
        <button class="icon-pencil" data-act="edit" data-tip="编辑"></button>
        <button class="icon-trash" data-act="del" data-tip="删除"></button>
      </div>`;
    })
    .join("");
}

function openCustomForm(cfg: CustomModel | null): void {
  ensureEl<HTMLInputElement>("aiCustomId").value = cfg?.id ?? "";
  ensureEl<HTMLInputElement>("aiCustomName").value = cfg?.name ?? "";
  ensureEl<HTMLInputElement>("aiCustomBaseUrl").value = cfg?.baseUrl ?? "";
  ensureEl<HTMLInputElement>("aiCustomFullUrl").checked = cfg?.fullUrl ?? false;
  ensureEl<HTMLInputElement>("aiCustomModel").value = cfg?.model ?? "";
  ensureEl<HTMLInputElement>("aiCustomMultimodal").checked = cfg?.multimodal ?? false;
  ensureEl<HTMLInputElement>("aiCustomKey").value = cfg?.key ?? "";
  updateUrlHint();
  ensureEl("aiCustomForm").style.display = "flex";
  ensureEl<HTMLInputElement>("aiCustomBaseUrl").focus();
}

function closeCustomForm(): void {
  ensureEl("aiCustomForm").style.display = "none";
}

function updateUrlHint(): void {
  const full = ensureEl<HTMLInputElement>("aiCustomFullUrl").checked;
  ensureEl("aiCustomUrlHint").textContent = full ? URL_HINT_FULL : URL_HINT_BASE;
}

function saveCustomFromForm(): void {
  const baseUrl = ensureEl<HTMLInputElement>("aiCustomBaseUrl").value.trim();
  if (!baseUrl) {
    tip("请填写自定义请求地址", true, "error", 4000);
    return;
  }

  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad protocol");
  } catch {
    tip("请求地址必须是合法的 http(s) URL", true, "error", 4000);
    return;
  }

  const model = ensureEl<HTMLInputElement>("aiCustomModel").value.trim();
  if (!model) {
    tip("请填写模型 ID", true, "error", 4000);
    return;
  }

  const id = ensureEl<HTMLInputElement>("aiCustomId").value || crypto.randomUUID();
  const cfg: CustomModel = {
    id,
    name: ensureEl<HTMLInputElement>("aiCustomName").value.trim() || model,
    baseUrl,
    fullUrl: ensureEl<HTMLInputElement>("aiCustomFullUrl").checked,
    model,
    key: ensureEl<HTMLInputElement>("aiCustomKey").value.trim(),
    multimodal: ensureEl<HTMLInputElement>("aiCustomMultimodal").checked
  };

  const models = getCustomModels();
  const index = models.findIndex(item => item.id === id);
  if (index === -1) models.push(cfg);
  else models[index] = cfg;
  saveCustomModels(models);

  closeCustomForm();
  renderCustomModelList();
  rebuildModelOptions(CUSTOM_PREFIX + id);
  syncKeyField();
  tip("自定义模型已保存", false, "success", 4000);
}

function deleteCustomModel(id: string): void {
  const models = getCustomModels();
  const target = models.find(item => item.id === id);
  if (!target) return;
  if (!window.confirm(`确定删除自定义模型「${target.name}」？`)) return;

  saveCustomModels(models.filter(item => item.id !== id));
  renderCustomModelList();
  rebuildModelOptions();
  syncKeyField();
}

export const AiGenerator = { open };
