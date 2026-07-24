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

### 格式规则
- UI 按钮文案 ≤4 字，长描述用完整句
- 数字 / 单位 / 坐标 / 百分比不译
- 人名、地名生成器产物不译（动态生成）
- 品牌名 Azgaar 不译
- 占位符 `{{xxx}}` `<%xxx%>` `${xxx}` `%s` 必须原样保留

### 不译内容
- 变量名、函数名、CSS 类名
- SVG 路径数据（d 属性值）
- data-* 属性的键名（值可译）
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
- `context_used`：subagent 决策时参考的上下文（tm_hints / glossary_terms / cross_file），用于审计

sidecar 文件位置：`i18n/artifacts/batch_<N>.json`（每批一个文件），`collect` 合并后清理。完整 JSON Schema 见 `i18n/schemas/translation-artifact.schema.json`。

### 状态文件写入所有权

- `tm.json` 和 `progress.json` 的写入仅由标准化层的 `collect()` 命令执行
- `prepare()` 只写 `batch_<N>.json`（输入文件）和 `artifacts/batch_<N>.json`（sidecar 占位）
- 自适应层（subagent / 手工 AI 流）只写 `artifacts/batch_<N>.json`
- 禁止在 subagent 指令中要求「直接追加 tm.json」或「直接更新 progress.json」

## 上游同步工具链（Sync Pipeline）

zh-CN 是独立翻译分支，不 PR 不 merge 出去。上游（master）更新时，通过 **AI 为主、脚本为辅** 的流程吸收上游变化。完整设计与决策记录见 `.claude/artifacts/designs/sync-tools-design.md`。

### 核心策略：Reset + Replay

zh-CN 源码相对 master 的差异**应只有字符串翻译**（1:1 替换）。同步时：
- **Lane-A**（改动 ≤80 行的文件）：`git merge master` + AI 解冲突 + 严格 `(file, source)` 查 tm.json 复用
- **Lane-B**（改动 >80 行的文件）：`git checkout master -- <file>` + TM Replay（脚本把 tm.json 的翻译覆盖回去）

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
