"use strict";

// version and caching control
const notifactionv = "2023.07.17.1012"; 
 // generator version, update each time

{
  const notifaction_Number = parseFloat(notifactionv);
  const stored_notifactionv = localStorage.getItem("notifactionv") ? parseFloat(localStorage.getItem("notifactionv")) : 0;

  const notifaction_isOutdated = stored_notifactionv !== notifaction_Number;
  if (notifaction_isOutdated) clearCache();

  const notifaction_showUpdate = stored_notifactionv < notifaction_Number;
  if (notifaction_showUpdate) setTimeout(show_notifaction_Window, 6000);

  function show_notifaction_Window() {


    alertMessage.innerHTML = /* html */ `<strong>更新时间：${notifactionv}</strong>
<p><strong>建了个交流群，群号：873020847</strong><p>
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
