# CABIN — Immersive Productivity App

A browser-first, first-person productivity environment styled as a long-haul business class aircraft cabin. Built for the Replit Buildathon (Replit's 10th birthday).

## What It Is

Cabin is a fully diegetic productivity app — no traditional UI. Every interaction happens by clicking physical objects inside a photorealistic 3D aircraft cabin rendered in Three.js/WebGL. The IFE screen IS the dashboard. The notebook IS the note editor. The engine hum IS the focus timer. Sessions run gate-to-gate with full Pomodoro sprint management.

## Tech Stack

- **Frontend**: Pure HTML + CSS + JavaScript (ES modules, zero build steps)
- **3D Engine**: Three.js r183 via CDN importmap
- **Audio**: Web Audio API (synthesized, no external audio files)
- **Fonts**: Instrument Serif + Inter (Google Fonts)
- **Server**: Python `http.server` on port 5000

## File Structure

```
cabin-web/
├── index.html              ← Entry point, importmap, font links
├── src/
│   ├── main.js             ← App bootstrap, wires all modules
│   ├── scene/
│   │   ├── CabinScene.js   ← Three.js scene, camera, renderer, lighting
│   │   ├── CabinGeometry.js ← All 3D mesh construction (procedural, no GLBs)
│   │   ├── WindowView.js   ← Procedural sky/cloud canvas texture
│   │   ├── Hotspots.js     ← Raycaster click detection
│   │   └── CameraRig.js    ← First-person look pan (mouse/touch/gyro)
│   ├── session/
│   │   ├── SessionEngine.js ← Flight phases, timer, Pomodoro logic
│   │   ├── RouteData.js    ← 20 real long-haul routes database
│   │   └── MealService.js  ← Scheduled meal fade-in events
│   ├── audio/
│   │   └── AudioEngine.js  ← Web Audio: engine hum, chimes, PA (speech synthesis)
│   ├── ui/
│   │   ├── IFEScreen.js    ← Diegetic IFE overlay (map/clock/tailcam/tasks modes)
│   │   ├── Notebook.js     ← In-world note editor panel
│   │   ├── SeatSelector.js ← Onboarding seat selection + config screen
│   │   └── PanelManager.js ← Panel transitions manager
│   └── style/
│       ├── base.css        ← CSS tokens, reset, typography
│       └── panels.css      ← IFE, notebook, seat selector styles
```

## Running

The app is served as static files by Python's http.server on port 5000.

```bash
python3 -m http.server 5000 --directory cabin-web
```

## Flight Phases

1. **ONBOARDING** — Seat selector + route/session config
2. **BOARDING** — Jet bridge, bright cabin lights, PA announcement
3. **TAXI** — Tarmac view, blue-purple lighting, seatbelt sign ON
4. **TAKEOFF** — Engine spool-up, camera tilts +12°, ground rushes away
5. **CRUISE** — Main work session, Pomodoro sprints, dynamic sky
6. **BREAK** — Walk to galley or stay seated (tea service)
7. **DESCENT** — Cabin brightens, approach PA, seatbelt sign ON
8. **LANDING** — Gear-down sounds, heavy camera shake
9. **ARRIVED** — Session summary on IFE with stats

## Key Features

- First-person camera with ±60° yaw / ±30° pitch look-around
- Procedural sky with clouds, stars, ground, tarmac based on phase
- All geometry built procedurally (no external 3D assets)
- PBR materials: marble console, walnut tray table, charcoal seat shell
- Clickable hotspots: IFE, tray table, notebook, seat controls, cubby, headphones
- Web Audio synthesized engine hum, chimes, clicks, PA announcements
- IFE modes: Flight Map (live telemetry), Big Clock, Tail Camera, Task Board
- Notebook with ruled paper styling and auto-timestamped sprint headers
- 20 real long-haul routes with realistic altitude/speed telemetry
- Meal service events at configurable intervals during cruise
- Mobile/touch responsive with pointer event support
