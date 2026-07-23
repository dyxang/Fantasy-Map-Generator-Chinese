# Fantasy Map Generator 汉化规则

> 本文件是 Trae IDE 的常驻记忆，每次翻译会话自动加载。

## 两层架构与写入所有权（契约）

翻译系统显式分为两层，每层有明确的写入所有权。本节是契约性约束，优先级高于下方「翻译单元处理」段落中与之冲突的旧描述。完整 spec 见 `.trae/specs/introduce-pipeline-layering/spec.md`，术语定义见 `i18n/CONTEXT.md` 的「翻译管线分层架构」章节。

### Standardized Layer（标准化层）

包含 `extract` / `pre-translate`（exact match）/ `collect-merge` / `validate`。承诺幂等可重放、不读源文件反推 target、不做模糊匹配决策、无 LLM 调用与网络、可单测可 CI 跑。

- **batch_runner 自动流属标准化层**：`collect` 命令独占 `tm.json` 与 `progress.json` 的写入

### Adaptive Layer（自适应层）

包含 `translate` / `tm_hints` 选择 / `cross_file_duplicates` 协调 / warning 类检查。接收上下文产出决策，相同输入可能不同输出。

- **手工 AI 流属自适应层**：subagent 翻译后产出 TranslationArtifact sidecar，不直接写 `tm.json`/`progress.json`

### TranslationArtifact（两层间的 seam）

subagent 翻译完每个 unit 后产出的结构化记录，是两层之间的唯一通信通道。sidecar 文件位于 `i18n/artifacts/batch_<N>.json`，`collect` 合并后清理。完整 JSON Schema 见 `i18n/schemas/translation-artifact.schema.json`。

## 状态文件写入所有权

- `tm.json` 和 `progress.json` 的写入仅由 `collect` 命令（标准化层）执行
- `prepare()` 只写 `batch_<N>.json`（输入文件）和 `artifacts/batch_<N>.json`（sidecar 占位）
- 自适应层（subagent / 手工 AI 流）只写 `artifacts/batch_<N>.json`
- 禁止在 subagent 指令中要求「直接追加 tm.json」或「直接更新 progress.json」
- 本规则**取代**下方「翻译单元处理 → 输出格式」中「在 `i18n/tm.json` 追加翻译条目」与「更新 `i18n/progress.json`」两条旧描述——subagent 不再直写状态文件，改由 `collect` 从 sidecar 合并

## 会话开始时（必做）

1. 读 `i18n/progress.json` 获取上次进度（last_processed_id 之后继续）
2. 读 `i18n/CONTEXT.md` 了解项目背景与翻译原则
3. 读 `i18n/glossary.json` 拿术语表（翻译前查表）
4. 读 `i18n/tm.json` 的最近 20 条译文作风格锚点
5. 读 `i18n/divergence.json` 确认哪些片段不可覆盖

## 翻译单元处理

### 批量大小
- 每会话处理 30-50 个单元（从 progress.json 的 last_processed_id 之后）
- 单次 Read 不超过 2000 行

### 上下文注入（每个单元）
- source 文本
- 前后各 3 个翻译单元（提供上下文连贯性）
- TM 中相似条目 top-5（source 相似度匹配）
- glossary.json 中相关术语

### 输出格式
- 直接用 Edit 工具修改原文件（文本节点 / 属性值）
- 在 `i18n/tm.json` 追加翻译条目
- 更新 `i18n/progress.json` 的 last_processed_id 和 completed_units

> ⚠️ 上述两条状态文件直写规则已由上方「状态文件写入所有权」段落**取代**：subagent 不再直写 `tm.json`/`progress.json`，改写 TranslationArtifact sidecar，由 `collect` 合并。下方「subagent 翻译产出契约」给出新流程。

## subagent 翻译产出契约（TranslationArtifact）

subagent 每翻译完一个 unit（用 Edit 修改源文件后），必须向 `i18n/artifacts/batch_<N>.json` 的 `artifacts` 数组追加一条 TranslationArtifact 记录。记录格式参考 `i18n/schemas/translation-artifact.schema.json`。

### 必填字段（每条 artifact）

- `id`：来自 `units.json` 的 unit id
- `source` / `target`：英文源文本与中文译文
- `file` / `line_before`：源文件路径与翻译前行号（来自 `units.json`）
- `type`：`html_text` / `html_attr` / `ts_string`
- `context_tag`：`button` / `label` / `tooltip` / `heading` / `option` / `description` 等
- `model`：subagent 实际使用的模型标识（如 `glm-5.2`）
- `confidence`：0-1 自评置信度
- `applied`：是否已通过 Edit 应用到源文件（通常为 `true`）

### 推荐字段

- `line_after`：翻译后源文件实际行号——可能与 `line_before` 不同（如 HTML 文本节点换行被压缩/展开），subagent 用 Edit 后的实际行号自报
- `context_used`：subagent 决策时参考的上下文，用于审计
  - `tm_hints`：命中的 TM 相似条目 source 列表
  - `glossary_terms`：命中的 glossary 术语 en 列表
  - `cross_file`：是否在 `cross_file_duplicates` 协调范围内

### 流程约束

- subagent **只**写 `i18n/artifacts/batch_<N>.json`，不写 `tm.json`、不写 `progress.json`
- sidecar 由 `prepare()` 预先创建为空 `{"artifacts": []}`，subagent 追加
- 批次完成后由 `collect`（标准化层）合并 sidecar 到 `tm.json`/`progress.json` 并清理 sidecar 文件
- 若 sidecar 缺失，`collect` 降级到 legacy 模式（从源文件反推），并打印警告

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
  "reviewed": false,
  "reviewed_by": null,
  "model": null,
  "upstream_commit": "51d8e3e...",
  "confidence": 0.95
}
```

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

## HTML 切片策略

`src/index.html` 是 ~9000 行巨型文件，按 section 切片处理：
- 每个对话框（dialog）一个 section
- 每个选项卡（tab）一个 section
- 处理时用 `Read` 的 offset/limit 参数读取对应行范围
- 处理完一个 section 再移到下一个

## 会话结束前（必做）

1. 更新 `i18n/progress.json`：
   - `last_processed_id` → 本次最后处理的单元 id
   - `last_file` 和 `last_line` → 本次最后处理的文件和行号
   - `completed_units` → 累计已完成数
   - `session_history` 追加本次记录：`{"date": "YYYY-MM-DD", "units": N, "end_id": "sha256:xxx", "notes": "处理了哪些面板"}`
2. 将本次翻译追加到 `i18n/tm.json` 的 `entries` 数组
3. 若发现新术语，追加到 `i18n/glossary.json` 的 `terms` 数组
4. 输出状态摘要："本次翻译 N 个单元，累计 M / Total，剩余 K 个单元，建议下次开新会话"

## 上下文窗口策略

- 单元平均 ~50 tokens × 30 = 1500 tokens
- 加注入（上下文 + glossary + TM）约 5K tokens
- 若上下文接近上限，主动结束会话前 flush progress
- 不要一次读取整个 index.html，按 section 切片

## 增量同步流程（上游更新时）

1. 用户运行 `node i18n/scripts/sync.mjs`
2. 读 `i18n/pending.json`，处理待译单元
3. 每个单元的 action：`translate`（新文本）/ `retranslate`（语义变更）/ `skip`（非语义变更或 divergence 命中）/ `delete`（已删除）
4. 处理完后运行 `node i18n/scripts/validate.mjs`
5. 验证通过后 `git merge upstream/master` + 更新 `i18n/base_commit.txt`
