/**
 * Connectivity Check Dialog（汉化版定制）
 * ---------------------------------------
 * 启动时检测 8 个外部资源链接的可访问性。每条 5s 超时立即更新对应行，
 * 全部出结论后才挂 `知道了` 按钮。检测过程弹窗关闭 X 隐藏、Escape 禁用、按钮为空。
 *
 * 此函数由 src/services/versioning.ts 在首次访问时调用（延迟 10s）。
 */

const CHECK_TIMEOUT_MS = 5000;

const TARGETS = [
  { name: "Google Fonts CSS", url: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC" },
  { name: "Google Fonts 字体", url: "https://fonts.gstatic.com/s/notosanssc/v36/k3kXo84MvpQhSxt5u1K2J4bFfQl4.woff2" },
  { name: "jsdelivr 镜像", url: "https://gcore.jsdelivr.net/gh/dyxang/zh_font@main/" },
  { name: "unpkg", url: "https://unpkg.com/three@0.184.0/build/three.module.js" },
  { name: "Google Cloud Storage", url: "https://storage.googleapis.com/workbox-cdn/releases/6.2.0/workbox-sw.js" },
  { name: "watabou.github.io", url: "https://watabou.github.io/" },
  { name: "Deorum 遭遇战", url: "https://deorum.8desk.top/encounter/1" },
  { name: "OpenAI / Anthropic API", url: "https://api.openai.com/" }
];

export function showConnectivityDialog(): void {
  const total = TARGETS.length;
  let done = 0;

  const setRow = (i: number, text: string, color: string) => {
    const cell = alertMessage.querySelector(`[data-row="${i}"]`);
    if (cell) cell.innerHTML = `<span style="color:${color};">${text}</span>`;
  };

  const probe = async (i: number) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
    const start = performance.now();
    try {
      await fetch(TARGETS[i].url, { mode: "no-cors", signal: ctrl.signal });
      setRow(i, `✓ 可达 (${Math.round(performance.now() - start)}ms)`, "#2e8b57");
      return true;
    } catch {
      setRow(i, "访问缓慢/超时（>5s）", "#c0392b");
      return false;
    } finally {
      clearTimeout(timer);
      const summary = document.getElementById("connectivity-summary");
      if (summary) summary.textContent = `${++done} / ${total}`;
    }
  };

  alertMessage.innerHTML = `
    <p>正在检测外部资源可访问性…</p>
    <table style="width:100%;border-collapse:collapse;font-size:0.95em;table-layout:fixed;">
      <colgroup>
        <col style="width:30%">
        <col>
        <col style="width:150px">
      </colgroup>
      <thead><tr>
        <th style="text-align:left;padding:2px 8px;">资源</th>
        <th style="text-align:left;padding:2px 8px;">URL</th>
        <th style="text-align:left;padding:2px 8px;">状态</th>
      </tr></thead>
      <tbody>${TARGETS.map(
        (t, i) => `
        <tr>
          <td style="text-align:left;padding:2px 8px;">${t.name}</td>
          <td style="text-align:left;padding:2px 8px;color:#888;font-size:0.9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${t.url}">${t.url}</td>
          <td data-row="${i}" style="padding:2px 8px;color:#666;white-space:nowrap;">检测中…</td>
        </tr>`
      ).join("")}
      </tbody>
    </table>
    <p id="connectivity-summary" style="margin-top:8px;font-size:0.9em;color:#666;">0 / ${total}</p>`;

  const $dialog = $("#alert").dialog({
    resizable: false,
    title: "网络可达性检测",
    width: "auto",
    maxWidth: 640,
    position: { my: "center center", at: "center center", of: window },
    buttons: {},
    closeOnEscape: false,
    open: () => $(".ui-dialog-titlebar-close").hide()
  });

  Promise.all(TARGETS.map((_, i) => probe(i))).then(results => {
    const unreachable = results.filter(ok => !ok).length;
    const warning = unreachable
      ? `<p style="color:#c0392b;margin-top:8px;"><strong>检测到 ${unreachable} 项访问困难</strong>，请切换能访问全球网络的工具。</p>`
      : `<p style="color:#2e8b57;margin-top:8px;">所有依赖资源均可达。</p>`;
    alertMessage.insertAdjacentHTML("beforeend", warning);
    $dialog.dialog("option", "buttons", {
      知道了(this: HTMLElement) {
        $(this).dialog("close");
      }
    });
  });
}
