# 计划：FMG 项目最轻量桌面打包 + CORS 解决方案

## Summary

将 Azgaar 奇幻地图生成器（FMG）打包为**最轻量的本地桌面应用**，并解决打包后浏览器在 `file://` 协议下出现的 CORS 限制。方案选 **Tauri v2**（~3–10MB 二进制、复用系统 WebView、不捆绑 Chromium）。CORS 问题通过 Tauri 的 `tauri://localhost` 自定义协议 + 资源协议 (asset protocol) 解决：所有本地资源改走类 HTTP 协议，浏览器不再触发 CORS 限制；同时对外部 CDN 资源做本地化或条件化处理，桌面模式下禁用 Service Worker。

---

## Phase 1 探索结论

### 项目结构
- 技术栈：Vanilla TS + SVG，Vite 8 + Biome；构建产物输出到 `dist/`
- 入口：`src/index.html`（9K 行 monolith，UI 模板）
- 现有部署：纯静态站（GitHub Pages / Netlify / Vercel / Docker nginx）
- 第三方库：`public/libs/`（jquery、d3、three、tinymce、dropbox-sdk、jszip、mapControls、orbitControls、loopsubdivision、objexporter、polylabel、alea、rgbquant、simplify、openwidget、flatqueue、indexedDB、delaunator）
- 数据资源：`public/heightmaps/*.png`、`public/images/textures/*.jpg`、`public/charges/*.svg`

### 关键 CORS 触点（grep `fetch|XMLHttpRequest|getBase64` 定位）
1. **`src/utils/commonUtils.ts:146-158` `getBase64()`** — 用 `XMLHttpRequest` 读 `./images/textures/*` 嵌入导出 SVG。`file://` 下 Chrome/Firefox 拒绝。
2. **`src/renderers/emblems/renderer.ts:72`** — `fetch('./charges/...')` 拉取纹章。
3. **`src/renderers/draw-trade-animation.ts:22`** — `fetch('./images/markers/...')` 加载交易标记。
4. **`src/services/io/load.ts:89`** — `fetch(url, { mode: 'cors' })` 用于远端 map 链接（CORS 由对端控制）。
5. **`src/services/fonts.ts:305/342`** — Google Fonts 跨域拉取（gstatic 允许 CORS）。
6. **`src/services/io/cloud.ts:90` / `export.ts:144` / `view-3d-renderer.ts:917,930,1139,1157,1169`** — `loadScript("libs/...")` 动态注入同源脚本。
7. **`public/main.js:17-19`** — 注册外部 Service Worker（`./sw.js` → `importScripts("https://storage.googleapis.com/workbox-cdn/...")`）。
8. **`src/index.html:29, 36-37`** — 内联 Google Fonts CSS + 第三方 analytics 脚本。

### 现有配置文件
- `vite.config.ts`：`base: NETLIFY ? '/' : '/Fantasy-Map-Generator/'`、`publicDir: ../public`、`outDir: ../dist`
- `package.json` scripts：`dev` / `build`（tsc + vite build） / `preview`
- `Dockerfile`：基于 `nginx:stable-alpine` + 自定义 `.docker/default.conf`（含 CSP 头）
- `.docker/default.conf`：标准 nginx 静态站配置
- `vercel.json` / `netlify.toml`：均为静态站部署配置

---

## Proposed Changes

### 决策摘要
| 决策 | 选择 | 理由 |
|------|------|------|
| 桌面框架 | **Tauri v2** | 最轻量（~3-10MB）、复用系统 WebView、零 Chromium、内置资源协议直接解 CORS |
| 资源协议 | 启用 `assetProtocol` + 强制 `tauri://localhost` | 同源 HTTP 语义，所有同源 XHR/fetch 自动合规 |
| Service Worker | 桌面模式下跳过注册 | 避免自定义协议下 SW 行为差异；本地资源由 Tauri 协议直接提供，无须离线缓存 |
| 外部 CDN | 全部本地化或条件化 | analytics / Google Fonts / workbox-cdn 改为可选或默认禁用，确保离线可用 |
| 安装/构建 | Tauri CLI 作为 devDep；最终产物为单文件可执行 + `.deb/.msi/.dmg` | 用户拿到的是双击运行的原生应用 |

### A. 新增 Tauri 脚手架（无侵入、低耦合）

