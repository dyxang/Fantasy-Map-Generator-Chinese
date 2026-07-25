/**
 * Version Control Guidelines
 * --------------------------
 * We use Semantic Versioning: major.minor.patch. Refer to https://semver.org
 * Our .map file format is considered the public API.
 *
 * Update the version on each merge to master:
 * 1. MAJOR version: Incompatible changes that break existing maps
 * 2. MINOR version: Additions or changes that are backward-compatible but may require old .map files to be updated
 * 3. PATCH version: Backward-compatible bug fixes and small features that don't affect the .map file format
 *
 * Example: 1.102.2 -> Major version 1, Minor version 102, Patch version 2
 * Version bumping is automated via GitHub Actions on PR merge.
 *
 * For the changes that may be interesting to end users, update the `latestPublicChanges` array below (new changes on top).
 */
import { showConnectivityDialog } from "./connectivity-check";

export const VERSION = "1.138.0";

const latestPublicChanges = [
  "经济模拟",
  "贸易动画",
  "通航河流",
  "3D视图：侵蚀地形",
  "3D视图：卫星纹理",
  "锯齿状海岸线",
  "高度图编辑器：填充画笔",
  "编辑器：撤销按钮",
  "小地图",
  "概览对话框中的搜索输入",
  "自定义城镇分组和图标选择",
  "可以设置自定义图像作为标记或军团图标",
  "子地图和变换工具重做",
  "Azgaar机器人回答问题和提供帮助"
];

export function parseMapVersion(version: string): string {
  let [major, minor, patch] = version.split(".");

  if (patch === undefined) {
    // e.g. 1.732
    const compactVersion = minor!;
    minor = compactVersion.slice(0, 2);
    patch = compactVersion.slice(2);
  }

  // e.g. 0.7b
  const majorN = parseInt(major!, 10) || 0;
  const minorN = parseInt(minor, 10) || 0;
  const patchN = parseInt(patch, 10) || 0;

  return `${majorN}.${minorN}.${patchN}`;
}

export function isValidVersion(versionString: string | null | undefined): boolean {
  if (!versionString) return false;
  const [major, minor, patch] = versionString.split(".");
  return !Number.isNaN(Number(major)) && !Number.isNaN(Number(minor)) && !Number.isNaN(Number(patch));
}

export type VersionComparison = { isEqual: boolean; isNewer: boolean; isOlder: boolean };

export function compareVersions(
  version1: string | null | undefined,
  version2: string | null | undefined,
  options: { major?: boolean; minor?: boolean; patch?: boolean } = { major: true, minor: true, patch: true }
): VersionComparison {
  if (!isValidVersion(version1) || !isValidVersion(version2)) return { isEqual: false, isNewer: false, isOlder: false };

  let [major1, minor1, patch1] = version1!.split(".").map(Number) as [number, number, number];
  let [major2, minor2, patch2] = version2!.split(".").map(Number) as [number, number, number];

  if (!options.major) major1 = major2 = 0;
  if (!options.minor) minor1 = minor2 = 0;
  if (!options.patch) patch1 = patch2 = 0;

  const isEqual = major1 === major2 && minor1 === minor2 && patch1 === patch2;
  const isNewer = major1 > major2 || (major1 === major2 && (minor1 > minor2 || (minor1 === minor2 && patch1 > patch2)));
  const isOlder = major1 < major2 || (major1 === major2 && (minor1 < minor2 || (minor1 === minor2 && patch1 < patch2)));

  return { isEqual, isNewer, isOlder };
}

export async function cleanupData(): Promise<void> {
  await clearCache();
  localStorage.clear();
  localStorage.setItem("version", VERSION);
  localStorage.setItem("disable_click_arrow_tooltip", "true");
  location.reload();
}

async function clearCache(): Promise<unknown> {
  const cacheNames = await caches.keys();
  return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
}

function showUpdateWindow(storedVersion: string | null): void {
  const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
  const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
  const discord = "https://discordapp.com/invite/X7E84HU";
  const patreon = "https://www.patreon.com/azgaar";

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
      ${latestPublicChanges.map(change => `<li>${change}</li>`).join("")}
    </ul>

    <p>加入原作者的 <a href="${discord}" target="_blank">Discord 群聊</a>或<a href="${reddit}" target="_blank">Reddit 社区</a>提出问题，分享地图，讨论生成器和世界构建，报告错误并提出新功能。</p>
    <span><i>感谢所有支持，到<a href="${patreon}" target="_blank">Patreon（赞助网站）</a>上支持原作者!</i></span>`;

  $("#alert").dialog({
    resizable: false,
    title: "幻想地图生成器更新",
    width: "28em",
    position: { my: "center center-4em", at: "center", of: "svg" },
    buttons: {
      清空缓存: () => cleanupData(),
      不再显示: function (this: HTMLElement) {
        $(this).dialog("close");
        localStorage.setItem("version", VERSION);
      }
    }
  });
}

function announceVersion(): void {
  if (parseMapVersion(VERSION) !== VERSION) alert("versioning：格式或解析函数无效");

  document.title += ` v${VERSION}`;
  const loadingScreenVersion = document.getElementById("versionText");
  if (loadingScreenVersion) loadingScreenVersion.innerText = `v${VERSION}`;

  const storedVersion = localStorage.getItem("version");
  if (compareVersions(storedVersion, VERSION, { major: true, minor: true, patch: false }).isOlder) {
    setTimeout(() => showUpdateWindow(storedVersion), 6000);
  }

  // 汉化版定制：首次访问时弹网络可达性检测（延迟 10s）
  if (storedVersion === null) {
    setTimeout(showConnectivityDialog, 10000);
  }
}

announceVersion();

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var VERSION: string;
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var cleanupData: () => Promise<void>;
}

// temp legacy compatibility
window.VERSION = VERSION;
window.cleanupData = cleanupData;
