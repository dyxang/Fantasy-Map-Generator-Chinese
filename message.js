"use strict";

// version and caching control
const notifactionv = "2023.07.14"; // generator version, update each time

{
  const notifaction_Number = parseFloat(notifactionv);
  const stored_notifactionv = localStorage.getItem("notifactionv") ? parseFloat(localStorage.getItem("notifactionv")) : 0;

  const notifaction_isOutdated = stored_notifactionv !== notifaction_Number;
  if (notifaction_isOutdated) clearCache();

  const notifaction_showUpdate = stored_notifactionv < notifaction_Number;
  if (notifaction_showUpdate) setTimeout(show_notifaction_Window, 6000);

  function show_notifaction_Window() {
    const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";


    alertMessage.innerHTML = /* html */ `<strong>更新时间：${notifactionv}</strong>
<p><strong></strong><p>
      <ul>
统一了一些词，持续汉化；更改了几处生硬的汉化; 还原一部分汉化为英文（因为一些作者代码问题，强行汉化会让人摸不着头脑）
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
      position: {my: "center center-4em", at: "center", of: "svg"},
      buttons
    });
  }

  async function clearCache() {
    const cacheNames = await caches.keys();
    Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }
}