新增 `src-tauri/` 目录，与 `src/` / `public/` 平级（项目根级别），遵循 Tauri v2 官方约定。**完全不修改** `src/` `public/` 中任何业务文件（除下面 D/E 提到的少量配置项）。

#### A.1 `src-tauri/Cargo.toml`（新增）
- 仅依赖 `tauri = "2"` + `tauri-build = "2"`（构建脚本用）
- 启用 `protocol-asset` 特性以便后续 `convertFileSrc` 访问任意本地文件
- `[profile.release]` 启用 `lto = true`、`codegen-units = 1`、`strip = true` 进一步缩体积

#### A.2 `src-tauri/tauri.conf.json`（新增）
- `productName: "Azgaar's Fantasy Map Generator"`
- `identifier: "top.8desk.fmg-desktop"`（沿用上游命名空间）
- `build.frontendDist: "../dist"`、`build.devUrl: "http://localhost:1420"`、`build.beforeDevCommand: "npm run dev"`、`build.beforeBuildCommand: "npm run build"`
- `app.windows[0]`：单窗口，800×600 起步、`minWidth: 800`、`minHeight: 600`、无菜单栏、`decorations: true`、`title: "Azgaar's Fantasy Map Generator"`
- `app.security.csp: null`（保留项目自带 CSP 在 `index.html`；不在 Tauri 侧再覆盖）
- `app.security.assetProtocol.enable: true`、`scope: ["**"]`（关键 CORS 解法：让 WebView 通过 `tauri://localhost/...` 访问任意本地资源）
- `bundle.targets: "all"`、`bundle.icon: ["icons/icon.png"]`（复用 `public/images/icons/icon_x512.png`）
- `bundle.category: "Utility"`、`bundle.shortDescription: "Fantasy Map Generator desktop"`

#### A.3 `src-tauri/src/main.rs` + `src-tauri/src/lib.rs`（新增）
- `main.rs`：`fn main() { fmg_lib::run() }`
- `lib.rs`：
  ```rust
  #[cfg_attr(mobile, tauri::mobile_entry_point)]
  pub fn run() {
      tauri::Builder::default()
          .plugin(tauri_plugin_fs::init())
          .setup(|_app| Ok(()))
          .run(tauri::generate_context!())
          .expect("error while running FMG desktop");
  }
  ```
- **不引入**任何业务逻辑、不改写 JS、不 monkey-patch 窗口对象

#### A.4 `src-tauri/build.rs`（新增）
- `fn main() { tauri_build::build() }`

#### A.5 `src-tauri/icons/icon.png`（新增）
- 直接从 `public/images/icons/icon_x512.png` 复制一份（脚本或手动），Tauri 需要根目录的 `icon.png`（512×512）

#### A.6 `src-tauri/.gitignore`（新增）
- `target/`、`WixTools/`（构建产物）

### B. 修改 `package.json`

仅追加条目，不动现有 scripts 顺序与依赖版本：
- 新增 devDep：`@tauri-apps/cli: ^2`
- 新增 dep：`@tauri-apps/api: ^2`（仅在需要 `convertFileSrc` 时由业务代码引用；当前不引入业务侧使用）
- 新增 scripts：
  - `"dev:desktop": "tauri dev"`
  - `"build:desktop": "tauri build"`
  - `"tauri": "tauri"`

### C. 修改 `vite.config.ts`

为 Tauri 模式加分支；保留原 Web 部署兼容性（Netlify / Vercel 仍用 `/` 或 `/Fantasy-Map-Generator/`）：
- `base: process.env.TAURI_DEV ? './' : (process.env.NETLIFY ? '/' : '/Fantasy-Map-Generator/')`
- 新增 `server: { port: 1420, strictPort: true }`（Tauri dev 固定端口）
- 新增 `clearScreen: false`
- 新增 `envPrefix: ['VITE_', 'TAURI_']`
- 新增 `build.target: 'esnext'`（对齐 Tauri 系统 WebView）

### D. 修改 `public/main.js`（最小 CORS 修复点）

唯一一处行为改动：检测到 Tauri 协议时跳过 SW 注册（约 3 行）：
```js
const IS_TAURI = location.protocol === "tauri:" || location.protocol === "tauri:";
if (PRODUCTION && !IS_TAURI && "serviceWorker" in navigator) {
  // ...原有 SW 注册逻辑保持不变
}
```
**效果**：Web 部署行为零变化；桌面应用跳过不稳定的 SW，资源由 Tauri 协议直接服务（已具备 HTTP 语义，无 CORS）。

