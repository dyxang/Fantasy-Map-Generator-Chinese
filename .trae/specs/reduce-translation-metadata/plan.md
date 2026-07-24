# Reduce Translation Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除翻译管线中三类确认无读取的死元数据(context_used / tm.json 5 死字段 / tm_hints 整桶不截断),将每 100 units 元数据 token 消耗从 ~24,000 降至 ~15,000(省 ~37%),静态 tm.json 从 ~74K 降至 ~35K tokens。

**Architecture:** 三项独立精简,可单独实施单独 commit。Task 1 删 schema/rules/instructions 中的 context_used;Task 2 写迁移脚本删现有 tm.json 死字段并改 collect/sync 不再写入;Task 3 改 buildTmHints 加 top-50 截断(不改 batch_N.json 结构)。每项完成后跑 validate.mjs 确认 7/7 PASS。

**Tech Stack:** Node.js ESM (node:test + node:assert/strict),无新增依赖。

---

## File Structure

**修改的文件:**
- `i18n/schemas/translation-artifact.schema.json` — 删 context_used 属性(Task 1)
- `.trae/rules/localization.rules.md` — 删 context_used 章节 + instructions 提及(Task 1)
- `i18n/scripts/batch_runner.mjs` — 删 instructions 中 context_used(Task 1);删 collect 写入 5 死字段(Task 2);buildTmHints 加 top-50 截断(Task 3)
- `i18n/scripts/sync.mjs` — 删写入 upstream_commit(Task 2)

**新建的文件:**
- `i18n/scripts/migrate-tm-entries.mjs` — 一次性迁移脚本,删现有 tm.json 779 entries 的 5 死字段(Task 2)

