const recipes = {
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
};

const stationLayout = [
  { id: "Loader", x: 180, y: 430, w: 160, h: 128, label: "Loader" },
  { id: "Vision", x: 395, y: 318, w: 170, h: 118, label: "Vision" },
  { id: "Robot", x: 730, y: 292, w: 205, h: 180, label: "Robot" },
  { id: "MTS", x: 965, y: 330, w: 170, h: 125, label: "MTS" },
  { id: "Buffer", x: 1048, y: 478, w: 160, h: 95, label: "Buffer" }
];

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

let mode = "pcb";
let running = true;
let speed = 1;
let lastFrame = performance.now();
let elapsed = 0;
let output = 0;
let faults = 0;
let activeStep = 0;
let stepClock = 0;
let faultClock = 0;
let logEntries = [];

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

function formatClock(seconds) {
  const total = Math.floor(seconds);
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function activeRecipe() {
  return recipes[mode];
}

function stationState(stationId) {
  if (faultClock > 0 && stationId === "Vision") return "fault";
  const step = activeRecipe().route[activeStep];
  return step.station === stationId ? "busy" : "ready";
}

function addLog(message) {
  logEntries.unshift({ time: formatClock(elapsed), message });
  logEntries = logEntries.slice(0, 8);
  renderLog();
}

function renderLog() {
  eventLog.innerHTML = logEntries
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

function renderStaticUi() {
  const recipe = activeRecipe();
  document.querySelector("#lineTitle").textContent = recipe.title;
  document.querySelector("#lineSubtitle").textContent = recipe.subtitle;
  document.querySelector("#activeRecipe").textContent = recipe.recipe;
  document.querySelector("#stationSummary").textContent =
    faultClock > 0 ? "1 fault" : `${stationLayout.length} online`;

  routeList.innerHTML = recipe.route
    .map(
      (step, index) => `
        <li class="${index === activeStep ? "active-step" : ""}">
          <span>${step.name}</span>
          <span class="duration-pill">${step.seconds.toFixed(1)}s</span>
        </li>
      `
    )
    .join("");

  stationGrid.innerHTML = stationLayout
    .map((station) => {
      const state = stationState(station.id);
      return `
        <div class="station-tile ${state}">
          <span class="station-name">${station.label}</span>
          <span class="station-state"><span class="state-dot"></span>${state}</span>
        </div>
      `;
    })
    .join("");

  document.querySelector("#metricOutput").textContent = String(output);
  document.querySelector("#metricYield").textContent =
    `${Math.max(94.2, recipe.yieldBase - faults * 0.3).toFixed(1)}%`;
  document.querySelector("#metricCycle").textContent = `${recipe.cycle.toFixed(1)}s`;
  document.querySelector("#metricOee").textContent =
    `${Math.max(62, recipe.oeeBase - faults * 4)}%`;
  document.querySelector("#clockReadout").textContent = formatClock(elapsed);
}

function resetSimulation(keepMode = true) {
  if (!keepMode) mode = "pcb";
  elapsed = 0;
  output = 0;
  faults = 0;
  activeStep = 0;
  stepClock = 0;
  faultClock = 0;
  logEntries = [];
  addLog(`${activeRecipe().recipe} loaded`);
  renderStaticUi();
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
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
  drawText("MICRO-LINE X", 118, 626, 18, "#2457c5", 800);
  drawText("Flexible robot + MTS automation demo", 304, 625, 15, "#60717d", 500);
}

function drawConveyor() {
  ctx.strokeStyle = "#303943";
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(linePath[0].x, linePath[0].y);
  linePath.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.stroke();

  ctx.strokeStyle = "#54616c";
  ctx.lineWidth = 2;
  for (let i = 0; i < 22; i += 1) {
    const p = progressOnPath((i / 22 + (elapsed * 0.02 * speed) % 1) % 1);
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
  drawText(state.toUpperCase(), station.x + 16, station.y + 54, 12, stroke, 800);

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
  const target = robotTargets[recipe.route[activeStep].station];
  const base = { x: 835, y: 472 };
  const armA = {
    x: base.x + (target.x - base.x) * 0.45,
    y: base.y - 125 + Math.sin(elapsed * 3) * 4
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
  const cycleProgress = stepClock / recipe.route[activeStep].seconds;
  const baseProgress = (activeStep + cycleProgress) / recipe.route.length;
  const offsets = [0, -0.2, -0.4, -0.6];

  offsets.forEach((offset, index) => {
    const progress = (baseProgress + offset + 1) % 1;
    const point = progressOnPath(progress);
    ctx.fillStyle = index === 0 ? recipe.itemColor : "#8a98a5";
    if (mode === "pcb") {
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
  drawText(`${recipe.unitLabel} route step ${activeStep + 1} / ${recipe.route.length}`, 122, 173, 14, "#60717d", 600);

  const barWidth = 248;
  ctx.fillStyle = "#e2e7ec";
  roundedRect(122, 184, barWidth, 8, 4);
  ctx.fill();
  ctx.fillStyle = recipe.accent;
  roundedRect(122, 184, Math.max(8, barWidth * (stepClock / recipe.route[activeStep].seconds)), 8, 4);
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

function tick(now) {
  const delta = Math.min(0.08, (now - lastFrame) / 1000);
  lastFrame = now;

  if (running) {
    const recipe = activeRecipe();
    const adjusted = delta * speed;
    elapsed += adjusted;

    if (faultClock > 0) {
      faultClock = Math.max(0, faultClock - adjusted);
      if (faultClock === 0) addLog("Vision fault cleared, automatic recovery complete");
    } else {
      stepClock += adjusted;
      const step = recipe.route[activeStep];
      if (stepClock >= step.seconds) {
        addLog(`${step.station}: ${step.name} complete`);
        stepClock = 0;
        activeStep += 1;
        if (activeStep >= recipe.route.length) {
          activeStep = 0;
          output += 1;
          addLog(`${recipe.unitLabel} unit ${String(output).padStart(3, "0")} finished`);
        }
      }
    }
  }

  renderStaticUi();
  draw();
  requestAnimationFrame(tick);
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    modeButtons.forEach((item) => item.classList.toggle("active", item === button));
    resetSimulation(true);
  });
});

toggleRun.addEventListener("click", () => {
  running = !running;
  toggleRun.querySelector(".button-icon").textContent = running ? "||" : ">";
  toggleRun.querySelector("span:last-child").textContent = running ? "Pause" : "Run";
  toggleRun.setAttribute("aria-label", running ? "Pause line" : "Run line");
  addLog(running ? "Line resumed" : "Line paused by operator");
  renderStaticUi();
  draw();
});

resetLine.addEventListener("click", () => {
  resetSimulation(true);
});

injectFault.addEventListener("click", () => {
  faults += 1;
  faultClock = 4.5;
  addLog("Vision alignment fault injected");
  renderStaticUi();
  draw();
});

speedRange.addEventListener("input", () => {
  speed = Number(speedRange.value);
  addLog(`Line speed set to ${speed.toFixed(2)}x`);
  renderStaticUi();
});

resetSimulation(true);
requestAnimationFrame(tick);
