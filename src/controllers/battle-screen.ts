import { mean, select, sum } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { applySorting, applySortingByHeader } from "@/components/dialog/sorting";
import { tip } from "@/components/tooltips";
import { drawMarker } from "@/renderers/draw-markers";
import { moveRegiment } from "@/renderers/draw-military";
import type { Marker } from "../generators/markers-generator";
import type { Regiment } from "../generators/military-generator";
import {
  capitalize,
  destroyDialogIfExists,
  ensureEl,
  getAdjective,
  last,
  list,
  minmax,
  P,
  Pint,
  rand,
  rn,
  wiki
} from "../utils";

type Side = "attackers" | "defenders";

interface BattleSide {
  regiments: Regiment[];
  distances: number[];
  morale: number;
  casualties: number;
  power: number;
  phase?: string;
  die?: number;
}

interface BattleState {
  iteration: number;
  x: number;
  y: number;
  cell: number;
  attackers: BattleSide;
  defenders: BattleSide;
  phasesRecord: { phase: string; count: number }[];
  place: string | null;
  type: string;
  name: string;
}

let battle: BattleState | null = null;

function open(attacker: Regiment, defender: Regiment): void {
  if (customization) return;
  closeDialogs(".stable");
  customization = 13; // enter customization to avoid unwanted dialogs

  renderDialog();

  const x = defender.x;
  const y = defender.y;
  const cell = findCell(x, y) ?? 0;

  battle = {
    iteration: 0,
    x,
    y,
    cell,
    attackers: { regiments: [], distances: [], morale: 100, casualties: 0, power: 0 },
    defenders: { regiments: [], distances: [], morale: 100, casualties: 0, power: 0 },
    phasesRecord: [],
    place: null,
    type: "field",
    name: ""
  };

  addHeaders();
  addRegimentToSide("attackers", attacker);
  addRegimentToSide("defenders", defender);
  battle.place = definePlace();
  defineType();
  battle.name = defineBattleName();
  randomizeBattle();
  calculateStrength("attackers");
  calculateStrength("defenders");
  getInitialMorale();

  $("#battleScreen").dialog({
    title: battle.name,
    resizable: false,
    width: "fit-content",
    position: { my: "center", at: "center", of: "#map" },
    close: cancelResults
  });
}

