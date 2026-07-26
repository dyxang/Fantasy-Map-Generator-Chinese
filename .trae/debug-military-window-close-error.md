# Debug Session: military-window-close-error

**Status**: [OPEN]
**Session ID**: military-window-close-error
**Started**: 2026-07-26

## Symptoms

- **Operation**: 点击 Tools > 军事 (Military) 打开军事总览窗口，然后关闭该窗口
- **Expected**: 窗口正常关闭，无报错
- **Actual**:
  1. 控制台报错：`未找到 id 为 "markersOverview" 的元素`
  2. 紧接 `TypeError: Cannot read properties of null (reading 'remove')`
  3. 控制台报错：`未找到 id 为 "militaryOverview" 的元素`（出现 2 次）
  4. 紧接 `TypeError: Cannot read properties of null (reading 'remove')`（出现 2 次）
  5. 窗口标题残留

## Stack Trace (Key)

```
f @ military-overview-RRunn3G9.js:71       ← closeMilitaryOverview
_trigger @ jquery-ui.min.js:1
(匿名) @ jquery-ui.min.js:1
dequeue @ jquery-3.1.1.min.js:3
t.Widget.<computed> @ jquery-ui.min.js:1   ← _hide
close @ jquery-ui.min.js:1
click @ jquery-ui.min.js:1
```

## Relevant Code

