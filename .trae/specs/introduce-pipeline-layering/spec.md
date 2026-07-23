# Introduce Translation Pipeline Layering Spec

## Why

翻译系统当前未显式区分「标准化（机械、幂等、可自动化）」与「AI 判断（自适应、需上下文）」两层。后果是 collect() 阶段从源文件正则反推 target（subagent 已知的 target 被丢掉再猜回来）、tm_hints 用「长度 ≥4 词重叠」做标准化匹配却漏掉 glossary 核心术语（Add/Map/State 都是 3-4 字符）、两套工作流（手工 AI 流 vs batch_runner 自动流）共享 tm.json/progress.json 但写入语义不一致（`model: null` vs 硬编码 `model: "minimax-m3"`）。

随着翻译推进，这些摩擦会累积成「翻译到中期不好设计」的死结。本 spec 显式定义两层边界与 seam，为长期维护奠定契约。

## What Changes

- 显式定义「标准化层」与「自适应层」的契约，写入 CONTEXT.md 与 localization.rules.md
- 引入 TranslationArtifact 作为两层间的 seam（subagent 产出的结构化结果）
- collect() 从「源文件正则反推 target」改为「合并 TranslationArtifact sidecar」
- 状态文件所有权：标准化层独占 tm.json/progress.json 写入；自适应层通过 sidecar 产出
- **BREAKING**: 删除 `extractTranslatedString` 和 `applyTranslationToLine`（脆弱反推函数），由 artifact seam 替代

## Impact

- Affected specs: 翻译流程契约（首次定义）
- Affected code:
  - `i18n/scripts/batch_runner.mjs`（collect 改为合并、删除反推函数、删除硬编码 model）
  - `i18n/scripts/extract.mjs`（无改动，属标准化层）
  - `i18n/scripts/validate.mjs`（无改动，属标准化层）
  - `i18n/CONTEXT.md`（增加两层术语）
  - `.trae/rules/localization.rules.md`（明确两套工作流归属）
- 不在本 spec 范围（留作后续 spec）：
  - pre-translate 模糊匹配扩展（依赖 SourceAnchor，见候选 2）
  - tm_hints 改用 glossary 术语锚点（独立改进）
  - cross_file_duplicates 按批次分组（独立改进）
  - `.i18nignore` 文件（见候选 1）

## ADDED Requirements

### Requirement: Standardized Layer Contract

标准化层包含 extract / pre-translate（exact match 部分）/ collect-merge / validate。该层模块承诺：

- **幂等可重放**：相同输入永远产出相同输出
- **不读源文件反推**：不猜测 subagent 写入了什么；target 来自 artifact.sidecar 或 TM exact match
- **不做模糊匹配决策**：模糊匹配、置信度判定属于自适应层
- **可单测、可 CI 跑**：无外部依赖（无 LLM 调用、无网络）

#### Scenario: extract 重跑稳定

- **WHEN** 用户重跑 `node i18n/scripts/extract.mjs` 而源文件未变
- **THEN** `units.json` 内容不变（字节级一致）

#### Scenario: collect 合并而非反推

- **WHEN** collect 处理一批 TranslationArtifact sidecar
- **THEN** tm.json 增量的 `target` 字段来自 `artifact.target`，不调用 `extractTranslatedString` 从源文件正则提取

#### Scenario: 标准化层不写 model 硬编码

- **WHEN** collect 写入新 tm entry
- **THEN** `model` 字段来自 `artifact.model`（subagent 自报），不硬编码 `"minimax-m3"`

### Requirement: Adaptive Layer Contract

自适应层包含 translate / tm_hints 选择 / cross_file_duplicates 协调 / warning 类检查。该层模块承诺：

- **接收上下文，产出决策**：相同输入可能产出不同输出（因模型/温度/上下文不同）
- **产出结构化 TranslationArtifact**：不直接写 tm.json/progress.json
- **通过 sidecar 与标准化层通信**：sidecar 是唯一输出通道

#### Scenario: subagent 产出 artifact

- **WHEN** subagent 翻译完一个 unit（已用 Edit 修改源文件）
- **THEN** 在 `i18n/artifacts/batch_<N>.json` 追加一条 TranslationArtifact 记录

