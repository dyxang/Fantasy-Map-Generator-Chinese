---
name: "translation-anchor"
description: "Maintains upstream commit anchor with history for translation sync tracking. Invoke when user says '记录锚点'/'更新进度' or asks '还有哪些没翻译'/'待翻译清单'."
---

# Translation Anchor — 翻译进度锚点管理

维护"翻译基于上游哪个 commit"的锚点记录，方便对比还有哪些上游更新没翻译。

## 与现有翻译工作流的关系（重要）

本项目已有一套同步工具链，本 skill 是它的**人工进度追踪补充**，不替代任何脚本：

- `i18n/base_commit.txt` — **当前锚点 SHA 的真实来源**。由 `i18n/scripts/sync-finalize.mjs` 在每次上游同步完成后自动更新为 master HEAD。本 skill **只读不写**这个文件。
- `.trae/skills/translation-anchor/PROGRESS.md` — 本 skill 维护的**带历史的进度文件**。记录当前锚点 + 历史归档 + 日期说明，弥补 `base_commit.txt` 只有裸 SHA、没有历史和说明的不足。

**联动时机**：每次跑完 `sync-finalize.mjs`（它会把 `base_commit.txt` 推到新 SHA）后，用户应说"更新进度"，本 skill 把旧锚点归档到历史记录，写上新锚点 + 日期 + 说明。

## 进度文件格式

文件路径：`.trae/skills/translation-anchor/PROGRESS.md`

```markdown
# 翻译进度记录

## 当前锚点
- 翻译基于的上游 commit：<40位SHA>（<YYYY-MM-DD>，<一句话说明>）
- 记录时上游最新 commit：<40位SHA>（<YYYY-MM-DD>）

## 历史记录
（每次更新锚点时，把旧的"当前锚点"挪到这里存档，最新的永远在最上面）
- <旧40位SHA>（<日期>）→ 已于 <YYYY-MM-DD> 推进到 <新40位SHA>
```

## 工作流程

### 流程一：用户说"记录锚点"或"更新进度"

1. 先确认上游最新 commit：
   ```bash
   git fetch origin master 2>/dev/null; git log -1 --format="%H %ci" origin/master
   ```
   （若 `origin/master` 不可用，改用 `master` 或 `upstream/master`，视仓库 remote 配置而定）

2. **确认本次翻译追到了哪个 commit**：
   - 优先读 `i18n/base_commit.txt` 拿到当前锚点 SHA（这是 sync-finalize.mjs 写入的，最权威）
   - 如果用户明确说"追到了 XXX"，以用户说的为准
   - **如果用户没说清楚、且 base_commit.txt 与 origin/master HEAD 不一致**，必须问用户："base_commit.txt 里是 `<SHA>`，但上游最新是 `<SHA>`，你这次翻译实际追到哪个 commit？"——不要自己猜

3. 取当前锚点的日期和说明：
   ```bash
   git log -1 --format="%ci" <锚点SHA>
   ```
   说明用一句话（如"对应上游 v1.138 附近"、"sync-finalize 后自动推进"），没把握就留"待补充"。

4. 更新 PROGRESS.md：
   - 把"当前锚点"整段挪到"历史记录"最上方，格式：`- <旧SHA>（<旧日期>）→ 已于 <今天> 推进到 <新SHA>`
   - 写入新的"当前锚点"（翻译基于的 commit + 记录时上游最新 commit）

5. 改完把 PROGRESS.md 内容给用户看一眼确认。

### 流程二：用户问"还有哪些没翻译"或"待翻译清单"

1. 读 `i18n/base_commit.txt` 拿到锚点 SHA（若文件缺失，读 PROGRESS.md 的"当前锚点"）。

2. 取上游最新 SHA：
   ```bash
   git fetch origin master 2>/dev/null; git log -1 --format="%H %ci" origin/master
   ```

3. 列出待翻译提交：
   ```bash
   git log --oneline <锚点SHA>..<最新SHA>
   ```

4. 看动了哪些文件：
   ```bash
   git diff --stat <锚点SHA>..<最新SHA>
   ```

5. 给用户一份简短清单：
   - 多少个提交待翻译
   - 主要改了哪些文件（按改动量排序，列出 top 10 即可）
   - 如果有明显的功能模块聚集（如都在 `src/controllers/` 下），点出来

6. **不要**自动开始翻译，只给清单。是否翻译由用户决定。

## 硬约束

- **PROGRESS.md 只记锚点信息**：SHA、日期、一句话说明、历史归档。别往里塞翻译内容、待办列表、或无关的东西。
- **SHA 一律用完整的 40 位**，别截短，免得以后 `git log <SHA>..` 比错。
- **PROGRESS.md 不存在就先创建**，别问用户。创建时"历史记录"留空。
- **不写 `i18n/base_commit.txt`**：那是 sync-finalize.mjs 的领地，本 skill 只读。如果发现 base_commit.txt 和 PROGRESS.md 当前锚点不一致，提醒用户但不要自己改 base_commit.txt。
- **PROGRESS.md 与 base_commit.txt 的当前锚点 SHA 必须一致**。流程一更新 PROGRESS.md 时，新锚点 SHA 应来自 base_commit.txt（或用户明确指定的 commit）。

## 与翻译工作流的联动清单

| 事件 | 谁动 | 本 skill 做什么 |
|---|---|---|
| 跑完 `sync-finalize.mjs` | base_commit.txt 被推到新 SHA | 用户说"更新进度"→ 本 skill 归档旧锚点、写新锚点 |
| 用户问"还有哪些没翻译" | — | 读 base_commit.txt → 对比 origin/master → 给清单 |
| 上游同步前 | — | 用户可先问"还有哪些没翻译"评估工作量 |
| 上游同步后 | base_commit.txt 已更新 | 必须跑"更新进度"归档旧锚点 |
| 日常翻译会话 | 不动 base_commit.txt | 不需要动 PROGRESS.md，锚点没变 |
