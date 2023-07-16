"use strict";

// version and caching control
const version = "1.89.32";
const notifactionv = "2023.07.16.2121"; // generator version, update each time

{
  document.title += " v" + version;
  const loadingScreenVersion = document.getElementById("version");
  if (loadingScreenVersion) loadingScreenVersion.innerHTML = version;

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
<p><strong>⚠请汉化版使用者仔细阅读以下内容！</strong>
<p>我一直在修补这个个人汉化版本，但是也不知道有多少人在用，而且该网站域名九月初就要到期了，所以我发起了一个投票（在【关于】页面里），看看使用汉化的人多不多，多的话我就续费域名。
      <ul>
        <strong>从上次汉化1.83版更新到该版本有了:</strong>
        <li>自动保存功能(选项中)</li>
        <li>谷歌翻译(选项中)</li>
        <li>宗教可以像文化一样被编辑和重绘</li>
        <li>锁定国家、省、文化和宗教防止“重新生成”的影响</li>
        <li>高度图笔刷:线性编辑选项</li>
        <li>汉化改进及为了理解还原英文的部分</li>
        <li>汉化破坏代码结构的问题</li>
        <li>以及更多细微改变</li>
      </ul>

      <p>Join our <a href="${discord}" target="_blank">Discord server</a> and <a href="${reddit}" target="_blank">Reddit community</a> to ask questions, share maps, discuss the Generator and Worlbuilding, report bugs and propose new features.</p>
      <span><i>Thanks for all supporters on <a href="${patreon}" target="_blank">Patreon</a>!</i></span>`;

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
  };
  const notifaction_Number = parseFloat(notifactionv);
  const stored_notifactionv = localStorage.getItem("notifactionv") ? parseFloat(localStorage.getItem("notifactionv")) : 0;

  const notifaction_isOutdated = stored_notifactionv !== notifaction_Number;
  if (notifaction_isOutdated) clearCache();

  const notifaction_showUpdate = stored_notifactionv < notifaction_Number;
  if (notifaction_showUpdate) setTimeout(show_notifaction_Window, 60000);

  function show_notifaction_Window() {
    const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";


    alertMessage.innerHTML = /* html */ `<strong>更新时间：${notifactionv}</strong>
<p><strong></strong><p>
      <ul>
修复破坏代码的汉化;润色汉化；修改错误汉化（不结合上下文后果）；还原部分英文
      </ul>
`;

    const buttons = {
      好的: function () {
        $(this).dialog("close");
        if (stored_notifactionv) localStorage.clear();
        localStorage.setItem("notifactionv", notifactionv);
      }
    };

    if (stored_notifactionv) {
      buttons.Reload = () => {
        localStorage.clear();
        localStorage.setItem("notifactionv", notifactionv);
        location.reload();
      };
    }

    $("#alert").dialog({
      resizable: false,
      title: "汉化版公告栏",
      width: "28em",
      position: {my: "center center-4em", at: "bottom ", of: "svg"},
      buttons
    });
  }

  async function clearCache() {
    const cacheNames = await caches.keys();
    Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }
}
