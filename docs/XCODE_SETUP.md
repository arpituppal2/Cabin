# Cabin — Xcode Setup Guide

This guide walks you from a fresh clone of this repo to a running iPad build in Xcode.

---

## Prerequisites

- **Xcode 15.3+** (required for Swift 5.10 and the `@_silgen_name` bridge)
- **Unreal Engine 5.3** installed via Epic Games Launcher (choose Apple Silicon / arm64 build)
- **Apple Developer account** with an active iOS development certificate
- **iPad with iPadOS 17+** (ProMotion 120Hz recommended)
- Your M4 MacBook Pro on charger (Lumen cook is GPU-intensive)

---

## Step 1 — Clone and open the UE project first

```bash
git clone https://github.com/arpituppal2/Cabin.git
cd Cabin/CabinEngine
```

Right-click `CabinEngine.uproject` → **Generate Xcode Project**.
This produces `CabinEngine.xcworkspace` inside `CabinEngine/`.

> **Do not** open `CabinEngine.uproject` directly in UE yet — generate first.

---

## Step 2 — Build the CabinBridge plugin

In UE Editor (once open):

1. **Edit → Plugins** → search `CabinBridge` → Enable → Restart.
2. UE will prompt to rebuild — click **Yes**. This compiles `SwiftBridgeImpl.cpp` and `IFETextureUpdater.cpp`.
3. Verify: bottom toolbar shows **100%** compile progress with no errors.

If you hit linker errors about Metal frameworks, confirm `CabinEngine.Build.cs` is listing
`Metal`, `MetalKit`, `CoreMotion`, `AVFoundation`, `QuartzCore` under `PublicFrameworks`.

---

## Step 3 — Cook for iOS

1. **Platforms → iOS → Cook Content**.
2. First cook takes ~20–40 minutes on M4 (Metal shader compilation).
   Subsequent cooks are incremental and take ~2–5 minutes.
3. Output lands in `CabinEngine/Saved/Cooked/IOS/`.

---

## Step 4 — Create the SwiftUI Xcode project

1. Open Xcode → **New Project → App** (iOS).
2. Name: `Cabin`, Bundle ID: `com.yourname.cabin`.
3. Interface: **SwiftUI**. Lifecycle: **SwiftUI App**.
4. **Add all `CabinApp/*.swift` files** to the target (drag from Finder).
5. Add `CabinApp/Info.plist` as the custom info plist:
   - Project settings → Target → Info → set **Custom iOS Target Properties** source file.
6. Add `CabinApp/LaunchScreen.storyboard` to the target.

---

## Step 5 — Link the Unreal Framework

The UE iOS cook produces `UE4Game.framework` (or `CabinEngine.framework` in packaged builds).

1. **Project Settings → Frameworks, Libraries, and Embedded Content**.
2. **+** → Add Other → Add Files → navigate to the cooked `.framework`.
3. Set embedding to **Embed & Sign**.

Also add the UE-generated `CabinBridge.framework` from the plugin output.

---

## Step 6 — Bridging Header

Create `CabinApp/CabinApp-Bridging-Header.h`:

```objc
// CabinApp-Bridging-Header.h
// Imports the C ABI bridge so Swift can call CabinBridge_* functions directly.

#ifndef CabinApp_Bridging_Header_h
#define CabinApp_Bridging_Header_h

#include "SwiftBridgeInterface.h"

#endif
```

In **Build Settings → Swift Compiler → Objective-C Bridging Header**, set the path to this file.

---

## Step 7 — Capabilities

In **Signing & Capabilities**:

| Capability | Required for |
|---|---|
| Background Modes → Audio | Engine hum in Split View |
| Background Modes → Background Processing | Session timer |
| Motion Usage | CMMotionManager gyro |
| Increased Memory Limit | UE5 + Metal frame buffer |

---

## Step 8 — Build and Run

1. Select your iPad as the destination.
2. **Product → Run** (⌘R).
3. On first launch you will see the black launch screen, then the `OnboardingView` with the seat diagram.
4. Select a seat, route, and session length → **BEGIN FLIGHT**.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `CabinBridge_SendGyro` not found | Check bridging header path in Build Settings |
| Black MTKView (no UE render) | Confirm `CabinRegisterMTKView` notification is posted after `engine.start()` |
| 60fps cap on iPad | Confirm `CADisableMinimumFrameDurationOnPhone=true` in Info.plist |
| Engine hum stops in Split View | Confirm Background Modes → Audio is enabled in capabilities |
| Lumen artifacts on M4 | Try `r.Lumen.Reflections.Allow=0` temporarily to isolate |
