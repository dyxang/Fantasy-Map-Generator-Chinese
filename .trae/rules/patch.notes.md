---
alwaysApply: false
---
## 补丁规则

本文件记录 **i18n 翻译管线无法处理** 的汉化版定制改动：

- 代码改动（CSS 规则、字体加载、新增函数 / 数据）
- 镜像站替换（URL 替换、统计脚本）
- 新增文件（404 页面）
- 配置变更（PWA Manifest）
- 汉化版定制文本追加（关于页特别说明、QQ 群、赞赏链接等）

纯界面文案翻译（按钮、标签、tooltip 等）由 i18n 管线统一管理，记录在 `i18n/tm.json`，定制内容登记在 `i18n/divergence.json`。本文件不重复记录纯翻译内容，只记录"原版没有的追加 / 替换"。

> **注意**：部分文本类补丁（如关于页文案、更新提醒文案）与 i18n 翻译有重叠。应用补丁前先检查 `src/` 下文件是否已被 i18n 翻过，避免覆盖已有译文。本文件在每个条目里标注了当前状态。

## 项目结构说明（重要）

项目已从 vanilla JS 迁移到 Vite + TS：

- 应用源码在 `src/`（Vite root，入口 `src/index.html`）
- 静态资源在 `public/`（Vite publicDir）
- 部分遗留 JS 仍在 `public/modules/`，被 `src/index.html` 通过 `<script defer>` 加载（如 `public/modules/ui/options.js`）
- 打补丁时**优先改 `src/` 下的 TS 文件**；遗留 JS 仅在必要时改

### 文件路径映射表

| 旧路径（已失效） | 新路径 |
|---|---|
| `index.html` | `src/index.html` |
| `index.css` | `public/index.css` |
| `modules/fonts.js` | `src/services/fonts.ts` |
| `modules/dynamic/supporters.js` | `src/data/supporters.ts` |
| `versioning.js` | `src/services/versioning.ts` |
| `modules/ui/notes-editor.js` | `src/controllers/notes-editor.ts` |
| `modules/ui/emblems-editor.js` | `src/controllers/emblems-editor.ts` |
| `modules/markers-generator.js` | `src/generators/markers-generator.ts` |
| `modules/ui/options.js` | `public/modules/ui/options.js`（仍作为 legacy 加载） |
| `manifest.webmanifest` | `public/manifest.webmanifest` |
| `sw.js` | `public/sw.js` |

## 镜像可用性（已验证）

以下镜像站已于 2026-07-24 验证可用，可直接打补丁：

- [x] `sakura.1inn.top/script.js` — HTTP 200，2.6KB，响应 0.99s
- [x] `gcore.jsdelivr.net/gh/dyxang/zh_font@main/` — HTTP 200，font/ttf；**注意字体文件偏大（约 6MB），首屏加载会慢**，建议配合 `display=swap` 或按需加载

---

## 一、字体补丁（适配中文显示）

### 1.1 全局 CSS 字体变量与中文字体引入

**文件**：`public/index.css` 顶部（替换原 `:root` 与字体定义部分）

**当前状态**：未应用。`public/index.css` 顶部仍是原版 `:root`（Consolas / Georgia / Helvetica）。

```css
:root {
  --monospace: 'HarmonyOS Sans SC', Consolas, monospace;
  --serif: Georgia, serif;
  --sans-serif: 'Noto Sans SC', Helvetica, Arial, sans-serif;
}

/*使用中文字体美化尝试*/
@font-face {
  font-family: "HarmonyOS Sans SC";
  src: url("https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/HarmonyOS_Sans_SC_Regular.ttf");
}
```

### 1.2 HTML 头部引入 Noto Sans SC

**文件**：`src/index.html` 的 `<head>` 内（`<link rel="manifest">` 之后，其它 `<script>` 之前）

**当前状态**：未应用。`src/index.html` 的 `<head>` 没有 Noto Sans SC 链接。

```html
<!--使用中文字体美化尝试-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap" rel="stylesheet">
<!--结束-->
```

### 1.3 字体列表（含国内镜像加载的中文书法字体）

**文件**：`src/services/fonts.ts` 的 `window.fonts = [...]` 数组开头追加以下条目

**当前状态**：未应用。`src/services/fonts.ts` 的 `window.fonts` 数组开头是 Arial / Brush Script MT 等英文字体。

