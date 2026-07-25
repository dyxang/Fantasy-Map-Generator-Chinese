---
alwaysApply: false
description: 翻译或进行翻译工作流
---
# Fantasy Map Generator 汉化规则

## 会话开始时（必做）

1. 读 `i18n/progress.json` 获取上次进度（`last_processed_id` 之后继续）
2. 读 `i18n/CONTEXT.md` 了解项目背景、翻译原则、翻译管线分层、上游同步工具链
3. 读 `i18n/divergence.json` 确认哪些片段不可覆盖

**注意**：术语表和 TM 会在批次文件中自动注入，无需手动读取 `glossary.json` 和 `tm.json`。每个批次文件包含：
- `glossary` 字段：筛选后的相关术语（基于批次内容动态筛选）
- `tm_hints` 字段：过滤后的相关 TM 条目（基于 context_tag 和 file 评分）

## 状态文件写入所有权（契约）

- `tm.json` 和 `progress.json` 的写入**仅由**标准化层的 `collect` 命令执行（`batch_runner.mjs collect` 或 `sync-collect.mjs`）
- subagent / 手工 AI 流**只写** `i18n/artifacts/batch_<N>.json`（TranslationArtifact sidecar）
- 禁止在 subagent 指令中要求「直接追加 tm.json」或「直接更新 progress.json」
- 两层架构与 TranslationArtifact 字段详见 `i18n/CONTEXT.md` 的「翻译管线分层架构」章节

## 硬约束（不可违反）

### 占位符保护
- `{{xxx}}` `<%xxx%>` `${xxx}` `%s` `%d` 必须原样保留，数量和位置不得改变

### HTML 结构保护
- 标签名、属性名、id、class 不得改动
- 只能修改：文本节点内容、`title` / `placeholder` / `aria-label` / `alt` / `data-tip` / `data-info` 属性的值
- `<script>` 和 `<style>` 内容不译
- 内联 SVG 的 `d` 属性（路径数据）不译

### TS/JS 字符串保护
- 字符串字面量只改内容，不改引号类型（单/双/反引号）
- 不改转义字符
- 模板字面量中的 `${...}` 占位符必须保留

### 不译内容
- 变量名、函数名、CSS 类名
- SVG 路径数据
- URL、文件路径
- 数字、单位、坐标、百分比
- 枚举值（如 state.form 的 "Monarchy"、"Republic"）
- 人名、地名生成器产物（动态生成）
- 品牌名 Azgaar

### 差异保护
- `divergence.json` 中的 `anchor_text` 命中即跳过，不覆盖

## 代码结构保护规则（防过度翻译）

以下规则用于区分「可翻译的显示文本」与「不可翻译的代码结构元素」，具有通用性，覆盖同类问题而非仅针对特定案例。

### 规则 1：对象属性名（键）禁止翻译

- **规则**：JavaScript/TypeScript 对象字面量中的属性名（键）必须保持英文原样，不得翻译。
- **原理**：属性名是代码结构元素，翻译会破坏对象解构、属性访问、类型推断等语法行为。
- **示例**：
  ```ts
  // ✅ 正确：属性名 id/label/defaultVal 保持英文，仅字符串值翻译
  { id: "minHeight", label: "最小高度", defaultVal: "40" }

  // ❌ 错误：属性名被翻译
  { 标识符: "minHeight", 标签: "最小高度", 默认值: "40" }
  ```

### 规则 2：jQuery UI 对话框按钮键（例外条款）

- **规则**：jQuery UI dialog 的 `buttons` 选项在使用**对象形式**时，键既是属性名也是按钮显示文本，**允许翻译键名**。
- **原理**：jQuery UI 的 API 设计中，对象形式的 `buttons: { 文本: handler }` 键被库内部读取为 `text` 属性。这是 API 契约的一部分，翻译键名不会破坏代码结构。
- **前提条件**（必须全部满足才允许翻译键名）：
  1. 对象被直接传入 jQuery UI dialog 的 `buttons` 选项
  2. 代码中不通过 `:contains('文本')` 或按键名引用按钮
  3. 按钮访问（如需）通过索引或 CSS 类选择器完成
- **推荐做法**：新增代码优先使用**数组形式**，将显示文本与属性名彻底解耦：
  ```ts
  // ✅ 推荐（数组形式）：属性名 text/click 保持英文，显示文本可翻译
  buttons: [{ text: "应用", click: function(this: HTMLElement) { $(this).dialog("close"); } }]

  // ✅ 可接受（对象形式，受 API 契约支持）
  buttons: { 应用: function(this: HTMLElement) { $(this).dialog("close"); } }

  // ❌ 错误：非 jQuery UI buttons 上下文中的属性名翻译
  const config = { 应用: handler, 取消: otherHandler };
  ```
- **方法简写语法**：`{ 知道了(this: HTMLElement) { ... } }` 等价于 `{ "知道了": function(this: HTMLElement) { ... } }`，同样适用本规则。

### 规则 3：数据标识值 vs 显示文本的区分

- **规则**：字符串字面量需按用途分类处理：
  - **纯显示文本**（如 `tip("点击编辑")`、`innerHTML = "..."`）：可翻译
  - **数据标识值**（用于比较、键查找、持久化的字符串）：禁止翻译
  - **双用途值**（既显示又参与比较）：翻译时必须同步更新所有引用点
