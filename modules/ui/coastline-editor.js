"use strict";

function editCoastline() {
  if (customization) return;
  closeDialogs(".stable");
  if (layerIsOn("toggleCells")) toggleCells();

  $("#coastlineEditor").dialog({
    title: "编辑海岸线",
    resizable: false,
    position: {my: "center top+20", at: "top", of: d3.event, collision: "fit"},
    close: closeCoastlineEditor
  });

  debug.append("g").attr("id", "vertices");
  const node = d3.event.target;
  elSelected = d3.select(node);
  selectCoastlineGroup(node);
  drawCoastlineVertices();
  viewbox.on("touchmove mousemove", null);

  if (modules.editCoastline) return;
  modules.editCoastline = true;

  // add listeners
  byId("coastlineGroupsShow").on("click", showGroupSection);
  byId("coastlineGroup").on("change", changeCoastlineGroup);
  byId("coastlineGroupAdd").on("click", toggleNewGroupInput);
  byId("coastlineGroupName").on("change", createNewGroup);
  byId("coastlineGroupRemove").on("click", removeCoastlineGroup);
  byId("coastlineGroupsHide").on("click", hideGroupSection);
  byId("coastlineEditStyle").on("click", editGroupStyle);

  function drawCoastlineVertices() {
    const featureId = +elSelected.attr("data-f");
    const {vertices, area} = pack.features[featureId];

    const cellsNumber = pack.cells.i.length;
    const neibCells = unique(vertices.map(v => pack.vertices.c[v]).flat()).filter(cellId => cellId < cellsNumber);
    debug
      .select("#vertices")
      .selectAll("polygon")
      .data(neibCells)
      .enter()
      .append("polygon")
      .attr("points", getPackPolygon)
      .attr("data-c", d => d);

    debug
      .select("#vertices")
      .selectAll("circle")
      .data(vertices)
      .enter()
      .append("circle")
      .attr("cx", d => pack.vertices.p[d][0])
      .attr("cy", d => pack.vertices.p[d][1])
      .attr("r", 0.4)
      .attr("data-v", d => d)
      .call(d3.drag().on("drag", handleVertexDrag).on("end", handleVertexDragEnd))
      .on("mousemove", () =>
        tip("拖动可移动顶点，仅用于微调！编辑高程图去更改实际单元格高度！")
      );

    coastlineArea.innerHTML = si(getArea(area)) + " " + getAreaUnit();
  }

  function handleVertexDrag() {
    const {vertices, features} = pack;

    const x = rn(d3.event.x, 2);
    const y = rn(d3.event.y, 2);
    this.setAttribute("cx", x);
    this.setAttribute("cy", y);

    const vertexId = d3.select(this).datum();
    vertices.p[vertexId] = [x, y];

    const featureId = +elSelected.attr("data-f");
    const feature = features[featureId];

    // change coastline path
    defs.select("#featurePaths > path#feature_" + featureId).attr("d", getFeaturePath(feature));

    // update area
    const points = feature.vertices.map(vertex => vertices.p[vertex]);
    feature.area = Math.abs(d3.polygonArea(points));
    coastlineArea.innerHTML = si(getArea(feature.area)) + " " + getAreaUnit();

    // update cell
    debug.select("#vertices").selectAll("polygon").attr("points", getPackPolygon);
  }

  function handleVertexDragEnd() {
    if (layerIsOn("toggleStates")) drawStates();
    if (layerIsOn("toggleProvinces")) drawProvinces();
    if (layerIsOn("toggleBorders")) drawBorders();
    if (layerIsOn("toggleBiomes")) drawBiomes();
    if (layerIsOn("toggleReligions")) drawReligions();
    if (layerIsOn("toggleCultures")) drawCultures();
  }

  function showGroupSection() {
    document.querySelectorAll("#coastlineEditor > button").forEach(el => (el.style.display = "none"));
    byId("coastlineGroupsSelection").style.display = "inline-block";
  }

  function hideGroupSection() {
    document.querySelectorAll("#coastlineEditor > button").forEach(el => (el.style.display = "inline-block"));
    byId("coastlineGroupsSelection").style.display = "none";
    byId("coastlineGroupName").style.display = "none";
    byId("coastlineGroupName").value = "";
    byId("coastlineGroup").style.display = "inline-block";
  }

  function selectCoastlineGroup(node) {
    const group = node.parentNode.id;
    const select = byId("coastlineGroup");
    select.options.length = 0; // remove all options

    coastline.selectAll("g").each(function () {
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });
  }

  function changeCoastlineGroup() {
    byId(this.value).appendChild(elSelected.node());
  }

  function toggleNewGroupInput() {
    if (coastlineGroupName.style.display === "none") {
      coastlineGroupName.style.display = "inline-block";
      coastlineGroupName.focus();
      coastlineGroup.style.display = "none";
    } else {
      coastlineGroupName.style.display = "none";
      coastlineGroup.style.display = "inline-block";
    }
  }

  function createNewGroup() {
    if (!this.value) return tip("请提供一个有效的组名");

    const group = this.value
      .toLowerCase()
      .replace(/ /g, "_")
      .replace(/[^\w\s]/gi, "");

    if (byId(group)) return tip("具有此 ID 的元素已经存在。请提供唯一的名称", false, "error");

    if (Number.isFinite(+group.charAt(0))) return tip("组名应以字母开头", false, "error");

    // just rename if only 1 element left
    const oldGroup = elSelected.node().parentNode;
    const basic = ["sea_island", "lake_island"].includes(oldGroup.id);
    if (!basic && oldGroup.childElementCount === 1) {
      byId("coastlineGroup").selectedOptions[0].remove();
      byId("coastlineGroup").options.add(new Option(group, group, false, true));
      oldGroup.id = group;
      toggleNewGroupInput();
      byId("coastlineGroupName").value = "";
      return;
    }

    // create a new group
    const newGroup = elSelected.node().parentNode.cloneNode(false);
    byId("coastline").appendChild(newGroup);
    newGroup.id = group;
    byId("coastlineGroup").options.add(new Option(group, group, false, true));
    byId(group).appendChild(elSelected.node());

    toggleNewGroupInput();
    byId("coastlineGroupName").value = "";
  }

  function removeCoastlineGroup() {
    const group = elSelected.node().parentNode.id;
    if (["sea_island", "lake_island"].includes(group))
      return tip("这是默认组之一，无法删除", false, "error");

    const count = elSelected.node().parentNode.childElementCount;
    alertMessage.innerHTML = /* html */ `确实要删除该组吗? 该组的所有海岸线元素 (${count}) 将被移到
      <i>sea_island</i> 组`;
    $("#alert").dialog({
      resizable: false,
      title: "删除海岸线组",
      width: "26em",
      buttons: {
        删除: function () {
          $(this).dialog("close");
          const sea = byId("sea_island");
          const groupEl = byId(group);
          while (groupEl.childNodes.length) {
            sea.appendChild(groupEl.childNodes[0]);
          }
          groupEl.remove();
          byId("coastlineGroup").selectedOptions[0].remove();
          byId("coastlineGroup").value = "sea_island";
        },
        取消: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function editGroupStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("coastline", g);
  }

  function closeCoastlineEditor() {
    debug.select("#vertices").remove();
    unselect();
  }
}
