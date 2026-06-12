"use strict";

/* =========================================================================
 * Flexible Line Simulator
 *
 * Sections:
 *   1. Localization        - all user-facing copy, per locale
 *   2. Line configuration  - recipes come from the locale table; geometry here
 *   3. DOM references
 *   4. Simulation state
 *   5. Dashboard rendering - DOM updates, event-driven (not per frame)
 *   6. Canvas drawing      - HiDPI-aware, draws in a fixed 1280x720 space
 *   7. Simulation update   - advances state, reports when the UI must refresh
 *   8. Event bindings
 * ========================================================================= */

/* ===== 1. Localization ================================================== */

const pageLang = document.documentElement.lang.toLowerCase();
const locale = pageLang.startsWith("zh") ? "zh" : pageLang.startsWith("de") ? "de" : "en";

const localeCopy = {
  en: {
    machineLabel: "MICRO-LINE X",
    machineTagline: "Flexible robot + MTS automation demo",
    routeStep: (unitLabel, current, total) => `${unitLabel} route step ${current} / ${total}`,
    stationSummary: (count) => `${count} online`,
    stationFault: "1 fault",
    stateLabels: {
      ready: "ready",
      busy: "busy",
      fault: "fault"
    },
    controls: {
      pause: "Pause",
      run: "Run",
      pauseAria: "Pause line",
      runAria: "Run line"
    },
    logs: {
      loaded: (recipe) => `${recipe} loaded`,
      recovered: "Vision fault cleared, automatic recovery complete",
      stepComplete: (station, step) => `${station}: ${step} complete`,
      unitFinished: (unitLabel, output) => `${unitLabel} unit ${String(output).padStart(3, "0")} finished`,
      paused: "Line paused by operator",
      resumed: "Line resumed",
      faultInjected: "Vision alignment fault injected",
      speedChanged: (speed) => `Line speed set to ${speed.toFixed(2)}x`
    },
    recipes: {
      pcb: {
        title: "PCB flexible assembly cell",
        subtitle: "Automated loading, optical alignment, robot transfer, and test routing.",
        recipe: "PCB-A12",
        unitLabel: "PCB",
        cycle: 7.6,
        yieldBase: 99.1,
        oeeBase: 87,
        itemColor: "#2457c5",
        accent: "#0b8a86",
        route: [
          { name: "Magazine load", station: "Loader", seconds: 1.2 },
          { name: "Fiducial alignment", station: "Vision", seconds: 1.7 },
          { name: "Robot transfer", station: "Robot", seconds: 1.4 },
          { name: "Functional test", station: "MTS", seconds: 2.2 },
          { name: "Buffer unload", station: "Buffer", seconds: 1.1 }
        ]
      },
      frame: {
        title: "Phone frame dual-process cell",
        subtitle: "Flexible handling for middle-frame inspection, dispensing, pressing, and verification.",
        recipe: "FRAME-B07",
        unitLabel: "Frame",
        cycle: 9.4,
        yieldBase: 98.4,
        oeeBase: 83,
        itemColor: "#bd7a1f",
        accent: "#2457c5",
        route: [
          { name: "Tray load", station: "Loader", seconds: 1.3 },
          { name: "Surface inspection", station: "Vision", seconds: 1.8 },
          { name: "Robot positioning", station: "Robot", seconds: 1.5 },
          { name: "Dispense and press", station: "MTS", seconds: 3.4 },
          { name: "Final verify", station: "Buffer", seconds: 1.4 }
        ]
      }
    },
    stations: {
      Loader: "Loader",
      Vision: "Vision",
      Robot: "Robot",
      MTS: "MTS",
      Buffer: "Buffer"
    }
  },
  de: {
    machineLabel: "MICRO-LINE X",
    machineTagline: "Flexible Roboter- + MTS-Automatisierungsdemo",
    routeStep: (unitLabel, current, total) => `${unitLabel}: Prozessschritt ${current} / ${total}`,
    stationSummary: (count) => `${count} online`,
    stationFault: "1 Störung",
    stateLabels: {
      ready: "bereit",
      busy: "aktiv",
      fault: "Störung"
    },
    controls: {
      pause: "Pause",
      run: "Start",
      pauseAria: "Linie pausieren",
      runAria: "Linie starten"
    },
    logs: {
      loaded: (recipe) => `${recipe} geladen`,
      recovered: "Vision-Störung behoben, automatische Erholung abgeschlossen",
      stepComplete: (station, step) => `${station}: ${step} abgeschlossen`,
      unitFinished: (unitLabel, output) => `${unitLabel}-Einheit ${String(output).padStart(3, "0")} fertiggestellt`,
      paused: "Linie vom Bediener pausiert",
      resumed: "Linie fortgesetzt",
      faultInjected: "Vision-Ausrichtungsstörung injiziert",
      speedChanged: (speed) => `Liniengeschwindigkeit auf ${speed.toFixed(2)}x gesetzt`
    },
    recipes: {
      pcb: {
        title: "Flexible PCB-Montagezelle",
        subtitle: "Automatisches Laden, optische Ausrichtung, Robotertransfer und Testrouting.",
        recipe: "PCB-A12",
        unitLabel: "PCB",
        cycle: 7.6,
        yieldBase: 99.1,
        oeeBase: 87,
        itemColor: "#2457c5",
        accent: "#0b8a86",
        route: [
          { name: "Magazin laden", station: "Loader", seconds: 1.2 },
          { name: "Fiducial-Ausrichtung", station: "Vision", seconds: 1.7 },
          { name: "Robotertransfer", station: "Robot", seconds: 1.4 },
          { name: "Funktionstest", station: "MTS", seconds: 2.2 },
          { name: "Puffer entladen", station: "Buffer", seconds: 1.1 }
        ]
      },
      frame: {
        title: "Doppelprozesszelle für Handy-Mittelrahmen",
        subtitle: "Flexibles Handling für Mittelrahmen-Inspektion, Dosieren, Pressen und Endprüfung.",
        recipe: "FRAME-B07",
        unitLabel: "Rahmen",
        cycle: 9.4,
        yieldBase: 98.4,
        oeeBase: 83,
        itemColor: "#bd7a1f",
        accent: "#2457c5",
        route: [
          { name: "Tray laden", station: "Loader", seconds: 1.3 },
          { name: "Oberflächeninspektion", station: "Vision", seconds: 1.8 },
          { name: "Roboterpositionierung", station: "Robot", seconds: 1.5 },
          { name: "Dosieren und Pressen", station: "MTS", seconds: 3.4 },
          { name: "Endprüfung", station: "Buffer", seconds: 1.4 }
        ]
      }
    },
    stations: {
      Loader: "Beladung",
      Vision: "Vision",
      Robot: "Roboter",
      MTS: "MTS",
      Buffer: "Puffer"
    }
  },
  zh: {
    machineLabel: "微型柔性产线 X",
    machineTagline: "机器人 + MTS 双工艺自动化演示",
    routeStep: (unitLabel, current, total) => `${unitLabel} 工艺步骤 ${current} / ${total}`,
    stationSummary: (count) => `${count} 个工位在线`,
    stationFault: "1 个故障",
    stateLabels: {
      ready: "就绪",
      busy: "运行",
      fault: "故障"
    },
    controls: {
      pause: "暂停",
      run: "运行",
      pauseAria: "暂停产线",
      runAria: "运行产线"
    },
    logs: {
      loaded: (recipe) => `${recipe} 配方已载入`,
      recovered: "视觉故障已清除，自动恢复完成",
      stepComplete: (station, step) => `${station}: ${step} 完成`,
      unitFinished: (unitLabel, output) => `${unitLabel} 工件 ${String(output).padStart(3, "0")} 已完成`,
      paused: "操作员暂停产线",
      resumed: "产线继续运行",
      faultInjected: "已注入视觉对位故障",
      speedChanged: (speed) => `产线速度调整为 ${speed.toFixed(2)}x`
    },
    recipes: {
      pcb: {
        title: "PCB 柔性装配单元",
        subtitle: "自动上料、光学对位、机器人转运与测试分流。",
        recipe: "PCB-A12",
        unitLabel: "PCB",
        cycle: 7.6,
        yieldBase: 99.1,
        oeeBase: 87,
        itemColor: "#2457c5",
        accent: "#0b8a86",
        route: [
          { name: "料框上料", station: "Loader", seconds: 1.2 },
          { name: "基准点对位", station: "Vision", seconds: 1.7 },
          { name: "机器人转运", station: "Robot", seconds: 1.4 },
          { name: "功能测试", station: "MTS", seconds: 2.2 },
          { name: "缓存下料", station: "Buffer", seconds: 1.1 }
        ]
      },
      frame: {
        title: "手机中框双工艺单元",
        subtitle: "面向中框检测、点胶、压合与复检的柔性搬运流程。",
        recipe: "FRAME-B07",
        unitLabel: "中框",
        cycle: 9.4,
        yieldBase: 98.4,
        oeeBase: 83,
        itemColor: "#bd7a1f",
        accent: "#2457c5",
        route: [
          { name: "托盘上料", station: "Loader", seconds: 1.3 },
          { name: "外观检测", station: "Vision", seconds: 1.8 },
          { name: "机器人定位", station: "Robot", seconds: 1.5 },
          { name: "点胶压合", station: "MTS", seconds: 3.4 },
          { name: "终检确认", station: "Buffer", seconds: 1.4 }
        ]
      }
    },
    stations: {
      Loader: "上料",
      Vision: "视觉",
      Robot: "机器人",
      MTS: "MTS",
      Buffer: "缓存"
    }
  }
};

