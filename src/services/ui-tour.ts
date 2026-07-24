import { driver } from "driver.js";
import { ensureEl } from "@/utils/nodeUtils";
import "driver.js/dist/driver.css";

function closeOptionsPanel() {
  const options = ensureEl("options");
  if (options && options.style.display !== "none") {
    ensureEl("optionsHide")?.click();
  }
}

function start() {
  closeOptionsPanel();

  const tour = driver({
    showProgress: true,
    allowClose: true,
    popoverClass: "fmg-tour",
    overlayColor: "rgb(0,0,0)",
    overlayOpacity: 0.75,
    stagePadding: 4,
    stageRadius: 4,
    onPopoverRender: popover => {
      Object.assign(popover.wrapper.style, {
        backgroundColor: "#ffffff",
        color: "#000000",
        border: "1px solid #cccccc",
        fontFamily: "Georgia, serif"
      });
      popover.title.style.color = "#000000";
      popover.title.style.borderBottomColor = "#cccccc";
      popover.progress.style.color = "#666666";
      popover.closeButton.style.color = "#000000";
      for (const btn of [popover.previousButton, popover.nextButton]) {
        Object.assign(btn.style, {
          backgroundColor: "#f0f0f0",
          border: "1px solid #cccccc",
          color: "#000000"
        });
      }
    },
    onDestroyStarted: () => {
      document.removeEventListener("keydown", handleKeydown);
      hideHeightmapCustomizationPanel();
      closeDialogs();
      tour.destroy();
      closeOptionsPanel();
    },
    steps: [
      {
        element: "#map",
        popover: {
          title: "欢迎使用 Fantasy Map Generator",
          description:
            "本快速导览涵盖基本操作。使用下一步/上一步进行导航，或按 Esc 随时退出。",
          side: "over",
          align: "center"
        }
      },
      {
        element: "#map",
        popover: {
          title: "浏览地图",
          description:
            "滚动鼠标滚轮可放大和缩小。在地图上点击并拖动可平移。双击某个位置可将其居中。",
          onNextClick: () => {
            document.body.classList.add("tour-free-roam");
            tour.moveNext();
          }
        }
      },
      {
        element: "#tooltip",
        onHighlightStarted: () => {
          document.body.classList.add("tour-free-roam");
        },
        popover: {
          title: "悬停提示",
          description:
            "将鼠标移到地图上（导览结束后），底部的提示栏会更新显示单元格、城镇、国家等信息。准备好后点击下一步继续。",
          side: "top",
          align: "center"
        }
      },
      {
        element: "#optionsTrigger",
        onHighlightStarted: () => {
          document.body.classList.remove("tour-free-roam");
          closeOptionsPanel();
        },
        popover: {
          title: "打开选项菜单",
          description: "点击此箭头按钮以打开主选项面板，所有配置选项卡都位于此处。",
          side: "right",
          onNextClick: () => {
            const options = ensureEl("options");
            if (options.style.display === "none") ensureEl("optionsTrigger").click();
            tour.moveNext();
          }
        }
      },

      // ── Layers tab ──────────────────────────────────────────────────────────
      {
        element: "#layersTab",
        onHighlightStarted: () => {
          ensureEl("layersTab")?.click();
        },
        popover: {
          title: "图层选项卡",
          description: "图层选项卡控制哪些地图元素在地图上可见。",
          side: "bottom"
        }
      },
      {
        element: "#layersPreset",
        onHighlightStarted: () => {
          ensureEl("layersTab")?.click();
        },
        popover: {
          title: "图层预设",
          description:
            "选择预设可立即显示或隐藏常见图层组合：政治、自然、宗教等。",
          side: "bottom"
        }
      },
      {
        element: "#mapLayers",
        onHighlightStarted: () => {
          ensureEl("layersTab")?.click();
        },
        popover: {
          title: "切换单个图层",
          description:
            "点击任意图层名称可切换其显示/隐藏。可通过拖放重新排列图层。",
          side: "right"
        }
      },

      // ── Style tab ────────────────────────────────────────────────────────────
      {
        element: "#styleTab",
        onHighlightStarted: () => {
          ensureEl("styleTab")?.click();
        },
        popover: {
          title: "样式选项卡",
          description:
            "样式选项卡控制地图的视觉外观——配色方案、不透明度、线宽及每个地图元素的其他属性。",
          side: "bottom"
        }
      },
      {
        element: "#stylePreset",
        onHighlightStarted: () => {
          ensureEl("styleTab")?.click();
        },
        popover: {
          title: "样式预设",
          description:
            "为地图选择配色方案预设，包括默认、古典、淡色等。整个地图的调色板会立即更新。",
          side: "bottom"
        }
      },
      {
        element: "#styleElementSelect",
        onHighlightStarted: () => {
          ensureEl("styleTab")?.click();
        },
        popover: {
          title: "单个样式设置",
          description:
            "从此下拉菜单中选择特定地图元素，以调整其颜色、不透明度、描边宽度和其他视觉属性。",
          side: "bottom"
        }
      },

      // ── Options tab ──────────────────────────────────────────────────────────
      {
        element: "#optionsTab",
        onHighlightStarted: () => {
          ensureEl("optionsTab")?.click();
        },
        popover: {
          title: "选项选项卡",
          description:
            "选项选项卡可配置世界生成参数，如国家、文化、宗教的数量，以及其他塑造生成世界的设置。",
          side: "bottom"
        }
      },
      {
        element: "#optionsContent",
        onHighlightStarted: () => {
          ensureEl("optionsTab")?.click();
        },
        popover: {
          title: "生成选项",
          description:
            "在生成新地图前设置世界参数，如文化、国家和宗教的数量。UI 偏好设置（如提示和自动保存）也在此处。",
          side: "right"
        }
      },
      {
        element: "#configureWorld",
        onHighlightStarted: () => {
          closeDialogs();
          ensureEl("optionsTab")?.click();
        },
        popover: {
          title: "配置世界",
          description:
            "此按钮可打开世界配置器，可在其中设置地图在地球仪上的位置，调整赤道和极地温度，并配置降水量以塑造世界气候。",
          side: "right",
          onNextClick: () => {
            tour.moveNext();
          }
        }
      },
      {
        element: "#worldConfigurator",
        disableActiveInteraction: false,
        onHighlightStarted: () => {
          void Controllers.WorldConfigurator.open();
        },
        popover: {
          title: "世界配置器",
          description:
            "在此可设置赤道和极地的温度，控制风向和降水量，并定位地图在地球仪上的位置。更改会影响生物群系和气候生成。",
          side: "right",
          onNextClick: () => {
            closeDialogs();
            ensureEl("toolsTab")?.click();
            tour.moveNext();
          }
        }
      },

      // ── Tools tab ────────────────────────────────────────────────────────────
      {
        element: "#toolsTab",
        onHighlightStarted: () => {
          ensureEl("toolsTab")?.click();
        },
        popover: {
          title: "工具选项卡",
          description:
            "工具选项卡可直接访问所有地图编辑器：地形、生物群系、国家、文化、宗教、道路等。",
          side: "bottom"
        }
      },
      {
        element: "#editHeightmapButton",
        onHighlightStarted: () => {
          ensureEl("toolsTab")?.click();
        },
        popover: {
          title: "编辑高度图",
          description:
            "打开高度图编辑器，通过升高或降低海拔来手动雕刻地形。此处的更改会重塑海岸线、河流和生物群系。",
          side: "right",
          onNextClick: () => {
            tour.moveNext();
          }
        }
      },
      {
        element: "#customizationMenu",
        disableActiveInteraction: false,
        onHighlightStarted: () => {
          const toolsContent = ensureEl("toolsContent");
          const customizationMenu = ensureEl("customizationMenu");
          toolsContent.style.display = "none";
          customizationMenu.style.display = "block";
        },
        onDeselected: () => {
          hideHeightmapCustomizationPanel();
        },
        popover: {
          title: "高度图编辑器",
          description:
            "高度图编辑器面板可直接在地图上绘制地形。可升高或降低陆地、应用模板、将图像转换为高度图，或以 3D 预览地形。",
          side: "right"
        }
      },

      // ── About tab ────────────────────────────────────────────────────────────
      {
        element: "#aboutTab",
        onHighlightStarted: () => {
          ensureEl("aboutTab")?.click();
        },
        popover: {
          title: "About Tab",
          description:
            "The About tab has links to documentation, video tutorials, the community Discord, and version information.",
          side: "bottom"
        }
      },
      {
        element: "#aboutContent",
        onHighlightStarted: () => {
          ensureEl("aboutTab")?.click();
        },
        popover: {
          title: "About & Resources",
          description:
            "Find the Quick Start guide, video tutorials, hotkey reference, Discord community, and changelog here. The project is open source and actively maintained.",
          side: "right"
        }
      },

      // ── Export / Save / Load ─────────────────────────────────────────────────
      {
        element: "#exportButton",
        onHighlightStarted: () => {
          closeDialogs();
        },
        popover: {
          title: "Export",
          description:
            "Click Export to open the export dialog where you can download the map as an SVG, PNG, or JPEG image, split it into tiles, or export the world data as JSON.",
          side: "top",
          onNextClick: () => {
            tour.moveNext();
          }
        }
      },
      {
        element: "#exportMapData",
        disableActiveInteraction: false,
        onHighlightStarted: () => {
          showExportPane();
        },
        popover: {
          title: "Export Options",
          description:
            "Download the map as a vector SVG, raster PNG or JPEG, or tiled PNG set. You can also export the full world data as JSON for use in other tools.",
          side: "top",
          onNextClick: () => {
            closeDialogs();
            tour.moveNext();
          }
        }
      },
      {
        element: "#saveButton",
        popover: {
          title: "Save and Load Maps",
          description:
            "Click Save to download a .map file preserving your entire world. Click Load to open a previously saved file and continue where you left off.",
          side: "top",
          onNextClick: () => {
            tour.destroy();
            closeOptionsPanel();
          }
        }
      }
    ]
  });

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return !!target.closest("input, textarea, select, [contenteditable], [contenteditable='plaintext-only']");
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (!tour.isActive() || isEditableTarget(e.target)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      document.querySelector<HTMLElement>(".driver-popover-next-btn")?.click();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      document.querySelector<HTMLElement>(".driver-popover-prev-btn")?.click();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      tour.destroy();
    }
  }

  document.addEventListener("keydown", handleKeydown);
  tour.drive();
}

function hideHeightmapCustomizationPanel() {
  const customizationMenu = ensureEl("customizationMenu");
  if (customizationMenu.style.display !== "block") return;
  customizationMenu.style.display = "none";
  ensureEl("toolsContent").style.display = "block";
}

export const UiTour = { start };