```typescript
{family: "叛逆明朝 僅繁體中文",
  src: "url(https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/Hangyaku-ywzMm.ttf)"
},
{family: "钟齐志莽行书",
  src: "url(https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/ZhiMangXing-Regular.ttf)"
},
{family: "云峰飞云体",
  src: "url(https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/云峰飞云体.ttf)"
},
{family: "马善政毛笔楷书",
  src: "url(https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/MaShanZheng-Regular.ttf)"},
{family: "三极泼墨体",
  src: "url(https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/三极泼墨体.ttf)"},
{family: "Silver像素体",
  src: "url(https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/Silver.ttf)"},
{family: "演示佛系体",
  src: "url(https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/Slidefu-Regular.ttf)"},
{family: "Pacifico",
  src: "url(https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/Pacifico-Regular.ttf)"},
{family: "X Typewriter",
  src: "url(https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/XTypewriter-Regular.woff2)"},
```

---

## 二、关于页面补丁（中文用户特别定制）

### 2.1 加载页文案

**文件**：`src/index.html` 中 `#loading-typography` 区块（约第 350 行）

**当前状态**：已被 i18n 部分翻译。当前内容为 `<div id="titleName">Azgaar's</div>` + `<div id="title">奇幻地图生成器</div>` + `<p id="loading-text">加载中<span>.</span>...</span></p>`。与本补丁的差异：缺少 "Azgaar的" 前缀和 "超时请更换能访问全球的网络" 提示。

**补丁目标**（按需对比已有译文，仅追加缺失部分）：

```html
<div id="loading-typography">
  <div id="titleName">Azgaar的</div>
  <div id="title">幻想地图生成器</div>
  <div id="versionText"> </div>
  <p id="loading-text">汉化版载入中<span>.</span><span>.</span><span>.</span></p>
  超时请更换能访问全球的网络
</div>
```

### 2.2 关于面板 `#aboutContent` 开头追加汉化版特别说明

**文件**：`src/index.html` 中 `<div id="aboutContent" class="tabcontent">` 之后立即插入（约第 2319 行之后）

**当前状态**：未应用。`#aboutContent` 已被 i18n 翻译为中文，但没有汉化版特别说明段落。当前第 2401 行只有一行 "中文本地化：8desk.top" 的简单署名。

```html
<p><b>关于个人汉化板的特别说明：</b>
<p>原版作者:Azgaar
<p>1.该版本为个人汉化，作者：B站 人类制作，QQ交流群873020847
<p>2.汉化问题群内提出，官方问题找作者
<p>3.主站为<a href="https://www.8desk.top" target="_blank">www.8desk.top</a>
<p>4.感谢羊驼哥曾经的帮助，通知站为<a href="https://zan.8desk.top" target="_blank">zan.8desk.top</a>
<p style="color:#d3e8e1;font-size:125%;">感谢所有<a data-tip="点击查看汉化赞赏者" onclick="showTrbackers()" style="color:#d3e8e1;">汉化支持者</a>！
<button><a href="https://zan.8desk.top/#/./SU" target="_blank" style="color:#d3e8e1;">支持译者</a></button></p>
```

> 注：`onclick` 调用的是 `showTrbackers()`（见 2.4），不是原版的 `showSupporters()`。

### 2.3 关于面板中汉化版仓库与 Wiki 链接

**文件**：`src/index.html` 中 `#aboutContent` 内的仓库说明段落（约第 2330 行）

**当前状态**：未应用。当前链接仍指向原版 `github.com/Azgaar/Fantasy-Map-Generator`。i18n 已翻译了周边文本，但链接未替换。

将原版 GitHub 仓库链接替换为汉化版仓库：

```html
<a href="https://github.com/dyxang/Fantasy-Map-Generator-Chinese/" target="_blank">幻想地图生成器汉化版</a> 是生成幻想地图的
<a href="https://github.com/dyxang/Fantasy-Map-Generator-Chinese/blob/master/LICENSE" target="_blank">开源工具</a>
<p>你可使用，编辑或新建地图。查看以下内容
<a href="https://github.com/dyxang/Fantasy-Map-Generator-Chinese/wiki" target="_blank">快速开始</a>,
<a href="https://github.com/dyxang/Fantasy-Map-Generator-Chinese/wiki/%E9%97%AE%E4%B8%8E%E7%AD%94" target="_blank">问题解答</a>,
<a href="https://youtube.com/playlist?list=PLtgiuDC8iVR2gIG8zMTRn7T_L0arl9h1C" target="_blank">视频教程</a>, 和
<a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys" target="_blank">快捷键</a> 指导
</p>
```

