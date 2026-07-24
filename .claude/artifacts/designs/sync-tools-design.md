# Sync Tools 设计文档

## 目标

为 zh-CN 翻译分支提供可持续的上游同步能力。每次官方（master）更新后，通过「脚本辅助 + AI 主导」的流程吸收上游变化，已翻译内容用 tm.json replay 复用，新增/修改内容由 AI 翻译，脚本提取盲区由独立 subagent 兜底。

## 核心决策汇总

| # | 决策点 | 选择 |
|---|---|---|
| 1 | 整体路径 | 方案 D（reset + replay） |
| 2 | 同步方式 | 方式 c（混合，80 行阈值） |
| 3 | fallback 机制 | 严格 (file, source) 主 + 全局 source 降级 + AMBIGUOUS 警告 |
| 4 | AMBIGUOUS 复核 | 批量化（按 source 分组，AI 一次决策一组） |
| 5 | 兜底扫描 | 独立 subagent |
| 6 | manual-marks.json | 混合（结构化必填字段 + 自由 note + 脚本定期校验） |
| 7 | 已翻译行被上游修改 | 重新翻译 |
| 8 | 已翻译行被上游删除 | 进 pending 中转区，整次同步完成后清理 |

## 可行性评估结论

- tm.json 的 source 在 master 文件中 100% 可定位（3 个测试文件 195/195 全部命中）
- replay-apply.mjs 不需要字符串提取器，直接遍历 tm.json entries 用 `en.includes(source)` 定位
- 真实指标是「上游字符串变化率」——上游不改则 100% 复用，上游改了字符串则按比例未命中（符合方案 D 设计）
- 字符串提取器的作用是发现新增字符串，归兜底 subagent 处理

## 完整工作流

```
阶段 0：准备
  $ git fetch upstream → 更新本仓库 master
  $ node i18n/scripts/sync-analyze.mjs
    输入: i18n/base_commit.txt + master HEAD
    输出: i18n/sync-report.json
      - 每个改动文件: { file, total_lines, changed_lines, change_type }
      - lane 分类: ≤80 行 → lane_a, >80 行 → lane_b
    打印摘要到 stdout

阶段 1：代码同步
  Lane-A（≤80 行，AI 处理）:
    $ git merge master   # 带冲突，AI 接管解冲突
    AI:
      读 sync-report.json 的 lane_a 文件列表
      对每个冲突文件:
        - 读 master 版本 + zh-CN 当前版本 + diff
        - 解冲突: 保留中文翻译 / 应用上游逻辑改动
        - 翻译新增字符串（严格 (file, source) 查 tm.json 复用）
      输出: 解决后的文件 + 翻译产出

  Lane-B（>80 行，reset + replay）:
    $ git checkout master -- <lane_b 文件列表>
    $ node i18n/scripts/replay-apply.mjs --files <lane_b 文件列表>
      输入: tm.json + lane_b 文件的 master 版本
      逻辑:
        for each file in lane_b:
          en = read(file)
          for each entry in tm.entries where entry.file == file:
            if en.includes(entry.source):
              en = en.replace(entry.source, entry.target)  # 严格匹配命中
              strict_hit++
            else if source_global_match(entry.source):  # 全局降级
              en = en.replace(entry.source, entry.target)
              global_hit++
              ambiguous_warnings.push(...)
            else:
              unmatched.push({ file, source, target })  # 进翻译队列
          write(file, en)
      输出:
        - 修改后的文件（已 replay）
        - i18n/sync-replay-report.json:
          { strict_hit, global_hit, unmatched[], ambiguous[] }
    AI subagent:
      翻译 unmatched 中的字符串
      复核 ambiguous 中的条目（按 source 分组批量决策）

阶段 2：复核与兜底
  AMBIGUOUS 复核 (AI, 批量化):
    读 sync-replay-report.json 的 ambiguous[]
    按 source 分组（同一英文 source 在多文件出现合并）
    AI 一次决策一组: 每个位置用哪个 target
    输出: 决策结果写入 i18n/sync-ambiguous-decisions.json

  兜底扫描 (独立 subagent):
    输入:
      - sync-report.json（受影响文件列表）
      - i18n/manual-marks.json（历史标注的特殊位置）
      - 上述文件的新版本（master / 已 replay）
    工作:
      1. 读 manual-marks.json 每条 mark
         - 用 mark.source + mark.location_hint 在新代码中定位
         - 找到 → 检查是否已翻译/变化 → 翻译
         - 没找到 → 标记 obsolete
      2. 扫描受影响文件找新英文残留
         - 发现脚本漏提取的特殊位置（HTML 跨标签、嵌套模板等）
         - 追加到 manual-marks.json（结构化字段 + note）
         - 翻译
    输出:
      - 翻译产出
      - 更新后的 manual-marks.json

阶段 3：finalize (脚本)
  $ node i18n/scripts/sync-collect.mjs
    合并所有翻译产出 (Lane-A / Lane-B unmatched / AMBIGUOUS 决策 / 兜底) 到 tm.json
  $ node i18n/scripts/sync-finalize.mjs
    - 检查 pending 中转区字符串是否在新位置找到 → 复用
    - 确实没回来的 → 从 tm.json 删除
    - manual-marks.json 维护: obsolete 的 mark → 移到 archived
    - 脚本校验: source 是否仍在文件中
    - 更新 i18n/base_commit.txt = master HEAD
    - 输出同步总结报告
```

