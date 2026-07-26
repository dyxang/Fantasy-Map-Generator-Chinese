---
name: "fmg-enhancer"
description: "为 Azgaar's Fantasy Map Generator 开发低侵入性增强功能（独立插件 .ts 或脚本），并在上游升级后重挂载既有增强。当用户提出新功能需求、改善体验、开发 FMG 插件/脚本，或上游更新后需要恢复、迁移、验证既有增强时，必须调用本 skill。"
---

# FMG 项目增强开发（插件 / 脚本）

接收用户的功能需求，通过开发**低侵入性**的插件或脚本满足需求。本 skill 内置项目调查结论、集成方式、风险控制流程与交付规范，开发时严格遵循。

## 一、硬性原则（低侵入性开发规范）

1. **新增文件优先**：能新增独立文件就不改动现有文件。唯一允许修改的现有文件是注册表 `src/controllers/index.ts` 或 `src/services/index.ts`（仅限追加一行 loader thunk）。
2. **绝不修改以下高风险目标**（除非用户明确确认，见风险控制）：
   - `src/index.html`（约 9K 行 monolith，结构标签嵌套极易损坏）
   - `.map` 序列化格式（`src/services/io/save.ts` / `load.ts`）——保存/加载契约必须完全往返一致
   - `pack` / `grid` 核心数据结构与已有字段语义
   - `src/utils/registry.ts` 的 thenable 防护逻辑
   - `package.json` 新增生产依赖（项目规定：未经许可禁止引入新生产依赖）
3. **上游兼容**：插件不得依赖上游内部私有实现的细节；优先通过公开集成缝（注册表、`window` 全局、DOM 事件）挂接，使上游代码变动时插件仍能插入使用。读取全局状态时必须做空值/存在性守卫。
4. **不损害现有功能**：不得覆盖、猴子补丁或重排现有模块的导出；不得改变现有图层、编辑器、生成器的行为。

## 二、项目技术速查（已完成调查，直接采信）

- **技术栈**：Vanilla TS + SVG 渲染，Vite 打包，Biome 检查（双引号、无尾逗号、120 列宽、强制分号），路径别名 `@/*` → `src/*`。
- **四层架构**：State（`window.pack` / `window.grid`）→ Generators（Model）→ Editors/Controllers → Renderers（View）。生成器禁止触碰 DOM/SVG；渲染器幂等只读；控制器薄、打开建 DOM、关闭销毁。
- **代码风格**：简洁紧凑、显式 TS 类型、避免 `any`、新文件必须用 TypeScript。
- **运行/验证命令**：`npm run dev`、`npm run build`（含 `tsc`）、`npm run lint`、`npm run test`（Vitest）。**绝不自动运行 Playwright e2e 测试**。
- **关键全局**（声明于 `src/types/global.ts`）：`pack`、`grid`、`seed`、`options`、`Controllers`、`Services`、`tip()`、`downloadFile()`、`findCell()`、`rn()`、`layerIsOn()`、各 SVG 图层 selection（`svg`、`viewbox`、`debug` 等）。插件引用未声明的全局时，在 `src/types/global.ts` 的既有注释约定下补充声明，禁止 `as any` 绕过。

## 三、实现形态选择

按需求性质选择形态，优先顺序 A > B > C > D：

### 形态 A：懒加载 Controller/Service 插件（UI 类需求首选）
适用于：新面板、对话框、概览、编辑器、导出工具。
- 在 `src/controllers/<name>.ts`（或 `src/services/`）新建独立 `.ts` 文件，导出单一命名对象：`export const MyTool = { open, ... }`。
- 在对应 `index.ts` 注册表**追加一行**：`MyTool: () => import("@/controllers/my-tool").then(m => m.MyTool),`
- 调用入口：`Controllers.MyTool.open()`（TS）或 `window.Controllers.MyTool.open()`（legacy JS / 内联事件）。
- UI 构建遵循项目约定：打开时用 `insertAdjacentHTML` 一次性注入 DOM 并挂事件；关闭时 `remove()` 生成的子树、清理计时器与监听器（隐藏 ≠ 关闭）。样式用 `<style>` 元素随对话框一起创建/销毁，不改全局 CSS。
- 遵守 lazy_loading 规则：命名导出、模块体不做 `window.X = ...` 自注册、不得被 eager 图静态 import。

### 形态 B：自注册全局模块（生成 / 渲染 / 数据类需求）
适用于：新生成器、新 SVG 图层、后台数据计算。
- 新建 `src/generators/<name>.ts` 或 `src/renderers/<name>.ts`，在对应 `index.ts` 中以 eager import 挂载，并按现有约定自注册 `window.MyModule`（同时在 `src/types/global.ts` 声明类型）。
- 生成器：确定性（Alea 种子）、只读写 world data、禁止 DOM/SVG；配套 `*.test.ts` 单元测试。
- 渲染器：幂等、只读 state、一次性字符串注入写 DOM、关闭图层时清空内容。

### 形态 C：浏览器脚本（零构建、即贴即用）
适用于：一次性批处理、数据导出、调试辅助、用户侧自动化。
- 纯 JS 单文件，直接在浏览器控制台执行或经书签/控制台粘贴运行；只通过 `window` 全局（`pack`、`grid`、`Controllers`、`Services`、`downloadFile` 等）交互，不 import 项目源码。
- 开头必须做环境自检：`if (typeof pack === "undefined") throw new Error("请先在 FMG 页面中生成或加载地图")`。
- 只读优先；如需修改 state，修改后提示用户手动触发对应重绘（如 `drawLayers()`）并提醒先保存 `.map` 备份。