function renderDialog(): void {
  destroyDialogIfExists("battleScreen");
  destroyDialogIfExists("regimentSelectorScreen");
  const editorHtml = /* html */ `<div id="battleScreen" class="dialog stable">
      <div id="battleBody">
        <template id="battlePhases_field">
          <button
            data-tip="小规模冲突阶段。远程单位占优"
            data-phase="skirmish"
            class="icon-button-skirmish"
          ></button>
          <button data-tip="近战阶段。近战单位占优" data-phase="melee" class="icon-button-melee"></button>
          <button
            data-tip="追击阶段。骑乘单位占优"
            data-phase="pursue"
            class="icon-button-pursue"
          ></button>
          <button
            data-tip="撤退阶段。单位实力减弱"
            data-phase="retreat"
            class="icon-button-retreat"
          ></button>
        </template>
        <template id="battlePhases_naval">
          <button
            data-tip="炮击阶段。海军火炮轰击敌方舰队"
            data-phase="shelling"
            class="icon-button-shelling"
          ></button>
          <button
            data-tip="接舷阶段。近战单位登船"
            data-phase="boarding"
            class="icon-button-boarding"
          ></button>
          <button
            data-tip="追击阶段。海军单位追击并偶尔炮击敌方舰队"
            data-phase="chase"
            class="icon-button-chase"
          ></button>
          <button
            data-tip="撤退阶段。海军单位试图逃离敌方舰队"
            data-phase="withdrawal"
            class="icon-button-withdrawal"
          ></button>
        </template>
        <template id="battlePhases_siege_attackers">
          <button
            data-tip="封锁阶段。准备或维持封锁"
            data-phase="blockade"
            class="icon-button-blockade"
          ></button>
          <button
            data-tip="轰击阶段。用器械单位攻击敌方"
            data-phase="bombardment"
            class="icon-button-bombardment"
          ></button>
          <button
            data-tip="强攻阶段。强攻敌方城镇。近战单位占优"
            data-phase="storming"
            class="icon-button-storming"
          ></button>
          <button
            data-tip="劫掠阶段。洗劫城镇。单位实力增强"
            data-phase="looting"
            class="icon-button-looting"
          ></button>
          <button
            data-tip="撤退阶段。单位实力减弱"
            data-phase="retreat"
            class="icon-button-retreat"
          ></button>
        </template>
        <template id="battlePhases_siege_defenders">
          <button
            data-tip="坚守阶段。躲藏在城墙后等待"
            data-phase="sheltering"
            class="icon-button-sheltering"
          ></button>
          <button
            data-tip="突围阶段。从被围城镇出击。近战单位占优"
            data-phase="sortie"
            class="icon-button-sortie"
          ></button>
          <button
            data-tip="轰击阶段。用器械单位攻击敌方"
            data-phase="bombardment"
            class="icon-button-bombardment"
          ></button>
          <button
            data-tip="防御阶段。远程和近战单位占优"
            data-phase="defense"
            class="icon-button-defense"
          ></button>
          <button
            data-tip="投降阶段。放弃防御。单位实力减弱"
            data-phase="surrendering"
            class="icon-button-surrendering"
          ></button>
          <button
            data-tip="追击阶段。骑乘单位占优"
            data-phase="pursue"
            class="icon-button-pursue"
          ></button>
        </template>
        <template id="battlePhases_ambush_attackers">
          <button
            data-tip="冲击阶段。单位实力减弱"
            data-phase="shock"
            class="icon-button-shock"
          ></button>
          <button data-tip="近战阶段。近战单位占优" data-phase="melee" class="icon-button-melee"></button>
          <button
            data-tip="追击阶段。骑乘单位占优"
            data-phase="pursue"
            class="icon-button-pursue"
          ></button>
          <button
            data-tip="撤退阶段。单位实力减弱"
            data-phase="retreat"
            class="icon-button-retreat"
          ></button>
        </template>
        <template id="battlePhases_ambush_defenders">
          <button
            data-tip="突袭阶段。单位实力增强，远程单位占优"
            data-phase="surprise"
            class="icon-button-surprise"
          ></button>
          <button data-tip="近战阶段。近战单位占优" data-phase="melee" class="icon-button-melee"></button>
          <button
            data-tip="追击阶段。骑乘单位占优"
            data-phase="pursue"
            class="icon-button-pursue"
          ></button>
          <button
            data-tip="撤退阶段。单位实力减弱"
            data-phase="retreat"
            class="icon-button-retreat"
          ></button>
        </template>
        <template id="battlePhases_landing_attackers">
          <button
            data-tip="登陆阶段。两栖攻击。单位面对有准备的防御时处于劣势"
            data-phase="landing"
            class="icon-button-landing"
          ></button>
          <button data-tip="近战阶段。近战单位占优" data-phase="melee" class="icon-button-melee"></button>
          <button
            data-tip="追击阶段。骑乘单位占优"
            data-phase="pursue"
            class="icon-button-pursue"
          ></button>
          <button data-tip="溃逃阶段。单位实力减弱" data-phase="flee" class="icon-button-flee"></button>
        </template>
        <template id="battlePhases_landing_defenders">
          <button
            data-tip="冲击阶段。单位未做好防御准备"
            data-phase="shock"
            class="icon-button-shock"
          ></button>
          <button
            data-tip="防御阶段。有准备的防御。单位实力增强"
            data-phase="defense"
            class="icon-button-defense"
          ></button>
          <button data-tip="近战阶段。近战单位占优" data-phase="melee" class="icon-button-melee"></button>
          <button
            data-tip="等待阶段。无法追击溃逃的海军"
            data-phase="waiting"
            class="icon-button-waiting"
          ></button>
          <button
            data-tip="追击阶段。试图拦截溃逃的攻击者。骑乘单位占优"
            data-phase="pursue"
            class="icon-button-pursue"
          ></button>
          <button
            data-tip="撤退阶段。单位实力减弱"
            data-phase="retreat"
            class="icon-button-retreat"
          ></button>
        </template>
        <template id="battlePhases_air">
          <button
            data-tip="机动阶段。单位实力减弱"
            data-phase="maneuvering"
            class="icon-button-maneuvering"
          ></button>
          <button
            data-tip="空战阶段。单位实力增强"
            data-phase="dogfight"
            class="icon-button-dogfight"
          ></button>
          <button
            data-tip="追击阶段。单位实力增强"
            data-phase="pursue"
            class="icon-button-pursue"
          ></button>
          <button
            data-tip="撤退阶段。单位实力减弱"
            data-phase="retreat"
            class="icon-button-retreat"
          ></button>
        </template>
        <div style="font-size: 1.2em; font-weight: bold; width: unset">
          <span>攻击方</span>
          <div style="float: right; font-size: 0.7em">
            <meter
              id="battleMorale_attackers"
              data-tip="攻击方士气："
              min="0"
              max="100"
              low="33"
              high="66"
              optimum="80"
            ></meter>
            <div
              id="battlePower_attackers"
              data-tip="本阶段攻击方实力。实力决定造成的伤害"
              style="display: inline-block; text-align: center"
              class="icon-button-power"
            ></div>
            <div style="display: inline-block">
              <button id="battlePhase_attackers" style="width: 3.2em"></button>
              <div class="battlePhases" style="display: none"></div>
            </div>
            <button
              id="battleDie_attackers"
              data-tip="攻击方随机因子。点击重新投掷"
              style="padding: 0.1em 0.2em; width: 3.2em"
              class="icon-button-die"
            ></button>
          </div>
        </div>
        <table id="battleAttackers"></table>
        <div style="font-size: 1.2em; font-weight: bold; width: unset">
          <span>防守方</span>
          <div style="float: right; font-size: 0.7em">
            <meter
              id="battleMorale_defenders"
              data-tip="防守方士气："
              min="0"
              max="100"
              low="33"
              high="66"
              optimum="80"
            ></meter>
            <div
              id="battlePower_defenders"
              data-tip="本阶段防守方实力。实力决定造成的伤害"
              style="display: inline-block; text-align: center"
              class="icon-button-power"
            ></div>
            <div style="display: inline-block">
              <button id="battlePhase_defenders" style="width: 3.2em"></button>
              <div class="battlePhases" style="display: none"></div>
            </div>
            <button
              id="battleDie_defenders"
              data-tip="防守方随机因子。点击重新投掷"
              style="padding: 0.1em 0.2em; width: 3.2em"
              class="icon-button-die"
            ></button>
          </div>
        </div>
        <table id="battleDefenders"></table>
      </div>
      <div id="battleBottom">
        <button id="battleType" data-tip="战斗类型。点击更改"></button>
        <div class="battleTypes" style="display: none">
          <button
            data-tip="野战：标准战斗类型"
            data-type="field"
            class="icon-button-field"
          ></button>
          <button data-tip="海战：海军单位战斗" data-type="naval" class="icon-button-naval"></button>
          <button data-tip="围城：城镇封锁与强攻" data-type="siege" class="icon-button-siege"></button>
          <button data-tip="伏击：突袭" data-type="ambush" class="icon-button-ambush"></button>
          <button data-tip="登陆：两栖攻击" data-type="landing" class="icon-button-landing"></button>
          <button
            data-tip="空战：飞行单位的机动战斗"
            data-type="air"
            class="icon-button-air"
          ></button>
        </div>
        <button id="battleNameShow" data-tip="设置战斗名称" class="icon-font"></button>
        <div id="battleNameSection" style="display: none">
          <button id="battleNameHide" data-tip="隐藏战斗名称区域" class="icon-font"></button>
          <input id="battleNamePlace" data-tip="输入地名" style="width: 30%" />
          <input id="battleNameFull" data-tip="输入完整战斗名称" style="width: 46%" />
          <button
            id="battleNameCulture"
            data-tip="生成特定文化风格的地名和战斗名"
            class="icon-book"
          ></button>
          <button
            id="battleNameRandom"
            data-tip="生成随机地名和战斗名"
            class="icon-globe"
          ></button>
        </div>
        <button id="battleAddRegiment" data-tip="向战斗添加军团" class="icon-user-plus"></button>
        <button id="battleRoll" data-tip="投掷骰子更新随机因子" class="icon-die"></button>
        <button id="battleRun" data-tip="推进战斗" class="icon-play"></button>
        <button
          id="battleApply"
          data-tip="结束战斗：应用当前结果并关闭界面"
          class="icon-check"
        ></button>
        <button
          id="battleCancel"
          data-tip="取消战斗：回滚结果并关闭界面"
          class="icon-cancel"
        ></button>
        <button id="battleWiki" data-tip="打开战斗模拟教程" class="icon-info"></button>
      </div>
    </div>
    <div id="regimentSelectorScreen" class="dialog">
      <div id="regimentSelectorHeader" class="header" style="grid-template-columns: 9em 13em 4em 6em">
        <div data-tip="点击按国家名称排序" class="sortable alphabetically" data-sortby="state">
          国家&nbsp;
        </div>
        <div data-tip="点击按军团名称排序" class="sortable alphabetically" data-sortby="regiment">
          军团&nbsp;
        </div>
        <div data-tip="点击按总军事力量排序" class="sortable" data-sortby="total">总数&nbsp;</div>
        <div
          data-tip="点击按到战场距离排序"
          class="sortable icon-sort-number-up"
          data-sortby="distance"
        >
          距离&nbsp;
        </div>
      </div>
      <div id="regimentSelectorBody" class="table"></div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  applySortingByHeader("regimentSelectorHeader");

  ensureEl("battleType").on("click", event => toggleChange(event));
  ensureEl("battleType").nextElementSibling!.on("click", event => changeType(event));
  ensureEl("battleNameShow").on("click", () => showNameSection());
  ensureEl<HTMLInputElement>("battleNamePlace").on("change", event => {
    if (battle) battle.place = (event.target as HTMLInputElement).value;
  });
  ensureEl<HTMLInputElement>("battleNameFull").on("change", event => changeName(event));
  ensureEl("battleNameCulture").on("click", () => generateBattleName("culture"));
  ensureEl("battleNameRandom").on("click", () => generateBattleName("random"));
  ensureEl("battleNameHide").on("click", () => hideNameSection());
  ensureEl("battleAddRegiment").on("click", () => addSide());
  ensureEl("battleRoll").on("click", () => randomizeBattle());
  ensureEl("battleRun").on("click", () => runBattle());
  ensureEl("battleApply").on("click", () => applyResults());
  ensureEl("battleCancel").on("click", () => cancelResults());
  ensureEl("battleWiki").on("click", () => wiki("Battle-Simulator"));

  ensureEl("battlePhase_attackers").on("click", event => toggleChange(event));
  ensureEl("battlePhase_attackers").nextElementSibling!.on("click", event => changePhase(event, "attackers"));
  ensureEl("battlePhase_defenders").on("click", event => toggleChange(event));
  ensureEl("battlePhase_defenders").nextElementSibling!.on("click", event => changePhase(event, "defenders"));
  ensureEl("battleDie_attackers").on("click", () => rollDie("attackers"));
  ensureEl("battleDie_defenders").on("click", () => rollDie("defenders"));
}

function defineType(): void {
  const b = battle!;
  const attacker = b.attackers.regiments[0];
  const defender = b.defenders.regiments[0];

  const getType = (): string => {
    const typesA = Object.keys(attacker.u).map(name => options.military.find(u => u.name === name)!.type);
    const typesD = Object.keys(defender.u).map(name => options.military.find(u => u.name === name)!.type);

    if (attacker.n && defender.n) return "naval"; // attacker and defender are navals
    if (typesA.every(t => t === "aviation") && typesD.every(t => t === "aviation")) return "air"; // if attackers and defender have only aviation units
    if (attacker.n && !defender.n && typesA.some(t => t !== "naval")) return "landing"; // if attacked is naval with non-naval units and defender is not naval
    if (!defender.n && (pack.burgs[pack.cells.burg[b.cell]].walls || pack.burgs[pack.cells.burg[b.cell]].citadel))
      return "siege"; // defender is in walled town
    if (P(0.1) && [5, 6, 7, 8, 9, 12].includes(pack.cells.biome[b.cell])) return "ambush"; // 20% if defenders are in forest or marshes
    return "field";
  };

  b.type = getType();
  setType();
}

function setType(): void {
  const b = battle!;
  ensureEl("battleType").className = `icon-button-${b.type}`;

  const sideSpecific = document.getElementById(`battlePhases_${b.type}_attackers`) as HTMLTemplateElement | null;
  const attackersContent = sideSpecific
    ? sideSpecific.content
    : ensureEl<HTMLTemplateElement>(`battlePhases_${b.type}`).content;
  const defendersContent = sideSpecific
    ? ensureEl<HTMLTemplateElement>(`battlePhases_${b.type}_defenders`).content
    : attackersContent;

  const attackersPhase = ensureEl("battlePhase_attackers").nextElementSibling!;
  const defendersPhase = ensureEl("battlePhase_defenders").nextElementSibling!;
  attackersPhase.innerHTML = "";
  defendersPhase.innerHTML = "";
  attackersPhase.append(attackersContent.cloneNode(true));
  defendersPhase.append(defendersContent.cloneNode(true));
}

function definePlace(): string | null {
  const cells = pack.cells;
  const i = battle!.cell;
  const burg = cells.burg[i] ? pack.burgs[cells.burg[i]].name : null;
  const getRiver = (riverId: number): string => {
    const river = pack.rivers.find(r => r.i === riverId)!;
    return `${river.name} ${river.type}`;
  };
  const river = !burg && cells.r[i] ? getRiver(cells.r[i]) : null;
  const proper = burg || river ? null : Names.getCulture(cells.culture[i]);
  return burg ? burg : river ? river : proper;
}

function defineBattleName(): string {
  const b = battle!;
  if (b.type === "field") return `${b.place}之战`;
  if (b.type === "naval") return `${b.place}海战`;
  if (b.type === "siege") return `${b.place}围城战`;
  if (b.type === "ambush") return `${b.place}伏击战`;
  if (b.type === "landing") return `${b.place}登陆战`;
  return `${b.place}${P(0.8) ? "空战" : "缠斗"}`; // "air"
}

function getTypeName(): string {
  const b = battle!;
  if (b.type === "field") return "野战";
  if (b.type === "naval") return "海战";
  if (b.type === "siege") return "围城战";
  if (b.type === "ambush") return "伏击战";
  if (b.type === "landing") return "登陆战";
  return "战斗"; // "air"
}

function addHeaders(): void {
  let headers = "<thead><tr><th></th><th></th>";

  for (const u of options.military) {
    const label = capitalize(u.name.replace(/_/g, " "));
    const isExternal = u.icon.startsWith("http") || u.icon.startsWith("data:image");
    const iconHTML = isExternal ? `<img src="${u.icon}" width="15" height="15">` : u.icon;
    headers += `<th data-tip="${label}">${iconHTML}</th>`;
  }

  headers += '<th data-tip="总军事力量">总数</th></tr></thead>';
  ensureEl("battleAttackers").innerHTML = headers;
  ensureEl("battleDefenders").innerHTML = headers;
}

function addRegimentToSide(side: Side, regiment: Regiment): void {
  const b = battle!;
  regiment.casualties = Object.keys(regiment.u).reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
  regiment.survivors = { ...regiment.u };

  const state = pack.states[regiment.state];
  const distance = (Math.hypot(b.y - regiment.by, b.x - regiment.bx) * distanceScale) | 0; // distance between regiment and its base
  const color = state.color?.[0] === "#" ? state.color : "#999";

  const isExternal = regiment.icon!.startsWith("http") || regiment.icon!.startsWith("data:image");
  const iconHtml = isExternal
    ? `<image href="${regiment.icon}" x="0.1em" y="0.1em" width="1.2em" height="1.2em"></image>`
    : `<text x="50%" y="1em" style="text-anchor: middle">${regiment.icon}</text>`;
  const icon = `<svg width="1.4em" height="1.4em" style="margin-bottom: -.6em; stroke: #333">
      <rect x="0" y="0" width="100%" height="100%" fill="${color}"></rect>${iconHtml}</svg>`;
  const body = `<tbody id="battle${state.i}-${regiment.i}">`;

  let initial = `<tr class="battleInitial"><td>${icon}</td><td class="regiment" data-tip="${
    regiment.name
  }">${regiment.name.slice(0, 24)}</td>`;
  let casualtiesRow = `<tr class="battleCasualties"><td></td><td data-tip="${state.fullName}">${state.fullName!.slice(
    0,
    26
  )}</td>`;
  let survivorsRow = `<tr class="battleSurvivors"><td></td><td data-tip="补给线长度，影响士气">到基地距离：${distance} ${distanceUnitInput.value}</td>`;

  for (const u of options.military) {
    initial += `<td data-tip="初始兵力" style="width: 2.5em; text-align: center">${regiment.u[u.name] || 0}</td>`;
    casualtiesRow += `<td data-tip="伤亡" style="width: 2.5em; text-align: center; color: red">0</td>`;
    survivorsRow += `<td data-tip="幸存者" style="width: 2.5em; text-align: center; color: green">${
      regiment.u[u.name] || 0
    }</td>`;
  }

  initial += `<td data-tip="初始兵力" style="width: 2.5em; text-align: center">${regiment.a || 0}</td></tr>`;
  casualtiesRow += `<td data-tip="伤亡"  style="width: 2.5em; text-align: center; color: red">0</td></tr>`;
  survivorsRow += `<td data-tip="幸存者" style="width: 2.5em; text-align: center; color: green">${
    regiment.a || 0
  }</td></tr>`;

  const container = ensureEl(side === "attackers" ? "battleAttackers" : "battleDefenders");
  container.innerHTML += `${body + initial + casualtiesRow + survivorsRow}</tbody>`;
  b[side].regiments.push(regiment);
  b[side].distances.push(distance);
}

