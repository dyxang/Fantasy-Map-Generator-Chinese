# Azgaar Fantasy Map Generator 单人 AI 汉化方案

> ⚠️ **本文档为初始规划，已过期，仅供参考。** 当前生效的实现以 `.trae/rules/localization.rules.md`、`i18n/CONTEXT.md`、`.trae/specs/`、`.claude/artifacts/designs/` 中的细粒度文档为准。本文档中的方案细节、文件结构、流程描述可能与实际实现不符。

## Summary

为 [Azgaar/Fantasy-Map-Generator](https://github.com/Azgaar/Fantasy-Map-Generator) 建立可持续的单人 AI 汉化工作流。核心痛点：硬编码字符散落在 638KB 巨型 HTML 和 TS 数据文件中；项目处于 vanilla JS → TS + Vite 迁移期；需要让 AI 跨会话维持上下文持续翻译；要持续跟随上游版本演进。

**推荐路线：硬编码覆盖 + 翻译记忆库 + 三方对齐**。不引入 i18n 框架，因为作者明确表态不做多语言、项目还在重构期、单人维护大改架构不现实。

---

## Current State Analysis（基于远程探索）

### 项目技术栈
- **版本**：v1.135.2（master），最新 release v1.124
- **构建**：Vite 8.0.16 + TypeScript 5.9.3
- **Lint**：Biome 2.4.6（pre-commit hook 强制）
- **测试**：Vitest 4.0.18 + Playwright 1.57
- **入口**：`src/index.html` → Vite 编译
- **依赖**：d3、delaunator、driver.js（UI Tour）、three（3D 视图）、polylabel、lineclip、alea

### 文件构成（用户提供的比例对应到实际位置）
| 比例 | 实际位置 | 翻译相关性 |
|------|---------|----------|
| HTML 56.7% | `src/index.html`（**638KB / ~1万+行**） | **翻译主战场**，所有 UI 文本硬编码 |
| TS 35.6% | `src/{components,controllers,data,generators,renderers,services,utils,types}/` | 数据文件含英文名（如 `heightmap-templates.ts` 的 `name: "Volcano"`），动态生成的 alert/confirm 文本 |
| JS 7% | 旧 vanilla 文件，迁移期残留 | 同 TS，含动态字符串 |
| Other 0.7% | 配置、JSON 资源 | 一般不需翻译 |

### 关键观察
1. **`src/index.html` 是单一巨型 UI 文件**，含所有面板、对话框、选项卡的 HTML 结构 + 文本 + 内联 SVG。这是 HTML 56.7% 的来源，也是 AI 上下文管理的最大挑战。
2. **TS 数据文件中的 `name` 字段**（如 `heightmapTemplates`、`view-3d-options`、`supporters`）是翻译目标，但又是数据不是 UI 文本，需单独处理。
3. **项目处于迁移期**：TS 文件大量使用 `window.xxx = xxx` 做 legacy 兼容（见 `heightmap-templates.ts` 末尾），意味着文件结构会持续变动。
4. **无 i18n 框架**：所有字符串硬编码，无 `t()` 调用、无 `data-i18n` 属性。
5. **已有汉化历史**：dyxang/Fantasy-Map-Generator-Chinese 是手动硬编码替换版，但版本停留在 v1.8，远落后于当前 v1.135。可作术语参考但不直接复用（结构差异太大）。
6. **作者明确不打算做多语言**（搜索结果证实），所以不能 PR 回主仓库，必须独立 fork 维护。

### 用户痛点对应
| 用户痛点 | 实际成因 | 方案应对 |
|---------|---------|---------|
| 硬编码字符 | HTML + TS 直写英文 | 提取脚本扫描所有硬编码 → 翻译 → 写回 |
| Vite 迁移期上下文管理 | 文件结构会变 | base commit 指针 + TM 按内容 hash 索引（不按路径） |
| AI 持续翻译 | 单会话上下文有限 | 滑动窗口 + 进度文件 + Rules 注入 |

---

## Decisions

| 决策点 | 选择 | 理由 |
|-------|------|------|
| 翻译路线 | 硬编码覆盖 | 不破坏项目结构、不与作者重构冲突、单人可承担 |
| 是否引入 i18n 框架 | **不引入** | 作者明确拒绝多语言、638KB HTML 改造工作量过大、迁移期重复改造 |
| 增量策略 | TM + three-way diff | base..upstream 对比，只译变更单元 |
| 上下文持续 | 进度文件 + Rules + 滑动窗口 | 不依赖会话记忆 |
| 目标语言 | zh-CN（简体中文） | 用户指定 |
| 仓库形态 | fork Azgaar/Fantasy-Map-Generator | 标准做法，方便 pull 上游 |
| AI IDE | Trae（当前环境） | 用户在用 |

---

## Proposed Changes

### 阶段 1：仓库初始化

**操作**：
1. 在 GitHub fork `Azgaar/Fantasy-Map-Generator` 到用户账号
2. clone fork 到 `/workspace/Fantasy-Map-Generator`
3. 添加 upstream 远程：`git remote add upstream https://github.com/Azgaar/Fantasy-Map-Generator.git`
4. 记录当前 base commit：`git rev-parse HEAD > i18n/base_commit.txt`
5. 创建汉化工作分支：`git checkout -b zh-CN`

**目的**：建立可追溯的版本基线，base commit 是三方对齐的锚点。

---

### 阶段 2：上下文资产层

在 `i18n/` 目录下创建以下文件（**这是 AI 的"外部记忆"，跨会话持续存在**）：

#### `i18n/CONTEXT.md` — 项目背景与翻译原则
内容应包含：
- 项目介绍（一句话）：奇幻地图生成器，面向小说作家、跑团玩家、制图师
- 读者画像：跑团玩家、奇幻小说作者、DnD 爱好者
- 翻译原则：
  - 术语偏向 DnD/奇幻文学通行译法（如 Burg → 城镇，Burgs 保留单复数不译）
  - UI 按钮文案 ≤4 字，长描述用完整句
  - 数字/单位/坐标/百分比不译
  - 人名、地名生成器产物不译（动态生成）
  - 品牌名 Azgaar 不译
- 与原版的故意差异（如有）：占位

#### `i18n/glossary.json` — 术语表
```json
{
  "version": 1,
  "locale": "zh-CN",
  "terms": [
    {"en": "Burg", "zh": "城镇", "context": "settlement", "do_not_translate": false},
    {"en": "Province", "zh": "省份", "context": "administrative", "do_not_translate": false},
    {"en": "Culture", "zh": "文化", "context": "demographic", "do_not_translate": false},
    {"en": "Religion", "zh": "宗教", "context": "demographic", "do_not_translate": false},
    {"en": "Heightmap", "zh": "高度图", "context": "terrain", "do_not_translate": false},
    {"en": "Biome", "zh": "生物群系", "context": "terrain", "do_not_translate": false},
    {"en": "Azgaar", "zh": "Azgaar", "context": "brand", "do_not_translate": true}
  ]
}
```
初始术语在翻译过程中逐步补充，每会话结束强制更新。

#### `i18n/tm.json` — 翻译记忆（核心）
```json
{
  "version": 1,
  "locale": "zh-CN",
  "entries": [
    {
      "id": "sha256:abc123...",
      "source": "Generate new map",
      "target": "生成新地图",
      "file": "src/index.html",
      "line": 1234,
      "type": "html_text",
      "context_tag": "button",
      "reviewed": false,
      "reviewed_by": null,
      "model": "claude-sonnet-4-6",
      "upstream_commit": "fa5016a...",
      "confidence": 0.95
    }
  ]
}
```
**关键设计**：
- `id` 用 source 文本 SHA-256（不按路径），文件移动/重命名仍能命中
- `context_tag` 区分 button / label / tooltip / heading，同一英文在不同上下文可有不同译法
- `upstream_commit` 记录翻译时所基于的上游版本，便于判断是否需重译
- `confidence` < 0.8 的不作为后续上下文注入

#### `i18n/divergence.json` — 定制差异保护清单
```json
{
  "version": 1,
  "entries": [
    {
      "anchor_text": "原版英文片段",
      "current_translation": "当前汉化版译文",
      "reason": "保留原因（如：产品决策/风格选择）",
      "file": "src/index.html",
      "line_range": [1234, 1240],
      "do_not_follow_upstream": true
    }
  ]
}
```
命中规则：上游 diff 中若变更单元包含 `anchor_text`，脚本自动跳过 + 报警。

#### `i18n/progress.json` — 跨会话进度
```json
{
  "task": "initial_translation",
  "phase": "extraction | translation | review | sync",
  "last_processed_id": "sha256:abc123...",
  "last_file": "src/index.html",
  "last_line": 4567,
  "completed_units": 1234,
  "total_units": 5000,
  "session_history": [
    {"date": "2026-07-23", "units": 50, "end_id": "sha256:xxx", "notes": "选项面板"}
  ]
}
```

#### `i18n/base_commit.txt` — 上游基准指针
单行文件，存当前 base commit SHA。每次完成一轮同步后更新。

---

### 阶段 3：Trae Rules（核心，AI 的常驻记忆）

**文件**：`.trae/rules/localization.rules.md`

内容大纲：
```markdown
# Fantasy Map Generator 汉化规则

## 会话开始时
1. 读 i18n/progress.json 获取上次进度
2. 读 i18n/CONTEXT.md 了解项目背景与原则
3. 读 i18n/glossary.json 拿术语表
4. 读 i18n/tm.json 的最近 20 条译文作风格锚点

## 翻译单元处理
- 每会话处理 30-50 个单元（见 i18n/progress.json 的 last_processed_id 之后）
- 每个单元注入：source + 前后 3 个单元上下文 + TM 相似条目 top-5 + glossary 相关项
- 输出格式：直接 Edit 原文件 + 在 tm.json 追加条目

## 硬约束
- 占位符 {{xxx}} <%xxx%> ${xxx} 必须原样保留
- HTML 标签结构、属性名、id、class 不得改动（只能改文本节点和 title/placeholder/aria-label/alt 属性值）
- TS 字符串字面量只改内容，不改引号类型和转义
- 不译内容：变量名、函数名、CSS 类名、SVG 路径数据、数字、单位
- divergence.json 中的 anchor_text 命中即跳过

## 会话结束前
- 更新 i18n/progress.json 的 last_processed_id 和 completed_units
- 追加本次翻译到 i18n/tm.json
- 若发现新术语，追加到 i18n/glossary.json
- 输出"剩余 N 个单元，建议下次开新会话"

## 上下文窗口策略
- 单次 Read 不超过 2000 行
- 处理 src/index.html 时按 section 切片（每个对话框/选项卡一个 section）
- 若上下文接近上限，主动结束会话前 flush 进度
```

---

### 阶段 4：提取脚本

**文件**：`i18n/scripts/extract.mjs`（Node ES Module，依赖零）

**输入**：项目根目录
**输出**：`i18n/units.json`

**功能**：
1. 解析 `src/index.html`
   - 提取所有文本节点（去除空白后非空的）
   - 提取属性：`title`、`placeholder`、`aria-label`、`alt`、`data-tip`、`data-info`
   - 跳过：`<script>`、`<style>` 内容
   - 每个单元记录：file、line、col、type、source、context_before(前 3 行)、context_after(后 3 行)
2. 扫描 `src/**/*.ts` 和 `src/**/*.js`
   - 用 AST（`acorn` 或简单正则）提取字符串字面量
   - 重点字段：`name:`、`title:`、`label:`、`description:`、`tip:`、`placeholder:`
   - 跳过：`import`、`require`、URL、文件路径、CSS 选择器
3. 为每个单元生成 id = SHA-256(source + context_before)
4. 输出 `units.json`，结构同 `tm.json` 但无 target

**伪代码**：
```javascript
// extract.mjs
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { parse } from 'parse5';  // HTML 解析

const html = readFileSync('src/index.html', 'utf8');
const units = [];

// HTML 文本节点
const document = parse(html, { sourceCodeLocationInfo: true });
walk(document, node => {
  if (node.nodeName === '#text') {
    const text = node.value.trim();
    if (text && /[a-zA-Z]/.test(text) && !isJustNumberOrSymbol(text)) {
      units.push({
        id: hash(text),
        file: 'src/index.html',
        line: node.sourceCodeLocation.startLine,
        type: 'html_text',
        source: text,
        context_before: getLines(html, node.sourceCodeLocation.startLine - 3, 3),
        context_after: getLines(html, node.sourceCodeLocation.startLine + 1, 3)
      });
    }
  }
  // 处理 title/placeholder/aria-label/alt 属性
});

// TS 文件字符串字面量
// 用正则 + 简单 AST 识别 name: "xxx" 模式
// ...

writeFileSync('i18n/units.json', JSON.stringify({units}, null, 2));
```

**预期产出**：~3000-5000 个翻译单元（基于 638KB HTML 估算）。

---

### 阶段 5：同步脚本

**文件**：`i18n/scripts/sync.mjs`

**输入**：base commit（来自 `i18n/base_commit.txt`）、upstream/master
**输出**：`i18n/pending.json`（待译单元清单）

**功能**：
1. `git fetch upstream`
2. `git diff <base>..upstream/master --stat` 拿到变更文件列表
3. 对每个变更文件 `git diff <base>..upstream/master -- <file>`
4. 用 `diff-match-patch` 库做行级 diff
5. 对每个变更块：
   - **新增行**：在 units.json 中找匹配单元，标记为 `added`
   - **删除行**：在 TM 中标记对应条目为 `obsolete`
   - **修改行**：判断是否语义变更（用 `RapidFuzz` 相似度 > 0.85 视为非语义变更，跳过；否则标记 `changed`）
6. 过滤 `divergence.json`：命中 `anchor_text` 的变更块标记 `skip`
7. 输出 `pending.json`：
```json
{
  "synced_at": "2026-07-23",
  "base_commit": "fa5016a...",
  "upstream_commit": "abc1234...",
  "pending_units": [
    {"id": "...", "action": "translate | retranslate | skip | delete", "reason": "..."}
  ]
}
```

---

### 阶段 6：验证脚本

**文件**：`i18n/scripts/validate.mjs`

**功能**（pre-commit hook 调用）：
1. **占位符完整性**：对比 base 和当前文件，确保 `{{xxx}}`、`<%xxx%>`、`${xxx}`、`%s` 数量一致
2. **HTML 结构完整性**：用 `parse5` 解析翻译后 HTML，对比 base 的 DOM 树，标签数量/层级应一致
3. **TS 编译**：`npx tsc --noEmit` 不报错（确保没破坏字符串语法）
4. **Biome lint**：`npm run lint` 通过
5. **中文残留英文检查**：UI 文本区域不应有未译英文（白名单：品牌名、术语保留词）
6. **TM 一致性**：同一 source 在 TM 中不应有多个不同 target（除非 context_tag 不同）

失败时阻止 commit，输出报告。

---

### 阶段 7：翻译工作流（实际操作步骤）

#### 7.1 首次全量翻译

**步骤**：
1. 跑 `node i18n/scripts/extract.mjs`，生成 `units.json`
2. 在 Trae 开新会话，第一句话：
   > 按 .trae/rules/localization.rules.md，从 i18n/units.json 头部开始翻译。
   > 每会话处理 30 个单元，按 Rules 注入上下文。
3. AI 自动：
   - 读 progress.json（首次为空，从头开始）
   - 读 CONTEXT.md + glossary.json + TM 最近 20 条
   - 读 units.json 前 30 条
   - 逐个翻译，Edit 原文件
   - 追加 TM 条目
   - 更新 progress.json
4. 用户在 `npm run dev` 跑起来浏览，校验翻译效果
5. 重复直到 units.json 处理完

**预估**：~5000 单元 / 30 单元每会话 ≈ **170 次会话**。每次会话 30-60 分钟，单人 1-2 个月可完成首次全量。

#### 7.2 增量同步（每次上游更新）

**步骤**：
1. `git fetch upstream`
2. `node i18n/scripts/sync.mjs`
3. 看 `pending.json`：
   - 若 `pending_units.length === 0` → 直接 `git merge upstream/master`，更新 base_commit
   - 否则开新会话：
     > 按 Rules，处理 i18n/pending.json 中的待译单元。
4. 处理完后 `npm run validate`，通过则 `git merge upstream/master` + 更新 base_commit

#### 7.3 术语全局校验

定期（每完成 500 单元或每次同步后）：
1. 跑 `node i18n/scripts/validate.mjs --check-consistency`
2. 扫描 TM 中所有 target，找出同一英文 source 有多种译法的条目
3. 人工决策，更新 glossary.json
4. 跑 `node i18n/scripts/validate.mjs --apply-glossary`，按 glossary 自动统一译法

---

## File Paths（所有要创建/修改的文件）

### 新建（汉化基础设施，不动原项目代码）
- `/workspace/Fantasy-Map-Generator/i18n/CONTEXT.md`
- `/workspace/Fantasy-Map-Generator/i18n/glossary.json`
- `/workspace/Fantasy-Map-Generator/i18n/tm.json`（初始为空 entries 数组）
- `/workspace/Fantasy-Map-Generator/i18n/divergence.json`（初始为空）
- `/workspace/Fantasy-Map-Generator/i18n/progress.json`（初始状态）
- `/workspace/Fantasy-Map-Generator/i18n/base_commit.txt`
- `/workspace/Fantasy-Map-Generator/i18n/units.json`（extract 脚本生成）
- `/workspace/Fantasy-Map-Generator/i18n/pending.json`（sync 脚本生成）
- `/workspace/Fantasy-Map-Generator/i18n/scripts/extract.mjs`
- `/workspace/Fantasy-Map-Generator/i18n/scripts/sync.mjs`
- `/workspace/Fantasy-Map-Generator/i18n/scripts/validate.mjs`
- `/workspace/Fantasy-Map-Generator/i18n/scripts/package.json`（含 parse5、diff-match-patch、rapidfuzz 依赖）
- `/workspace/Fantasy-Map-Generator/.trae/rules/localization.rules.md`

### 修改（汉化过程会动到，但不是本方案直接改）
- `/workspace/Fantasy-Map-Generator/src/index.html`（汉化主战场）
- `/workspace/Fantasy-Map-Generator/src/**/*.ts`（数据文件 name 字段等）
- `/workspace/Fantasy-Map-Generator/src/**/*.js`（少量动态字符串）

### 不动
- `package.json`（不引入 i18n 依赖）
- `vite.config.ts`
- `biome.json`
- 测试文件
- 构建配置

---

## Assumptions & Risks

### 假设
1. 用户有 GitHub 账号可以 fork
2. 用户本地 Node 版本 ≥ 24（项目要求）
3. 用户使用 Trae IDE 进行翻译（不是其他 IDE）
4. 简体中文为目标语言，不需要繁体
5. 上游更新频率：每月 1-2 个 minor 版本（基于 release 历史）

### 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| 上游重构把 `index.html` 拆分成多个组件 | 高（v1.110 Vite 迁移刚发生，未来会继续） | TM 按 content hash 索引，文件拆分后内容仍在 TM 中可命中 |
| 上游引入 i18n 框架 | 低（作者明确拒绝） | 若发生则切换方案，TM 数据可平滑迁移到 i18next JSON |
| 提取脚本漏提动态生成的字符串 | 中 | validate.mjs 的"中文残留英文检查"兜底；翻译过程中人审发现后手动补 |
| 上下文窗口不够装 30 个单元 + 注入 | 低 | 单元平均 50 tokens × 30 = 1500 tokens，加注入约 5K tokens，远低于窗口 |
| 翻译破坏 .map 文件兼容性 | 中 | 不动 .map 序列化逻辑；validate.mjs 的 TS 编译检查兜底 |
| 术语漂移（同一词多种译法） | 高 | 每次同步后跑 glossary 一致性检查 + 自动统一 |
| 单人 1-2 月首次全量太久 | 中 | 可分阶段：先译主菜单和常用选项卡（用户最先看到），罕用面板后译 |
| 上游合并冲突 | 高 | base commit + 三方对齐 + divergence 保护，冲突时优先保留汉化版定制 |

---

## Verification

### 阶段性验证
1. **基础设施搭建后**：
   - `cd /workspace/Fantasy-Map-Generator && npm install` 成功
   - `npm run dev` 浏览器打开看到原版英文界面
   - `node i18n/scripts/extract.mjs` 输出 units.json，单元数 > 1000
   - Trae 启动时自动加载 `.trae/rules/localization.rules.md`

2. **首批 30 单元翻译后**：
   - `npm run dev` 看到对应区域变成中文
   - `npm run lint` 通过
   - `npx tsc --noEmit` 通过
   - `node i18n/scripts/validate.mjs` 全绿
   - tm.json 有 30 条 entries
   - progress.json 的 last_processed_id 指向第 30 个单元

3. **首次同步上游后**：
   - pending.json 正确分类 added/changed/skip/delete
   - divergence.json 命中的单元被正确跳过
   - merge 后 `npm run dev` 不报错

### 持续验证（CI 化，可选）
- GitHub Action 在 PR 时跑 `validate.mjs`
- 阻止破坏占位符或 HTML 结构的 commit

### 完成判定
- units.json 中所有单元都有对应 TM 条目
- `npm run dev` 全界面中文，无残留英文（除白名单）
- `npm test` 全通过
- 上游同步脚本可一键运行，pending.json 可解释
- 至少跑过 3 次上游同步，流程稳定

---

## Implementation Order（执行顺序）

1. **fork + clone + 远程配置**（5 分钟）
2. **创建 `i18n/` 目录结构 + 初始化所有 JSON/MD 文件**（10 分钟）
3. **写 `.trae/rules/localization.rules.md`**（10 分钟）
4. **写 `i18n/scripts/package.json` + 安装依赖**（parse5、diff-match-patch、rapidfuzz）（5 分钟）
5. **写 `extract.mjs`**（30-60 分钟，需测试 HTML 解析覆盖率）
6. **跑 extract.mjs，检查 units.json 单元数和分布**（10 分钟）
7. **写 `validate.mjs`**（20 分钟）
8. **写 `sync.mjs`**（30 分钟，依赖 base_commit 已记录）
9. **首次会话试翻译 30 个单元**（验证 Rules + TM 流程闭环）（30 分钟）
10. **跑 validate.mjs 校验**（5 分钟）
11. **写 README 简要说明工作流**（10 分钟，可选）
12. **commit 基础设施到 zh-CN 分支**（5 分钟）

后续按"翻译 30 → 校验 → 提交"循环，直到全量完成。

---

## Out of Scope（明确不做）

- ❌ 引入 i18next / vue-i18n 等框架
- ❌ 重构 src/index.html 拆分组件
- ❌ PR 回主仓库（作者明确拒绝多语言）
- ❌ 繁体中文支持（用户只要简体）
- ❌ 自动翻译（必须有 AI IDE 在环，人审最终决策）
- ❌ 改动 .map 文件格式或序列化逻辑
- ❌ 部署/CDN 配置（用户自行处理发布）