### 形态 D：项目工具脚本（仓库级自动化）
适用于：构建辅助、版本处理、数据修复等仓库维护任务。
- 放入 `scripts/` 目录（现有先例：`bump-version.js`、`detect-bump-type.js`、`repair-map-line-endings.py`），Node.js 或 Python 均可，不得影响应用运行时。

## 四、风险控制机制（强制执行）

### 高风险判定清单（命中任意一项即为高风险）
- 需要修改 `src/index.html`、`save.ts`/`load.ts`、`.map` 文件格式、`pack`/`grid` 既有字段语义
- 需要新增 npm 依赖或改动 `package.json` / 构建配置
- 需要修改现有核心文件超过 5 行，或改动注册表以外的任何现有逻辑
- 需要覆盖/包装现有函数、修改全局 CSS、变更现有图层行为
- 会改变地图生成结果（影响种子确定性）或破坏旧 `.map` 文件兼容性
- 需求本身需要多文件、跨层改动才能实现

### 风险确认流程
1. 判定为高风险后，**停止开发**，向用户输出风险提示，包含：
   - 风险点与影响范围（波及哪些文件/功能/数据契约）
   - 侵入性评估（需改动的现有文件与行数量级）
   - 上游兼容性影响（上游更新后是否容易失效）
   - 可行的低侵入替代方案（如形态降级：插件 → 浏览器脚本；或缩小需求范围）
2. 等待用户确认继续、或调整需求后，方可开发。
3. 低风险需求（纯新增独立文件 + 至多一行注册）可直接开发，但仍需在交付说明中列出全部改动点。

## 五、开发工作流

1. **需求分析**：明确功能目标、用户交互方式、是否需要持久化（进入 `.map` 的选形态 A/B 且需风险评估；仅 `localStorage` 偏好则为 app 级）。
2. **形态选择**：按第三节选择实现形态并简述理由。
3. **风险判定**：按第四节清单判定；高风险走确认流程。
4. **定位参考实现**：开发前阅读 1–2 个同类现有模块作为模式参照（如面板参考 `src/controllers/minimap.ts`，注册参考 `src/controllers/index.ts`，生成器参考 `src/generators/markets-generator.ts`）。
5. **实现**：遵循编码规范编写代码；UI 类可参考 `templates/` 下的模板。
6. **验证**：依次运行 `npm run lint`、`npm run build`（含 `tsc` 类型检查）；形态 A 还需确认产物被拆分为独立 chunk（`dist/assets` 中出现 `<name>-<hash>.js`）。有单元测试的运行 `npm run test`。**不运行 Playwright**。
7. **交付**：按第六节输出完整交付物。

## 六、交付物规范（每次开发必须完整输出）

1. **实现代码**：全部新增/修改文件的完整代码与路径清单。
2. **使用说明**：功能用途、安装/挂载方式（插件如何注册启用、脚本如何执行）、操作步骤、注意事项。
3. **兼容性测试报告**，至少包含：
   - 验证命令及结果（lint / build / test 的实际执行结果）
   - 侵入性清单：新增文件列表 + 修改的现有文件及具体行
   - 兼容性确认：未触碰高风险目标声明；`.map` 往返不受影响说明；对上游变动的敏感度评估（依赖了哪些集成缝、上游变更时的预期表现）
   - 已知限制与后续建议

## 七、上游升级后的增强重挂载工作流

当用户拉取上游新版本后需要恢复此前开发的增强时，按以下流程执行（无需重写插件代码）：

1. **盘点既有增强**：列出全部增强资产 —— 新增文件（插件 `.ts`、脚本）、注册表追加行、`.trae/` 之外的交付记录。独立新增文件天然不受上游合并影响，应原样保留；若 `git pull`/`git merge` 产生冲突，冲突点理论上只会出现在注册表 `src/controllers/index.ts` / `src/services/index.ts`。
2. **恢复注册表条目**：检查注册表中插件的 loader 行是否仍在；若被上游改动覆盖或冲突，重新追加该行（接受上游其余全部改动，只补回自己的一行）。注册表若被上游重命名/重构，参照新注册表写法等价迁移这一行。
3. **验证集成缝存活**：逐项核对插件依赖的集成缝在新版本仍存在：
   - `Controllers` / `Services` 注册表机制（`src/utils/registry.ts`）
   - 插件引用的 `window` 全局（对照新版 `src/types/global.ts`，确认 `pack`、`grid`、`tip`、`downloadFile` 等仍声明）
   - UI 锚点 DOM（如 `#dialogs`）与插件调用的其他控制器方法签名
   - 浏览器脚本：逐一确认脚本用到的每个 `window` 全局在新版本仍存在且语义未变
4. **重新验证**：运行 `npm run lint`、`npm run build`、`npm run test`（若插件带测试）；形态 A 插件确认仍拆分为独立 chunk。
5. **冒烟测试**：`npm run dev` 启动后逐个打开/执行每个增强，确认功能行为与新版本一致。
6. **按需修复**：若集成缝已变更（如全局改名、方法签名调整、DOM 锚点移除），仅修改插件自身文件适配，**不得**为适配而修改上游主体代码；适配成本过高时向用户提示并给出替代方案（如降级为浏览器脚本）。
7. **输出重挂载报告**：各增强的存活状态（直接可用 / 已适配修复 / 无法迁移及原因）、验证命令结果、对上游变更的 diff 摘要。

## 九、模板

- `templates/controller-plugin.template.ts` — 形态 A 控制器插件骨架（含打开建 DOM / 关闭销毁 / 样式隔离模式）
- `templates/browser-script.template.js` — 形态 C 浏览器脚本骨架（含环境自检与备份提醒）