function addSide(): void {
  const b = battle!;
  const body = ensureEl("regimentSelectorBody");
  const regiments = pack.states.filter(s => s.military && !s.removed).flatMap(s => s.military!);

  const distance = (reg: Regiment): number => rn(Math.hypot(b.y - reg.y, b.x - reg.x) * distanceScale);
  const isAdded = (reg: Regiment): boolean =>
    b.defenders.regiments.some(r => r === reg) || b.attackers.regiments.some(r => r === reg);

  body.innerHTML = regiments
    .map(r => {
      const s = pack.states[r.state];
      const added = isAdded(r);
      const dist = added ? 0 : distance(r);
      const distLabel = `${dist} ${distanceUnitInput.value}`;
      return `<div ${added ? "class='inactive'" : ""} data-s=${s.i} data-i=${r.i} data-state=${
        s.name
      } data-regiment=${r.name}
        data-total=${r.a} data-distance="${dist}" data-tip="点击选择军团">
        <svg width=".9em" height=".9em" style="margin-bottom:-1px; stroke: #333"><rect x="0" y="0" width="100%" height="100%" fill="${
          s.color
        }" ></svg>
        <div style="width:6em">${s.name.slice(0, 11)}</div>
        <div style="width:1.2em">${r.icon}</div>
        <div style="width:13em">${r.name.slice(0, 24)}</div>
        <div style="width:4em">${r.a}</div>
        <div style="width:4em">${distLabel}</div>
      </div>`;
    })
    .join("");

  $("#regimentSelectorScreen").dialog({
    resizable: false,
    width: "fit-content",
    title: "添加军团到战斗",
    position: { my: "left center", at: "right+10 center", of: "#battleScreen" },
    close: addSideClosed,
    buttons: {
      添加到攻击方: () => addSideClicked("attackers"),
      添加到防守方: () => addSideClicked("defenders"),
      取消: () => $("#regimentSelectorScreen").dialog("close")
    }
  });

  applySorting(ensureEl("regimentSelectorHeader"));
  body.on("click", selectLine);

  function selectLine(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.className === "inactive") {
      tip("军团已加入战斗", false, "error");
      return;
    }
    target.classList.toggle("selected");
  }

  function addSideClicked(side: Side): void {
    const selected = body.querySelectorAll<HTMLElement>(".selected");
    if (!selected.length) {
      tip("请先选择一个军团", false, "error");
      return;
    }

    $("#regimentSelectorScreen").dialog("close");
    selected.forEach(line => {
      const state = pack.states[+line.dataset.s!];
      const regiment = state.military!.find(r => r.i === +line.dataset.i!)!;
      addRegimentToSide(side, regiment);
      calculateStrength(side);
      getInitialMorale();

      // move regiment
      const defenders = b.defenders.regiments;
      const attackers = b.attackers.regiments;
      const shift = side === "attackers" ? attackers.length * -8 : (defenders.length - 1) * 8;
      regiment.px = regiment.x;
      regiment.py = regiment.y;
      moveRegiment(regiment, defenders[0].x, defenders[0].y + shift);
    });
  }

  function addSideClosed(): void {
    body.innerHTML = "";
    body.off("click", selectLine);
  }
}

