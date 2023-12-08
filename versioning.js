"use strict";

// version and caching control
const version = "1.95.01";// generator version, update each time

{
  document.title += " v" + version;
  const loadingScreenVersion = document.getElementById("versionText");
  if (loadingScreenVersion) loadingScreenVersion.innerText = `v${version}`;

  const versionNumber = parseFloat(version);
  const storedVersion = localStorage.getItem("version") ? parseFloat(localStorage.getItem("version")) : 0;

  const isOutdated = storedVersion !== versionNumber;
  if (isOutdated) clearCache();

  const showUpdate = storedVersion < versionNumber;
  if (showUpdate) setTimeout(showUpdateWindow, 6000);

  function showUpdateWindow() {
    const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
    const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
    const discord = "https://discordapp.com/invite/X7E84HU";
    const patreon = "https://www.patreon.com/azgaar";

    alertMessage.innerHTML = /* html */ `幻想地图生成器更新到版本<strong>${version}</strong>，此版本兼容<a href="${changelog}" target="_blank">这些版本</a>，地图文件将自动更新
      ${storedVersion ? "<span><strong>⚠一定要点击</strong>重新加载页面以获取新的代码。</span>" : ""}
<p><strong>⚠请汉化版使用者阅读以下内容！</strong></p>
<p>①<a href="https://www.8desk.top" target="_blank">主站链接</a>②<a href="https://hk.8desk.top" target="_blank">国内节点</a>③<a href="https://zan.8desk.top" target="_blank">信息站</a></p>
<p>应要求，建了个汉化版交流的群：873020847</p>汉化版完全免费，支持译者:
<p><a href="https://afdian.net/a/freeguy" target="_blank" style="color: #946ce6;">爱发电</a></p>
<p><a href="https://zan.8desk.top/#/./SU" target="_blank" style="color: #42b983;">微信赞赏码</a><p>
      <ul>
        <strong>版本更新内容:</strong>
        <li>渐变视觉图层和渐变造型选项</li>
        <li>自定义高程图配色方案</li>
        <li>新的样式预设Night和高程图配色方案</li>
        <li>随机偶遇事件 (整合了 <a href="https://deorum.vercel.app/" target="_blank">Deorum</a> 国内可能无法访问）</li>
        <li>自动加载上次保存的地图可选(参见<i>加载行为</i>选项)</li>
        <li>新的国家标签放置算法</li>
        <li>南北极温度可独立设置</li>
        <li>70多项新纹章填充</li>
        <li>支持多色纹章填充</li>
        <li>新3D场景选项和改进</li>
        <li>支持国家合并</li>
      </ul>
      <p>加入作者 <a href="${discord}" target="_blank">Discord</a> 和 <a href="${reddit}" target="_blank">Reddit 社区</a>提出问题，分享地图，讨论生成器和世界构建，报告错误并提出新功能。</p>
      <span><i>感谢所有支持，去<a href="${patreon}" target="_blank">支持原作者（Patreon）</a>!</i></span>
`;

    const buttons = {
      好的: function () {
        $(this).dialog("close");
        if (storedVersion) localStorage.clear();
        localStorage.setItem("version", version);
      }
    };

    if (storedVersion) {
      buttons.Reload = () => {
        localStorage.clear();
        localStorage.setItem("version", version);
        location.reload();
      };
    }

    $("#alert").dialog({
      resizable: false,
      title: "更新说明",
      width: "28em",
      position: {my: "center center-4em", at: "center", of: "svg"},
      buttons
    });
  }

  async function clearCache() {
    const cacheNames = await caches.keys();
    Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }
}
