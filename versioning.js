"use strict";

// version and caching control
const version = "1.89.38";// generator version, update each time

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

    alertMessage.innerHTML = /* html */ `幻想地图生成器更新到版本<strong>${version}</strong>此版本兼容<a href target="_blank">以前的版本</a>,加载的<i>.map</i>文件将自动更新
      ${storedVersion ? "<span><strong>⚠一定要点击</strong>重新加载页面以获取新的代码。</span>" : ""}
<p><strong>⚠请汉化版使用者阅读以下内容！</strong></p>
<p>应要求，建了个汉化版交流的群：873020847</p>

<p>我一直在修补这个个人汉化版本，但是也不知道有多少人在用，而且该网站域名九月初就要到期了，所以我发起了一个投票（在【关于】页面里），看看使用汉化的人多不多，多的话我就续费域名。</p>
<p><b>感谢4位神秘人和网友“长江长”的赞赏</b></p>
<p><img src="https://pic.imgdb.cn/item/64c48f1e1ddac507ccde116b.png" alt="赞赏码" style="max-height: 40vh;max-width: 40vw;"></p>
      <ul>
        <strong>版本更新内容，修复及改进不列出:</strong>
        <li>支持国家合并</li>
        <li>自动保存功能(选项中)</li>
        <li>谷歌翻译(选项中)</li>
        <li>宗教可以像文化一样被编辑和重绘</li>
        <li>锁定国家、省、文化和宗教防止“重新生成”的影响</li>
        <li>高程图笔刷:线性编辑选项</li>
      </ul>

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