function showNameSection(): void {
  document.querySelectorAll<HTMLElement>("#battleBottom > button").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("battleNameSection").style.display = "inline-block";

  ensureEl<HTMLInputElement>("battleNamePlace").value = battle!.place ?? "";
  ensureEl<HTMLInputElement>("battleNameFull").value = battle!.name;
}

function hideNameSection(): void {
  document.querySelectorAll<HTMLElement>("#battleBottom > button").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("battleNameSection").style.display = "none";
}

function changeName(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  battle!.name = value;
  $("#battleScreen").dialog({ title: value });
}

function generateBattleName(type: "culture" | "random"): void {
  const b = battle!;
  const place =
    type === "culture"
      ? Names.getCulture(pack.cells.culture[b.cell], undefined, undefined, "")
      : Names.getBase(rand(Names.nameBases.length - 1));
  b.place = place;
  ensureEl<HTMLInputElement>("battleNamePlace").value = place;
  b.name = defineBattleName();
  ensureEl<HTMLInputElement>("battleNameFull").value = b.name;
  $("#battleScreen").dialog({ title: b.name });
}

function getJoinedForces(regiments: Regiment[]): Record<string, number> {
  return regiments.reduce<Record<string, number>>((acc, regiment) => {
    for (const k in regiment.survivors) {
      if (!Object.hasOwn(regiment.survivors, k)) continue;
      acc[k] = (acc[k] || 0) + regiment.survivors![k];
    }
    return acc;
  }, {});
}