const copy = localeCopy[locale];
const recipes = copy.recipes;

/* ===== 2. Line configuration ============================================ */

// All canvas drawing uses a fixed virtual coordinate space; section 6 maps it
// to the real (HiDPI-scaled) canvas buffer.
const VIEW_W = 1280;
const VIEW_H = 720;

const FAULT_RECOVERY_SECONDS = 4.5;
const MAX_LOG_ENTRIES = 8;

const stationLayout = [
  { id: "Loader", x: 180, y: 430, w: 160, h: 128, label: copy.stations.Loader },
  { id: "Vision", x: 395, y: 318, w: 170, h: 118, label: copy.stations.Vision },
  { id: "Robot", x: 730, y: 292, w: 205, h: 180, label: copy.stations.Robot },
  { id: "MTS", x: 965, y: 330, w: 170, h: 125, label: copy.stations.MTS },
  { id: "Buffer", x: 1048, y: 478, w: 160, h: 95, label: copy.stations.Buffer }
];

const linePath = [
  { x: 95, y: 530 },
  { x: 235, y: 530 },
  { x: 430, y: 530 },
  { x: 620, y: 530 },
  { x: 775, y: 530 },
  { x: 968, y: 530 },
  { x: 1150, y: 530 },
  { x: 1225, y: 530 }
];

