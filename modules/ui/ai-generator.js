"use strict";

const GPT_MODELS = {
  openai: ["gpt-4o-mini", "chatgpt-4o-latest", "gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
  deepseek: ["deepseek-chat"]
};
const BASE_URL = [{ display: "openai", value: "https://api.openai.com/v1/chat/completions" },{ display: "deepseek", value: "https://api.deepseek.com/v1/chat/completions" }];
const SYSTEM_MESSAGE = "我正在绘制我的幻想地图。";

function generateWithAi(defaultPrompt, onApply) {
  updateValues();

  $("#aiGenerator").dialog({
    title: "AI 文本生成器",
    position: {my: "center", at: "center", of: "svg"},
    resizable: false,
    buttons: {
      Generate: function (e) {
        generate(e.target);
      },
      应用: function () {
        const result = byId("aiGeneratorResult").value;
        if (!result) return tip("没有可应用的结果。", true, "error", 4000);
        onApply(result);
        $(this).dialog("close");
      },
      关闭: function () {
        $(this).dialog("close");
      }
    }
  });

  if (modules.generateWithAi) return;
  modules.generateWithAi = true;

  function updateValues() {
    byId("aiGeneratorResult").value = "";
    byId("aiGeneratorPrompt").value = defaultPrompt;
    byId("aiGeneratorKey").value = localStorage.getItem("fmg-ai-kl") || "";

    const baseurlselect = byId("aiGeneratorBaseurl");
    baseurlselect.options.length = 0;
    BASE_URL.forEach(baseurl => baseurlselect.options.add(new Option(baseurl.display, baseurl.value)));
    baseurlselect.value = localStorage.getItem("fmg-ai-baseurl") || BASE_URL[0].value;

    // 监听 baseurl 下拉列表的变化
    baseurlselect.addEventListener("change", updateModels);

    // 初始化模型下拉列表
    updateModels();
}

function updateModels() {
    const baseurlselect = byId("aiGeneratorBaseurl");
    const selectedBaseUrl = baseurlselect.value;
    const selectedBaseUrlDisplay = BASE_URL.find(url => url.value === selectedBaseUrl).display;

    const select = byId("aiGeneratorModel");
    select.options.length = 0;
    GPT_MODELS[selectedBaseUrlDisplay].forEach(model => select.options.add(new Option(model, model)));
    select.value = localStorage.getItem("fmg-ai-model") || GPT_MODELS[selectedBaseUrlDisplay][0];
}

  async function generate(button) {
    const key = byId("aiGeneratorKey").value;
    if (!key) return tip("请输入 API key", true, "error", 4000);
    localStorage.setItem("fmg-ai-kl", key);

    const baseurl = byId("aiGeneratorBaseurl").value;
    if (!baseurl) return tip("请选择服务方", true, "error", 4000);
    localStorage.setItem("fmg-ai-baseurl", baseurl);

    const model = byId("aiGeneratorModel").value;
    if (!model) return tip("请选择模型", true, "error", 4000);
    localStorage.setItem("fmg-ai-model", model);

    const prompt = byId("aiGeneratorPrompt").value;
    if (!prompt) return tip("请输入提示词", true, "error", 4000);

    try {
      button.disabled = true;
      const resultArea = byId("aiGeneratorResult");
      resultArea.value = "";
      resultArea.disabled = true;

      const response = await fetch(`${baseurl}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {role: "system", content: SYSTEM_MESSAGE},
            {role: "user", content: prompt}
          ],
          temperature: 1.2,
          stream: true, // Enable streaming
        })
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json?.error?.message || "Failed to generate");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split("\n");

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const jsonData = JSON.parse(line.slice(6));
              const content = jsonData.choices[0].delta.content;
              if (content) resultArea.value += content;
            } catch (jsonError) {
              console.warn("Failed to parse JSON:", jsonError, "Line:", line);
            }
          }
        }

        buffer = lines[lines.length - 1];
      }
    } catch (error) {
      return tip(error.message, true, "error", 4000);
    } finally {
      button.disabled = false;
      byId("aiGeneratorResult").disabled = false;
    }
  }
}
