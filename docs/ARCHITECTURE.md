# Cabin — Architecture Document

## Overview

Cabin is a first-person, gate-to-gate, diegetic productivity timer built around a photorealistic business-class aircraft cabin environment. The Mac/iPad screen becomes the user's eyes. All UI is embedded inside the in-flight entertainment (IFE) screen rendered in Unreal Engine 5. There are no floating menus.

---

## System Layers

```
┌─────────────────────────────────────────────┐
│              CabinApp (SwiftUI)             │
│  SessionEngine · IFEView · AudioController  │
│  GestureRouter · MetalBridge                │
└──────────────────┬──────────────────────────┘
                   │ Metal texture + events
┌──────────────────▼──────────────────────────┐
│           CabinBridge (UE Plugin)           │
│  IFETextureUpdater · SwiftBridgeInterface   │
└──────────────────┬──────────────────────────┘
                   │ Blueprint calls / UE API
┌──────────────────▼──────────────────────────┐
│          CabinEngine (Unreal Engine 5.3+)   │
│  CabinPawn · CabinPlayerController          │
│  CabinSessionManager · CabinGameMode        │
│  Lumen GI · Nanite · Niagara · Sequencer    │
└─────────────────────────────────────────────┘
```

---

## Cabin Seat Layout — 1-2-1 Configuration

```
LEFT WALL │ 1A │     │ 2B │ AISLE │ 1D │ 2D ║ 2G │ 1G │ AISLE │ 2J │     │ 1L │ RIGHT WALL
```

### Seat Definitions

| ID  | Name                        | Window | Console Position   | Privacy |
|-----|-----------------------------|--------|--------------------|---------|
| 1A  | True Left Window            | Yes    | Aisle-side shield  | Maximum |
| 2B  | Left Aisle                  | No     | Window side        | Open    |
| 1D  | Center Left – Aisle Facing  | No     | Center             | Medium  |
| 2D  | Center Left – Center Facing | No     | Aisle shield       | High    |
| 2G  | Center Right – Center Facing| No     | Aisle shield       | High    |
| 1G  | Center Right – Aisle Facing | No     | Center             | Medium  |
| 2J  | Right Aisle                 | No     | Window side        | Open    |
| 1L  | True Right Window           | Yes    | Aisle-side shield  | Maximum |

---

## Phase Timeline (Gate-to-Gate)

| Phase | Name              | Duration (example) | Trigger                       |
|-------|-------------------|--------------------|-------------------------------|
| 0     | Boarding          | ~3 min             | App launch                    |
| 1     | Pre-Departure     | User-set (e.g. 5m) | Session config complete       |
| 2     | Taxi & Takeoff    | ~4 min             | Session start                 |
| 3     | Cruise            | Remaining time     | Gear up                       |
| 4     | Break (Galley)    | 5 min              | Pomodoro sprint end           |
| 5     | Descent & Landing | ~6 min             | Final sprint end              |
| 6     | Gate Arrival      | ~1 min             | Touch down + taxi in          |

---

## IFE Modes

| Mode | Name         | Content                                              |
|------|--------------|------------------------------------------------------|
| 0    | Flight Map   | 3D globe, live route, telemetry (altitude, speed, ETA)|
| 1    | Big Clock    | Full-screen Pomodoro countdown, white on black        |
| 2    | Tail Camera  | Procedural cloud feed simulated from tail             |

---

## Camera System

- **Rig**: First-person SpringArm attached to CabinPawn (seated position)
- **Input**: iPad gyroscope → UE InputAxis pitch/yaw; Mac drag → mouse delta
- **Limits**: Yaw ±80°, Pitch –15° to +45° (simulates head movement in seat)
- **Turbulence**: Perlin noise applied to camera transform via Sequencer curve
- **Break animation**: Timeline-driven dolly from seat → aisle → galley door

---

## Rendering Pipeline

### Unreal Engine 5.3+
- **Lumen**: Dynamic GI + reflections (window glare on IFE, cabin bounce light)
- **Nanite**: Seats, console, tray table, overhead bins, cabin walls
- **TSR**: Temporal Super Resolution at 60 FPS target
- **Niagara**: Engine exhaust haze (window), air vent particles, cabin dust motes
- **Sequencer**: Takeoff tilt, landing tilt, break walk

### Window / Sky System
- **Procedural layer**: Volumetric cloud material (Niagara + shader)
- **Video plate layer**: 4K H.265 looping plates per time-of-day × seat position
- **Time-of-day rig**: Directional light + sky atmosphere driven by session clock
- **Altitude fog**: Exponential height fog adjusted during climb/descent

