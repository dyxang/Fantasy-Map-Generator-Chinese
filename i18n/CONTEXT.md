# Fantasy Map Generator 汉化上下文

## 项目介绍

Azgaar's Fantasy Map Generator 是一个程序化生成、编辑和可视化奇幻地图的 Web 应用，面向小说作家、跑团玩家和制图师。用户可以生成地形、文化、国家、河流、宗教、军事等要素，并导出为图片或数据文件。

## 读者画像

- **跑团玩家**：DnD / Pathfinder 等桌游 GM，需要快速生成世界地图
- **奇幻小说作者**：需要为虚构世界构建地理参考
- **制图师**：对地图美学和细节有要求
- **世界观构建爱好者**：喜欢精细调整每个参数

## 翻译原则

### 术语风格
- 术语偏向 DnD / 奇幻文学通行译法
- Burg → 城镇（settlement 语境）
- State → 国家（political entity 语境，不译为"州"）
- Province → 省份
- Culture → 文化
- Religion → 宗教
- Biome → 生物群系
- Heightmap → 高度图
- Emblem → 纹章
- Marker → 标记
- Zone → 区域

### 不译即译
- 界面已通用的英文保持原样：`OK` / `API` / `URL` / `Wi-Fi` / `OAuth` / `JSON` / `CSS` / `HTML` 等技术缩写
- 品牌名 `Azgaar` 不译

### 占位符与变量保护
- `{name}` / `%s` / `{{count}}` / `${expr}` 等占位符原样保留，数量与位置不动
- HTML 标签结构、属性名、`id`、`class` 不动（只能改文本节点和 `title` / `placeholder` / `aria-label` / `alt` / `data-tip` / `data-info` 属性的值）
- 代码片段不译、不移动位置（除非中文语序必须调整且工具支持）

### `<u>` 快捷键标签语义（关键）
- `<u>X</u>` 包裹的字母是**快捷键字母提示**，与该元素的 `data-shortcut` 属性对应（如 `<u>G</u>oods` + `data-shortcut="G"` 提示按 G）
- 中文翻译时**保留 `<u>` 在快捷键字母上**，不要移到中文字上（移到中文字上会误导用户以为某中文字对应快捷键）
- 译文格式：`<u>X</u>中文译文`（字母在前，中文紧随其后，无空格）
  - 例：`<u>G</u>oods` → `<u>G</u>货物`；`Precipit<u>a</u>tion` → `<u>A</u>降水量`