- [src/controllers/military-overview.ts](file:///opt/data/workspace/fantasy-map-generator/src/controllers/military-overview.ts) - `closeMilitaryOverview` (L126-129)
- [src/controllers/markers-overview.ts](file:///opt/data/workspace/fantasy-map-generator/src/controllers/markers-overview.ts) - `closeMarkersOverview` (L86-94)
- [src/utils/nodeUtils.ts](file:///opt/data/workspace/fantasy-map-generator/src/utils/nodeUtils.ts) - `ensureEl` (L8-16)
- [public/modules/ui/editors.js](file:///opt/data/workspace/fantasy-map-generator/public/modules/ui/editors.js) - `closeDialogs` (L54-62)

## Falsifiable Hypotheses

### H1: `dialog("destroy")` 在 close 回调内触发二次 close 事件 ⭐ 主假设

**论据**: jquery-ui 的 `_createWidget` 绑定了 `remove` 事件 → `destroy`。当 close 回调里先调 `dialog("destroy")` 时，`_destroy` 内部会 `detach` 原元素 + `remove` uiDialog 包装器；接着 `ensureEl(...).remove()` 移除原元素。如果 destroy 过程或随后的 remove 触发了某种二次回调，第二次 `ensureEl` 就会找不到元素。militaryOverview 报错两次正好对应"二次触发"。

**观察点**: 在 `closeMilitaryOverview` 入口和 destroy 前后分别打日志，记录元素存在状态和调用次数。

### H2: close 回调被重复绑定

**论据**: `open()` 可被多次调用（菜单点击 / 快捷键）。每次 `open` 都会 `renderDialog()`（先 `remove` 旧元素再建新元素），并在新元素上 `dialog({close: closeMilitaryOverview})`。如果旧 dialog 实例未被销毁，可能残留事件绑定。

**观察点**: 在 `open` 入口记录调用次数和元素创建/销毁；在 close 回调记录调用栈次数。

### H3: `ensureEl().remove()` 触发 jquery-ui Widget 的 `remove` 事件 → 再次 `destroy`

**论据**: Widget `_createWidget` 里 `this._on(!0, this.element, {remove: function(t){ t.target===s && this.destroy() }})`。当 `ensureEl("militaryOverview").remove()` 执行时，会触发元素上的 `remove` 事件，该 handler 调用 `this.destroy()`。若 `destroy` 内部又尝试访问已被清理的状态，可能间接造成二次报错。

**观察点**: 监听元素 `remove` 事件，记录是否触发 `destroy` 二次调用。

### H4: 多个 .stable 对话框互相影响

**论据**: 用户报错中 markersOverview 和 militaryOverview 同时出现。两者都是 `.stable` 对话框。`closeDialogs("#militaryOverview, .stable")` 在 `open()` 中被调用，但 `.not("#militaryOverview, .stable")` 会排除所有 `.stable`，理论上不会关闭其他 stable 对话框。但如果用户先开了 markersOverview 再开 military，关闭 military 时可能存在某种级联。

**观察点**: 记录打开/关闭时所有 `.stable` 对话框的存在与可见状态。

### H5: `_hide` 队列在 `dialog("destroy")` 后继续执行导致状态错乱

**论据**: jquery-ui `close()` 调用 `_hide(uiDialog, null, callback)`，callback 是 `_trigger("close")`。`_hide` 用 `s.queue(function(i){ t(this)[e](); o.call(s[0]); i(); })`。callback（即 close 回调）执行时调用了 `dialog("destroy")` 移除了 `uiDialog`，之后队列继续 `i()`（dequeue）可能在已移除的元素上操作，产生异常。

**观察点**: 记录 `_hide` callback 执行前后的 uiDialog 状态。

## Instrumentation Plan

| Point ID | Hypothesis | Location | What to log |
|----------|-----------|-----------------------|
| A:open-entry | H2/H4 | military-overview.ts `open()` 入口 | 调用次数、当前 #militaryOverview 是否存在、.stable 可见对话框列表 |
| B:close-entry | H1/H2 | `closeMilitaryOverview` 入口 | 调用次数、#militaryOverview 是否存在、stack |
| C:destroy-pre | H1/H3 | `dialog("destroy")` 调用前 | 元素是否在 DOM、uiDialog 是否存在 |
| D:destroy-post | H1/H3 | `dialog("destroy")` 调用后 | 元素是否在 DOM（detach 后 re-attach 是否成功）|
| E:remove-pre | H1 | `ensureEl(...).remove()` 调用前 | ensureEl 返回值 |
| F:markers-close | H4 | `closeMarkersOverview` 入口 | 调用次数、#markersOverview 是否存在 |

## Run Log

### Run 1 (pre-fix)

**操作**: 点击 Tools > Military 两次 → 关闭可见窗口 → 关闭残留标题栏

**Debug Server 日志**:
| ts | H | location | 关键数据 |
|----|---|----------|---------|
| ...996 | A | open() | callCount=1, militaryElExists=false, visibleStable=[] |
| ...643 | A | open() | **callCount=2, militaryElExists=true, visibleStable=["militaryOverview"]** |
| ...436 | B | closeMilitaryOverview | callCount=1, element exists, has dialog data |
| ...436 | C | pre-destroy | element exists, in DOM |
| ...438 | D | post-destroy | **element still exists, re-attached (parentTag: DIV)** |
| ...439 | E | pre-remove | ensureEl returns element, element exists |

**浏览器 DOM 验证**:
- 第二次点击 Military 后：DOM 中存在 **3 个 .ui-dialog**，其中 **两个"军事总览"**（一个仅标题栏，一个完整窗口）
- 关闭可见窗口后：残留一个仅标题栏的"军事总览"元素
- 关闭残留标题栏时：控制台出现 **"未找到 id 为 militaryOverview 的元素"** 错误

## Evidence Analysis

### 根因确认

**H1 部分成立**：close 回调被触发两次，但不是因为 `dialog("destroy")` 触发二次 close 事件。

**H4 补充成立**：多个 .stable 对话框有同样的 bug 模式，但用户报错中 markers/military 同时出现是因为两者都触发了相同 bug。

**实际根因（不在原假设中，但证据确凿）**：

`renderDialog()` 使用 **原生** `document.getElementById("militaryOverview")?.remove()` 移除已存在的元素。原生 `Element.remove()` **不会**触发 jQuery 的 `cleanData`，因此：

1. 旧 dialog 实例 **未被销毁**（`destroy()` 未被调用）
2. 旧 uiDialog 包装器（含标题栏）**残留在 DOM 中**
3. 新元素和新 dialog 实例被创建
4. 当用户关闭残留标题栏时，旧实例的 close 回调触发 `closeMilitaryOverview`
5. 此时 `#militaryOverview` 已被新实例移除 → `ensureEl` 返回 null → TypeError

**证据链**:
- `open()` callCount=2 时 `visibleStableDialogs=["militaryOverview"]`（旧实例仍可见）
- 浏览器 DOM 验证显示两个"军事总览"ui-dialog
- 关闭残留标题栏时复现"未找到 id"错误

### 假设验证结果

| 假设 | 结果 | 说明 |
|------|------|------|
| H1: destroy 触发二次 close | ❌ 不成立 | destroy 不会触发 close 事件；二次 close 来自旧实例残留 |
| H2: close 回调重复绑定 | ❌ 不成立 | 每个实例只有一个 close 回调，但有两个实例 |
| H3: ensureEl.remove 触发 Widget remove 事件 | ❌ 不成立 | 原生 remove 不触发 jQuery 事件 |
| H4: 多个 .stable 对话框互相影响 | ⚠️ 部分成立 | 同样的 bug 模式存在于多个对话框，但不是直接互相影响 |
| H5: _hide 队列状态错乱 | ❌ 不成立 | 队列执行正常 |

## Fix Plan

**修复方案**：将 `renderDialog()` 中的原生 `Element.remove()` 替换为 `destroyDialogIfExists()`，确保在移除元素前先销毁 jQuery UI dialog 实例。

**修改文件**:
1. `src/controllers/military-overview.ts` - `renderDialog()` (L50) + `renderOptions()` (L664)
2. `src/controllers/markers-overview.ts` - `renderDialog()` (L33)

**修改内容**:
- 导入 `destroyDialogIfExists`
- `document.getElementById("militaryOverview")?.remove();` → `destroyDialogIfExists("militaryOverview");`
- `document.getElementById("markersOverview")?.remove();` → `destroyDialogIfExists("markersOverview");`
- `document.getElementById("militaryOptions")?.remove();` → `destroyDialogIfExists("militaryOptions");`

## Cleanup

待用户确认后执行

## Post-Fix Verification (Run 2)

**操作**: 同 Run 1（点击 Military 两次 → 关闭可见窗口）

**Debug Server 日志 (runId=post)**:
| ts | H | location | 关键数据 |
|----|---|----------|---------|
| ...819 | A | open() | callCount=1, militaryElExists=false, visibleStable=[] |
| ...099 | A | open() | callCount=2, militaryElExists=true, visibleStable=["militaryOverview"] |
| ...816 | B | closeMilitaryOverview | callCount=1, element exists, has dialog data |
| ...816 | C | pre-destroy | element exists, in DOM |
| ...817 | D | post-destroy | element re-attached (parentTag: DIV) |
| ...818 | E | pre-remove | ensureEl returns element, element exists |

**浏览器 DOM 验证 (post-fix)**:
- 第二次点击 Military 后：DOM 中只有 **1 个**"军事总览"ui-dialog（修复前是 2 个）
- 关闭可见窗口后：**无残留**标题栏（`militaryOverview exists: false`）
- **无"未找到 id 为 militaryOverview 的元素"错误**

## Pre-fix vs Post-fix 对比

| 指标 | Pre-fix | Post-fix |
|------|---------|----------|
| 第二次点击后 ui-dialog 数量 | 3（含 2 个"军事总览"）| 仅 1 个"军事总览" |
| 关闭后残留标题栏 | ✅ 有残留 | ❌ 无残留 |
| "未找到 id" 错误 | ✅ 出现 | ❌ 未出现 |
| close 回调触发次数 | 2 次（第 2 次失败）| 1 次（成功）|
| TypeError null.remove | ✅ 出现 | ❌ 未出现 |

## 修复总结

**根因**: `renderDialog()` 使用原生 `Element.remove()` 移除已存在的对话框元素，未触发 jQuery UI 的 `destroy()` 清理，导致旧 dialog 实例的 uiDialog 包装器（含标题栏）残留在 DOM 中。当用户关闭残留标题栏时，close 回调尝试访问已被移除的 `#militaryOverview` 元素，引发"未找到"错误和 TypeError。

**修复**: 将 `military-overview.ts` 和 `markers-overview.ts` 中 `renderDialog()` / `renderOptions()` 的 `document.getElementById(...)?.remove()` 替换为 `destroyDialogIfExists(...)`，确保在移除元素前先调用 `dialog("destroy")` 销毁 jQuery UI dialog 实例。