---

## Audio Pipeline (Unreal Audio Engine)

| Sound                  | Type                   | Notes                              |
|------------------------|------------------------|------------------------------------|
| Ground power hum       | Loop                   | Phase 0–1                          |
| Boarding music         | Loop (lo-fi filtered)  | Phase 0–1                          |
| PA announcements       | One-shot (MetaSound)   | Triggered by phase transitions     |
| Seatbelt chime         | One-shot               | Phase 2 start, Phase 3 start       |
| Engine spool-up        | Transition loop        | Phase 2                            |
| Engine cruise hum      | Loop                   | Phase 3, dominant focus audio      |
| Air vent hiss          | Loop                   | Phase 3                            |
| Turbulence creak       | Random stinger         | Phase 3                            |
| Tray table deploy      | One-shot               | User tap                           |
| Meal service clink     | One-shot               | Break meal fade-in                 |
| Cabin carpet footstep  | Loop                   | Break walk animation               |
| Galley chatter (muffled)| Loop                  | Phase 4 galley                     |
| Landing gear thud      | One-shot               | Phase 5                            |
| Arrival PA             | One-shot               | Phase 6                            |

Convolution reverb profile: narrow metal tube (0.3s RT60) for seat area; larger reverb (0.8s RT60) for galley.

---

## SwiftUI ↔ UE5 Metal Bridge

```
SwiftUI SessionEngine
    │
    │  (updates every frame via CADisplayLink @ 120Hz)
    ▼
MetalBridge.swift
    │  MTLTexture (shared IOSurface)
    ▼
CabinBridge UE Plugin
    │  IFETextureUpdater → UTexture2D parameter
    ▼
IFE Material in UE5
    │  Emissive map → OLED screen mesh
    ▼
Lumen renders IFE glow onto surrounding seat surfaces
```

The IFE screen in-world reflects correctly because it is a real emissive texture updated live — not a UI overlay.

---

## iPadOS Features

| Feature            | Implementation                                    |
|--------------------|--------------------------------------------------|
| Split View         | UE rendered to MTKView; SwiftUI hosts as side panel |
| PiP Audio          | AVAudioSession .playback, background mode entitlement |
| Gyroscope          | CMMotionManager → UE InputAxis via bridge         |
| Low-Power Fallback | Lumen disabled; baked lightmap swapped in; video plate only |
| Background Timer   | BGTaskScheduler + local notification on sprint end|

---

## File Structure

```
Cabin/
├── CabinApp/              SwiftUI application target
│   ├── CabinApp.swift
│   ├── ContentView.swift
│   ├── SessionEngine.swift
│   ├── IFEView.swift
│   ├── MetalBridge.swift
│   ├── AudioController.swift
│   ├── GestureRouter.swift
│   └── Info.plist
├── CabinEngine/           Unreal Engine 5 project
│   ├── CabinEngine.uproject
│   ├── Config/
│   │   └── DefaultEngine.ini
│   └── Source/
│       ├── CabinEngine.Target.cs
│       ├── CabinEngineEditor.Target.cs
│       └── CabinEngine/
│           ├── CabinEngine.Build.cs
│           ├── CabinGameMode.h/.cpp
│           ├── CabinPlayerController.h/.cpp
│           ├── CabinPawn.h/.cpp
│           ├── CabinSessionManager.h/.cpp
│           └── CabinBridge.h/.cpp
├── CabinBridge/           UE Plugin — Metal texture bridge
│   ├── CabinBridge.uplugin
│   └── Source/CabinBridge/
│       ├── CabinBridge.Build.cs
│       ├── IFETextureUpdater.h/.cpp
│       └── SwiftBridgeInterface.h
└── docs/
    ├── ARCHITECTURE.md    (this file)
    └── DESIGN_SPEC.md
```

---

## Build Targets

| Target              | Platform       | Notes                             |
|---------------------|----------------|-----------------------------------|
| CabinApp            | iPadOS 17+     | SwiftUI + Metal                   |
| CabinApp (Mac)      | macOS 14+      | Catalyst or native Mac target     |
| CabinEngine         | iOS/iPadOS     | UE5 packaged via Xcode            |
| CabinEngine (Editor)| macOS (M-chip) | Development/cook environment      |

---

## Development Machine

- MacBook Pro M4 Max — GPU usage uncapped, always on charger
- UE5 Editor runs natively via Apple Silicon build
- Metal GPU family: Apple 9 (M4 Max)
- Target frame rate: 60 FPS (ProMotion 120Hz for UI gestures)
