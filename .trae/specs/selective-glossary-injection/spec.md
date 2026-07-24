# AI 翻译工作流 Token 优化 Spec

## Why
当前翻译工作流存在严重的 token 浪费问题：
1. **术语表全量加载**：每次会话开始时加载完整术语表（82 条，约 6000 token），但实际翻译时只需要其中一小部分
2. **TM 全量注入**：每次注入最近 20 条 TM 条目（约 8000 token），但大部分与当前翻译无关
3. **会话初始化开销**：每次会话都要重新读取大量静态内容，未利用 Prompt Caching 机制

通过实施三项优化（选择性术语注入、TM 启发式过滤、Prompt Caching），预计可减少 60-75% 的 token 消耗，同时保持翻译质量。

## What Changes
### 优化 0：提取规则完善（Extraction Pattern Enhancement）
- 修改 `extract.mjs`，添加对 TS/JS 模板字符串中 HTML 属性的提取
- 新增正则模式：`data-tip="..."`、`aria-label="..."`、`alt="..."` 等
- 确保所有需要翻译的 HTML 属性都能被正确提取

### 优化 1：选择性术语注入（Selective Glossary Injection）
- 修改 `batch_runner.mjs` 的 `prepare()` 函数，添加术语筛选逻辑
- 在生成批次文件时，只注入当前批次需要的术语
- 添加术语筛选的兜底机制，确保不会遗漏关键术语

### 优化 2：TM 启发式过滤（TM Heuristic Filtering）
- 改进现有的 `buildTmHints()` 函数，基于 `context_tag` 和 `file` 进行过滤
- 优先注入与当前批次相关的 TM 条目（相同 context_tag 或相同 file）
- 减少无关 TM 条目的注入

### 文档更新
- 修改翻译规则文档，移除会话开始时加载完整术语表和 TM 的要求
- 添加说明：术语表和 TM 会在批次文件中自动注入

## Impact
- Affected specs: 无（新增优化）
- Affected code: 
  - `i18n/scripts/batch_runner.mjs`（主要修改：术语筛选 + TM 过滤）
  - `.trae/rules/localization.rules.md`（规则调整：移除会话初始化要求）

## ADDED Requirements

### Requirement 1: 术语动态筛选（Selective Glossary Injection）
系统 SHALL 在准备翻译批次时，根据批次内所有待翻译单元的源文本内容，动态筛选出相关的术语条目。

#### Scenario 1.1: 正常筛选流程
- **WHEN** 执行 `batch_runner.mjs prepare` 命令
- **THEN** 系统收集批次内所有单元的源文本
- **THEN** 系统检查每个术语的英文是否在源文本中出现
- **THEN** 只将匹配的术语注入到批次文件的 `glossary` 字段中

#### Scenario 1.2: 筛选结果过少时的兜底
- **WHEN** 筛选后的术语数量少于 5 条
- **THEN** 系统 SHALL 提供完整的术语表作为兜底
- **THEN** 确保 AI 有足够的上下文信息

#### Scenario 1.3: 术语形式匹配
- **WHEN** 源文本中包含术语的复数形式（如 "Burgs"）
- **THEN** 系统 SHALL 能够匹配到术语表中的单数形式（如 "Burg"）
- **THEN** 确保不会遗漏相关术语

### Requirement 2: TM 启发式过滤（TM Heuristic Filtering）
系统 SHALL 在生成批次文件时，基于 `context_tag` 和 `file` 对 TM 条目进行启发式过滤，优先注入与当前批次相关的条目。

#### Scenario 2.1: 基于 context_tag 过滤
- **WHEN** 批次内的单元具有特定的 `context_tag`（如 "button"、"tooltip"）
- **THEN** 系统优先注入具有相同 `context_tag` 的 TM 条目
- **THEN** 确保翻译风格一致性

#### Scenario 2.2: 基于 file 过滤
- **WHEN** 批次内的单元来自特定文件
- **THEN** 系统优先注入来自相同文件的 TM 条目
- **THEN** 确保同一文件的术语一致性

#### Scenario 2.3: 混合排序策略
- **WHEN** 同时存在 context_tag 匹配和 file 匹配的 TM 条目
- **THEN** 系统按相关性排序（context_tag + file 同时匹配 > 单一匹配）
- **THEN** 截断到 top-N 条（建议 N=20）

### Requirement 3: Prompt Caching 支持
系统 SHALL 支持 Prompt Caching 机制，减少静态内容的重复传输成本。

#### Scenario 3.1: 静态内容缓存标记
- **WHEN** 调用翻译 API 时
- **THEN** 系统对静态内容（CONTEXT.md、规则文档、术语表 schema）设置缓存标记
- **THEN** 利用 API 的缓存机制（如 Anthropic 的 `cache_control`）

#### Scenario 3.2: 缓存失效处理
- **WHEN** 静态内容发生变化时
- **THEN** 系统自动更新缓存标记
- **THEN** 确保缓存内容与当前版本一致

### Requirement 4: 批次文件结构扩展
批次文件 SHALL 包含 `glossary` 和 `tm_hints` 字段，存储筛选后的术语列表和 TM 条目。

#### Scenario 4.1: 批次文件生成
- **WHEN** 生成批次文件 `batch_N.json`
- **THEN** 文件中包含 `glossary` 数组字段（筛选后的术语）
- **THEN** 文件中包含 `tm_hints` 数组字段（过滤后的 TM 条目）
- **THEN** 每个字段包含相关的上下文信息

### Requirement 5: 翻译规则更新
翻译规则文档 SHALL 移除会话开始时加载完整术语表和 TM 的要求。

#### Scenario 5.1: 规则文档更新
- **WHEN** 更新 `.trae/rules/localization.rules.md`
- **THEN** 移除"读 `i18n/glossary.json` 拿术语表"的步骤
- **THEN** 移除"读 `i18n/tm.json` 的最近 20 条译文作风格锚点"的步骤
- **THEN** 添加说明：术语表和 TM 会在批次文件中自动注入

## MODIFIED Requirements

### Requirement: 批次准备流程
`batch_runner.mjs` 的 `prepare()` 函数 SHALL 在生成批次文件前执行术语筛选和 TM 过滤。

#### Scenario: 术语筛选集成
- **WHEN** 调用 `prepare()` 函数准备翻译批次
- **THEN** 函数收集批次内所有单元的源文本
- **THEN** 调用术语筛选函数 `filterGlossary()`
- **THEN** 调用 TM 过滤函数 `filterTmHints()`
- **THEN** 将筛选结果注入到批次数据中
- **THEN** 写入批次文件

#### Scenario: 术语筛选函数实现
- **WHEN** 执行术语筛选
- **THEN** 将源文本转换为小写
- **THEN** 检查每个术语的英文（小写）是否在源文本中
- **THEN** 支持词干匹配（去除复数后缀 "s"）
- **THEN** 返回匹配的术语列表

#### Scenario: TM 过滤函数实现
- **WHEN** 执行 TM 过滤
- **THEN** 提取批次内所有单元的 `context_tag` 和 `file`
- **THEN** 对 TM 条目进行评分（context_tag 匹配 +2 分，file 匹配 +1 分）
- **THEN** 按评分降序排序
- **THEN** 截断到 top-20 条
