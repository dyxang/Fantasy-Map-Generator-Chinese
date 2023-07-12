"use strict";
function overviewRivers() {
  if (customization) return;
  closeDialogs("#riversOverview, .stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  const body = document.getElementById("riversBody");
  riversOverviewAddLines();
  $("#riversOverview").dialog();

  if (modules.overviewRivers) return;
  modules.overviewRivers = true;

  $("#riversOverview").dialog({
    title: "河流概况",
    resizable: false,
    width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("riversOverviewRefresh").addEventListener("click", riversOverviewAddLines);
  document.getElementById("addNewRiver").addEventListener("click", toggleAddRiver);
  document.getElementById("riverCreateNew").addEventListener("click", createRiver);
  document.getElementById("riversBasinHighlight").addEventListener("click", toggleBasinsHightlight);
  document.getElementById("riversExport").addEventListener("click", downloadRiversData);
  document.getElementById("riversRemoveAll").addEventListener("click", triggerAllRiversRemove);

  // add line for each river
  function riversOverviewAddLines() {
    body.innerHTML = "";
    let lines = "";
    const unit = distanceUnitInput.value;

    for (const r of pack.rivers) {
      const discharge = r.discharge + " m³/s";
      const length = rn(r.length * distanceScaleInput.value) + " " + unit;
      const width = rn(r.width * distanceScaleInput.value, 3) + " " + unit;
      const basin = pack.rivers.find(river => river.i === r.basin)?.name;

      lines += /* html */ `<div
        class="states"
        data-id=${r.i}
        data-name="${r.name}"
        data-type="${r.type}"
        data-discharge="${r.discharge}"
        data-length="${r.length}"
        data-width="${r.width}"
        data-basin="${basin}"
      >
        <span data-tip="点击关注河流" class="icon-dot-circled pointer"></span>
        <div data-tip="河名" class="riverName">${r.name}</div>
        <div data-tip="河流类型名称" class="riverType">${r.type}</div>
        <div data-tip="河流流量(通量功率)" class="biomeArea">${discharge}</div>
        <div data-tip="从源头到出口的河流长度" class="biomeArea">${length}</div>
        <div data-tip="河口宽度" class="biomeArea">${width}</div>
        <input data-tip="流域(主干名称)" class="stateName" value="${basin}" disabled />
        <span data-tip="编辑河" class="icon-pencil"></span>
        <span data-tip="移除河" class="icon-trash-empty"></span>
      </div>`;
    }
    body.insertAdjacentHTML("beforeend", lines);

    // update footer
    riversFooterNumber.innerHTML = pack.rivers.length;
    const averageDischarge = rn(d3.mean(pack.rivers.map(r => r.discharge)));
    riversFooterDischarge.innerHTML = averageDischarge + " m³/s";
    const averageLength = rn(d3.mean(pack.rivers.map(r => r.length)));
    riversFooterLength.innerHTML = averageLength * distanceScaleInput.value + " " + unit;
    const averageWidth = rn(d3.mean(pack.rivers.map(r => r.width)), 3);
    riversFooterWidth.innerHTML = rn(averageWidth * distanceScaleInput.value, 3) + " " + unit;

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => riverHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => riverHighlightOff(ev)));
    body.querySelectorAll("div > span.icon-dot-circled").forEach(el => el.addEventListener("click", zoomToRiver));
    body.querySelectorAll("div > span.icon-pencil").forEach(el => el.addEventListener("click", openRiverEditor));
    body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.addEventListener("click", triggerRiverRemove));

    applySorting(riversHeader);
  }

  function riverHighlightOn(event) {
    if (!layerIsOn("toggleRivers")) toggleRivers();
    const r = +event.target.dataset.id;
    rivers
      .select("#river" + r)
      .attr("stroke", "red")
      .attr("stroke-width", 1);
  }

  function riverHighlightOff(e) {
    const r = +e.target.dataset.id;
    rivers
      .select("#river" + r)
      .attr("stroke", null)
      .attr("stroke-width", null);
  }

  function zoomToRiver() {
    const r = +this.parentNode.dataset.id;
    const river = rivers.select("#river" + r).node();
    highlightElement(river, 3);
  }

  function toggleBasinsHightlight() {
    if (rivers.attr("data-basin") === "hightlighted") {
      rivers.selectAll("*").attr("fill", null);
      rivers.attr("data-basin", null);
    } else {
      rivers.attr("data-basin", "hightlighted");
      const basins = [...new Set(pack.rivers.map(r => r.basin))];
      const colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

      basins.forEach((b, i) => {
        const color = colors[i % colors.length];
        pack.rivers
          .filter(r => r.basin === b)
          .forEach(r => {
            rivers.select("#river" + r.i).attr("fill", color);
          });
      });
    }
  }

  function downloadRiversData() {
    let data = "Id,River,Type,Discharge,Length,Width,Basin\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function (el) {
      const d = el.dataset;
      const discharge = d.discharge + " m³/s";
      const length = rn(d.length * distanceScaleInput.value) + " " + distanceUnitInput.value;
      const width = rn(d.width * distanceScaleInput.value, 3) + " " + distanceUnitInput.value;
      data += [d.id, d.name, d.type, discharge, length, width, d.basin].join(",") + "\n";
    });

    const name = getFileName("Rivers") + ".csv";
    downloadFile(data, name);
  }

  function openRiverEditor() {
    const id = "river" + this.parentNode.dataset.id;
    editRiver(id);
  }

  function triggerRiverRemove() {
    const river = +this.parentNode.dataset.id;
    alertMessage.innerHTML = /* html */ `您确定要移除这条河吗? 所有的支流都将被自动移除`;

    $("#alert").dialog({
      resizable: false,
      width: "22em",
      title: "移除河",
      buttons: {
        Remove: function () {
          Rivers.remove(river);
          riversOverviewAddLines();
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function triggerAllRiversRemove() {
    alertMessage.innerHTML = /* html */ `你确定要移除所有的河流吗？`;
    $("#alert").dialog({
      resizable: false,
      title: "移除所有河流",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          removeAllRivers();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function removeAllRivers() {
    pack.rivers = [];
    pack.cells.r = new Uint16Array(pack.cells.i.length);
    rivers.selectAll("*").remove();
    riversOverviewAddLines();
  }
}