function calculateStrength(side: Side): void {
  const b = battle!;
  const scheme: Record<string, Record<string, number>> = {
    // field battle phases
    skirmish: {
      melee: 0.2,
      ranged: 2.4,
      mounted: 0.1,
      machinery: 3,
      naval: 1,
      armored: 0.2,
      aviation: 1.8,
      magical: 1.8
    }, // ranged excel
    melee: { melee: 2, ranged: 1.2, mounted: 1.5, machinery: 0.5, naval: 0.2, armored: 2, aviation: 0.8, magical: 0.8 }, // melee excel
    pursue: { melee: 1, ranged: 1, mounted: 4, machinery: 0.05, naval: 1, armored: 1, aviation: 1.5, magical: 0.6 }, // mounted excel
    retreat: {
      melee: 0.1,
      ranged: 0.01,
      mounted: 0.5,
      machinery: 0.01,
      naval: 0.2,
      armored: 0.1,
      aviation: 0.8,
      magical: 0.05
    }, // reduced

    // naval battle phases
    shelling: { melee: 0, ranged: 0.2, mounted: 0, machinery: 2, naval: 2, armored: 0, aviation: 0.1, magical: 0.5 }, // naval and machinery excel
    boarding: {
      melee: 1,
      ranged: 0.5,
      mounted: 0.5,
      machinery: 0,
      naval: 0.5,
      armored: 0.4,
      aviation: 0,
      magical: 0.2
    }, // melee excel
    chase: { melee: 0, ranged: 0.15, mounted: 0, machinery: 1, naval: 1, armored: 0, aviation: 0.15, magical: 0.5 }, // reduced
    withdrawal: {
      melee: 0,
      ranged: 0.02,
      mounted: 0,
      machinery: 0.5,
      naval: 0.1,
      armored: 0,
      aviation: 0.1,
      magical: 0.3
    }, // reduced

    // siege phases
    blockade: {
      melee: 0.25,
      ranged: 0.25,
      mounted: 0.2,
      machinery: 0.5,
      naval: 0.2,
      armored: 0.1,
      aviation: 0.25,
      magical: 0.25
    }, // no active actions
    sheltering: {
      melee: 0.3,
      ranged: 0.5,
      mounted: 0.2,
      machinery: 0.5,
      naval: 0.2,
      armored: 0.1,
      aviation: 0.25,
      magical: 0.25
    }, // no active actions
    sortie: { melee: 2, ranged: 0.5, mounted: 1.2, machinery: 0.2, naval: 0.1, armored: 0.5, aviation: 1, magical: 1 }, // melee excel
    bombardment: {
      melee: 0.2,
      ranged: 0.5,
      mounted: 0.2,
      machinery: 3,
      naval: 1,
      armored: 0.5,
      aviation: 1,
      magical: 1
    }, // machinery excel
    storming: {
      melee: 1,
      ranged: 0.6,
      mounted: 0.5,
      machinery: 1,
      naval: 0.1,
      armored: 0.1,
      aviation: 0.5,
      magical: 0.5
    }, // melee excel
    defense: { melee: 2, ranged: 3, mounted: 1, machinery: 1, naval: 0.1, armored: 1, aviation: 0.5, magical: 1 }, // ranged excel
    looting: {
      melee: 1.6,
      ranged: 1.6,
      mounted: 0.5,
      machinery: 0.2,
      naval: 0.02,
      armored: 0.2,
      aviation: 0.1,
      magical: 0.3
    }, // melee excel
    surrendering: {
      melee: 0.1,
      ranged: 0.1,
      mounted: 0.05,
      machinery: 0.01,
      naval: 0.01,
      armored: 0.02,
      aviation: 0.01,
      magical: 0.03
    }, // reduced

    // ambush phases
    surprise: { melee: 2, ranged: 2.4, mounted: 1, machinery: 1, naval: 1, armored: 1, aviation: 0.8, magical: 1.2 }, // increased
    shock: {
      melee: 0.5,
      ranged: 0.5,
      mounted: 0.5,
      machinery: 0.4,
      naval: 0.3,
      armored: 0.1,
      aviation: 0.4,
      magical: 0.5
    }, // reduced

    // landing phases
    landing: {
      melee: 0.8,
      ranged: 0.6,
      mounted: 0.6,
      machinery: 0.5,
      naval: 0.5,
      armored: 0.5,
      aviation: 0.5,
      magical: 0.6
    }, // reduced
    flee: {
      melee: 0.1,
      ranged: 0.01,
      mounted: 0.5,
      machinery: 0.01,
      naval: 0.5,
      armored: 0.1,
      aviation: 0.2,
      magical: 0.05
    }, // reduced
    waiting: {
      melee: 0.05,
      ranged: 0.5,
      mounted: 0.05,
      machinery: 0.5,
      naval: 2,
      armored: 0.05,
      aviation: 0.5,
      magical: 0.5
    }, // reduced

    // air battle phases
    maneuvering: { melee: 0, ranged: 0.1, mounted: 0, machinery: 0.2, naval: 0, armored: 0, aviation: 1, magical: 0.2 }, // aviation
    dogfight: { melee: 0, ranged: 0.1, mounted: 0, machinery: 0.1, naval: 0, armored: 0, aviation: 2, magical: 0.1 } // aviation
  };

  const forces = getJoinedForces(b[side].regiments);
  const phase = b[side].phase!;
  const adjuster = Math.max(populationRate / 10, 10); // population adjuster, by default 100
  b[side].power = sum(options.military.map(u => (forces[u.name] || 0) * u.power * scheme[phase][u.type])) / adjuster;
  const uiValue = b[side].power ? Math.max(b[side].power | 0, 1) : 0;
  ensureEl(`battlePower_${side}`).innerHTML = String(uiValue);
}

function getInitialMorale(): void {
  const b = battle!;
  const powerFee = (diff: number): number => minmax(100 - diff ** 1.5 * 10 + 10, 50, 100);
  const distanceFee = (dist: number[]): number => Math.min((mean(dist) ?? 0) / 50, 15);
  const powerDiff = b.defenders.power / b.attackers.power;
  b.attackers.morale = powerFee(powerDiff) - distanceFee(b.attackers.distances);
  b.defenders.morale = powerFee(1 / powerDiff) - distanceFee(b.defenders.distances);
  updateMorale("attackers");
  updateMorale("defenders");
}

