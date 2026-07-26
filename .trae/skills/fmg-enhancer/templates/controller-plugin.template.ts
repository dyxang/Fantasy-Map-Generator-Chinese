/**
 * FMG 低侵入 Controller 插件骨架（形态 A）
 *
 * 使用步骤：
 * 1. 复制本文件为 src/controllers/my-tool.ts，重命名导出对象 MyTool 与 DOM id 前缀 myTool
 * 2. 在 src/controllers/index.ts 注册表追加一行（唯一允许修改的现有文件）：
 *    MyTool: () => import("@/controllers/my-tool").then(m => m.MyTool),
 * 3. 调用入口：Controllers.MyTool.open() 或 window.Controllers.MyTool.open()
 *
 * 规范要点：打开时一次性注入 DOM、关闭时彻底销毁；样式随对话框创建/销毁；
 * 只读 pack/grid，如需修改 state 必须在修改后触发对应重绘。
 */

function open(): void {
  closeDialogs("#myTool");
  renderDialog();

  // jQuery UI dialog（项目 legacy UI 体系，见 src/controllers/minimap.ts）
  $("#myTool").dialog({
    title: "My Tool",
    resizable: false,
    width: "auto",
    position: { my: "center", at: "center", of: "svg" },
    close: closeMyTool
  });
}

function renderDialog(): void {
  document.getElementById("myTool")?.remove();
  document.getElementById("myToolStyles")?.remove();

  // 存在性守卫：上游 DOM 结构变动时给出明确报错而非静默失败
  const host = document.getElementById("dialogs");
  if (!host) throw new Error("MyTool: #dialogs container not found");

  // 一次性注入，避免循环 append 引发多次 reflow
  host.insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="myTool" class="dialog stable">
      <div id="myToolBody"><!-- 插件内容 --></div>
    </div>`
  );

  // 样式隔离：仅作用于 #myTool 作用域，不改全局 CSS
  const style = document.createElement("style");
  style.id = "myToolStyles";
  style.textContent = /* css */ `
    #myTool { padding: 0.5em; }
    #myToolBody { min-width: 20em; }
  `;
  document.head.appendChild(style);

  // 事件在 build 时绑定，随 DOM 销毁自动释放
  // document.getElementById("myToolRun")?.addEventListener("click", run);
}

function closeMyTool(this: HTMLElement): void {
  // 销毁生成的子树与样式；清理计时器/监听器/动画（隐藏 ≠ 关闭）
  document.getElementById("myTool")?.remove();
  document.getElementById("myToolStyles")?.remove();
}

// 单一命名导出，注册表按键名解析；方法经 registry 调用后均返回 Promise
export const MyTool = { open };