### 2.4 汉化赞赏者弹窗（最小侵入方案）

**设计原则**：复刻原版 `showSupporters()` 的模式，只追加，不修改原版逻辑。

原版 `showSupporters()` 位于 `public/modules/ui/options.js:84`，读取 `window.Supporters`。汉化版按相同模式新增 `showTrbackers()` 读取 `window.trbackers`。

#### 2.4.1 函数定义

**文件**：`public/modules/ui/options.js` 中 `showSupporters()` 函数之后追加

```javascript
// show popup with a list of Chinese localization supporters
async function showTrbackers() {
  const list = window.trbackers.split("\n").sort();
  const columns = window.innerWidth < 800 ? 2 : 5;

  alertMessage.innerHTML =
    `<ul style='column-count: ${columns}; column-gap: 2em'>` + list.map(n => `<li>${n}</li>`).join("") + "</ul>";
  $("#alert").dialog({
    resizable: false,
    title: "汉化版赞赏者 - 真名已打码",
    width: "min-width",
    position: {my: "center", at: "center", of: "svg"}
  });
}
```

> 之所以放在 `public/modules/ui/options.js` 而不是 `src/` 下，是因为原版 `showSupporters()` 就在这里，`src/index.html` 第 5507 行通过 `<script defer src="modules/ui/options.js?v=1.137.6">` 加载它。复用同一文件最小化侵入。

#### 2.4.2 汉化支持者名单数据

**文件**：`src/data/supporters.ts` 末尾追加（与原版 `supporters` 导出并列）

**当前状态**：未应用。`src/data/supporters.ts` 只有原版 `supporters` 导出和 `window.Supporters = supporters` 赋值。

```typescript
export const trbackers = `Crisp
■越
星空下的牧草
■■晗
长江长
wx
小光
居高声自远
爱之梦
路旁的菜叶
米卡柳丁
■兵
DCVSMarvel
爱发电用户_eUkY
爱发电用户_HEeR
神经漫游者nobu
飞天归来
Yotta
怎么回事
师维梵
朱■哲
爱发电用户_eWFG
了望的猪猪
JUNJUN
爱发电用户_YTSe
爱发电用户_850dc
爱发电用户_66f75
青莲剑歌
及其他七个好心人`;

// temp legacy compatibility（与原版 window.Supporters 模式一致）
window.trbackers = trbackers;

declare global {
  var trbackers: string;
}
```

> 注意：`declare global` 块要并入 `src/data/supporters.ts` 已有的 `declare global` 块，不要重复声明。

### 2.5 PWA Manifest 汉化

**文件**：`public/manifest.webmanifest`

**当前状态**：未应用。当前是原版英文（name: "Azgaar's Fantasy Map Generator"，url 指向 azgaar.github.io）。

```json
{
  "background_color": "#fff",
  "display": "standalone",
  "orientation": "any",
  "name": "Azgaar的幻想地图生成器",
  "short_name": "幻想地图生成器",
  "description": "用来生成交互式和高度可定制地图的Web应用程序",
  "scope": "/",
  "start_url": "/?source=pwa",
  "url": "https://www.8desk.top",
  "icons": [ ... ]
}
```

> 注：`scope` 和 `start_url` 需根据汉化版实际部署路径调整（原版是 `/Fantasy-Map-Generator/`，汉化版主站可能是 `/`）。

### 2.6 HTML 头部 meta 信息汉化

**文件**：`src/index.html` 的 `<head>`（约第 1-42 行）

**当前状态**：部分应用。`<title>` 已是 "Azgaar 奇幻地图生成器"，但 `lang="en"`、`meta description`、`og:*`、`canonical` 仍是原版英文 / 原版 URL。