const robotTargets = {
  Loader: { x: 265, y: 450 },
  Vision: { x: 480, y: 398 },
  Robot: { x: 830, y: 430 },
  MTS: { x: 1050, y: 408 },
  Buffer: { x: 1120, y: 505 }
};

/* ===== 3. DOM references ================================================= */

const canvas = document.querySelector("#lineCanvas");
const ctx = canvas.getContext("2d");
const routeList = document.querySelector("#routeList");
const stationGrid = document.querySelector("#stationGrid");
const eventLog = document.querySelector("#eventLog");
const toggleRun = document.querySelector("#toggleRun");
const resetLine = document.querySelector("#resetLine");
const injectFault = document.querySelector("#injectFault");
const speedRange = document.querySelector("#speedRange");
const modeButtons = document.querySelectorAll("[data-mode]");
const lineTitle = document.querySelector("#lineTitle");
const lineSubtitle = document.querySelector("#lineSubtitle");
const activeRecipeReadout = document.querySelector("#activeRecipe");
const stationSummary = document.querySelector("#stationSummary");
const metricOutput = document.querySelector("#metricOutput");
const metricYield = document.querySelector("#metricYield");
const metricCycle = document.querySelector("#metricCycle");
const metricOee = document.querySelector("#metricOee");
const clockReadout = document.querySelector("#clockReadout");