#### Scenario: 自适应层不直写状态文件

- **WHEN** subagent 或手工 AI 流程完成翻译
- **THEN** tm.json/progress.json 的写入由 collect（标准化层）统一执行，自适应层只写 sidecar

### Requirement: TranslationArtifact Seam

两层之间的 seam 是 TranslationArtifact，schema 如下（JSON Schema 描述）：

```
{
  "id": string,              // 来自 units.json 的 unit id（当前实现，不强制稳定）
  "source": string,          // 英文源文本
  "target": string,          // 中文译文
  "file": string,            // 相对仓库根的源文件路径
  "line_before": number,     // 翻译前源文件行号（来自 units.json）
  "line_after": number,      // 翻译后源文件实际行号（subagent 自报，可能漂移）
  "type": string,            // html_text | html_attr | ts_string
  "context_tag": string,     // button | label | tooltip | ...
  "model": string,           // subagent 实际使用的模型标识
  "confidence": number,      // 0-1，subagent 自评
  "applied": boolean,        // 是否已通过 Edit 应用到源文件
  "context_used": {          // subagent 决策时参考的上下文（用于审计）
    "tm_hints": string[],    // 命中的 tm_hints source 列表
    "glossary_terms": string[], // 命中的 glossary 术语 en 列表
    "cross_file": boolean    // 是否在 cross_file_duplicates 中
  }
}
```

sidecar 文件位置：`i18n/artifacts/batch_<N>.json`（每批一个文件，collect 后清理）

#### Scenario: sidecar 文件存在则 collect 合并

- **WHEN** collect 启动且 `i18n/artifacts/batch_<N>.json` 存在
- **THEN** collect 从 sidecar 读取 artifact 列表，合并到 tm.json，然后删除 sidecar

#### Scenario: sidecar 缺失则降级到 legacy collect

- **WHEN** collect 启动但无 artifacts 目录或 sidecar 文件
- **THEN** collect 打印警告并降级到 legacy 模式（从源文件正推），保证向后兼容

## MODIFIED Requirements

### Requirement: collect() 合并而非反推

`collect()` 命令优先从 TranslationArtifact sidecar 读取 target。当 sidecar 存在时，不调用源文件读取与正则提取。`existing` 检查改为基于 `(file, line_before, source)` 三元组（line_before 来自 units.json，稳定）。

### Requirement: 状态文件写入所有权

`tm.json` 和 `progress.json` 的 `writeFileSync` 调用仅出现在 `collect()` 函数中（标准化层）。`prepare()` 只写 `batch_<N>.json`（输入文件），不写状态文件。自适应层（subagent）只写 `artifacts/batch_<N>.json`。

### Requirement: model 字段来源

tm entry 的 `model` 字段从 `artifact.model` 读取。legacy collect 模式下（无 sidecar）保留 `model: null`（不再硬编码 `"minimax-m3"`），表示「来源未知」。

## REMOVED Requirements

### Requirement: extractTranslatedString

**Reason**: 从源文件正则反推 target 是有损往返——一行有多个中文字符串时抓第一个，可能是错的。subagent 已知 target，应直接产出。

**Migration**: 由 TranslationArtifact sidecar 的 `target` 字段替代。legacy collect 模式保留该函数作为降级路径（标记 `@deprecated`）。

### Requirement: applyTranslationToLine

**Reason**: 不锚定字符串字面量边界，source `"Add"` 会匹配 `Added`/`Address` 中的子串；含 `${...}` 占位符的 source 静默 `return null` 跳过。pre-translate 的应用逻辑应重新实现并锚定到字符串字面量边界。

**Migration**: pre-translate 应用逻辑重写为「在字符串字面量内做精确替换」，含占位符的 source 走 subagent 流程而非静默跳过。

### Requirement: 硬编码 model: "minimax-m3"

**Reason**: batch_runner.mjs 无法知道 subagent 实际用什么模型（由 Task 工具调用方决定），硬编码字段在撒谎。

**Migration**: model 字段从 artifact 读取；legacy 模式设为 `null`。