- 原版**无 `<u>`** 的 list_item（如 `Ice` / `Markets` / `Trade` / `Rulers` / `Scale Bar` / `Vignette`）中文版也不加 `<u>`，保持原版视觉一致
- `data-shortcut` 属性值（如 `X` / `H` / `;` / `` ` `` / `=` / `/` / `[`）原样不动

### 术语一致性
- 同一功能/概念全站同一译法：`Settings` 译为"设置"就永远是"设置"，不混用"设定"/"偏好"
- 翻译前查 `glossary.json`，发现新术语后追加到 glossary

### UI 语气匹配
- 中文界面用祈使短句，不用"请您……"
- 按钮用动词（"保存"/"删除"/"取消"），不加句号
- 长描述用完整句

### 不解释、不补充
- 原文写 `Save` 就译"保存"，不译成"保存当前更改"
- UI 翻译不是文档翻译，不加原文没有的信息

### 标点跟中文 UI 规范
- 省略号用 `……` 不用 `...`
- 界面标签和按钮末尾不加句号
- 引号统一用 `「」` 或 `""`（视产品风格，本项目用 `""`）
- 全角冒号 `：` 用于 section 提示，半角 `:` 用于代码或纯英文上下文

### 歧义处理
- UI 不允许歧义：原文若含糊，取该上下文最合理的唯一意思，不保留多义
- 数字 / 单位 / 坐标 / 百分比 / 颜色值（如 `#ffffff`）不译
- 人名、地名生成器产物不译（动态生成）

### 不译内容
- 变量名、函数名、CSS 类名
- SVG 路径数据（`d` 属性值）
- `data-*` 属性的键名（值可译）
- URL、文件路径
- 枚举值（如 state.form 的 "Monarchy"、"Republic"）

### 上下文区分
- 同一英文在不同上下文可有不同译法
- `context_tag` 区分：button / label / tooltip / heading / option / description
- 翻译时注入前后 3 个单元作上下文参考

## 技术约束

- `src/index.html` 是 ~9000 行的巨型 UI 文件，按 section（对话框/选项卡）切片处理
- 项目处于 vanilla JS → TS + Vite 迁移期，文件结构会变动
- TM（翻译记忆）的 `id` 字段是 source+file 的 SHA-256 短哈希，但**匹配以 `(file, source)` 二元组为准**——sync 时严格匹配不开全局降级
- Biome lint 强制双引号、无尾逗号、120 行宽

## 与原版的故意差异

（翻译过程中如有产品决策层面的定制差异，记录到 `i18n/divergence.json`）

## 翻译管线分层架构（Standardized vs Adaptive）

翻译系统显式分为两层，每层有明确的契约与写入所有权。完整 spec 见 `.trae/specs/introduce-pipeline-layering/spec.md`。

### Standardized Layer（标准化层）

包含 `extract` / `pre-translate`（exact match 部分）/ `collect-merge` / `validate` 四个机械步骤。该层模块承诺：

- **幂等可重放**：相同输入永远产出相同输出，无副作用
- **不读源文件反推 target**：不猜测 subagent 写入了什么；target 来自 TranslationArtifact sidecar 或 TM exact match
- **不做模糊匹配决策**：模糊匹配、置信度判定属于自适应层
- **可单测、可 CI 跑**：无外部依赖（无 LLM 调用、无网络），任意时刻可在 CI 中重放

对应实现：`i18n/scripts/extract.mjs`、`i18n/scripts/validate.mjs`、`i18n/scripts/batch_runner.mjs` 的 `collect()` 与 `pre-translate` 命令。

### Adaptive Layer（自适应层）

包含 `translate` / `tm_hints` 选择 / `cross_file_duplicates` 协调 / warning 类检查等需要上下文与判断的步骤。该层模块承诺：

- **接收上下文，产出决策**：相同输入可能因模型/温度/上下文不同产出不同输出
- **产出结构化 TranslationArtifact**：每个 unit 翻译完后产出一条 artifact 记录
- **不直接写 tm.json/progress.json**：只写 TranslationArtifact sidecar，由标准化层的 `collect` 统一合并

对应实现：subagent 翻译流程、手工 AI 翻译会话、batch_runner 的 `prepare()`（产出待翻译输入）。

### TranslationArtifact（两层间的 seam）

subagent 翻译完每个 unit 后产出的结构化记录，是两层之间的唯一通信通道。包含字段：

- `source` / `target`：英文源文本与中文译文
- `file` / `line_before` / `line_after`：源文件路径与翻译前后行号（行号可能因翻译后行宽变化而漂移）
- `type` / `context_tag`：文本类型与上下文标签
- `model` / `confidence` / `applied`：subagent 实际使用的模型标识、0-1 自评置信度、是否已通过 Edit 应用到源文件

sidecar 文件位置：`i18n/artifacts/batch_<N>.json`（每批一个文件），`collect` 合并后清理。完整 JSON Schema 见 `i18n/schemas/translation-artifact.schema.json`。

### subagent 翻译产出契约

subagent 每翻译完一个 unit（用 Edit 修改源文件后），必须向 `i18n/artifacts/batch_<N>.json` 的 `artifacts` 数组追加一条 TranslationArtifact 记录。

**必填字段**：`id`（来自 units.json）/ `source` / `target` / `file` / `line_before` / `type`（`html_text` / `html_attr` / `ts_string`）/ `context_tag`（`button` / `label` / `tooltip` / `heading` / `option` / `description` 等）/ `model` / `confidence`（0-1）/ `applied`（通常 `true`）

**推荐字段**：`line_after`（翻译后源文件实际行号）

**流程约束**：
- subagent **只**写 `i18n/artifacts/batch_<N>.json`，不写 `tm.json`、不写 `progress.json`
- sidecar 由 `prepare()` 预先创建为空 `{"artifacts": []}`，subagent 追加
- 批次完成后由 `collect`（标准化层）合并 sidecar 到 `tm.json`/`progress.json` 并清理 sidecar 文件
- 若 sidecar 缺失，`collect` 降级到 legacy 模式（从源文件反推），并打印警告

### 状态文件写入所有权

- `tm.json` 和 `progress.json` 的写入仅由标准化层的 `collect()` 命令执行
- `prepare()` 只写 `batch_<N>.json`（输入文件）和 `artifacts/batch_<N>.json`（sidecar 占位）
- 自适应层（subagent / 手工 AI 流）只写 `artifacts/batch_<N>.json`
- 禁止在 subagent 指令中要求「直接追加 tm.json」或「直接更新 progress.json」

### Token 优化机制（filterGlossary + filterTmHints）

`batch_runner.mjs` 的 `prepare()` 函数在生成 `batch_<N>.json` 时执行两项注入优化，目标是把单批注入开销从 ~14K token 压到 ~2K token（节省 60–75%）。完整 spec 见 `.trae/specs/selective-glossary-injection/spec.md`。

#### filterGlossary（选择性术语注入）

按批次内单元的源文本筛选 glossary，只注入相关术语：

- 收集批次内所有单元的 source，转小写后按 `[^a-z0-9]+` 分词，丢掉长度 <2 的碎片
- 对每个 glossary term 做单词级匹配（避免子串误匹配：`iron` 裸 `includes` 会匹配 `environment`）
- 词干兜底：去除复数后缀 `s` 再匹配一次（如 `Burgs` → 命中 `Burg`）
- **回退机制**：筛选后不足 5 条时返回完整 glossary（防止短批次漏掉关键术语）

#### filterTmHints（TM 启发式过滤）

按 `context_tag` + `file` + 单词重叠对 TM 条目评分，注入 top-20：

- `context_tag` 匹配：+2 分（保证 UI 风格一致：button/button、tooltip/tooltip）
- `file` 匹配：+1 分（保证同文件内术语一致）
- 单词重叠（长度 ≥4 的英文词）：每词 +0.5 分
- 评分 >0 的条目按分降序，截断到 top-20
- 注入 batch 文件的 `tm_hints` 字段，subagent 拿到时已是按相关性排好的 top-20

#### 批次文件结构

`batch_<N>.json` 在原 `units` 字段之外新增：

- `glossary`：filterGlossary 筛选后的术语数组（每条包含 `en` / `zh` / `context` / `do_not_translate`）
- `tm_hints`：filterTmHints 评分后的 top-20 TM 条目数组（每条含 `source` / `target` / `score`）
- `cross_file_duplicates`：跨文件重复 source 清单（提示 subagent 选简洁译法以便其他批次复用）

subagent 读批次文件即可，**无需再读 `glossary.json` 或 `tm.json`**。

## 翻译单元处理流程

### 批量大小
- 每会话处理 30-50 个单元（从 progress.json 的 last_processed_id 之后）
- 单次 Read 不超过 2000 行

### 上下文注入（每个单元）
- source 文本
- 前后各 3 个翻译单元（提供上下文连贯性）
- TM 启发式过滤后的 top-20 条目（由 `filterTmHints()` 评分：`context_tag` 匹配 +2、`file` 匹配 +1、单词重叠 +0.5/词）
- 选择性术语注入的相关术语（由 `filterGlossary()` 基于单词级匹配 + 去复数后缀词干匹配筛选；不足 5 条时回退到完整术语表）

### 输出格式
- 直接用 Edit 工具修改原文件（文本节点 / 属性值）
- 向 `i18n/artifacts/batch_<N>.json` 追加 TranslationArtifact 记录（不直写 tm.json/progress.json）

### HTML 切片策略

`src/index.html` 是 ~9000 行巨型文件，按 section 切片处理：
- 每个对话框（dialog）一个 section
- 每个选项卡（tab）一个 section
- 处理时用 `Read` 的 offset/limit 参数读取对应行范围
- 处理完一个 section 再移到下一个

### 上下文窗口策略

- 单元平均 ~50 tokens × 30 = 1500 tokens
- 加注入（上下文 + 选择性 glossary + 过滤后 TM hints）约 1.5–2.5K tokens（选择性注入后相比全量加载节省 60–75%）
- 若上下文接近上限，主动结束会话前 flush progress
- 不要一次读取整个 index.html，按 section 切片
- Prompt Caching 由 Trae IDE 自动管理，无需在文本中加任何"请缓存"指令

### 会话结束前（必做）

1. 确认所有 artifact 已写入 sidecar（`i18n/artifacts/batch_<N>.json`）
2. 运行 `node i18n/scripts/batch_runner.mjs collect` 合并 sidecar 到 tm.json/progress.json
3. 若发现新术语，追加到 `i18n/glossary.json` 的 `terms` 数组
4. 输出状态摘要："本次翻译 N 个单元，累计 M / Total，剩余 K 个单元，建议下次开新会话"

## 翻译单元结构（tm.json entry）

```json
{
  "id": "sha256:abc123...",
  "source": "Generate new map",
  "target": "生成新地图",
  "file": "src/index.html",
  "line": 1234,
  "type": "html_text | html_attr | ts_string",
  "context_tag": "button | label | tooltip | heading | option | description",
  "skipped": false,
  "skip_reason": null
}
```

## 上游同步工具链（Sync Pipeline）

zh_CN 是独立翻译分支，不 PR 不 merge 出去。上游（master）更新时，通过 **AI 为主、脚本为辅** 的流程吸收上游变化。本节即同步工具链的完整设计与决策记录（原始 `.claude/artifacts/designs/sync-tools-design.md` 已合并到此处）。

### 核心策略：Reset + Replay

zh_CN 源码相对 master 的差异**应只有字符串翻译**（1:1 替换）。同步时：
- **Lane-A**（改动 ≤80 行的文件）：`git merge master` + AI 解冲突 + 严格 `(file, source)` 查 tm.json 复用
- **Lane-B**（改动 >80 行的文件）：`git checkout master -- <file>` + TM Replay（脚本把 tm.json 的翻译覆盖回去）

### 同步工作流

1. `git fetch upstream` 更新本仓库的 master 分支
2. `node i18n/scripts/sync-analyze.mjs` 分析改动，按 80 行阈值分 lane，输出 `i18n/sync-report.json`
3. 代码同步阶段：
   - **Lane-A**（≤80 行）：`git merge master`，AI 解冲突 + 翻译新增字符串，严格 `(file, source)` 查 tm.json 复用
   - **Lane-B**（>80 行）：`git checkout master -- <file>` + `node i18n/scripts/replay-apply.mjs --files <...>`，未命中的字符串进翻译队列
4. AI subagent 翻译未命中的字符串
5. 派独立兜底 subagent 扫描脚本漏提取的英文残留，记录到 `i18n/manual-marks.json`
6. `node i18n/scripts/sync-collect.mjs` 合并翻译产出到 tm.json
7. `node i18n/scripts/sync-finalize.mjs` 清理 pending 中转区、归档 obsolete marks、更新 base_commit
8. `node i18n/scripts/validate.mjs` 验证翻译完整性

### 替换实现（AST 精确替换，一步到位）

- `.ts` / `.js`：TypeScript AST 遍历 StringLiteral 节点，按位置精确替换
- `.html`：parse5 AST 遍历文本节点 + 属性节点，按 sourceCodeLocation 精确替换
- 默认**严格匹配** `(file, source)`，不开全局降级（避免 `type === "River"` 被误翻成 `type === "河流"`）
- `--allow-global-fallback` 仅在人工复核后启用，输出 AMBIGUOUS 警告

### manual-marks.json（AI 外化记忆）

脚本提取字符串的盲区（动态拼接、跨标签 HTML 文本、看起来像代码的字符串）由兜底 subagent 扫描，记录到 `manual-marks.json`：
- 结构化字段：`id` / `file` / `source` / `category` / `location_hint` / `note` / `base_commit` / `added_at`
- `category` 取值：`dynamic-concat | template-nested | code-like | complex-encoding | html-cross-tag | other`
- 下次同步时兜底 subagent 优先读这份清单，定位每个 mark 并翻译
- sync-finalize 会归档 obsolete 的 mark（source 已不在 master 文件中）

### pending.json（中转区）

上游删除的字符串进入 pending，不立即从 tm.json 删除——防止"移到别处"误删。sync-finalize 整次同步完成后检查 pending，确实没回来的才清理。

### 同步工具职责

| 工具 | 类型 | 职责 |
|---|---|---|
| `sync-analyze.mjs` | 脚本 | 差异分析 + lane 分类（80 行阈值） |
| `replay-apply.mjs` | 脚本 | TM Replay（TS/JS AST + HTML AST） |
| `sync-collect.mjs` | 脚本 | 合并翻译产出到 tm.json |
| `sync-finalize.mjs` | 脚本 | 清理 pending + 归档 marks + 更新 base_commit |
| 兜底 subagent | AI | 扫描残留 + 维护 manual-marks |

复用：`batch_runner.mjs`（prepare/collect）、`validate.mjs`
