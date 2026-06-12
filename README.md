# Flexible Line Simulator

A lightweight digital twin demo for a flexible intelligent production line.

This browser project simulates a robotic production cell with conveyor flow, workstation state, process switching, fault recovery, and a live production dashboard. It is designed as a portfolio-friendly GitHub project for demonstrating PCB and phone-frame automation workflows.

## Features

- PCB and phone-frame process modes
- Animated conveyor and robot transfer simulation
- Station-level ready, busy, and fault states
- Output, yield, cycle time, and OEE dashboard
- Event log for route completion and injected faults
- No build step and no external runtime dependencies

## Language Versions

| Language | Entry file | GitHub Pages |
|----------|------------|--------------|
| English | `index.html` | https://binbinfu131.github.io/flexible-line-simulator/ |
| Deutsch | `de.html` | https://binbinfu131.github.io/flexible-line-simulator/de.html |
| 中文 | `zh-cn.html` | https://binbinfu131.github.io/flexible-line-simulator/zh-cn.html |

All versions share `styles.css` and `app.js`; the UI copy is selected from the
locale table in `app.js` based on the page's `lang` attribute.

## Run Locally

Open `index.html` directly in a browser, or serve the folder with any static file server:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## GitHub Pages

This repository is ready for GitHub Pages. In the repository settings, choose:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/root`

## Project Positioning

This is a front-end simulator and visualization demo. It is not a real industrial controller, PLC program, MES integration, or safety-rated automation system.

## License

MIT
