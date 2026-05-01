# Cabin — Unreal Engine 5 Setup Guide

Covers opening the project, wiring Blueprints, and cooking for iPad.

---

## Opening the Project

1. Launch Epic Games Launcher → **Unreal Engine 5.3** → Launch.
2. **Browse** → navigate to `Cabin/CabinEngine/CabinEngine.uproject` → Open.
3. When prompted to rebuild modules, click **Yes**.

---

## Wiring the Blueprint Stubs

The `Content/Blueprints/*.json` files in this repo are **human-readable descriptors**,
not native UE assets. You must create the actual Blueprint assets in the editor:

### For each Blueprint:

1. **Content Browser → Blueprints** folder → right-click → **Blueprint Class**.
2. Set the parent class to the C++ class named in the JSON (e.g. `CabinGameMode`, `CabinPawn`).
3. Name it exactly as in the JSON descriptor (`BP_CabinGameMode`, etc.).
4. Open the Blueprint graph and wire the nodes listed in the JSON `EventGraph` array.

### Order of creation matters:

```
1. BP_CabinGameMode      (no dependencies)
2. BP_CabinPawn          (no dependencies)
3. BP_WindowSystem       (no dependencies)
4. BP_CabinConsole       (depends on SM_Console mesh assets)
5. BP_CabinSessionManager (depends on BP_WindowSystem, BP_CabinConsole)
```

---

## Placing Actors in the Level

1. Open `Content/Maps/CabinBoardingMap` (create it if it does not exist yet).
2. Drag from Content Browser:
   - `BP_CabinGameMode` → set as World Settings → GameMode Override.
   - `BP_WindowSystem`  → place in level, set `bUseVideoPlate=true`.
   - `BP_CabinConsole`  → position relative to seat (consult DESIGN_SPEC.md measurements).
   - `BP_CabinSessionManager` → place anywhere, it is logic-only.
3. Set **World Settings → Default Pawn** to `BP_CabinPawn`.

---

## Lighting Setup

1. Delete the default sky sphere and directional light.
2. `BP_WindowSystem` owns its own directional light and sky atmosphere — nothing else needed.
3. Add a **Sky Light** → set to **Real Time Capture** so Lumen gets the correct sky colour.
4. Add **Exponential Height Fog** → Density=0.002, Height Falloff=0.4 (altitude simulation).
5. In **Edit → Project Settings → Rendering** confirm:
   - Global Illumination: **Lumen**
   - Reflections: **Lumen**
   - Anti-Aliasing: **Temporal Super Resolution**
   - Shadow Map Method: **Virtual Shadow Maps**

---

## Creating the IFE Material

1. **Content Browser** → right-click → **Material** → name `M_IFEDynamic`.
2. Set **Shading Model: Unlit** (the IFE screen emits its own light).
3. Add a **TextureObjectParameter** node named `DynamicTexture`.
4. Connect to **Emissive Color**.
5. Assign this material to `SM_IFEScreen`.

The `IFETextureUpdater` C++ class will update `DynamicTexture` each frame via
`CabinBridge_UpdateIFETexture()` → `FlushUpdate()` on the render thread.

---

## Cooking for iOS

```
Platforms → iOS → Cook Content
```

- First cook: ~20–40 min (Metal shader compilation for Lumen + Nanite + TSR).
- Incremental cook: ~2–5 min.
- Cooked output: `Saved/Cooked/IOS/CabinEngine/`

### Packaging (for TestFlight)

```
Platforms → iOS → Package Project
```

This produces an `.ipa`. Import into Transporter.app or use `xcrun altool` to upload.

---

## Performance Targets on M4

| Metric | Target | How to verify |
|---|---|---|
| Frame rate | 120fps in cruise | `stat fps` in console |
| GPU time | <7ms | `stat gpu` |
| Draw calls | <800 | `stat scenerendering` |
| Nanite triangles | Unlimited (handled by Nanite) | `r.Nanite.Visualize=1` |
| Memory | <3GB | Xcode Memory debugger |

---

## Low-Power Mode Toggle

From Swift, call `CabinBridge_SetLowPower(1)`. This triggers:

```ini
[CabinLowPowerMode]
r.Lumen.Reflections.Allow=0
r.DynamicGlobalIlluminationMethod=0
r.ReflectionMethod=0
r.Shadow.Virtual.Enable=0
r.MotionBlurQuality=0
r.BloomQuality=2
r.ScreenPercentage=75
```

The C++ bridge applies these as live console variable overrides — no restart required.