### E. 修改 `src/index.html`（移除外部 CDN 默认加载）

三处改动，约 4 行：
- L29：移除 `sakura.1inn.top` analytics 脚本（或包到 `if (!IS_TAURI)` 条件中，桌面默认不加载）
- L36-37：移除 Google Fonts `<link>`（或条件化；桌面模式下用系统字体即可）
- 顶部 `<head>` 末尾新增 `<script>window.IS_TAURI = location.protocol.startsWith("tauri:");</script>`（让上述条件判断在 `main.js` 加载前就绪，避免 FOUC）

**说明**：这是项目里最"侵入"的改动，但每处都是可选的（条件化、删一行）。改动只影响默认外观，**不**影响 .map 序列化、CSS 主题或任何业务逻辑。

### F. 修改 `public/sw.js`（不再依赖外部 workbox）

把 `importScripts("https://storage.googleapis.com/...")` 替换为**直接使用浏览器原生 Cache API** 实现最简离线缓存（仅桌面应用不需要 SW，可保留 web 用）：
- 移除 workbox import
- 用 `self.addEventListener("install", ...)` + `caches.open/open + cache.addAll` 实现 install 时预缓存关键静态资源
- 用 `fetch(e.request).then(...).catch(() => caches.match(e.request))` 实现 fetch 回退
- **桌面模式**下 SW 不会被注册（见 D），所以这段 sw.js 实际只在浏览器部署场景下生效

**为什么保留简化版 SW**：Tauri 模式下跳过注册，Web 部署仍受益；维护一份简单 SW 比删掉更友好。

### G. `.docker/default.conf` 不变
原有 nginx 配置继续服务纯 Web 部署。Tauri 是平行的另一条分发路径，两者互不干扰。

### H. `i18n/`、`docs/`、`tests/e2e/` 不变
- 翻译工作流、本地规则、Playwright e2e 均不受影响（e2e 仍跑 web 部署 / Vite dev server）
- 单元测试 `vitest` 继续工作

---

## CORS 问题逐条解决映射

| CORS 触点 | Tauri 模式下解决方式 | 是否改业务代码 |
|-----------|----------------------|----------------|
| `getBase64()` XHR 读 `./images/textures/*` | `tauri://localhost` 协议同源，XHR 正常 | 不改 |
| `fetch('./charges/...')` | 同上 | 不改 |
| `fetch('./images/markers/...')` | 同上 | 不改 |
| `loadScript("libs/...")` 动态脚本 | 同上 | 不改 |
| `fetch(url, { mode: 'cors' })` 远端 map | 由对端 CORS 头决定，Tauri WebView 不限制跨域 | 不改 |
| Google Fonts 跨域拉取 | 桌面模式默认不加载；字体降级到系统字体 | index.html L36-37 |
| `importScripts("https://workbox-cdn")` | 桌面模式不注册 SW；web 部署改用纯 Cache API | sw.js 头部 |
| `sakura.1inn.top` analytics | 桌面模式默认不加载 | index.html L29 |
| 任意用户本地文件 (拖拽 `.map`) | `<input type="file">` + `FileReader` 走浏览器原生 API，无 CORS | 不改 |

---

## 假设与决策记录

- **决策 1**：Tauri v2 而非 Electron / NW.js / Neutralino
  - 理由：体积最小、复用系统 WebView、原生支持资源协议直接解 CORS、上游项目已是静态站，Tauri 集成成本最低
- **决策 2**：不引入任何上游业务改动
  - 理由：除 `main.js` 跳过 SW 3 行、`index.html` 条件化 4 行、`sw.js` 替换 workbox 一行外，**零业务代码变更**。`.map` 序列化、生成器、控制器、渲染器全部保持原样
- **决策 3**：SW 桌面模式跳过、web 模式保留简化版
  - 理由：Tauri v2 系统 WebView 对 `tauri://` 协议下 SW 支持有限，强行启用会引入不可预期问题；Web 部署仍依赖 SW 提速，因此保留一份去掉 workbox CDN 的简化版