function updateMorale(side: Side): void {
  const b = battle!;
  const morale = ensureEl<HTMLInputElement>(`battleMorale_${side}`);
  morale.dataset.tip = (morale.dataset.tip || "").replace(morale.value, "");
  morale.value = String(b[side].morale | 0);
  morale.dataset.tip += morale.value;
}

function randomizeBattle(): void {
  rollDie("attackers");
  rollDie("defenders");
  selectPhase();
  calculateStrength("attackers");
  calculateStrength("defenders");
}

function rollDie(side: Side): void {
  const b = battle!;
  const el = ensureEl(`battleDie_${side}`);
  const prev = +el.innerHTML;
  let value: number;
  do {
    value = rand(1, 6);
    el.innerHTML = String(value);
  } while (value === prev);
  b[side].die = value;
}

function selectPhase(): void {
  const b = battle!;
  const i = b.iteration;
  const morale = [b.attackers.morale, b.defenders.morale];
  const powerRatio = b.attackers.power / b.defenders.power;

  const getFieldBattlePhase = (): [string, string] => {
    const prev = [b.attackers.phase || "skirmish", b.defenders.phase || "skirmish"]; // previous phase

    // chance if moral < 25
    if (P(1 - morale[0] / 25)) return ["retreat", "pursue"];
    if (P(1 - morale[1] / 25)) return ["pursue", "retreat"];

    // skirmish phase continuation depends on ranged forces number
    if (prev[0] === "skirmish" && prev[1] === "skirmish") {
      const forces = getJoinedForces(b.attackers.regiments.concat(b.defenders.regiments));
      const total = sum(Object.values(forces)); // total forces
      const ranged =
        sum(
          options.military
            .filter(u => u.type === "ranged")
            .map(u => u.name)
            .map(u => forces[u])
        ) / total; // ranged units
      if (P(ranged) || P(0.8 - i / 10)) return ["skirmish", "skirmish"];
    }

    return ["melee", "melee"]; // default option
  };

  const getNavalBattlePhase = (): [string, string] => {
    const prev = [b.attackers.phase || "shelling", b.defenders.phase || "shelling"]; // previous phase

    if (prev[0] === "withdrawal") return ["withdrawal", "chase"];
    if (prev[0] === "chase") return ["chase", "withdrawal"];

    // withdrawal phase when power imbalanced
    if (prev[0] !== "boarding") {
      if (powerRatio < 0.5 || (P(b.attackers.casualties) && powerRatio < 1)) return ["withdrawal", "chase"];
      if (powerRatio > 2 || (P(b.defenders.casualties) && powerRatio > 1)) return ["chase", "withdrawal"];
    }

    // boarding phase can start from 2nd iteration
    if (prev[0] === "boarding" || P(i / 10 - 0.1)) return ["boarding", "boarding"];

    return ["shelling", "shelling"]; // default option
  };

  const getSiegePhase = (): [string, string] => {
    const prev: [string, string] = [b.attackers.phase || "blockade", b.defenders.phase || "sheltering"]; // previous phase
    const phase: [string, string] = ["blockade", "sheltering"]; // default phase

    if (prev[0] === "retreat" || prev[0] === "looting") return prev;

    if (P(1 - morale[0] / 30) && powerRatio < 1) return ["retreat", "pursue"]; // attackers retreat chance if moral < 30
    if (P(1 - morale[1] / 15)) return ["looting", "surrendering"]; // defenders surrendering chance if moral < 15

    if (P((powerRatio - 1) / 2)) return ["storming", "defense"]; // start storm

    if (prev[0] !== "storming") {
      const machinery = options.military.filter(u => u.type === "machinery").map(u => u.name); // machinery units

      const attackersForces = getJoinedForces(b.attackers.regiments);
      const machineryA = sum(machinery.map(u => attackersForces[u]));
      if (i && machineryA && P(0.9)) phase[0] = "bombardment";

      const defendersForces = getJoinedForces(b.defenders.regiments);
      const machineryD = sum(machinery.map(u => defendersForces[u]));
      if (machineryD && P(0.9)) phase[1] = "bombardment";

      if (i && prev[1] !== "sortie" && machineryD < machineryA && P(0.25) && P(morale[1] / 70)) phase[1] = "sortie"; // defenders sortie
    }

    return phase;
  };

  const getAmbushPhase = (): [string, string] => {
    const prev = [b.attackers.phase || "shock", b.defenders.phase || "surprise"]; // previous phase

    if (prev[1] === "surprise" && P(1 - (powerRatio * i) / 5)) return ["shock", "surprise"];

    // chance if moral < 25
    if (P(1 - morale[0] / 25)) return ["retreat", "pursue"];
    if (P(1 - morale[1] / 25)) return ["pursue", "retreat"];

    return ["melee", "melee"]; // default option
  };

  const getLandingPhase = (): [string, string] => {
    const prev = [b.attackers.phase || "landing", b.defenders.phase || "defense"]; // previous phase

    if (prev[1] === "waiting") return ["flee", "waiting"];
    if (prev[1] === "pursue") return ["flee", P(0.3) ? "pursue" : "waiting"];
    if (prev[1] === "retreat") return ["pursue", "retreat"];

    if (prev[0] === "landing") {
      const attackersPhase = P(i / 2) ? "melee" : "landing";
      const defendersPhase = i ? prev[1] : P(0.5) ? "defense" : "shock";
      return [attackersPhase, defendersPhase];
    }

    if (P(1 - morale[0] / 40)) return ["flee", "pursue"]; // chance if moral < 40
    if (P(1 - morale[1] / 25)) return ["pursue", "retreat"]; // chance if moral < 25

    return ["melee", "melee"]; // default option
  };

  const getAirBattlePhase = (): [string, string] => {
    const prev = [b.attackers.phase || "maneuvering", b.defenders.phase || "maneuvering"]; // previous phase

    // chance if moral < 25
    if (P(1 - morale[0] / 25)) return ["retreat", "pursue"];
    if (P(1 - morale[1] / 25)) return ["pursue", "retreat"];

    if (prev[0] === "maneuvering" && P(1 - i / 10)) return ["maneuvering", "maneuvering"];

    return ["dogfight", "dogfight"]; // default option
  };

  const phase: [string, string] = (() => {
    switch (b.type) {
      case "field":
        return getFieldBattlePhase();
      case "naval":
        return getNavalBattlePhase();
      case "siege":
        return getSiegePhase();
      case "ambush":
        return getAmbushPhase();
      case "landing":
        return getLandingPhase();
      case "air":
        return getAirBattlePhase();
      default:
        return getFieldBattlePhase();
    }
  })();

  b.attackers.phase = phase[0];
  b.defenders.phase = phase[1];

  const buttonA = ensureEl("battlePhase_attackers");
  buttonA.className = `icon-button-${b.attackers.phase}`;
  buttonA.dataset.tip = buttonA.nextElementSibling!.querySelector<HTMLElement>(
    `[data-phase='${phase[0]}']`
  )!.dataset.tip;

  const buttonD = ensureEl("battlePhase_defenders");
  buttonD.className = `icon-button-${b.defenders.phase}`;
  buttonD.dataset.tip = buttonD.nextElementSibling!.querySelector<HTMLElement>(
    `[data-phase='${phase[1]}']`
  )!.dataset.tip;
}

