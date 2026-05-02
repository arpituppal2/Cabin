# Cabin

A macOS/iPadOS immersive productivity app — a first-person, gate-to-gate, diegetic productivity timer built around a photorealistic business-class aircraft cabin environment.

## Project Overview

Cabin is a native Apple platform application. It is **not a web app** and cannot be built or run in a Linux/Replit environment. This repository is intended for development on a macOS machine with Xcode and Unreal Engine installed.

## Architecture

The project has three components:

- **CabinApp/** — SwiftUI application target (iPadOS 17+ / macOS 14+)
  - SessionEngine, IFEView, MetalBridge, AudioController, GestureRouter
- **CabinEngine/** — Unreal Engine 5.7 project
  - CabinPawn, CabinPlayerController, CabinSessionManager, CabinGameMode
  - Lumen GI, Nanite, Niagara particles, Sequencer
- **CabinBridge/** — UE5 plugin bridging Metal textures from Swift to UE
  - IFETextureUpdater, SwiftBridgeInterface

## Build Requirements

- macOS 26+ (Apple Silicon recommended — M4 Max target)
- Xcode 26.4+ with iPadOS 26 SDK
- Unreal Engine 5.7.4 installed via Epic Games Launcher
- Swift 6.0 (strict concurrency enabled)

## Setup

Run `bash setup.sh` on a qualifying macOS machine. This will:
1. Verify Xcode and UE5 installations
2. Symlink the CabinBridge plugin into the UE project
3. Generate UE5 project files
4. Open the Xcode project

## Documentation

- `docs/ARCHITECTURE.md` — Full system architecture and layer diagram
- `docs/DESIGN_SPEC.md` — Visual and experience design specification
- `docs/UE5_SETUP.md` — Unreal Engine setup steps
- `docs/XCODE_SETUP.md` — Xcode signing and build steps

## Key Features

- First-person business-class cabin simulation
- Gate-to-gate Pomodoro session structure (7 flight phases)
- Diegetic IFE screen with 3 modes: Flight Map, Big Clock, Tail Camera
- Metal texture bridge between SwiftUI and UE5 at 120Hz
- Dynamic lighting, Lumen GI, Nanite geometry
- Spatial audio via Unreal Audio Engine with convolution reverb
- iPad gyroscope camera control
- iPadOS Split View support