- **决策 4**：外部 CDN 默认在桌面模式禁用
  - 理由：桌面应用卖点是"双击即用、不依赖网络"；保留可选的联网能力（AI、Dropbox、字体下拉）由用户点击具体功能时再发起，不影响主流程
- **决策 5**：不引入 `tauri-plugin-*`（除 fs/asset protocol）
  - 理由：项目无系统集成需求（无需 tray、auto-updater、deep-link、shell、notification），保持最轻量
- **决策 6**：构建产物为系统原生安装包
  - Linux: `.deb` + AppImage；Windows: `.msi`；macOS: `.dmg`（用户双击即可安装；AppImage 直接运行无需安装）

---

## Verification

执行顺序：

1. **类型检查 + Web 构建未破坏**
   - `npm run build` 应照常通过（验证 `tsc + vite build` 在加入 Tauri 配置后无回归）
   - 检查 `dist/index.html` 的 `<base>` 在 `TAURI_DEV` 未设时仍为 `/Fantasy-Map-Generator/`，未影响 Web 部署
2. **Lint**
   - `npm run lint` 通过
3. **Tauri dev 模式冒烟**
   - `npm run dev:desktop` 启动桌面应用，浏览器窗口打开，**随机生成地图、保存到本地、加载 `.map`、导出 PNG/SVG** 全部正常
4. **CORS 关键路径验证**（手动）
   - 打开控制台，执行 `Services.ExportMap.exportToPng()`，确认 `getBase64('./images/textures/plaster.jpg')` 成功（无 CORS 错误）
   - 切换 trade animation 图层，确认 marker 图标正确显示（`fetch('./images/markers/ship.svg')` 成功）
   - 打开 emblems 编辑器，确认 charges 正常显示（`fetch('./charges/...')` 成功）
5. **外部 CDN 禁用验证**
   - 在 Tauri dev 窗口打开 DevTools Network 标签，确认无对 `googleapis.com` / `sakura.1inn.top` / `storage.googleapis.com` 的请求
6. **SW 禁用验证**
   - DevTools → Application → Service Workers 确认 SW 未注册
7. **离线运行验证**
   - 在 Tauri 桌面窗口中关掉所有网络（或 `tc qdisc add dev lo root netem loss 100%` 模拟断网），重启动应用，地图生成、加载、导出全部正常
8. **Web 部署回归**
   - `npm run preview` 启动 Vite preview 服务，浏览器访问 `http://localhost:4173/...`，确认 Web 模式不受影响
9. **Tauri 生产构建**
   - `npm run build:desktop` 成功生成 `src-tauri/target/release/bundle/{deb,msi,dmg}/`，单安装包 < 15 MB

---

## 交付物

新增文件：
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/build.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/icons/icon.png`（从 `public/images/icons/icon_x512.png` 复制）
- `src-tauri/.gitignore`

修改文件：
- `package.json`（+3 scripts，+2 deps）
- `vite.config.ts`（+`server` `clearScreen` `envPrefix` `build.target`，`base` 增加 Tauri 分支）
- `public/main.js`（+3 行跳过 SW 注册）
- `src/index.html`（analytics 与 Google Fonts 条件化 + IS_TAURI 标记）
- `public/sw.js`（替换 workbox CDN 为原生 Cache API 简化实现）
- `.gitignore`（追加 `src-tauri/target/`、`src-tauri/gen/`）

下游产物：
- 桌面应用安装包（用户双击运行）
- Web 部署（GitHub Pages / Vercel / Netlify / Docker）行为零变化

---

## 已知限制与后续

- **首次安装 Tauri 工具链**：`npm run build:desktop` 需 Rust 1.77+ 与系统 WebView 依赖（Linux: `libwebkit2gtk-4.1-dev`；Win: WebView2 Runtime；macOS: 内置）。文档中需说明。
- **CSP**：Tauri v2 默认对 `tauri://` 协议不施加 CSP，沿用 `index.html` 中现有 CSP（`default-src 'self' 'unsafe-inline'` 等）即可。
- **大文件处理**：100k cell 地图在 WebView 中渲染时内存占用 ~1-2 GB 仍受系统限制，与 Web 版相同；不需额外优化。
- **CI 不自动构建 Tauri 包**（避免污染现有 PR 检查）；本地手动 `npm run build:desktop` 产出。
- **未引入自动更新**：保留最轻量；如需后续可在 `tauri.conf.json` 启用 `tauri-plugin-updater`。