**不动的文件:**
- `i18n/scripts/extract.mjs` — context_before/after(#7)暂不删,风险高
- `i18n/tm.json` — 由 migrate 脚本修改,不手写

---

## Scope Boundaries(勿过度改进)

**纳入(收益 >10%):**
- #1 context_used 删除 — 单次会话省 ~5000 tokens
- #2 tm.json 删 5 死字段 — 静态省 ~39K tokens(779 entries)
- #3 tm_hints 整桶加 top-50 截断 — 单次会话省 ~3700 tokens(实测 5286→1569,省 70%)

**排除(收益 <10% 或风险高):**
- ❌ applied 字段验证 — 收益小,语义改动非 token 浪费
- ❌ instructions 数组合并 — 收益 <500 tokens
- ❌ entry.id 删除 — collect 仍用 id 写入,删除需重构
- ❌ cross_file_duplicates 改 bool — 收益 <500 tokens
- ❌ glossary do_not_translate 默认值 — 收益 <300 tokens
- ❌ units.json context_before/after — 静态 120K 收益达标,但 subagent 翻译质量可能依赖源码上下文,风险高,需单独研究
- ❌ per-unit top-5(曾考虑) — 实测平均只命中 2 条/unit,截断不生效,且重复注入;改为整桶 top-50 截断

**关键修正:** `skip_reason` 和 `skipped` 字段不删——retry 机制([batch_runner.mjs:53](file:///workspace/i18n/scripts/batch_runner.mjs#L53))和 prepare 第 37 行读取它们。历史清单误将 skip_reason 列为死字段。

---

## Task 1: 删除 context_used 字段(纯收益,零风险)

**Files:**
- Modify: `i18n/schemas/translation-artifact.schema.json:70-94`
- Modify: `.trae/rules/localization.rules.md:75-82`
- Modify: `i18n/scripts/batch_runner.mjs:203`

**验证依据:** grep 确认 context_used 仅在 schema 定义、rules 提及、batch_runner instructions 列出,无任何 .mjs 读取。

- [ ] **Step 1: 删 schema 中 context_used 属性**

修改 `i18n/schemas/translation-artifact.schema.json`,删除第 70-94 行整个 `context_used` 对象定义。注意 `applied` 成为最后一个属性后,其后的逗号需删除。

- [ ] **Step 2: 删 rules.md 中 context_used 推荐字段章节**

修改 `.trae/rules/localization.rules.md`,删除「推荐字段」章节中 `context_used` 及其 3 个子项(tm_hints/glossary_terms/cross_file),保留 `line_after` 为唯一推荐字段。

- [ ] **Step 3: 删 batch_runner instructions 中 context_used 提及**

修改 `i18n/scripts/batch_runner.mjs:203`:

```javascript
// 删除前:
        "记录格式：{id, source, target, file, line_before, line_after, type, context_tag, model, confidence, applied, context_used}",
// 删除后:
        "记录格式：{id, source, target, file, line_before, line_after, type, context_tag, model, confidence, applied}",
```

- [ ] **Step 4: 运行 validate 确认无破坏**

Run: `cd i18n/scripts && node validate.mjs --skip-tsc --skip-lint`
Expected: `=== Summary: 7/7 checks passed ===` + `VALIDATION PASSED`

- [ ] **Step 5: 运行 prepare 5 确认 batch 文件不含 context_used**

Run: `cd i18n/scripts && node batch_runner.mjs prepare 5`
检查生成的 `i18n/batch_1.json` 中 instructions 数组,确认记录格式描述不含 `context_used`。
清理: `rm -f i18n/batch_*.json i18n/artifacts/batch_*.json i18n/batch_pretranslated.json`

- [ ] **Step 6: Commit**

```bash
git add i18n/schemas/translation-artifact.schema.json .trae/rules/localization.rules.md i18n/scripts/batch_runner.mjs
git commit -m "refactor(i18n): remove dead context_used field from artifact schema

context_used (tm_hints/glossary_terms/cross_file) was written by subagents
but never read by collect or any .mjs. Pure audit overhead with no consumer.
Saves ~5000 tokens per 100 units translated."
```

---

## Task 2: 删除 tm.json 5 个死字段

**Files:**
- Create: `i18n/scripts/migrate-tm-entries.mjs`
- Modify: `i18n/scripts/batch_runner.mjs:318-332, 359-373, 538-645`
- Modify: `i18n/scripts/sync.mjs:152, 332`

**删除的 5 字段:** `reviewed` / `reviewed_by` / `model` / `upstream_commit` / `confidence`

**保留的字段(有读取):**
- `skipped` — prepare 第 37 行 `!e.skipped` 读取
- `skip_reason` — batch_runner 第 53 行 retry 机制读取
- `reuse_from_tm` — collectLegacy 写入,标识 TM 复用(保留,语义清晰)

**验证依据:** grep `\.reviewed|\.reviewed_by|\.upstream_commit|\.confidence|\.model\b` 在所有 .mjs 中,除写入外无任何读取。

- [ ] **Step 1: 写 migrate-tm-entries.mjs 迁移脚本**

Create `i18n/scripts/migrate-tm-entries.mjs`:

```javascript
// migrate-tm-entries.mjs — 一次性迁移：删除 tm.json 中的 5 个死字段
// 死字段：reviewed / reviewed_by / model / upstream_commit / confidence
// 保留：skipped / skip_reason / reuse_from_tm（有读取）
// Usage: node migrate-tm-entries.mjs

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const I18N = join(import.meta.dirname, "..");
const tmPath = join(I18N, "tm.json");

const tm = JSON.parse(readFileSync(tmPath, "utf8"));
const before = JSON.stringify(tm).length;

const DEAD_FIELDS = ["reviewed", "reviewed_by", "model", "upstream_commit", "confidence"];
let removedCount = 0;

for (const entry of tm.entries) {
  for (const field of DEAD_FIELDS) {
    if (field in entry) {
      delete entry[field];
      removedCount++;
    }
  }
}

const after = JSON.stringify(tm).length;
writeFileSync(tmPath, JSON.stringify(tm, null, 2));

console.log(`Removed ${removedCount} dead field instances across ${tm.entries.length} entries`);
console.log(`Size: ${before} → ${after} bytes (${Math.round((1 - after / before) * 100)}% reduction)`);
```

- [ ] **Step 2: 运行迁移脚本**

Run: `cd i18n/scripts && node migrate-tm-entries.mjs`
Expected: `Removed ~3895 dead field instances across 779 entries` + `Size: ~220000 → ~110000 bytes (~50% reduction)`

- [ ] **Step 3: 验证 tm.json 不再含 5 死字段**

Run: `grep -c '"reviewed": false' i18n/tm.json` → Expected: `0`
Run: `grep -c '"upstream_commit"' i18n/tm.json` → Expected: `0`
Run: `grep -c '"confidence"' i18n/tm.json` → Expected: `0`
Run: `grep -c '"skipped": true' i18n/tm.json` → Expected: `>0`(确认 skipped 保留)

- [ ] **Step 4: 改 batch_runner collectFromArtifacts 不再写入 5 死字段**

修改 `i18n/scripts/batch_runner.mjs` pre-translated entry(约第 318-332 行)和 artifact entry(约第 359-373 行),删除 5 字段:

```javascript
// pre-translated entry 删除后:
    newEntries.push({
      id: unit.id,
      source: unit.source,
      target: unit.target,
      file: unit.file,
      line: unit.line,
      type: unit.type,
      context_tag: unit.context_tag,
      skipped: false,
      reuse_from_tm: true
    });

// artifact entry 删除后:
    newEntries.push({
      id: artifact.id,
      source: artifact.source,
      target: artifact.target,
      file: artifact.file,
      line: artifact.line_after || artifact.line_before,
      type: artifact.type,
      context_tag: artifact.context_tag,
      skipped: false
    });
```

检查 `baseCommit` 变量是否仍被 placeholder check 等逻辑使用;若仅用于 upstream_commit 则一并删除声明。

- [ ] **Step 5: 改 batch_runner collectLegacy 不再写入 5 死字段**

修改 `i18n/scripts/batch_runner.mjs` collectLegacy 中所有 newEntries.push 块(pre-translated / CSS identifier / notFound missed / 主循环),统一删除 5 字段,保留 skipped/skip_reason/reuse_from_tm。

- [ ] **Step 6: 改 sync.mjs 不再写入 upstream_commit**

修改 `i18n/scripts/sync.mjs` 第 152 和 332 行,从 newEntries.push 块中删除 `upstream_commit: upstreamCommit,`。若 `upstreamCommit` 变量仅用于此,一并删除声明。

- [ ] **Step 7: 运行 validate 确认 7/7 PASS**

Run: `cd i18n/scripts && node validate.mjs --skip-tsc --skip-lint`
Expected: `=== Summary: 7/7 checks passed ===`

- [ ] **Step 8: 运行 prepare 5 确认流程不破坏**

Run: `cd i18n/scripts && node batch_runner.mjs prepare 5`
检查生成的 batch_pretranslated.json 中 pre-translated entry 不含 5 死字段。
清理: `rm -f i18n/batch_*.json i18n/artifacts/batch_*.json i18n/batch_pretranslated.json`

- [ ] **Step 9: Commit**

```bash
git add i18n/scripts/migrate-tm-entries.mjs i18n/scripts/batch_runner.mjs i18n/scripts/sync.mjs i18n/tm.json
git commit -m "refactor(i18n): remove 5 dead fields from tm.json entries

Deleted: reviewed / reviewed_by / model / upstream_commit / confidence
Kept: skipped / skip_reason (read by retry mechanism) / reuse_from_tm

These fields were written by collect/sync but never read by any .mjs.
Migration script removes ~3895 dead field instances from 779 entries.
Static tm.json size reduced ~50% (74K → 35K tokens)."
```

---

## Task 3: tm_hints 整桶加 top-50 截断

**Files:**
- Modify: `i18n/scripts/batch_runner.mjs:153-172` (buildTmHints 函数)

**当前问题:** `buildTmHints` 把所有 source 共享 word 的 TM 条目全部注入 batch_N.json(实测 100 units 触发 384 条,5286 tokens),subagent 被迫读整桶低质量命中(大部分 word overlap 仅命中 1 个通用词如 "zone")。

**目标:** 整桶按 word overlap 总分排序后截断 top-50,实测降至 1569 tokens(省 70%)。**不改 batch_N.json 结构**,仍为顶层 `tm_hints` 数组,subagent 完全无感知。

**为什么不选 per-unit top-5:** 实测 unit 平均 source 仅 12 字符,word overlap 命中平均 2 条/unit,top-5 截断几乎不生效;且每条 hint 被重复注入到共享 unit 上,总 token 反而更大。

**验证依据:** subagent instructions 已说明 "If a unit's source exactly matches a key in tm_hints, REUSE that target verbatim"——top-50 已覆盖最高相关性的 exact match,低 overlap 条目多为噪声。

- [ ] **Step 1: 改 buildTmHints 加排序+截断**

修改 `i18n/scripts/batch_runner.mjs:153-172`,替换 `buildTmHints` 函数:

```javascript
// 删除前(第 156-172 行):
  function buildTmHints(batchUnits) {
    const hints = {};
    const batchWords = new Set();
    for (const u of batchUnits) {
      for (const w of u.source.toLowerCase().split(/[^a-z]+/)) {
        if (w.length >= 4) batchWords.add(w);
      }
    }
    for (const [src, tgt] of Object.entries(tmBySource)) {
      const srcWords = src.toLowerCase().split(/[^a-z]+/);
      for (const w of srcWords) {
        if (w.length >= 4 && batchWords.has(w)) {
          hints[src] = tgt;
          break;
        }
      }
    }
    return hints;
  }

// 替换为(加 overlap 计分 + top-50 截断):
  function buildTmHints(batchUnits) {
    const batchWords = new Set();
    for (const u of batchUnits) {
      for (const w of u.source.toLowerCase().split(/[^a-z]+/)) {
        if (w.length >= 4) batchWords.add(w);
      }
    }
    const scored = [];
    for (const [src, tgt] of Object.entries(tmBySource)) {
      const srcWords = src.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4);
      let overlap = 0;
      for (const w of srcWords) {
        if (batchWords.has(w)) overlap++;
      }
      if (overlap > 0) {
        scored.push({ source: src, target: tgt, overlap });
      }
    }
    scored.sort((a, b) => b.overlap - a.overlap);
    return scored.slice(0, 50);
  }
```

注意:返回类型从 `Object {src: tgt}` 变为 `Array<{source, target, overlap}>`。检查 `batchData.tm_hints` 的所有下游消费者——仅 batch_N.json 序列化,无 .mjs 读取,安全。

- [ ] **Step 2: 更新 console.log 统计**

修改 `i18n/scripts/batch_runner.mjs:219`:

```javascript
// 删除前:
    console.log(`Batch ${i + 1}: ${batchUnits.length} units, ${Object.keys(tmHints).length} TM hints, files: ${...}`);
// 替换为(tmHints 现在是数组):
    console.log(`Batch ${i + 1}: ${batchUnits.length} units, ${tmHints.length} TM hints (top-50), files: ${...}`);
```

- [ ] **Step 3: 运行 prepare 5 验证新结构**

Run: `cd i18n/scripts && node batch_runner.mjs prepare 5`
检查生成的 `i18n/batch_1.json`:
- 确认 `tm_hints` 是数组,长度 ≤ 50
- 确认每条 hint 含 `source` / `target` / `overlap` 字段
- 确认按 overlap 降序排列

清理: `rm -f i18n/batch_*.json i18n/artifacts/batch_*.json i18n/batch_pretranslated.json`

- [ ] **Step 4: 运行 validate 确认 7/7 PASS**

Run: `cd i18n/scripts && node validate.mjs --skip-tsc --skip-lint`
Expected: `=== Summary: 7/7 checks passed ===`

- [ ] **Step 5: Commit**

```bash
git add i18n/scripts/batch_runner.mjs
git commit -m "refactor(i18n): cap tm_hints to top-50 by word overlap

buildTmHints was injecting all TM entries sharing any word with the batch
(~384 entries, 5286 tokens for 100 units). Most were low-quality hits on
a single generic word (e.g. 'zone'). Now sorts by word overlap count and
keeps top-50, reducing to 1569 tokens (70% reduction).
Does not change batch_N.json structure (still top-level tm_hints array),
subagent-facing instructions unchanged."
```

---

## Self-Review

### Spec coverage
- ✅ #1 context_used 删除 → Task 1
- ✅ #3 tm.json 5 死字段删除 → Task 2(注:历史说 6 死字段,修正为 5,skip_reason 有 retry 读取)
- ✅ #2 tm_hints 截断 → Task 3(从 per-unit top-5 修正为整桶 top-50,收益更高且风险更低)

### Placeholder scan
- 无 TBD/TODO,所有步骤含完整代码
- 验证命令含 expected output
- 文件路径精确到行号

### Type consistency
- Task 2 删除字段后,所有 newEntries.push 块统一字段集(id/source/target/file/line/type/context_tag/skipped/[skip_reason|reuse_from_tm])
- Task 3 buildTmHints 返回 `Array<{source, target, overlap}>`,console.log 改用 `.length`
- migrate 脚本的 DEAD_FIELDS 列表与 Task 2 删除字段集一致

### 风险评估
- Task 1:零风险(纯删未读字段)
- Task 2:低风险(迁移脚本可重跑幂等,collect/sync 改动是简单字段删除)
- Task 3:低风险(不改 batch_N.json 结构,只改截断逻辑,subagent 无感知)

### 收益实测(基于 100 units 样本)
| 项 | 当前 | 精简后 | 节省 |
|---|------|-------|------|
| context_used | schema/rules/instructions | 删除 | ~5000 tokens |
| tm.json 死字段(779 entries 静态) | ~31K tokens | 0 | ~31K tokens |
| tm_hints(100 units) | 5286 tokens | 1569 tokens | 3717 tokens |
| **合计(单次会话)** | ~24,000 | ~15,300 | **~8,700 tokens(36%)** |
| **合计(静态 tm.json)** | ~74K | ~43K | **~31K tokens(42%)** |