function runBattle(): void {
  const b = battle!;
  // validations
  if (!b.attackers.power) {
    tip("攻方军队已被消灭", false, "warn");
    return;
  }
  if (!b.defenders.power) {
    tip("守方军队已被消灭", false, "warn");
    return;
  }

  const currentPhase = `攻击方：${b.attackers.phase}，防守方：${b.defenders.phase}`;
  const lastRecord = b.phasesRecord.at(-1);
  if (lastRecord?.phase === currentPhase) lastRecord.count += 1;
  else b.phasesRecord.push({ phase: currentPhase, count: 1 });

  // calculate casualties
  const attack = b.attackers.power * (b.attackers.die! / 10 + 0.4);
  const defense = b.defenders.power * (b.defenders.die! / 10 + 0.4);

  // casualties modifier for phase
  const phaseCasualtyRate: Record<string, number> = {
    skirmish: 0.1,
    melee: 0.2,
    pursue: 0.3,
    retreat: 0.3,
    boarding: 0.2,
    shelling: 0.1,
    chase: 0.03,
    withdrawal: 0.03,
    blockade: 0,
    sheltering: 0,
    sortie: 0.1,
    bombardment: 0.05,
    storming: 0.2,
    defense: 0.2,
    looting: 0.5,
    surrendering: 0.5,
    surprise: 0.3,
    shock: 0.3,
    landing: 0.3,
    flee: 0,
    waiting: 0,
    maneuvering: 0.1,
    dogfight: 0.2
  };

  const casualties =
    Math.random() * Math.max(phaseCasualtyRate[b.attackers.phase!], phaseCasualtyRate[b.defenders.phase!]); // total casualties, ~10% per iteration
  const casualtiesA = (casualties * defense) / (attack + defense); // attackers casualties, ~5% per iteration
  const casualtiesD = (casualties * attack) / (attack + defense); // defenders casualties, ~5% per iteration

  calculateCasualties("attackers", casualtiesA);
  calculateCasualties("defenders", casualtiesD);
  b.attackers.casualties += casualtiesA;
  b.defenders.casualties += casualtiesD;

  // change morale
  b.attackers.morale = Math.max(b.attackers.morale - casualtiesA * 100 - 1, 0);
  b.defenders.morale = Math.max(b.defenders.morale - casualtiesD * 100 - 1, 0);

  // update table values
  updateTable("attackers");
  updateTable("defenders");

  // prepare for next iteration
  b.iteration += 1;
  selectPhase();
  calculateStrength("attackers");
  calculateStrength("defenders");
}

function calculateCasualties(side: Side, casualties: number): void {
  const b = battle!;
  for (const r of b[side].regiments) {
    for (const unit in r.u) {
      const randomness = 0.8 + Math.random() * 0.4;
      const died = Math.min(Pint(r.u[unit] * casualties * randomness), r.survivors![unit]);
      r.casualties![unit] -= died;
      r.survivors![unit] -= died;
    }
  }
}

function updateTable(side: Side): void {
  const b = battle!;
  for (const r of b[side].regiments) {
    const tbody = ensureEl(`battle${r.state}-${r.i}`);
    const battleCasualties = tbody.querySelector(".battleCasualties")!;
    const battleSurvivors = tbody.querySelector(".battleSurvivors")!;

    let index = 3; // index to find table element easily
    for (const u of options.military) {
      battleCasualties.querySelector(`td:nth-child(${index})`)!.innerHTML = String(r.casualties![u.name] || 0);
      battleSurvivors.querySelector(`td:nth-child(${index})`)!.innerHTML = String(r.survivors![u.name] || 0);
      index++;
    }

    battleCasualties.querySelector(`td:nth-child(${index})`)!.innerHTML = String(sum(Object.values(r.casualties!)));
    battleSurvivors.querySelector(`td:nth-child(${index})`)!.innerHTML = String(sum(Object.values(r.survivors!)));
  }
  updateMorale(side);
}

function toggleChange(event: Event): void {
  event.stopPropagation();
  const button = event.target as HTMLElement;
  const div = button.nextElementSibling as HTMLElement;

  const hideSection = (): void => {
    button.style.opacity = "1";
    div.style.display = "none";
  };
  if (div.style.display === "block") {
    hideSection();
    return;
  }

  button.style.opacity = "0.5";
  div.style.display = "block";

  document.getElementsByTagName("body")[0].on("click", hideSection, { once: true });
}

function changeType(event: Event): void {
  const target = event.target as HTMLElement;
  if (target.tagName !== "BUTTON") return;
  const b = battle!;
  b.type = target.dataset.type!;
  setType();
  selectPhase();
  calculateStrength("attackers");
  calculateStrength("defenders");
  b.name = defineBattleName();
  $("#battleScreen").dialog({ title: b.name });
}

function changePhase(event: Event, side: Side): void {
  const target = event.target as HTMLElement;
  if (target.tagName !== "BUTTON") return;
  const b = battle!;
  const phase = target.dataset.phase!;
  b[side].phase = phase;
  const button = ensureEl(`battlePhase_${side}`);
  button.className = `icon-button-${phase}`;
  button.dataset.tip = target.dataset.tip;
  calculateStrength(side);
}

function getRegimentStatus(losses: number): string {
  if (losses === 1) return "全军覆没";
  if (losses > 0.9) return "几乎被全歼";
  if (losses > 0.75) return "几乎被摧毁";
  if (losses > 0.6) return "遭到重创";
  if (losses > 0.45) return "遭到毁灭性损失";
  if (losses > 0.3) return "遭到严重损失";
  if (losses > 0.2) return "遭到重大损失";
  if (losses > 0.1) return "遭受相当大的损失";
  if (losses > 0.05) return "遭受明显损失";
  if (losses > 0) return "遭受轻微损失";
  return "毫发无伤";
}