- **判断方法**：在翻译前搜索该字符串是否出现在 `===`、`!==`、`switch case`、对象键、数组查找等逻辑位置。
- **示例**：
  ```ts
  // ✅ 纯显示文本：可翻译
  tip("无法将城镇放入水中");

  // ❌ 数据标识值：禁止翻译（r.type 用于比较）
  if (r.type === "Cult") { ... }  // "Cult" 不可译

  // ✅ 双用途值的正确处理：用 TYPE_LABELS 映射，保留数据字段
  const TYPE_LABELS = { Cult: "邪教", Heresy: "异端" };
  const label = TYPE_LABELS[r.type] || r.type;  // r.type 保持英文，label 用于显示
  ```
- **数据模型默认值**（如 `const type = "Unknown"`）：若该值会持久化到 `pack.*` 数据结构并被后续逻辑比较，翻译时需评估对旧存档的兼容性影响。建议保留英文默认值，仅在显示层翻译。

### 规则 4：函数/方法参数名禁止翻译

- **规则**：函数声明、方法定义、箭头函数中的参数名必须保持英文。
- **原理**：参数名是标识符，翻译会破坏函数签名和调用。
- **示例**：
  ```ts
  // ✅ 正确：参数名 options/title/message 保持英文
  function confirmationDialog(options: { title: string; message: string }) { ... }

  // ❌ 错误：参数名被翻译
  function confirmationDialog(选项: { 标题: string; 消息: string }) { ... }
  ```

### 规则 5：注释中的技术术语保护

- **规则**：代码注释中的技术术语（函数名、变量名、API 名、库名、文件路径、配置项名）不得翻译，注释中的自然语言描述可翻译。
- **原理**：注释中的技术术语是对代码元素的引用，翻译会失去可检索性和可追溯性。
- **示例**：
  ```ts
  // ✅ 正确：技术术语 showUpdateWindow() 保持英文，自然语言可中文
  // 汉化版定制：首次访问时调用 showConnectivityDialog() 弹出检测窗口

  // ❌ 错误：函数名被翻译
  // 汉化版定制：首次访问时调用 显示连接性检测() 弹出检测窗口
  ```

### 规则 6：枚举值与魔法字符串保护

- **规则**：用于 `switch case`、对象键查找、状态比较的字符串字面量（枚举值/魔法字符串）禁止翻译。
- **原理**：这些字符串是逻辑分支的标识符，翻译会破坏控制流。
- **检查清单**（翻译字符串前必须搜索）：
  - 该字符串是否出现在任何 `===` / `!==` / `==` 比较中？
  - 该字符串是否作为 `switch case` 的值？
  - 该字符串是否作为对象键进行查找？
  - 该字符串是否被赋值给会被持久化的数据字段（如 `pack.*`）？
- **示例**：
  ```ts
  // ❌ 禁止翻译：state.form 的枚举值
  if (state.form === "Monarchy") { ... }

  // ❌ 禁止翻译：用作对象键的字符串
  const relations = { Ally: {...}, Enemy: {...} };  // "Ally"/"Enemy" 不可译

  // ✅ 可翻译：relations.Ally.inText 是显示文本
  const relations = { Ally: { inText: "结盟", tip: "盟国..." } };
  ```

## 翻译范围豁免清单

`extract.mjs` 仅扫三处：`src/index.html` + `src/**/*.ts` / `src/**/*.js` + `public/modules/**/*.js`。其它路径均不扫，下表仅作备忘。

### 已硬编码排除
- `node_modules/` / `dist/` / `.git/` / `tests/` / `i18n/`

### 不在扫描范围（无需处理）
- 根 MD：`docs/` / `README.md` / `LICENSE` / `AGENTS.md` / `CONTEXT.md` / `CLAUDE.md` / `CODE_OF_CONDUCT.md`
- 根配置：`package*.json` / `biome.json` / `vite.config.ts` / `tsconfig.json` / `playwright.config.ts` / `vitest*.config.ts` / `netlify.toml` / `Dockerfile`
- IDE/CI：`.github/` / `.docker/` / `.claude/` / `.trae/` / `.vscode/` / `.idea/`
- 维护脚本：`scripts/`、根目录空 `main.js`
- `public/libs/`（第三方库）+ `public/main.js` / `sw.js` / `index.css` / `icons.css` / `404.html` / `manifest.webmanifest` / `heightmaps/` / `charges/` / `images/` / `styles/`

### ⚠️ `public/modules/` 不要排除
legacy vanilla JS 源码（`tools.js` / `options.js` / `style.js` / `editors.js` / `style-presets.js` / `layers.js` / `hotkeys.js` / `general.js`），浏览器直接加载，扫到 10 个有效 UI 字符串。**禁止把整个 `public/` 排除。**

### 小噪音
`src/**/*.test.ts` 产生 4 个测试固件单元（0.47%），优先度低，未动。

## 上游同步

- zh_CN 是独立翻译分支，不 PR 不 merge 出去
- 上游更新时走 reset+replay 流程，**AI 为主、脚本为辅**
- 执行同步任务前，读 `i18n/CONTEXT.md` 的「上游同步工具链」章节
- 完整设计与决策记录已合并到 `i18n/CONTEXT.md` 的「上游同步工具链」章节
