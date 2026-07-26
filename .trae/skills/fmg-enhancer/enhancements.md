# fmg-enhancer 增强清单

本文件由 `scripts/record-enhancement.mjs` 自动维护，记录每次增强的改动要点与还原指令。
- 位置：`.trae/skills/fmg-enhancer/enhancements.md`（与 SKILL.md 同目录，跟踪策略与 `.trae/` 一致）
- 用途：上游升级后据本清单快速判断哪些增强需要重挂载、逐条还原
- 写入时机：fmg-enhancer skill 交付阶段的最后一步


## ai-custom-models — AI 生成器支持自定义 OpenAI 兼容端点

- **日期**：2026-07-26 (2026-07-26 08:22:00)
- **类别**：plugin  |  **风险等级**：low
- **摘要**：在 AI 文本生成器基础上新增自定义 OpenAI Chat Completions 兼容端点（DeepSeek / Moonshot / OpenRouter / one-api / LM Studio 等），含多模型管理子对话框（增删改 + 完整 URL 开关），配置存 localStorage。
- **基线提交**：`zh_CN@bdda9d33`

### 改动清单
**新增** (4)：
- `.trae/skills/fmg-enhancer/templates/browser-script.template.js`
- `.trae/skills/fmg-enhancer/templates/controller-plugin.template.ts`
- `src/controllers/ai-generator-plus.ts`
- `scripts/record-enhancement.mjs`
**修改** (2)：
- `README.md`
- `src/controllers/index.ts`

### 注册表追加行（关键还原锚点）
**src/controllers/index.ts**
```ts
  AiGenerator: () => import("@/controllers/ai-generator-plus").then(m => m.AiGenerator),
```

### 改动量
```
 6 files changed, 902 insertions(+), 1 deletion(-)
```

### 回滚指令
```bash
git checkout -- src/controllers/index.ts && rm src/controllers/ai-generator-plus.ts
```

### 上游升级时重挂载
1) 检查 src/controllers/index.ts 第 4 行 loader 仍指向 ai-generator-plus；2) 对照新版 src/types/global.ts 确认 tip/openURL/ensureEl/destroyDialogIfExists 全局仍存在；3) 重新运行 npm run lint && npm run build；4) 启动后打开笔记编辑器 → 机器人图标 → 测试自定义模型子对话框；5) 上游若改 ai-generator.ts（如新模型），需人工同步到 plus 文件。

---
