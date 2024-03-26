"use strict";
function editUnits() {
  closeDialogs("#unitsEditor, .stable");
  $("#unitsEditor").dialog();

  if (modules.editUnits) return;
  modules.editUnits = true;

  $("#unitsEditor").dialog({
    title: "单位编辑器",
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  const renderScaleBar = () => {
    drawScaleBar(scaleBar, scale);
    fitScaleBar(scaleBar, svgWidth, svgHeight);
  };

  // add listeners
  byId("distanceUnitInput").addEventListener("change", changeDistanceUnit);
  byId("distanceScaleOutput").addEventListener("input", changeDistanceScale);
  byId("distanceScaleInput").addEventListener("change", changeDistanceScale);
  byId("heightUnit").addEventListener("change", changeHeightUnit);
  byId("heightExponentInput").addEventListener("input", changeHeightExponent);
  byId("heightExponentOutput").addEventListener("input", changeHeightExponent);
  byId("temperatureScale").addEventListener("change", changeTemperatureScale);


  byId("populationRateOutput").addEventListener("input", changePopulationRate);
  byId("populationRateInput").addEventListener("change", changePopulationRate);
  byId("urbanizationOutput").addEventListener("input", changeUrbanizationRate);
  byId("urbanizationInput").addEventListener("change", changeUrbanizationRate);
  byId("urbanDensityOutput").addEventListener("input", changeUrbanDensity);
  byId("urbanDensityInput").addEventListener("change", changeUrbanDensity);

  byId("addLinearRuler").addEventListener("click", addRuler);
  byId("addOpisometer").addEventListener("click", toggleOpisometerMode);
  byId("addRouteOpisometer").addEventListener("click", toggleRouteOpisometerMode);
  byId("addPlanimeter").addEventListener("click", togglePlanimeterMode);
  byId("removeRulers").addEventListener("click", removeAllRulers);
  byId("unitsRestore").addEventListener("click", restoreDefaultUnits);

  function changeDistanceUnit() {
    if (this.value === "custom_name") {
      prompt("提供距离单位的自定义名称", {default: ""}, custom => {
        this.options.add(new Option(custom, custom, false, true));
        lock("distanceUnit");
        renderScaleBar();
        calculateFriendlyGridSize();
      });
      return;
    }

    renderScaleBar();
    calculateFriendlyGridSize();
  }

  function changeDistanceScale() {
    renderScaleBar();
    calculateFriendlyGridSize();
  }

  function changeHeightUnit() {
    if (this.value !== "custom_name") return;

    prompt("为高度单位提供自定义名称", {default: ""}, custom => {
      this.options.add(new Option(custom, custom, false, true));
      lock("heightUnit");
    });
  }

  function changeHeightExponent() {
    calculateTemperatures();
    if (layerIsOn("toggleTemp")) drawTemp();
  }

  function changeTemperatureScale() {
    if (layerIsOn("toggleTemp")) drawTemp();
  }


  function changePopulationRate() {
    populationRate = +this.value;
  }

  function changeUrbanizationRate() {
    urbanization = +this.value;
  }

  function changeUrbanDensity() {
    urbanDensity = +this.value;
  }

  function restoreDefaultUnits() {
    // distanceScale
    distanceScale = 3;
    byId("distanceScaleOutput").value = 3;
    byId("distanceScaleInput").value = 3;
    unlock("distanceScale");

    // units
    const US = navigator.language === "en-US";
    const UK = navigator.language === "en-GB";
    distanceUnitInput.value = US || UK ? "mi" : "km";
    heightUnit.value = US || UK ? "ft" : "m";
    temperatureScale.value = US ? "°F" : "°C";
    areaUnit.value = "square";
    localStorage.removeItem("distanceUnit");
    localStorage.removeItem("heightUnit");
    localStorage.removeItem("temperatureScale");
    localStorage.removeItem("areaUnit");
    calculateFriendlyGridSize();

    // height exponent
    heightExponentInput.value = heightExponentOutput.value = 1.8;
    localStorage.removeItem("heightExponent");
    calculateTemperatures();


    renderScaleBar();

    // population
    populationRate = populationRateOutput.value = populationRateInput.value = 1000;
    urbanization = urbanizationOutput.value = urbanizationInput.value = 1;
    urbanDensity = urbanDensityOutput.value = urbanDensityInput.value = 10;
    localStorage.removeItem("populationRate");
    localStorage.removeItem("urbanization");
    localStorage.removeItem("urbanDensity");
  }

  function addRuler() {
    if (!layerIsOn("toggleRulers")) toggleRulers();
    const pt = byId("map").createSVGPoint();
    (pt.x = graphWidth / 2), (pt.y = graphHeight / 4);
    const p = pt.matrixTransform(viewbox.node().getScreenCTM().inverse());
    const dx = graphWidth / 4 / scale;
    const dy = (rulers.data.length * 40) % (graphHeight / 2);
    const from = [(p.x - dx) | 0, (p.y + dy) | 0];
    const to = [(p.x + dx) | 0, (p.y + dy) | 0];
    rulers.create(Ruler, [from, to]).draw();
  }

  function toggleOpisometerMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("绘制曲线测量长度。按住 Shift 不允许路径优化", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(
        d3.drag().on("start", function () {
          const point = d3.mouse(this);
          const opisometer = rulers.create(Opisometer, [point]).draw();

          d3.event.on("drag", function () {
            const point = d3.mouse(this);
            opisometer.addPoint(point);
          });

          d3.event.on("end", function () {
            restoreDefaultEvents();
            clearMainTip();
            addOpisometer.classList.remove("pressed");
            if (opisometer.points.length < 2) rulers.remove(opisometer.id);
            if (!d3.event.sourceEvent.shiftKey) opisometer.optimize();
          });
        })
      );
    }
  }

  function toggleRouteOpisometerMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("沿着路线画一条曲线来测量长度。按住 Shift 来测量远离道路的距离.", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(
        d3.drag().on("start", function () {
          const cells = pack.cells;
          const burgs = pack.burgs;
          const point = d3.mouse(this);
          const c = findCell(point[0], point[1]);
          if (cells.road[c] || d3.event.sourceEvent.shiftKey) {
            const b = cells.burg[c];
            const x = b ? burgs[b].x : cells.p[c][0];
            const y = b ? burgs[b].y : cells.p[c][1];
            const routeOpisometer = rulers.create(RouteOpisometer, [[x, y]]).draw();

            d3.event.on("drag", function () {
              const point = d3.mouse(this);
              const c = findCell(point[0], point[1]);
              if (cells.road[c] || d3.event.sourceEvent.shiftKey) {
                routeOpisometer.trackCell(c, true);
              }
            });

            d3.event.on("end", function () {
              restoreDefaultEvents();
              clearMainTip();
              addRouteOpisometer.classList.remove("pressed");
              if (routeOpisometer.points.length < 2) {
                rulers.remove(routeOpisometer.id);
              }
            });
          } else {
            restoreDefaultEvents();
            clearMainTip();
            addRouteOpisometer.classList.remove("pressed");
            tip("必须从有路线的单元格开始", false, "error");
          }
        })
      );
    }
  }

  function togglePlanimeterMode() {
    if (this.classList.contains("pressed")) {
      restoreDefaultEvents();
      clearMainTip();
      this.classList.remove("pressed");
    } else {
      if (!layerIsOn("toggleRulers")) toggleRulers();
      tip("画一条曲线来测量它的面积。按住 Shift 不允许路径优化", true);
      unitsBottom.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
      this.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(
        d3.drag().on("start", function () {
          const point = d3.mouse(this);
          const planimeter = rulers.create(Planimeter, [point]).draw();

          d3.event.on("drag", function () {
            const point = d3.mouse(this);
            planimeter.addPoint(point);
          });

          d3.event.on("end", function () {
            restoreDefaultEvents();
            clearMainTip();
            addPlanimeter.classList.remove("pressed");
            if (planimeter.points.length < 3) rulers.remove(planimeter.id);
            else if (!d3.event.sourceEvent.shiftKey) planimeter.optimize();
          });
        })
      );
    }
  }

  function removeAllRulers() {
    if (!rulers.data.length) return;
    alertMessage.innerHTML = /* html */ ` 确实要删除所有已放置的标尺吗?
      <br />如果你只是想隐藏尺子，在菜单中切换尺子图层`;
    $("#alert").dialog({
      resizable: false,
      title: "删除所有尺子",
      buttons: {
        删除: function () {
          $(this).dialog("close");
          rulers.undraw();
          rulers = new Rulers();
        },
        取消: function () {
          $(this).dialog("close");
        }
      }
    });
  }
}
