# AI 翻译工作流 Token 优化 - 任务清单

## 优化 1：选择性术语注入（Selective Glossary Injection）

### Task 1: 实现术语筛选函数
在 `batch_runner.mjs` 中添加术语筛选逻辑：
- [x] 1.1 创建 `filterGlossary(batchUnits)` 函数
- [x] 1.2 实现源文本收集逻辑（合并批次内所有单元的 source）
- [x] 1.3 实现术语匹配算法（支持大小写不敏感、词干匹配）
- [x] 1.4 添加兜底机制（筛选结果少于 5 条时返回完整术语表）
- [x] 1.5 编写单元测试验证筛选逻辑

### Task 2: 集成术语筛选到批次准备流程
修改 `prepare()` 函数，在生成批次文件时注入筛选后的术语：
- [x] 2.1 在 `prepare()` 中调用 `filterGlossary()` 函数
- [x] 2.2 将筛选结果添加到 `batchData` 对象的 `glossary` 字段
- [x] 2.3 更新批次文件输出格式（包含 glossary 字段）
- [x] 2.4 测试批次文件生成（验证 glossary 字段正确注入）

## 优化 2：TM 启发式过滤（TM Heuristic Filtering）

### Task 3: 实现 TM 启发式过滤函数
改进现有的 `buildTmHints()` 函数，添加基于 `context_tag` 和 `file` 的过滤逻辑：
- [ ] 3.1 创建 `filterTmHints(batchUnits, tmEntries)` 函数
- [ ] 3.2 实现 context_tag 匹配逻辑（相同 context_tag 得 2 分）
- [ ] 3.3 实现 file 匹配逻辑（相同 file 得 1 分）
- [ ] 3.4 实现混合排序策略（按评分降序，截断到 top-20）
- [ ] 3.5 保留现有的单词重叠匹配作为补充（权重降低）

### Task 4: 集成 TM 过滤到批次准备流程
修改 `prepare()` 函数，使用新的 TM 过滤逻辑：
- [ ] 4.1 替换现有的 `buildTmHints()` 调用为 `filterTmHints()`
- [ ] 4.2 验证 TM 过滤结果（检查 top-20 条目的相关性）
- [ ] 4.3 测试批次文件生成（验证 tm_hints 字段正确过滤）

## 优化 3：Prompt Caching 支持

### Task 5: 更新翻译规则文档
修改 `.trae/rules/localization.rules.md`，移除会话开始时加载完整术语表和 TM 的要求：
- [ ] 5.1 删除"读 `i18n/glossary.json` 拿术语表"的步骤
- [ ] 5.2 删除"读 `i18n/tm.json` 的最近 20 条译文作风格锚点"的步骤
- [ ] 5.3 添加说明：术语表和 TM 会在批次文件中自动注入
- [ ] 5.4 更新翻译流程描述

### Task 6: 添加 Prompt Caching 文档说明
在翻译规则文档中添加 Prompt Caching 的使用说明：
- [ ] 6.1 说明静态内容（CONTEXT.md、规则文档）应设置缓存标记
- [ ] 6.2 提供 API 调用示例（如 Anthropic 的 `cache_control`）
- [ ] 6.3 说明缓存失效处理机制

## 综合测试与验证

### Task 7: 端到端测试验证
验证三个优化方案的整体效果：
- [ ] 7.1 运行 `batch_runner.mjs prepare 30` 生成测试批次
- [ ] 7.2 检查生成的批次文件（验证 glossary 和 tm_hints 字段）
- [ ] 7.3 对比优化前后的 token 消耗（预期减少 60-75%）
- [ ] 7.4 验证翻译质量未受影响（术语准确性和一致性）
- [ ] 7.5 测试兜底机制（术语筛选 < 5 条时的行为）
- [ ] 7.6 测试边界情况（空批次、单单元批次、特殊字符）

### Task 8: 性能基准测试
建立性能基准，量化优化效果：
- [ ] 8.1 测量优化前的 token 消耗（术语表 + TM + 批次文件）
- [ ] 8.2 测量优化后的 token 消耗
- [ ] 8.3 计算 token 节省比例
- [ ] 8.4 记录翻译质量指标（术语准确性、一致性）

## 任务依赖关系
- Task 2 依赖 Task 1（需要先实现术语筛选函数）
- Task 4 依赖 Task 3（需要先实现 TM 过滤函数）
- Task 7 依赖 Task 2、Task 4、Task 5（需要完成代码修改和文档更新）
- Task 8 依赖 Task 7（需要完成端到端测试）
- Task 1、Task 3、Task 5 可以并行执行

## 验收标准
1. 术语筛选函数正确工作，支持大小写不敏感和词干匹配
2. TM 过滤函数正确工作，基于 context_tag 和 file 进行评分和排序
3. 批次文件包含正确的 glossary 和 tm_hints 字段（只包含相关内容）
4. 翻译规则文档已更新，移除会话开始时加载术语表和 TM 的要求
5. 端到端测试通过，token 消耗减少 60-75%
6. 翻译质量未受影响（术语准确性和一致性保持）
7. 性能基准测试完成，有明确的量化数据
