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

## 上游同步

- zh_CN 是独立翻译分支，不 PR 不 merge 出去
- 上游更新时走 reset+replay 流程，**AI 为主、脚本为辅**
- 执行同步任务前，读 `i18n/CONTEXT.md` 的「上游同步工具链」章节
- 完整设计与决策记录见 `.claude/artifacts/designs/sync-tools-design.md`