```html
<html lang="zh-cn">
<title>Azgaar的奇幻地图生成器</title>
<meta name="description" content="汉化版，免费的网络应用程序，帮助幻想作家，游戏大师和制图师创建和编辑幻想地图" />
<meta property="og:url" content="https://8desk.top" />
<meta property="og:title" content="Azgaar's Fantasy Map Generator(个人汉化)" />
<meta property="og:description" content="免费的网络应用程序，帮助幻想作家，游戏大师和制图师创建和编辑幻想地图" />
<link rel="canonical" href="https://8desk.top/" />
```

---

## 三、更新提醒页面补丁（中文用户特别定制）

**文件**：`src/services/versioning.ts` 中 `showUpdateWindow()` 函数（约第 97 行）

**当前状态**：未应用。当前 `alertMessage.innerHTML` 是原版英文，只有 dialog title 被翻译成 "Fantasy Map Generator 更新"。

### 设计原则（重要）

`showUpdateWindow()` 的内容分两部分，处理方式不同：

1. **固定提示段**（汉化版特供，必须保留）：QQ 群、赞赏链接、主站 / 信息站、电脑访问提示等——这些是汉化版独有内容，不随版本变化，**始终保留**。
2. **最近更新列表**（跟随原版，灵活翻译）：原版 `latestPublicChanges` 数组每次发版都会变，**不要写死**。AI 应用补丁时，应读取当前 `versioning.ts` 里的 `latestPublicChanges` 数组，逐条翻译后填入 `<ul>` 列表。上游升级导致列表变化时，重新翻译当前数组即可，不要回退到本文件里的旧列表。

> 换句话说：本文件给出的"最近更新"示例仅供参考格式，**实际内容以原版 `latestPublicChanges` 当前值为准**。

### 补丁内容

**只改 `alertMessage.innerHTML` 赋值的字符串内容，不改函数结构、不改 `$("#alert").dialog({...})` 配置。**

`alertMessage.innerHTML` 模板字符串替换为（`<ul>` 列表内容按原版 `latestPublicChanges` 动态翻译）：

```typescript
alertMessage.innerHTML = /* html */ `幻想地图生成器更新到版本<strong>${VERSION}</strong>，此版本兼容<a href="${changelog}" target="_blank">这些版本</a>，地图文件将自动更新
    ${storedVersion ? "<span><strong>⚠一定要点击</strong>重新加载页面以获取新的代码。</span>" : ""}
<p><strong>⚠请必须仔细阅读以下内容！</strong></p>
<p>❗因代码底层逻辑，推荐电脑访问达到最好体验❗<p>
<p>①<a href="https://www.8desk.top" target="_blank">主站链接</a>②<a href="https://zan.8desk.top" target="_blank">信息站</a></p>
<p>应要求，建了个汉化版交流的群：873020847</p>汉化版完全免费，支持译者:
<p><a href="https://afdian.com/a/freeguy" target="_blank" style="color: #946ce6;">爱发电</a></p>
<p><a href="https://zan.8desk.top/#/./SU" target="_blank" style="color: #42b983;">微信赞赏码</a><p>
    <ul>
      <strong>最近更新:</strong>
      <!-- 将原版 latestPublicChanges 数组的每个条目翻译后填入此处，格式：<li>翻译后的条目</li> -->
      ${latestPublicChanges.map(change => `<li>${translateChange(change)}</li>`).join("")}
    </ul>

    <p>加入原作者的 <a href="${discord}" target="_blank">Discord 群聊</a>或<a href="${reddit}" target="_blank">Reddit 社区</a>提出问题，分享地图，讨论生成器和世界构建，报告错误并提出新功能。</p>
    <span><i>感谢所有支持，到<a href="${patreon}" target="_blank">Patreon（赞助网站）</a>上支持原作者!</i></span>`;
```

> **AI 应用指引**：
> - 上面的 `${latestPublicChanges.map(...)}` 是示意，实际打补丁时把 `latestPublicChanges` 每个条目翻译成中文后硬编码为 `<li>` 列表即可（因为 `latestPublicChanges` 本身就是原版数组，翻译后写死，下次上游更新再重新翻译）。
> - **固定提示段**（从"⚠请必须仔细阅读"到"微信赞赏码"）必须原样保留，不可删改。
> - dialog 配置的 `title` 改为 `"幻想地图生成器更新"`，`buttons` 的键改为 `"清空缓存"` / `"不再显示"`（仅改文本，不改函数逻辑）。