## 工具接口设计

### sync-analyze.mjs

**位置**: `i18n/scripts/sync-analyze.mjs`

**调用**: `node sync-analyze.mjs`

**输入**:
- `i18n/base_commit.txt`（当前基线 commit）
- master 分支 HEAD（通过 `git rev-parse master` 获取）

**输出**:
- stdout：人类可读摘要
- `i18n/sync-report.json`:
  ```json
  {
    "base_commit": "51d8e3e...",
    "master_head": "abc1234...",
    "analyzed_at": "2026-07-24T...",
    "files": [
      {
        "file": "src/generators/cultures-generator.ts",
        "total_lines": 1346,
        "changed_lines": 266,
        "change_type": "modified",
        "lane": "b"
      }
    ],
    "summary": {
      "lane_a_count": 68,
      "lane_b_count": 4,
      "total_changed_files": 72
    }
  }
  ```

**lane 分类逻辑**:
- `changed_lines <= 80` → `lane_a`
- `changed_lines > 80` → `lane_b`
- 阈值可在调用时通过 `--threshold <N>` 覆盖

### replay-apply.mjs

**位置**: `i18n/scripts/replay-apply.mjs`

**调用**: `node replay-apply.mjs --files <file1,file2,...>`

**输入**:
- `i18n/tm.json`
- 列表中每个文件的当前内容（master 版本，已被 `git checkout master --` 覆盖）

**输出**:
- 直接修改文件：把命中的英文 source 替换为中文 target
- `i18n/sync-replay-report.json`:
  ```json
  {
    "files_processed": ["src/generators/cultures-generator.ts"],
    "strict_hit": 82,
    "global_hit": 1,
    "unmatched": [
      { "file": "...", "source": "...", "target": null }
    ],
    "ambiguous": [
      {
        "source": "Name",
        "occurrences": [
          { "file": "src/.../a.ts", "candidate_targets": ["名称", "命名"] },
          { "file": "src/.../b.ts", "candidate_targets": ["名称"] }
        ]
      }
    ]
  }
  ```

**匹配逻辑**:
1. 严格匹配：`byFile.get(file + '::' + source)`
2. 严格未命中 → 全局降级：`bySource.get(source)`
3. 全局命中 → 检查 candidate_targets 是否唯一
   - 唯一 → 直接用
   - 多个 → 加入 ambiguous 警告
4. 仍未命中 → 进 unmatched

**替换安全性**:
- 用 `String.replace(source, target)` 仅替换第一个匹配（防止误伤）
- 若同一 source 在文件中出现多次且都需要翻译，需要遍历所有出现位置（按 line 精确定位）
- 后续优化：用 AST 解析做精确替换（v2）

### sync-collect.mjs

**位置**: `i18n/scripts/sync-collect.mjs`

**调用**: `node sync-collect.mjs`

**输入**:
- `i18n/tm.json`（当前）
- Lane-A 产出（AI 写入的文件 + 翻译产出 JSON）
- Lane-B 产出（subagent 的 artifact JSON）
- AMBIGUOUS 决策（`i18n/sync-ambiguous-decisions.json`）
- 兜底 subagent 产出

**输出**:
- 更新 `i18n/tm.json`（新增 entries、更新 target、删除 obsolete）
- 更新 `i18n/progress.json`
- 输出 collect 报告到 stdout

### sync-finalize.mjs

**位置**: `i18n/scripts/sync-finalize.mjs`

**调用**: `node sync-finalize.mjs`

**输入**:
- `i18n/tm.json`
- `i18n/manual-marks.json`
- `i18n/pending.json`（中转区）
- master HEAD

**工作**:
1. 检查 pending 中每条 entry: source 是否在新代码中出现 → 复用 / 删除
2. manual-marks.json: obsolete 的 mark → archived
3. 脚本校验: 每条 mark 的 source 是否仍在 file 中（输出校验报告）
4. 更新 `i18n/base_commit.txt` = master HEAD
5. 生成总结报告 `i18n/sync-summary.md`:
   - 本次同步的文件数
   - replay 命中率
   - 翻译新增数
   - 删除/复用数
   - manual-marks 变化

## manual-marks.json schema

**位置**: `i18n/manual-marks.json`

```json
{
  "version": 1,
  "marks": [
    {
      "id": "manual-001",
      "file": "src/index.html",
      "source": "Azgaar's <em>Fantasy</em> Map Generator",
      "category": "html-cross-tag | template-nested | code-like | complex-encoding | dynamic-concat | other",
      "note": "跨标签 HTML 文本，em 标签需保留",
      "location_hint": "h1 标签内，title 区",
      "base_commit": "51d8e3e",
      "added_at": "2026-07-24",
      "status": "active | obsolete | archived"
    }
  ],
  "archived": []
}
```