function applyResults(): void {
  const b = battle!;
  const battleName = b.name;
  const maxCasualties = Math.max(b.attackers.casualties, b.defenders.casualties);
  const totalCasualties = b.attackers.casualties + b.defenders.casualties;
  const relativeCasualties = totalCasualties ? b.defenders.casualties / totalCasualties : NaN;
  const battleStatus = getBattleStatus(relativeCasualties, maxCasualties);

  function getBattleStatus(relative: number, max: number): [string, string] {
    if (Number.isNaN(relative)) return ["僵持", "僵持"]; // if no casualties at all
    if (max < 0.05) return ["小规模冲突", "小规模冲突"];
    if (relative > 0.95) return ["攻击方完胜", "防守方溃退"];
    if (relative > 0.7) return ["攻击方决定性胜利", "防守方惨败"];
    if (relative > 0.6) return ["攻击方胜利", "防守方失败"];
    if (relative > 0.4) return ["僵局", "僵局"];
    if (relative > 0.3) return ["攻击方失败", "防守方胜利"];
    if (relative >= 0) return ["攻击方溃退", "防守方完胜"];
    return ["僵局", "僵局"]; // exception
  }

  b.attackers.regiments.forEach(r => {
    applyResultForSide(r, "attackers");
  });
  b.defenders.regiments.forEach(r => {
    applyResultForSide(r, "defenders");
  });

  function applyResultForSide(r: Regiment, side: Side): void {
    const id = `regiment${r.state}-${r.i}`;

    // add result to regiment note
    const note = notes.find(n => n.id === id);
    if (note) {
      const status = side === "attackers" ? battleStatus[0] : battleStatus[1];
      const losses = r.a ? Math.abs(sum(Object.values(r.casualties!))) / r.a : 1;
      const regStatus = getRegimentStatus(losses);
      const initialList = Object.keys(r.u)
        .map(t => (r.u[t] ? `${r.u[t]} ${t}` : null))
        .filter((c): c is string => Boolean(c));
      const initialText = initialList.length ? ` 初始兵力：${list(initialList)}。` : "";
      const casualtiesList = Object.keys(r.casualties!)
        .map(t => (r.casualties![t] ? `${Math.abs(r.casualties![t])} ${t}` : null))
        .filter((c): c is string => Boolean(c));
      const casualtiesText = casualtiesList.length ? ` 伤亡：${list(casualtiesList)}。` : "";
      const legend = `<br><br>${battleName}（${options.year} ${options.eraShort}）：${status}。该军团${regStatus}。${initialText}${casualtiesText}`;
      note.legend += legend;
    }

    r.u = { ...r.survivors };
    r.a = sum(Object.values(r.u)); // reg total
    select<SVGGElement, unknown>("#armies").select(`g#${id} > text`).text(Military.getTotal(r)); // update reg box

    moveRegiment(r, r.px!, r.py!); // move regiment back to initial position
  }

  const i = (last(pack.markers)?.i ?? -1) + 1;
  {
    // append battlefield marker
    const marker: Marker = { i, x: b.x, y: b.y, cell: b.cell, icon: "⚔️", type: "battlefields", dy: 52 };
    pack.markers.push(marker);
    const markerHTML = drawMarker(marker);
    ensureEl("markers").insertAdjacentHTML("beforeend", markerHTML);
  }

  const getSide = (regs: Regiment[], n: number): string =>
    regs.length > 1
      ? `${list([...new Set(regs.map(r => pack.states[r.state].name))])}的${n ? "军团" : "军队"}`
      : `${getAdjective(pack.states[regs[0].state].name)} ${regs[0].name}`;
  const getLosses = (casualties: number): number => Math.min(rn(casualties * 100), 100);

  // aggregate units across all regiments of a side (casualties keys hold every unit type of the regiment)
  const aggregateUnits = (regs: Regiment[], getCount: (r: Regiment, unit: string) => number): Record<string, number> =>
    regs.reduce<Record<string, number>>((acc, r) => {
      for (const unit in r.casualties) acc[unit] = (acc[unit] || 0) + getCount(r, unit);
      return acc;
    }, {});
  const unitsToText = (units: Record<string, number>): string => {
    const items = Object.keys(units)
      .map(t => (units[t] ? `${units[t]} ${t}` : null))
      .filter((c): c is string => Boolean(c));
    return items.length ? list(items) : "";
  };
  const getForcesLegend = (label: string, side: BattleSide): string => {
    // initial forces are reconstructed from survivors + casualties, as r.u now holds survivors
    const initial = unitsToText(
      aggregateUnits(side.regiments, (r, u) => (r.survivors![u] || 0) + Math.abs(r.casualties![u]))
    );
    const casualties = unitsToText(aggregateUnits(side.regiments, (r, u) => Math.abs(r.casualties![u])));
    let text = initial ? `<br>${label}初始兵力：${initial}。` : "";
    if (casualties) text += ` 伤亡：${casualties}。`;
    return text;
  };

  const status = battleStatus[+P(0.7)];
  const result = `${getTypeName()}以${status}告终`;
  let legend = `${b.name}发生于${options.year} ${options.eraShort}。交战双方为${getSide(
    b.attackers.regiments,
    1
  )}与${getSide(b.defenders.regiments, 0)}。${result}。
      <br>攻击方损失：${getLosses(b.attackers.casualties)}%，防守方损失：${getLosses(b.defenders.casualties)}%。`;
  legend += getForcesLegend("攻击方", b.attackers);
  legend += getForcesLegend("防守方", b.defenders);

  if (b.phasesRecord.length) {
    const phasesText = b.phasesRecord.map(r => (r.count > 1 ? `${r.phase} (x${r.count})` : r.phase)).join("<br>");
    legend += `<br><br>交战进程：<br>${phasesText}`;
  }

  notes.push({ id: `marker${i}`, name: b.name, legend });

  tip(`${b.name} 已结束。${result}`, true, "success", 4000);

  closeBattleScreen();
  cleanData();
}

function cancelResults(): void {
  const b = battle!;
  b.attackers.regiments.forEach(r => {
    moveRegiment(r, r.px!, r.py!);
  });
  b.defenders.regiments.forEach(r => {
    moveRegiment(r, r.px!, r.py!);
  });

  closeBattleScreen();
  cleanData();
}

function closeBattleScreen(): void {
  $("#battleScreen").dialog("destroy");
  ensureEl("battleScreen").remove();

  const regimentSelector = document.getElementById("regimentSelectorScreen");
  if (regimentSelector?.classList.contains("ui-dialog-content")) $("#regimentSelectorScreen").dialog("destroy");
  regimentSelector?.remove();
}

function cleanData(): void {
  customization = 0; // exit edit mode

  // clean temp data
  if (battle) {
    battle.attackers.regiments.concat(battle.defenders.regiments).forEach(r => {
      delete r.px;
      delete r.py;
      delete r.casualties;
      delete r.survivors;
    });
  }
  battle = null;
}

export const BattleScreen = { open };