### 固定提示段（必须保留的汉化版特供内容）

以下内容无论版本如何变化都必须保留在 `alertMessage.innerHTML` 中：

```
<p><strong>⚠请必须仔细阅读以下内容！</strong></p>
<p>❗因代码底层逻辑，推荐电脑访问达到最好体验❗<p>
<p>①<a href="https://www.8desk.top" target="_blank">主站链接</a>②<a href="https://zan.8desk.top" target="_blank">信息站</a></p>
<p>应要求，建了个汉化版交流的群：873020847</p>汉化版完全免费，支持译者:
<p><a href="https://afdian.com/a/freeguy" target="_blank" style="color: #946ce6;">爱发电</a></p>
<p><a href="https://zan.8desk.top/#/./SU" target="_blank" style="color: #42b983;">微信赞赏码</a><p>
```

> **同步规则**：`VERSION` 常量跟随原版升级。原版 `latestPublicChanges` 数组更新时，重新翻译当前数组填入 `<ul>` 列表，固定提示段不动。

---

## 四、镜像站补丁（国内加速）

> 镜像可用性已于 2026-07-24 验证通过，见顶部「镜像可用性」。

### 4.1 字体资源镜像

所有中文字体文件统一通过 jsdelivr 国内加速镜像加载：

- 镜像前缀：`https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/`
- 涉及文件：`public/index.css`（见 1.1）、`src/services/fonts.ts`（见 1.3）

### 4.2 TinyMCE 编辑器资源镜像

**文件**：`src/controllers/notes-editor.ts`（约第 105、122 行）

**当前状态**：未应用。当前用的是 `https://azgaar.github.io/Fantasy-Map-Generator/libs/tinymce/tinymce.min.js`。

```typescript
const url = "https://www.8desk.top/libs/tinymce/tinymce.min.js";
// ...
window.tinymce._setBaseUrl("https://www.8desk.top/libs/tinymce");
```

> 验证方式：浏览器访问 `https://www.8desk.top/libs/tinymce/tinymce.min.js`，确认文件存在且可加载。

### 4.3 纹章编辑器 Google Fonts 链接

**文件**：`src/controllers/emblems-editor.ts`（约第 653 行）

**当前状态**：已存在原版链接 `https://fonts.googleapis.com/css2?family=Forum&family=Overlock+SC`。若国内可访问 Google Fonts 则无需改动；若需镜像，需找对应的国内 Google Fonts 镜像并替换。

### 4.4 随机遇遇事件 iframe 镜像

**文件**：`src/generators/markers-generator.ts`（约第 1653 行）

**当前状态**：未应用。当前用的是 `https://deorum.vercel.app/encounter/${encounterSeed}`。

```typescript
const legend = `<div>你偶遇了一位人.</div><iframe src="https://deorum.8desk.top/encounter/${encounterSeed}" width="375" height="600" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
```

> 验证方式：浏览器访问 `https://deorum.8desk.top/encounter/1`，确认子站存在且返回正常内容。

### 4.5 访问统计脚本

**文件**：`src/index.html` 的 `<head>` 内（约第 29-37 行）

**当前状态**：未应用。当前用的是 googletagmanager（`gtag/js?id=G-VJL3J26W7R`）。

将原版 Google Analytics 替换为自建统计镜像：

```html
<script defer src="https://sakura.1inn.top/script.js" data-website-id="279a18ba-42d8-487c-84ee-162e139e209b"></script>
```

> 应用时需删除原版的 `<script async src="https://www.googletagmanager.com/gtag/js?id=G-VJL3J26W7R">` 及对应的 `gtag` 配置代码块。

### 4.6 Service Worker 缓存配置

**文件**：`public/sw.js`

**当前状态**：保留 workbox CDN 引用即可，确保缓存策略兼容国内访问。

```javascript
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.2.0/workbox-sw.js");
```

> 若 `storage.googleapis.com` 国内访问困难，需找 workbox 的国内镜像或自托管。

### 4.7 添加字体对话框提示文案

**文件**：`src/index.html` 中 `#addFontDialog`（约第 2606 行）

**当前状态**：已被 i18n 翻译为中文，但缺少汉化版定制的"上海交大字体镜像"和"100font"提示。需在已有译文基础上追加：