**字段说明**:
- `id`: 唯一标识，格式 `manual-NNN`
- `file`: 文件路径
- `source`: 原始字符串内容（可能含 HTML 标签、变量占位符等）
- `category`: 分类，便于统计和模式识别
- `note`: 自由文本，记录为什么特殊、如何处理
- `location_hint`: 人类可读的位置描述（不用行号，行号会漂移）
- `base_commit`: 标注时上游 commit
- `added_at`: 标注日期
- `status`: active=有效，obsolete=本次同步发现已不在，archived=已归档（保留历史）

## 兜底 subagent 工作契约

**输入**:
1. `i18n/sync-report.json`（受影响文件列表）
2. `i18n/manual-marks.json`（历史标注）
3. 受影响文件的新版本内容（subagent 自行读取）

**工作流程**:

```
1. 处理已有 marks:
   for each mark in manual-marks.marks where status == active:
     file_content = read(mark.file)
     if mark.source in file_content:
       # 找到，检查翻译状态
       if 已翻译: skip
       else: 翻译 + 更新 mark.note
     else:
       # 没找到
       mark.status = "obsolete"

2. 扫描受影响文件找新英文残留:
   for each file in sync-report.files:
     content = read(file)
     # 用启发式规则识别"该翻译但脚本漏掉"的位置:
     # - HTML 跨标签文本（<h1>Azgaar's <em>Fantasy</em></h1>）
     # - 动态拼接（"Hello " + name）
     # - 嵌套模板（`${x} of ${y}`）
     # - 看起来像代码但实为字符串的（如 CSS 选择器）
     findings = scan(content, file)
     for each finding in findings:
       translate(finding)
       append to manual-marks.marks (status=active)

3. 输出:
   - 翻译产出（写入对应的 artifact 文件，供 sync-collect 合并）
   - 更新后的 manual-marks.json
```

**输出格式**: 与 batch_runner 的 sidecar artifact 一致，便于 sync-collect 复用

## 边界情况

### 1. 同一 source 在文件中出现多次

- tm.json 中 (file, source) 应唯一，但实际可能有重复
- replay-apply 用 `String.replace` 默认替换第一个，可能漏掉后续
- **处理**: 后续优化用 AST 或按 line 精确定位；初版可接受单次替换（多出现的情况由兜底 subagent 处理）

### 2. 上游重命名文件

- 严格匹配失败（file 字段失效）
- 全局降级匹配命中（source 仍在，只是 file 变了）
- 输出 AMBIGUOUS 警告
- **处理**: AI 复核时识别"file 已重命名"，更新 tm.json 中对应 entry 的 file 字段

### 3. 上游删除文件

- replay-apply 跳过（文件不存在）
- 该文件的所有 tm.json entry 进 pending 中转区
- finalize 检查 pending：未在新位置出现 → 删除
- **处理**: 直接删除 entry，不保留（用户明确要求"单次任务完全翻译完后再删除"）

### 4. 上游重构（拆分/合并文件）

- 严格匹配失败
- 全局降级可能部分命中
- 大量字符串进 unmatched 队列
- **处理**: subagent 翻译 + 兜底扫描识别新位置

### 5. 同步过程中断

- 阶段 1 已 reset 但阶段 2 未完成 → zh-CN 处于半成品状态
- **处理**: sync-report.json + sync-replay-report.json 记录进度，可从断点续做
- **回滚方案**: `git checkout zh-CN -- <files>` 恢复（但会丢失已翻译的新增字符串）

## 与现有工具的关系

| 现有工具 | 复用方式 |
|---|---|
| `batch_runner.mjs` | prepare/collect 逻辑被 sync-collect 复用 |
| `validate.mjs` | 同步完成后运行验证 |
| `tm.json` | 核心数据源，replay-apply 直接使用 |
| `units.json` | 兜底 subagent 可参考，识别待翻译字符串全集 |
| `progress.json` | sync-finalize 更新进度 |
| `base_commit.txt` | sync-analyze 读取，sync-finalize 更新 |

## 不实现的部分（明确边界）

1. **不实现自动 CI 触发**：手动同步（用户决策）
2. **不实现 Overlay 构建期替换**：保留硬编码方案
3. **不实现 AST 精确替换**（v1）：初版用 `String.replace` + 兜底 subagent 补漏
4. **不实现相似度模糊匹配**：用户明确要求严格

## 实现优先级

1. **P0（核心）**:
   - `sync-analyze.mjs`：差异分析 + lane 分类
   - `replay-apply.mjs`：TM Replay 核心
   - `manual-marks.json` 初始结构

2. **P1（必要）**:
   - `sync-collect.mjs`：合并翻译产出
   - `sync-finalize.mjs`：清理 + 更新 base_commit

3. **P2（增强）**:
   - 兜底 subagent 的工作流文档化
   - AMBIGUOUS 批量复核的 AI prompt 模板

## 验收标准

- `sync-analyze.mjs` 在当前 base_commit = master HEAD 时输出空报告（无改动）
- `replay-apply.mjs` 对已翻译文件 reset 后能恢复 100% 中文（上游无变化时）
- `manual-marks.json` schema 通过 JSON schema 校验
- 文档不含实现代码，仅描述接口和流程
