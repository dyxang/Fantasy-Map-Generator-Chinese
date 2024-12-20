"use strict";
/**
 * Version Control Guidelines
 * --------------------------
 * We use Semantic Versioning: major.minor.patch. Refer to https://semver.org
 * Our .map file format is considered the public API.
 *
 * Update the version MANUALLY on each merge to main:
 * 1. MAJOR version: Incompatible changes that break existing maps
 * 2. MINOR version: Additions or changes that are backward-compatible but may require old .map files to be updated
 * 3. PATCH version: Backward-compatible bug fixes and small features that do not affect the .map file format
 *
 * Example: 1.102.2 -> Major version 1, Minor version 102, Patch version 2
 */

const VERSION = "1.106.7";
if (parseMapVersion(VERSION) !== VERSION) alert("versioning.js: Invalid format or parsing function");

{
  document.title += " v" + VERSION;
  const loadingScreenVersion = document.getElementById("versionText");
  if (loadingScreenVersion) loadingScreenVersion.innerText = `v${VERSION}`;

  const storedVersion = localStorage.getItem("version");
  if (storedVersion === null || compareVersions(storedVersion, VERSION, {major: true, minor: true, patch: false}).isOlder) {
    setTimeout(showUpdateWindow, 6000);
  }

  function showUpdateWindow() {
    const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
    const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
    const discord = "https://discordapp.com/invite/X7E84HU";
    const patreon = "https://www.patreon.com/azgaar";

    alertMessage.innerHTML = /* html */ `幻想地图生成器更新到版本<strong>${VERSION}</strong>，此版本兼容<a href="${changelog}" target="_blank">这些版本</a>，地图文件将自动更新
      ${storedVersion ? "<span><strong>⚠一定要点击</strong>重新加载页面以获取新的代码。</span>" : ""}
<p><strong>⚠请必须仔细阅读以下内容！</strong></p>
<p>❗因代码底层逻辑，推荐电脑访问达到最好体验❗<p>
<p>①<a href="https://www.8desk.top" target="_blank">主站链接</a>②<a href="https://hk.8desk.top" target="_blank">国内节点</a>③<a href="https://zan.8desk.top" target="_blank">信息站</a></p>
<p>应要求，建了个汉化版交流的群：873020847</p>汉化版完全免费，支持译者:
<p><a href="https://afdian.net/a/freeguy" target="_blank" style="color: #946ce6;">爱发电</a></p>
<p><a href="https://zan.8desk.top/#/./SU" target="_blank" style="color: #42b983;">微信赞赏码</a><p>
      <ul>
        <strong>最近更新:</strong>
        <li>下位/变化图重做</li>
        <li>助手（右下气泡）提供生成器相关帮助，可用中文</li>
        <li>标签:可以设置字母间距</li>
        <li>Zone性能改进</li>
        <li>注释编辑器:按需AI文本生成</li>
        <li>新样式预设:Dark Seas</li>
        <li>新路线生成算法</li>
        <li>路线概览工具</li>
        <li>可配置经度</li>
        <li>预览村庄地图</li>
        <li>渲染海洋高程图</li>
      </ul>

      <p>加入作者 <a href="${discord}" target="_blank">Discord server</a> 和 <a href="${reddit}" target="_blank">Reddit 社区</a>提出问题，分享地图，讨论生成器和世界构建，报告错误并提出新功能。</p>
      <span><i>感谢所有支持，去<a href="${patreon}" target="_blank">Patreon网站</a>上支持原作者!</i></span>`;

    $("#alert").dialog({
      resizable: false,
      title: "幻想地图生成器更新",
      width: "28em",
      position: {my: "center center-4em", at: "center", of: "svg"},
      buttons: {
        "清空缓存": () => cleanupData(),
        "不再显示": function () {
          $(this).dialog("close");
          localStorage.setItem("version", VERSION);
        }
      }
    });
  }
}

async function cleanupData() {
  await clearCache();
  localStorage.clear();
  localStorage.setItem("version", VERSION);
  localStorage.setItem("disable_click_arrow_tooltip", "true");
  location.reload();
}

async function clearCache() {
  const cacheNames = await caches.keys();
  return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
}

function parseMapVersion(version) {
  let [major, minor, patch] = version.split(".");

  if (patch === undefined) {
    // e.g. 1.732
    minor = minor.slice(0, 2);
    patch = minor.slice(2);
  }

  // e.g. 0.7b
  major = parseInt(major) || 0;
  minor = parseInt(minor) || 0;
  patch = parseInt(patch) || 0;

  return `${major}.${minor}.${patch}`;
}

function isValidVersion(versionString) {
  if (!versionString) return false;
  const [major, minor, patch] = versionString.split(".");
  return !isNaN(major) && !isNaN(minor) && !isNaN(patch);
}

function compareVersions(version1, version2, options = {major: true, minor: true, patch: true}) {
  if (!isValidVersion(version1) || !isValidVersion(version2)) return {isEqual: false, isNewer: false, isOlder: false};

  let [major1, minor1, patch1] = version1.split(".").map(Number);
  let [major2, minor2, patch2] = version2.split(".").map(Number);

  if (!options.major) major1 = major2 = 0;
  if (!options.minor) minor1 = minor2 = 0;
  if (!options.patch) patch1 = patch2 = 0;

  const isEqual = major1 === major2 && minor1 === minor2 && patch1 === patch2;
  const isNewer = major1 > major2 || (major1 === major2 && (minor1 > minor2 || (minor1 === minor2 && patch1 > patch2)));
  const isOlder = major1 < major2 || (major1 === major2 && (minor1 < minor2 || (minor1 === minor2 && patch1 < patch2)));

  return {isEqual, isNewer, isOlder};
}