/* ===== 4. Simulation state =============================================== */

const sim = {
  mode: "pcb",
  running: true,
  speed: 1,
  elapsed: 0,
  output: 0,
  faults: 0,
  activeStep: 0,
  stepClock: 0,
  faultClock: 0,
  logEntries: []
};

function activeRecipe() {
  return recipes[sim.mode];
}

function stationState(stationId) {
  if (sim.faultClock > 0 && stationId === "Vision") return "fault";
  const step = activeRecipe().route[sim.activeStep];
  return step.station === stationId ? "busy" : "ready";
}

function formatClock(seconds) {
  const total = Math.floor(seconds);
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/* ===== 5. Dashboard rendering ============================================
 * The dashboard is event-driven: renderDashboard() runs only when the line
 * state changes (step advance, fault, reset, mode switch), never per frame.
 * Only the clock readout is refreshed from the animation loop, and only when
 * the displayed second actually changes.
 * ========================================================================= */

function addLog(message) {
  sim.logEntries.unshift({ time: formatClock(sim.elapsed), message });
  sim.logEntries = sim.logEntries.slice(0, MAX_LOG_ENTRIES);
  renderLog();
}

function renderLog() {
  eventLog.innerHTML = sim.logEntries
    .map(
      (entry) => `
        <li>
          <span class="event-time">${entry.time}</span>
          <span class="event-text">${entry.message}</span>
        </li>
      `
    )
    .join("");
}

function renderHeadline() {
  const recipe = activeRecipe();
  lineTitle.textContent = recipe.title;
  lineSubtitle.textContent = recipe.subtitle;
  activeRecipeReadout.textContent = recipe.recipe;
}

function renderRoute() {
  routeList.innerHTML = activeRecipe()
    .route.map(
      (step, index) => `
        <li class="${index === sim.activeStep ? "active-step" : ""}">
          <span>${step.name}</span>
          <span class="duration-pill">${step.seconds.toFixed(1)}s</span>
        </li>
      `
    )
    .join("");
}

function renderStations() {
  stationSummary.textContent =
    sim.faultClock > 0 ? copy.stationFault : copy.stationSummary(stationLayout.length);
  stationGrid.innerHTML = stationLayout
    .map((station) => {
      const state = stationState(station.id);
      return `
        <div class="station-tile ${state}">
          <span class="station-name">${station.label}</span>
          <span class="station-state"><span class="state-dot"></span>${copy.stateLabels[state]}</span>
        </div>
      `;
    })
    .join("");
}

function renderMetrics() {
  const recipe = activeRecipe();
  metricOutput.textContent = String(sim.output);
  metricYield.textContent = `${Math.max(94.2, recipe.yieldBase - sim.faults * 0.3).toFixed(1)}%`;
  metricCycle.textContent = `${recipe.cycle.toFixed(1)}s`;
  metricOee.textContent = `${Math.max(62, recipe.oeeBase - sim.faults * 4)}%`;
}

let lastClockText = "";

function renderClock() {
  const text = formatClock(sim.elapsed);
  if (text !== lastClockText) {
    lastClockText = text;
    clockReadout.textContent = text;
  }
}

function renderDashboard() {
  renderHeadline();
  renderRoute();
  renderStations();
  renderMetrics();
  renderClock();
}

/* ===== 6. Canvas drawing ================================================= */

// Keeps the backing buffer matched to the element's CSS size and the device
// pixel ratio, while every draw call keeps using VIEW_W x VIEW_H coordinates.
function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cssWidth = canvas.clientWidth || VIEW_W;
  const width = Math.round(cssWidth * dpr);
  const height = Math.round((cssWidth * dpr * VIEW_H) / VIEW_W);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(width / VIEW_W, 0, 0, height / VIEW_H, 0, 0);
}

