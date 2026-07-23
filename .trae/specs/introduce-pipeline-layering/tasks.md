# Tasks

- [x] Task 1: 定义两层契约并文档化（文档层，无代码改动）
  - [x] SubTask 1.1: 在 `i18n/CONTEXT.md` 增加「Standardized Layer」与「Adaptive Layer」术语定义段落
  - [x] SubTask 1.2: 在 `i18n/CONTEXT.md` 增加「TranslationArtifact」术语定义
  - [x] SubTask 1.3: 更新 `.trae/rules/localization.rules.md`，明确两套工作流（手工 AI 流 vs batch_runner 自动流）的归属：手工流属自适应层、只写 sidecar；自动流属标准化层、独占状态文件写入
  - [x] SubTask 1.4: 在 `i18n/schemas/translation-artifact.schema.json` 创建 JSON Schema 文件（描述 spec 中的 artifact 结构）
- [x] Task 2: 标准化层 - collect 改为合并 TranslationArtifact（核心代码改动）
  - [x] SubTask 2.1: 在 `batch_runner.mjs` 新增 `collect-from-artifacts` 命令，从 `i18n/artifacts/batch_<N>.json` 读取 artifact 列表合并到 tm.json
  - [x] SubTask 2.2: 合并时 `model` 字段从 `artifact.model` 读取，`confidence` 从 `artifact.confidence` 读取
  - [x] SubTask 2.3: `existing` 检查改为基于 `(file, line_before, source)` 三元组（line_before 来自 units.json，稳定）
  - [x] SubTask 2.4: 合并完成后删除 sidecar 文件
  - [x] SubTask 2.5: 将原 `collect` 命令重命名为 `collect-legacy`，标记 `@deprecated`，保留作为无 sidecar 时的降级路径
- [x] Task 3: 自适应层 - subagent 产出 TranslationArtifact sidecar（subagent 指令层）
  - [x] SubTask 3.1: 更新 `batch_runner.mjs prepare` 生成的 batch_N.json，在 `instructions` 数组增加「产出 artifact」指令：subagent 每翻译完一个 unit，向 `i18n/artifacts/batch_<N>.json` 追加一条 artifact 记录
  - [x] SubTask 3.2: 在 `prepare` 时创建空的 `i18n/artifacts/batch_<N>.json`（初始化为 `{batch: N, artifacts: []}`）
  - [x] SubTask 3.3: 更新 `.trae/rules/localization.rules.md` 的 subagent 指令模板，要求产出 artifact
- [x] Task 4: 状态文件写入所有权清理
  - [x] SubTask 4.1: 确认 `prepare()` 不写 tm.json/progress.json（只写 batch_N.json + artifacts/batch_N.json）
  - [x] SubTask 4.2: 删除 `collect-legacy`（原 collect）中硬编码的 `model: "minimax-m3"`，改为 `model: null`
  - [x] SubTask 4.3: 删除 `collect-legacy` 中硬编码的 `confidence: 0.9`，改为 `confidence: null`
  - [x] SubTask 4.4: 在 `localization.rules.md` 增加「状态文件写入所有权」段落，明确只有 collect 命令可写 tm.json/progress.json
- [x] Task 5: 删除脆弱反推函数并重写 pre-translate 应用逻辑
  - [x] SubTask 5.1: 删除 `applyTranslationToLine` 函数
  - [x] SubTask 5.2: 重写 pre-translate 的源文件应用逻辑：锚定到字符串字面量边界（`"..."`、`'...'`、`` `...` ``），仅在字面量内做精确替换
  - [x] SubTask 5.3: 含 `${...}` 占位符的 source 不再静默跳过，改为不应用 pre-translate（走 subagent 流程），并打印 INFO 日志说明原因
  - [x] SubTask 5.4: 将 `extractTranslatedString` 标记 `@deprecated`（保留用于 collect-legacy，不在新路径调用）
- [x] Task 6: 验证与回归
  - [x] SubTask 6.1: 准备一个小批量测试：prepare 5 → 模拟 pre-translated units → collect-from-artifacts → 验证 tm.json 增量正确（修复了 collectFromArtifacts 未处理 batch_pretranslated.json 的 bug，并经合成测试验证：源文件翻译应用 + TM 增量 + model=tm-reuse + confidence=1.0 + reuse_from_tm=true）
  - [x] SubTask 6.2: 运行 `node validate.mjs --skip-tsc --skip-lint`，7 项检查通过
  - [x] SubTask 6.3: 验证 collect-legacy 仍可用（无 sidecar 时降级路径工作 — dispatch 测试通过：无 sidecar 时正确 fallback 到 collectLegacy；无 batch 文件时正确报错退出）
  - [x] SubTask 6.4: 验证 prepare 不再写 tm.json/progress.json（grep 确认 writeFileSync 调用仅出现在 collectFromArtifacts L396-397 与 collectLegacy L640-641）

# Task Dependencies

- Task 1（文档与 schema）是所有后续任务的前置：契约先定义，代码后实现
- Task 2（collect-from-artifacts）依赖 Task 1（schema）和 Task 3（subagent 产出 artifact）—— 需要先有 artifact 才能 collect
- Task 3（subagent 产出 sidecar）依赖 Task 1（指令模板）
- Task 4（所有权清理）可并行于 Task 2/3，但 SubTask 4.2/4.3 修改的是 collect-legacy，与 Task 2 的 collect-from-artifacts 不冲突
- Task 5（删除脆弱函数）依赖 Task 2（新 collect 路径就位后才能安全删除旧路径的依赖）
- Task 6（验证）依赖所有前置任务

# Parallelizable Work

- Task 1 的四个 SubTask 可并行（文档与 schema 互不依赖）
- Task 3 与 Task 4 可并行（一个改 prepare 指令，一个清理所有权）
- Task 5 依赖 Task 2，但 SubTask 5.1（删除 applyTranslationToLine）可与 Task 2 并行（只要确认新路径不依赖该函数）

# 验证过程中发现的 Bug 与修复

**Bug**: `collectFromArtifacts()` 在清理段（原 line 325-330）删除 `batch_pretranslated.json` 但从未读取或合并其内容，导致 `prepare()` 写入的 pre-translated 单元被静默丢失。

**修复**: 在 `collectFromArtifacts()` 内新增 pre-translated 处理块（line 243-336），镜像 `collectLegacy` 的处理逻辑：读取 `batch_pretranslated.json`，对 `applied: true` 的单元用 `applyTranslationToLiteral` 应用到源文件并加入 TM（model="tm-reuse", confidence=1.0, reuse_from_tm=true）；对 `applied: false` 的单元打印 INFO 日志并跳过（路由到 subagent）。

**验证**: 合成测试（3 个 pre-translated 单元：2 applied + 1 placeholder-skipped）端到端通过：
- 源文件 `name: "Roman",` → `name: "罗马",`，`name: "Celtic",` → `name: "凯尔特",`
- TM 779 → 781，新增 2 条 model=tm-reuse 条目
- Progress 781 → 783
- 占位符单元正确跳过并打印日志
