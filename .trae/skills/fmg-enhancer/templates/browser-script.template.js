/**
 * FMG 浏览器脚本骨架（形态 C，零构建）
 *
 * 使用方式：在 FMG 页面打开 DevTools 控制台，粘贴全文执行；
 * 或保存为书签小脚本（javascript: 前缀需自行压缩为单行）。
 *
 * 规范要点：只通过 window 全局交互，不 import 项目源码；
 * 只读优先；修改 state 前先提醒用户保存 .map 备份，修改后手动触发重绘。
 */
(() => {
  "use strict";

  // 1. 环境自检：确认在 FMG 页面内且地图已生成/加载
  if (typeof pack === "undefined" || typeof grid === "undefined") {
    throw new Error("请先在 Azgaar's Fantasy Map Generator 页面中生成或加载一张地图");
  }

  // 2. 备份提醒（仅在需要修改 state 时取消注释）
  // if (!confirm("本脚本将修改地图数据。请确认已保存 .map 备份，是否继续？")) return;

  // 3. 只读访问 world state 示例
  const burgs = pack.burgs.filter(b => b.i && !b.removed);
  console.log(`当前地图共有 ${burgs.length} 个城镇（burg）`);

  // 4. 结果输出示例：优先使用项目内置的 downloadFile 全局导出文件
  // const data = JSON.stringify(burgs, null, 2);
  // downloadFile(data, "burgs-export.json", "application/json");

  // 5. 若修改了 state，必须手动触发受影响图层重绘，例如：
  // drawLayers(); // 或更精确的 drawBurgs() / drawStateLabels() 等

  // 6. 使用项目内置 tip 提示完成状态
  if (typeof tip === "function") tip("脚本执行完成", false, "success");
})();