function progressOnPath(progress) {
  const segmentCount = linePath.length - 1;
  const normalized = Number.isFinite(progress) ? ((progress % 1) + 1) % 1 : 0;
  const scaled = Math.min(normalized * segmentCount, segmentCount - 0.001);
  const index = Math.min(Math.max(Math.floor(scaled), 0), segmentCount - 1);
  const local = scaled - index;
  const a = linePath[index];
  const b = linePath[index + 1];
  return {
    x: a.x + (b.x - a.x) * local,
    y: a.y + (b.y - a.y) * local
  };
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawText(text, x, y, size = 16, color = "#172026", weight = 600) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`;
  ctx.fillText(text, x, y);
}

function drawFrame() {
  ctx.fillStyle = "#f8fafb";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.strokeStyle = "#cbd5dd";
  ctx.lineWidth = 6;
  roundedRect(64, 84, 1152, 530, 14);
  ctx.stroke();

  ctx.strokeStyle = "#e2e7ec";
  ctx.lineWidth = 2;
  for (let x = 105; x < 1180; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, 92);
    ctx.lineTo(x + 42, 92);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  roundedRect(94, 590, 1092, 56, 6);
  ctx.fill();
  ctx.strokeStyle = "#d8e0e6";
  ctx.lineWidth = 2;
  ctx.stroke();
  drawText(copy.machineLabel, 118, 626, 18, "#2457c5", 800);
  drawText(copy.machineTagline, 304, 625, 15, "#60717d", 500);
}

function drawConveyor() {
  ctx.strokeStyle = "#303943";
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(linePath[0].x, linePath[0].y);
  linePath.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.stroke();

  // sim.elapsed already advances with the speed factor applied
  ctx.strokeStyle = "#54616c";
  ctx.lineWidth = 2;
  for (let i = 0; i < 22; i += 1) {
    const p = progressOnPath((i / 22 + (sim.elapsed * 0.02) % 1) % 1);
    ctx.beginPath();
    ctx.moveTo(p.x - 10, p.y - 18);
    ctx.lineTo(p.x + 10, p.y + 18);
    ctx.stroke();
  }
}

function drawStation(station) {
  const state = stationState(station.id);
  const fill = state === "fault" ? "#fff2ef" : state === "busy" ? "#edf4ff" : "#ffffff";
  const stroke = state === "fault" ? "#bd3f35" : state === "busy" ? "#2457c5" : "#cbd5dd";

  ctx.fillStyle = fill;
  roundedRect(station.x, station.y, station.w, station.h, 8);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();

  drawText(station.label, station.x + 16, station.y + 30, 16, "#172026", 800);
  drawText(copy.stateLabels[state], station.x + 16, station.y + 54, 12, stroke, 800);

  if (station.id === "Vision") {
    ctx.strokeStyle = "#8a98a5";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(station.x + 74, station.y + 78);
    ctx.lineTo(station.x + 118, station.y + 78);
    ctx.stroke();
    ctx.strokeRect(station.x + 82, station.y + 68, 28, 20);
  }

  if (station.id === "MTS") {
    ctx.fillStyle = "#d8e0e6";
    ctx.fillRect(station.x + 28, station.y + 70, 112, 12);
    ctx.fillRect(station.x + 76, station.y + 44, 16, 58);
  }
}

function drawRobot() {
  const recipe = activeRecipe();
  const target = robotTargets[recipe.route[sim.activeStep].station];
  const base = { x: 835, y: 472 };
  const armA = {
    x: base.x + (target.x - base.x) * 0.45,
    y: base.y - 125 + Math.sin(sim.elapsed * 3) * 4
  };
  const wrist = {
    x: armA.x + (target.x - armA.x) * 0.66,
    y: armA.y + (target.y - armA.y) * 0.66
  };

  ctx.fillStyle = "#303943";
  roundedRect(base.x - 28, base.y + 14, 56, 44, 6);
  ctx.fill();

  ctx.strokeStyle = "#202a33";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(base.x, base.y + 16);
  ctx.lineTo(armA.x, armA.y);
  ctx.lineTo(wrist.x, wrist.y);
  ctx.stroke();

  ctx.strokeStyle = recipe.accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y + 16);
  ctx.lineTo(armA.x, armA.y);
  ctx.lineTo(wrist.x, wrist.y);
  ctx.stroke();

  ctx.fillStyle = "#172026";
  ctx.beginPath();
  ctx.arc(base.x, base.y + 16, 18, 0, Math.PI * 2);
  ctx.arc(armA.x, armA.y, 14, 0, Math.PI * 2);
  ctx.arc(wrist.x, wrist.y, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#172026";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(wrist.x - 18, wrist.y + 12);
  ctx.lineTo(wrist.x + 18, wrist.y + 12);
  ctx.moveTo(wrist.x - 12, wrist.y + 12);
  ctx.lineTo(wrist.x - 18, wrist.y + 28);
  ctx.moveTo(wrist.x + 12, wrist.y + 12);
  ctx.lineTo(wrist.x + 18, wrist.y + 28);
  ctx.stroke();
}

function drawDisplays() {
  ctx.fillStyle = "#202a33";
  roundedRect(526, 136, 158, 96, 7);
  ctx.fill();
  roundedRect(712, 136, 158, 96, 7);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(538, 148, 134, 66);
  ctx.fillRect(724, 148, 134, 66);

  ctx.strokeStyle = activeRecipe().accent;
  ctx.lineWidth = 4;
  roundedRect(564, 170, 82, 24, 12);
  ctx.stroke();

  const colors = ["#2457c5", "#0b8a86", "#bd7a1f", "#bd3f35"];
  colors.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(742 + index * 24, 174, 16, 16);
  });

  ctx.fillStyle = "#303943";
  ctx.fillRect(596, 232, 14, 88);
  ctx.fillRect(782, 232, 14, 88);
  ctx.fillRect(566, 318, 258, 14);
}

function drawWorkItems() {
  const recipe = activeRecipe();
  const cycleProgress = sim.stepClock / recipe.route[sim.activeStep].seconds;
  const baseProgress = (sim.activeStep + cycleProgress) / recipe.route.length;
  const offsets = [0, -0.2, -0.4, -0.6];

  offsets.forEach((offset, index) => {
    const progress = (baseProgress + offset + 1) % 1;
    const point = progressOnPath(progress);
    ctx.fillStyle = index === 0 ? recipe.itemColor : "#8a98a5";
    if (sim.mode === "pcb") {
      roundedRect(point.x - 28, point.y - 14, 56, 28, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      for (let i = 0; i < 4; i += 1) ctx.fillRect(point.x - 18 + i * 11, point.y - 5, 5, 10);
    } else {
      ctx.lineWidth = 9;
      ctx.strokeStyle = index === 0 ? recipe.itemColor : "#8a98a5";
      roundedRect(point.x - 30, point.y - 18, 60, 36, 13);
      ctx.stroke();
    }
  });
}

function drawHud() {
  const recipe = activeRecipe();
  ctx.fillStyle = "#ffffff";
  roundedRect(100, 114, 300, 88, 8);
  ctx.fill();
  ctx.strokeStyle = "#d8e0e6";
  ctx.lineWidth = 2;
  ctx.stroke();
  drawText(recipe.recipe, 122, 146, 18, "#172026", 800);
  drawText(copy.routeStep(recipe.unitLabel, sim.activeStep + 1, recipe.route.length), 122, 173, 14, "#60717d", 600);

  const barWidth = 248;
  ctx.fillStyle = "#e2e7ec";
  roundedRect(122, 184, barWidth, 8, 4);
  ctx.fill();
  ctx.fillStyle = recipe.accent;
  roundedRect(122, 184, Math.max(8, barWidth * (sim.stepClock / recipe.route[sim.activeStep].seconds)), 8, 4);
  ctx.fill();
}

function draw() {
  drawFrame();
  stationLayout.forEach(drawStation);
  drawDisplays();
  drawConveyor();
  drawWorkItems();
  drawRobot();
  drawHud();
}

/* ===== 7. Simulation update ============================================== */

// Advances the line by `adjusted` (already speed-scaled) seconds.
// Returns true when something dashboard-visible changed.
function update(adjusted) {
  let dashboardChanged = false;
  sim.elapsed += adjusted;

  if (sim.faultClock > 0) {
    sim.faultClock = Math.max(0, sim.faultClock - adjusted);
    if (sim.faultClock === 0) {
      addLog(copy.logs.recovered);
      dashboardChanged = true;
    }
  } else {
    sim.stepClock += adjusted;
    const route = activeRecipe().route;
    const step = route[sim.activeStep];
    if (sim.stepClock >= step.seconds) {
      addLog(copy.logs.stepComplete(copy.stations[step.station], step.name));
      sim.stepClock = 0;
      sim.activeStep += 1;
      dashboardChanged = true;
      if (sim.activeStep >= route.length) {
        sim.activeStep = 0;
        sim.output += 1;
        addLog(copy.logs.unitFinished(activeRecipe().unitLabel, sim.output));
      }
    }
  }

  return dashboardChanged;
}

function resetSimulation() {
  sim.elapsed = 0;
  sim.output = 0;
  sim.faults = 0;
  sim.activeStep = 0;
  sim.stepClock = 0;
  sim.faultClock = 0;
  sim.logEntries = [];
  lastClockText = "";
  addLog(copy.logs.loaded(activeRecipe().recipe));
  renderDashboard();
  draw();
}

let lastFrame = performance.now();

function tick(now) {
  const delta = Math.min(0.08, (now - lastFrame) / 1000);
  lastFrame = now;

  // While paused nothing moves, so skip both update and draw; control
  // handlers repaint directly when they change state.
  if (sim.running) {
    if (update(delta * sim.speed)) {
      renderRoute();
      renderStations();
      renderMetrics();
    }
    renderClock();
    draw();
  }

  requestAnimationFrame(tick);
}

/* ===== 8. Event bindings ================================================= */

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sim.mode = button.dataset.mode;
    modeButtons.forEach((item) => item.classList.toggle("active", item === button));
    resetSimulation();
  });
});

toggleRun.addEventListener("click", () => {
  sim.running = !sim.running;
  toggleRun.querySelector(".button-icon").textContent = sim.running ? "||" : ">";
  toggleRun.querySelector("span:last-child").textContent =
    sim.running ? copy.controls.pause : copy.controls.run;
  toggleRun.setAttribute("aria-label", sim.running ? copy.controls.pauseAria : copy.controls.runAria);
  addLog(sim.running ? copy.logs.resumed : copy.logs.paused);
  draw();
});

resetLine.addEventListener("click", resetSimulation);

injectFault.addEventListener("click", () => {
  sim.faults += 1;
  sim.faultClock = FAULT_RECOVERY_SECONDS;
  addLog(copy.logs.faultInjected);
  renderStations();
  renderMetrics();
  draw();
});

// Speed applies immediately while dragging; the log entry is written once on
// release to keep the event log readable.
speedRange.addEventListener("input", () => {
  sim.speed = Number(speedRange.value);
});

speedRange.addEventListener("change", () => {
  addLog(copy.logs.speedChanged(sim.speed));
});

let resizePending = false;
window.addEventListener("resize", () => {
  if (resizePending) return;
  resizePending = true;
  requestAnimationFrame(() => {
    resizePending = false;
    fitCanvas();
    draw();
  });
});

fitCanvas();
resetSimulation();
requestAnimationFrame(tick);