```html
<p><strong>谷歌字体</strong>. 打开 <a href="https://fonts.google.com/" target="_blank">Google Fonts</a>, 找到字体并在下面输入名称。
</p><p>汉化版使用上海交大的字体镜像</p>
<p>
  <strong>本地字体</strong>. ... 推荐字体来源有
  <a href="https://www.100font.com/" target="_blank">100font(免费可商用)</a> 和 Github 上的开源字体.
</p>
```

### 4.8 自定义 404 页面

**文件**：`public/404.html`（新建文件，汉化版特有）

**当前状态**：不存在。

```html
<!DOCTYPE html><html lang="zh-cn"><!--汉化版特有的404页面-->
<head>...<title>404 - 页面不存在</title>...</head>
<body>
  <div class="error-page"><div><h1 data-h1="404">404</h1><p data-p="NOT FOUND">页面不存在</p></div></div>
  <a href="https://8desk.top" class="back">返回首页</a>
</body>
</html>
```

> 注：需补全 `<head>` 内的 meta 和样式，使其符合原版 404 页面结构（如有）。

### 4.9 纹章生成器中 FMG 链接

**文件**：`src/controllers/emblems-editor.ts`（约第 634 行）

**当前状态**：未应用。当前 FMG 链接指向 `https://azgaar.github.io/Fantasy-Map-Generator`。

```typescript
const FMG = `<a href="https://8desk.top" target="_blank">Azgaar's Fantasy Map Generator</a>`;
```

---

## 补丁应用规则

1. **文本优先，不动代码**：打补丁时**尽量只做文本上的改动，不改动代码逻辑**。能改字符串内容就不改函数结构，能改 HTML 文本节点就不改标签结构，能改属性值就不改属性名。例：`showUpdateWindow()` 只改 `alertMessage.innerHTML` 的字符串内容和 dialog 的 `title` / `buttons` 文本，不改函数签名、控制流、变量名。

2. **不要覆盖原版逻辑**：本规则列出的所有内容均是在原版基础上追加或替换，遇到原版代码有功能更新时，仅同步功能逻辑，保留上述中文特供内容。

3. **保留作者信息**：所有提到"作者:Azgaar"、"汉化作者:B站 人类制作"、"QQ群873020847"、"主站 8desk.top"、"通知站 zan.8desk.top"、"爱发电"、"微信赞赏码"等内容必须完整保留。

4. **保留镜像链接**：`gcore.jsdelivr.net/gh/dyxang/zh_font@main/` 字体镜像、`8desk.top` 主站镜像、`zan.8desk.top` 通知站镜像、`deorum.8desk.top` 子站镜像、`sakura.1inn.top` 统计镜像，不可改回原版海外链接。

5. **保留版本号同步**：`src/services/versioning.ts` 中 `VERSION` 常量需跟随原版升级，但 `showUpdateWindow()` 内部的固定提示段（QQ 群、赞赏链接、主站 / 信息站等）必须保留。"最近更新"列表跟随原版 `latestPublicChanges` 数组动态翻译，不写死（见三节「设计原则」）。

6. **保留汉化支持者数据**：`src/data/supporters.ts` 中的 `trbackers` 是汉化版特有数据，不可被原版的 `supporters` 数组覆盖或删除；原版 `supporters` 数组同时保留。

7. **HTML 字符转义**：将纯文本转换为 HTML 时，注意 `<`、`>`、`&` 等字符的转义；模板字符串中使用反引号包裹时注意 `${}` 变量插值。

8. **遵守许可证**：汉化版使用 GNU AGPLv3 许可证，补丁后的代码须继续遵循该许可。

9. **与 i18n 管线协作**：纯文本翻译由 i18n 管线管理（`i18n/tm.json` + `i18n/divergence.json`）。本文件涉及的文本类补丁（关于页文案、更新提醒文案、meta 信息）应用前需检查 i18n 是否已翻译，避免覆盖已有译文。汉化版定制内容（特别说明、QQ 群、赞赏链接等）应登记到 `i18n/divergence.json` 防止上游同步时被覆盖。

10. **路径适配**：本文件所有路径已更新为 Vite + TS 新结构。打补丁时优先改 `src/` 下 TS 文件；`public/modules/ui/options.js` 等 legacy 文件仅在原版逻辑仍在此处时才改。
