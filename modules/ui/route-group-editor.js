"use strict";

function editRouteGroups() {
  if (customization) return;
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  addLines();

  $("#routeGroupsEditor").dialog({
    title: "路线组编辑器",
    resizable: false,
    position: {my: "left top", at: "left+10 top+140", of: "#map"}
  });

  if (modules.editRouteGroups) return;
  modules.editRouteGroups = true;

  // add listeners
  byId("routeGroupsEditorAdd").addEventListener("click", addGroup);
  byId("routeGroupsEditorBody").on("click", ev => {
    const group = ev.target.closest(".states")?.dataset.id;
    if (ev.target.classList.contains("editStyle")) editStyle("routes", group);
    else if (ev.target.classList.contains("removeGroup")) removeGroup(group);
  });

  function addLines() {
    byId("routeGroupsEditorBody").innerHTML = "";

    const lines = Array.from(routes.selectAll("g")._groups[0]).map(el => {
      const count = el.children.length;
      return /* html */ `<div data-id="${el.id}" class="states" style="display: flex; justify-content: space-between;">
          <span>${el.id} (${count})</span>
          <div style="width: auto; display: flex; gap: 0.4em;">
            <span data-tip="Edit style" class="editStyle icon-brush pointer" style="font-size: smaller;"></span>
            <span data-tip="Remove group" class="removeGroup icon-trash pointer"></span>
          </div>
        </div>`;
    });

    byId("routeGroupsEditorBody").innerHTML = lines.join("");
  }

  const DEFAULT_GROUPS = ["roads", "trails", "searoutes"];

  function addGroup() {
    prompt("输入组名", {default: "route-group-new"}, v => {
      let group = v
        .toLowerCase()
        .replace(/ /g, "_")
        .replace(/[^\w\s]/gi, "");

      if (!group) return tip("无效组名", false, "error");
      if (!group.startsWith("route-")) group = "route-" + group;
      if (byId(group)) return tip("这个名字的元素已经有了。给个独一无二的名字吧。", false, "error");
      if (Number.isFinite(+group.charAt(0))) return tip("组名称应该以字母开头。", false, "error");

      routes
        .append("g")
        .attr("id", group)
        .attr("stroke", "#000000")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "1 0.5")
        .attr("stroke-linecap", "butt");
      byId("routeGroup")?.options.add(new Option(group, group));
      addLines();

      byId("routeCreatorGroupSelect").options.add(new Option(group, group));
    });
  }

  function removeGroup(group) {
    confirmationDialog({
      title: "移除路线组",
      message:
        "确定要删除整个组吗?该组中的所有路线将被删除。<br>此操作无法恢复",
      confirm: "移除",
      onConfirm: () => {
        pack.routes.filter(r => r.group === group).forEach(Routes.remove);
        if (!DEFAULT_GROUPS.includes(group)) routes.select(`#${group}`).remove();
        addLines();
      }
    });
  }
}
