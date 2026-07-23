# Checklist

## 文档与契约（Task 1）

- [x] `i18n/CONTEXT.md` 包含「Standardized Layer」术语定义，明确其包含 extract / pre-translate(exact) / collect-merge / validate，承诺幂等可重放、不反推、不模糊匹配
- [x] `i18n/CONTEXT.md` 包含「Adaptive Layer」术语定义，明确其包含 translate / tm_hints 选择 / cross_file 协调 / warning 检查，承诺接收上下文产出决策、只写 sidecar
- [x] `i18n/CONTEXT.md` 包含「TranslationArtifact」术语定义，说明它是两层间的 seam
- [x] `.trae/rules/localization.rules.md` 明确两套工作流归属：手工 AI 流属自适应层（写 sidecar）、batch_runner 自动流属标准化层（写状态文件）
- [x] `.trae/rules/localization.rules.md` 包含「状态文件写入所有权」段落，明确只有 collect 命令可写 tm.json/progress.json
- [x] `i18n/schemas/translation-artifact.schema.json` 存在且符合 JSON Schema 规范（draft-07 或更新）
- [x] translation-artifact.schema.json 描述的字段与 spec.md 的 TranslationArtifact 结构一致（id/source/target/file/line_before/line_after/type/context_tag/model/confidence/applied/context_used）

## collect-from-artifacts 实现（Task 2）

- [x] `batch_runner.mjs` 有 `collect-from-artifacts` 命令（或 `collect` 命令优先走 artifact 路径）
- [x] collect-from-artifacts 从 `i18n/artifacts/batch_<N>.json` 读取 artifact 列表
- [x] 合并时 `target` 字段来自 `artifact.target`，不调用 `extractTranslatedString`
- [x] 合并时 `model` 字段来自 `artifact.model`
- [x] 合并时 `confidence` 字段来自 `artifact.confidence`
- [x] `existing` 检查基于 `(file, line_before, source)` 三元组，不依赖 `id`
- [x] 合并完成后删除 sidecar 文件（`i18n/artifacts/batch_<N>.json`）
- [x] 原 `collect` 命令重命名为 `collect-legacy` 并标记 `@deprecated`
- [x] **(验证补充)** `collect-from-artifacts` 也处理 `batch_pretranslated.json`：对 `applied: true` 的 pre-translated 单元用 `applyTranslationToLiteral` 应用到源文件并加入 TM（model="tm-reuse"），对 `applied: false` 打印 INFO 日志并跳过

## subagent 产出 artifact（Task 3）

- [x] `prepare` 生成的 batch_N.json 的 `instructions` 数组包含「产出 artifact」指令
- [x] `prepare` 时创建空的 `i18n/artifacts/batch_<N>.json`（`{batch: N, artifacts: []}`）
- [x] `.trae/rules/localization.rules.md` 的 subagent 指令模板要求每翻译完一个 unit 向 sidecar 追加 artifact 记录
- [x] artifact 记录包含 `line_after`（subagent 自报翻译后实际行号）

## 状态文件所有权清理（Task 4）

- [x] `prepare()` 函数中无 `writeFileSync` 调用 tm.json 或 progress.json（grep 验证：写入仅出现在 collectFromArtifacts L396-397 与 collectLegacy L640-641）
- [x] `collect-legacy` 中 `model` 字段为 `null`，不再硬编码 `"minimax-m3"`（grep 0 matches）
- [x] `collect-legacy` 中 `confidence` 字段为 `null`，不再硬编码 `0.9`
- [x] `collect-from-artifacts` 中 `model`/`confidence` 来自 artifact（artifact 路径）；pre-translated 路径用 `model: "tm-reuse"`、`confidence: 1.0`、`reuse_from_tm: true`

## 删除脆弱函数（Task 5）

- [x] `applyTranslationToLine` 函数已从 batch_runner.mjs 删除（grep 0 matches）
- [x] pre-translate 的源文件应用逻辑重写，锚定到字符串字面量边界（`"..."`、`'...'`、`` `...` ``）
- [x] 含 `${...}` 占位符的 source 不再静默 `return null`，改为打印 INFO 日志并跳过 pre-translate（走 subagent）
- [x] `extractTranslatedString` 标记 `@deprecated`（保留用于 collect-legacy）

## 验证与回归（Task 6）

- [x] 小批量端到端测试：prepare → 模拟 pre-translated → collect-from-artifacts → tm.json 增量正确（合成测试：2 applied + 1 placeholder-skipped，源文件正确修改、TM +2、Progress +2、新条目元数据正确）
- [x] `node validate.mjs --skip-tsc --skip-lint` 7 项检查全部 PASS（Placeholder / HTML structure / TM consistency / Residual English 全 PASS）
- [x] collect-legacy 降级路径可用（无 sidecar 时仍能 collect — dispatch 测试通过：`collect` 无 sidecar 时正确 fallback，`collect-from-artifacts`/`collect-legacy` 无输入时正确报错退出 exit=1）
- [x] grep 确认 `prepare()` 不写 tm.json/progress.json（4 处 writeFileSync 仅在 collectFromArtifacts 与 collectLegacy）
- [x] grep 确认 `model: "minimax-m3"` 不再出现在 batch_runner.mjs（0 matches）
- [x] grep 确认 `applyTranslationToLine` 不再出现在 batch_runner.mjs（0 matches）
