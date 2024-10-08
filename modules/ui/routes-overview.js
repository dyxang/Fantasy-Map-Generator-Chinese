"use strict";

function overviewRoutes() {
  if (customization) return;
  closeDialogs("#routesOverview, .stable");
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  const body = byId("routesBody");
  routesOverviewAddLines();
  $("#routesOverview").dialog();

  if (modules.overviewRoutes) return;
  modules.overviewRoutes = true;

  $("#routesOverview").dialog({
    title: "路线预览",
    resizable: false,
    width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  byId("routesOverviewRefresh").on("click", routesOverviewAddLines);
  byId("routesCreateNew").on("click", createRoute);
  byId("routesExport").on("click", downloadRoutesData);
  byId("routesLockAll").on("click", toggleLockAll);
  byId("routesRemoveAll").on("click", triggerAllRoutesRemove);

  // add line for each route
  function routesOverviewAddLines() {
    body.innerHTML = "";
    let lines = "";

    for (const route of pack.routes) {
      if (!route.points || route.points.length < 2) continue;
      route.name = route.name || Routes.generateName(route);
      route.length = route.length || Routes.getLength(route.i);
      const length = rn(route.length * distanceScale) + " " + distanceUnitInput.value;

      lines += /* html */ `<div
        class="states"
        data-id="${route.i}"
        data-name="${route.name}"
        data-group="${route.group}"
        data-length="${route.length}"
      >
        <span data-tip="定位并聚焦于路线" class="icon-dot-circled pointer"></span>
        <div data-tip="路线名" style="width: 15em; margin-left: 0.4em;">${route.name}</div>
        <div data-tip="路线组" style="width: 8em;">${route.group}</div>
        <div data-tip="路线长" style="width: 6em;">${length}</div>
        <span data-tip="编辑路线" class="icon-pencil"></span>
        <span class="locks pointer ${
          route.lock ? "icon-lock" : "icon-lock-open inactive"
        }" onmouseover="showElementLockTip(event)"></span>
        <span data-tip="移除路线" class="icon-trash-empty"></span>
      </div>`;
    }
    body.insertAdjacentHTML("beforeend", lines);

    // update footer
    routesFooterNumber.innerHTML = pack.routes.length;
    const averageLength = rn(d3.mean(pack.routes.map(r => r.length)) || 0);
    routesFooterLength.innerHTML = averageLength * distanceScale + " " + distanceUnitInput.value;

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.on("mouseenter", routeHighlightOn));
    body.querySelectorAll("div.states").forEach(el => el.on("mouseleave", routeHighlightOff));
    body.querySelectorAll("div > span.icon-dot-circled").forEach(el => el.on("click", zoomToRoute));
    body.querySelectorAll("div > span.icon-pencil").forEach(el => el.on("click", openRouteEditor));
    body.querySelectorAll("div > span.locks").forEach(el => el.addEventListener("click", toggleLockStatus));
    body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.on("click", triggerRouteRemove));

    applySorting(routesHeader);
  }

  function routeHighlightOn(event) {
    if (!layerIsOn("toggleRoutes")) toggleRoutes();
    const routeId = +event.target.dataset.id;
    routes
      .select("#route" + routeId)
      .attr("stroke", "red")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "none");
  }

  function routeHighlightOff(e) {
    const routeId = +e.target.dataset.id;
    routes
      .select("#route" + routeId)
      .attr("stroke", null)
      .attr("stroke-width", null)
      .attr("stroke-dasharray", null);
  }

  function zoomToRoute() {
    const routeId = +this.parentNode.dataset.id;
    const route = routes.select("#route" + routeId).node();
    highlightElement(route, 3);
  }

  function downloadRoutesData() {
    let data = "Id,Route,Group,Length\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function (el) {
      const d = el.dataset;
      const length = rn(d.length * distanceScale) + " " + distanceUnitInput.value;
      data += [d.id, d.name, d.group, length].join(",") + "\n";
    });

    const name = getFileName("Routes") + ".csv";
    downloadFile(data, name);
  }

  function openRouteEditor() {
    const routeId = "route" + this.parentNode.dataset.id;
    editRoute(routeId);
  }

  function toggleLockStatus() {
    const routeId = +this.parentNode.dataset.id;
    const route = pack.routes.find(route => route.i === routeId);
    if (!route) return;

    route.lock = !route.lock;
    if (this.classList.contains("icon-lock")) {
      this.classList.remove("icon-lock");
      this.classList.add("icon-lock-open");
      this.classList.add("inactive");
    } else {
      this.classList.remove("icon-lock-open");
      this.classList.add("icon-lock");
      this.classList.remove("inactive");
    }
  }

  function toggleLockAll() {
    const allLocked = pack.routes.every(route => route.lock);

    pack.routes.forEach(route => {
      route.lock = !allLocked;
    });

    routesOverviewAddLines();
    byId("routesLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
  }

  function triggerRouteRemove() {
    const routeId = +this.parentNode.dataset.id;
    confirmationDialog({
      title: "移除路线",
      message: "确定移除此路线？<br>操作不可恢复！",
      confirm: "移除",
      onConfirm: () => {
        const route = pack.routes.find(r => r.i === routeId);
        Routes.remove(route);
        routesOverviewAddLines();
      }
    });
  }

  function triggerAllRoutesRemove() {
    alertMessage.innerHTML = /* html */ `确定要移除所有路线？操作不可恢复！`;
    $("#alert").dialog({
      resizable: false,
      title: "移除所有路线",
      buttons: {
        移除: function () {
          pack.cells.routes = {};
          pack.routes = [];
          routes.selectAll("path").remove();

          routesOverviewAddLines();
          $(this).dialog("close");
        },
        取消: function () {
          $(this).dialog("close");
        }
      }
    });
  }
}
