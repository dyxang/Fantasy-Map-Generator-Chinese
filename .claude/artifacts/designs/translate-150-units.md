# Translate 150 Units Spec

> Status: DRAFT
> Author: user
> Last updated: 2026-07-23

## Background

当前翻译进度:1960 总单元中已完成 682(35%),剩余 1278。TM 有 779 entries(769 翻译 + 10 跳过)。本次元数据精简(context_used 删除、tm.json 5 死字段删除、tm_hints top-50 截断)后,token 消耗已降低 ~37%。

基于实测 token 预估:不压缩上下文下,128K 窗口单会话理论最大 190 units,保守 80% 为 152 units。本次目标定 150 units。

## In scope

- 翻译 150 units(从 `progress.last_processed_id` 之后取)
- 使用 batch_runner 自动流:prepare 150 → 4 subagent 并行翻译 → collect 合并
- 4 个 subagent 各处理 ~37 units,每个 subagent 上下文消耗 ~54K tokens(不压缩,不溢出)
- 主会话仅执行 prepare + collect,消耗 ~8K tokens

## Out of scope

- 剩余 1128 units(1278 - 150,后续 session 处理)
- units.json 的 context_before/after 删除(静态 120K 收益达标但风险高,需单独研究)
- 翻译质量人工 review(由 glossary + tm_hints + validate 保证)

## Assumptions

- 上下文窗口 128K tokens(GLM-5.2)
- 每 unit 累积增长 437 tokens(输入 142 + 输出 95 + Edit 200)
- index.html 5523 行,按 2000 行/section 切片约 3 个 section
- subagent 各自独立上下文,不共享,不压缩
- prepare() 自动按 file 分组 balance 到 4 batch

## Token 预估(精简后实测)

| 项目 | tokens | 说明 |
|------|--------|------|
| 主会话固定开销 | 4,840 | rules(1251) + CONTEXT(728) + glossary(1707) + progress(223) + divergence(9) + TM锚点(923) |
| 主会话 prepare 输出 | ~2,000 | 4 batch 统计 |
| 主会话 collect 输出 | ~2,000 | 合并结果 |
| 主会话总计 | ~8,840 | 远低于 128K |
| 每 subagent 固定开销 | ~4,840 | 同主会话固定开销 |
| 每 subagent batch_N.json | ~3,000 | 37 units + tm_hints + instructions |
| 每 subagent 源文件 section | ~30,000 | 2000 行 index.html |
| 每 subagent 翻译累积 | ~16,169 | 37 units × 437 tokens |
| 每 subagent 总计 | ~54,009 | 在 128K 窗口内,安全 |

## Solution

```bash
# 1. 主会话:prepare 150 units,生成 4 batch + sidecar
node i18n/scripts/batch_runner.mjs prepare 150

# 2. 主会话:派 4 个 subagent 并行翻译
#    每个 subagent 读取 i18n/batch_N.json,翻译 units,追加 artifact 到 i18n/artifacts/batch_N.json
#    subagent 不压缩上下文,处理 ~37 units(~54K tokens,不溢出)

# 3. 主会话:collect 合并 sidecar 到 tm.json + progress.json
node i18n/scripts/batch_runner.mjs collect

# 4. 主会话:validate 验证
node i18n/scripts/validate.mjs --skip-tsc --skip-lint
```

## Edge cases & risks

| Category | Notes |
|---|---|
| subagent 溢出 | 每 subagent ~54K,128K 窗口,余量 74K,安全 |
| index.html section 切换 | 1006 剩余 units 分布在 5523 行,每 2000 行一个 section。subagent 需按 section 读源文件,非一次全读 |
| TM exact match | prepare 会 pre-translate 已在 TM 中的 source,减少 subagent 负担。150 units 中可能 ~10-20% pre-translated |
| notFound 重试 | 若上次有 notFound(missed)单元,prepare 会自动注入重试。需确认 retry units 不超 batch 容量 |
| cross_file_duplicates | 同一 source 在多文件出现时,prepare 标记 cross_file_duplicates,subagent 需协调译法 |

## Acceptance criteria

- AC-1: `node batch_runner.mjs prepare 150` 执行后,生成 4 个 `i18n/batch_N.json` + 4 个空 `i18n/artifacts/batch_N.json` sidecar + `i18n/batch_pretranslated.json`(若 TM exact match > 0)
- AC-2: 4 个 subagent 各自完成翻译后,每个 `i18n/artifacts/batch_N.json` 的 `artifacts` 数组非空,每条 artifact 含必填字段(id/source/target/file/line_before/type/context_tag/model/confidence/applied)
- AC-3: `node batch_runner.mjs collect` 执行后,`tm.json.entries` 数量增加 ~150(pre-translated + subagent translated),`progress.json.completed_units` 增加 ~150,`progress.json.last_processed_id` 推进到本批最后一个 unit 的 id
- AC-4: `node validate.mjs --skip-tsc --skip-lint` 输出 `7/7 checks passed` + `VALIDATION PASSED`
- AC-5: 剩余 units ≤ 1128(1278 - 150,允许 ±5 误差因 pre-translated/skipped)

## Open questions

- 无。流程清晰,token 预估已完成,目标已确认。
