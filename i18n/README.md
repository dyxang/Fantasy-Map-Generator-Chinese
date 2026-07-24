# Fantasy Map Generator 汉化工具

## 目录结构

```
i18n/
├── CONTEXT.md           # 项目背景与翻译原则
├── glossary.json        # 术语表（英文 → 中文映射）
├── tm.json              # 翻译记忆库（已翻译条目）
├── divergence.json      # 定制差异保护清单（不跟随上游的片段）
├── progress.json        # 跨会话进度追踪
├── base_commit.txt      # 上游基准 commit SHA
├── units.json           # 提取的翻译单元清单（extract 生成）
├── pending.json         # 上游删除字符串的中转区（sync-finalize 维护）
├── manual-marks.json    # AI 标注的脚本提取盲区（兜底 subagent 维护）
└── scripts/
    ├── extract.mjs      # 从 HTML/TS/JS 提取可翻译字符串
    ├── batch_runner.mjs # 批量翻译 prepare/collect 流程
    ├── replay-apply.mjs # TM Replay：用 tm.json 把翻译覆盖到 master 文件
    ├── sync-analyze.mjs # 分析上游改动，按 80 行阈值分 lane
    ├── sync-collect.mjs # 合并同步期间的翻译产出到 tm.json
    ├── sync-finalize.mjs # 同步收尾：清理 pending、更新 base_commit
    ├── validate.mjs     # 验证翻译完整性（占位符/HTML/TS/lint）
    └── package.json     # 脚本依赖
```

## 快速开始

### 1. 安装脚本依赖

```bash
cd i18n/scripts && npm install
```

### 2. 提取翻译单元

```bash
node i18n/scripts/extract.mjs
```

输出 `i18n/units.json`，包含所有可翻译的字符串。

### 3. 翻译工作流

按 `.trae/rules/localization.rules.md` 执行。批量化流程用 `batch_runner.mjs`：

```bash
node i18n/scripts/batch_runner.mjs prepare <N>   # 生成 batch_N.json + artifacts 占位
# 派 subagent 翻译 batch_N.json，产出 i18n/artifacts/batch_N.json sidecar
node i18n/scripts/batch_runner.mjs collect       # 合并 sidecar 到 tm.json/progress.json
```

### 4. 验证

```bash
# 完整验证（含 TS 编译和 lint）
node i18n/scripts/validate.mjs

# 跳过 TS 编译和 lint（快速检查）
node i18n/scripts/validate.mjs --skip-tsc --skip-lint

# 检查术语表一致性
node i18n/scripts/validate.mjs --check-consistency
```

### 5. 上游同步（master 更新后）

完整流程见 `.claude/artifacts/designs/sync-tools-design.md`，简要步骤：

```bash
# 1. 更新本仓库的 master 分支
git fetch upstream
git checkout master && git merge upstream/master && git checkout zh-CN

# 2. 分析改动（按 80 行阈值分 lane，输出 sync-report.json）
node i18n/scripts/sync-analyze.mjs

# 3. 代码同步阶段
#    Lane-A（≤80 行改动）：git merge master，AI 解冲突
#    Lane-B（>80 行改动）：git checkout master -- <files> && node i18n/scripts/replay-apply.mjs --files <...>

# 4. 翻译未命中的字符串（AI/subagent）

# 5. 合并翻译产出
node i18n/scripts/sync-collect.mjs

# 6. 收尾：清理 pending、更新 base_commit
node i18n/scripts/sync-finalize.mjs
```

工具职责见 `.claude/artifacts/designs/sync-tools-design.md`。

## 翻译单元类型

| type | 说明 | 来源 |
|------|------|------|
| `html_text` | HTML 文本节点 | src/index.html |
| `html_attr` | HTML 属性值 (title, placeholder, aria-label, alt, data-tip, data-info) | src/index.html |
| `ts_string` | TS/JS 字符串字面量 | src/**/*.ts, src/**/*.js, public/modules/**/*.js |

## 验证检查项

1. **占位符完整性** — `{{xxx}}` `<%xxx%>` `${xxx}` `%s` 数量与基准一致
2. **HTML 结构完整性** — 标签数量与基准一致
3. **TS 编译** — `npx tsc --noEmit` 通过
4. **Biome lint** — `npm run lint` 通过
5. **TM 一致性** — 同一 source 不应有多个不同 target（除非 context_tag 不同）
6. **未译检查** — 统计已译/未译比例

进度与 TM 状态以 `i18n/progress.json` 和 `i18n/tm.json` 为准。
