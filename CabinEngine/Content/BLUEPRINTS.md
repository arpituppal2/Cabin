# Cabin — Blueprint Reference

Every Blueprint in this document must be created inside Unreal Editor by hand
(Blueprints cannot be committed as binary `.uasset` files to a text repo).
This document gives you the **exact variable names, component hierarchy,
event graph logic, and construction script** for each Blueprint so you can
recreate them precisely.

---

## BP_CabinPawn

**Parent class:** `CabinPawn` (C++, `Source/CabinEngine/CabinPawn.h`)
**Location:** `Content/Blueprints/BP_CabinPawn.uasset`

### Components (in order)
```
DefaultSceneRoot
└─ CameraRoot  [USceneComponent]          — turbulence shake applied here
   └─ FirstPersonCamera  [UCameraComponent]
      CaptureMode: Perspective
      FOV: 72.0
      AspectRatio: 1.7778  (16:9, overridden at runtime per seat)
      bConstrainAspectRatio: false
```

### Variables
| Name | Type | Default | Notes |
|---|---|---|---|
| `WindowSystem` | `ACabinWindowSystem*` | null | Set in BeginPlay via GetActorOfClass |
| `SessionManager` | `ACabinSessionManager*` | null | Set in BeginPlay via GetActorOfClass |
| `MPC_WindowBlend` | `UMaterialParameterCollection*` | asset ref | Assign in editor |
| `LookYaw` | `float` | 0.0 | Accumulates from GestureRouter |
| `LookPitch` | `float` | 0.0 | Clamped -45..45 |
| `bTrayDeployed` | `bool` | false | |
| `bStandingUp` | `bool` | false | |
| `StandUpTimeline` | `FTimeline` | — | Drives break-walk camera arc |

### Event Graph

#### Event BeginPlay
```
BeginPlay
  -> GetActorOfClass(ACabinWindowSystem)  -> SET WindowSystem
  -> GetActorOfClass(ACabinSessionManager) -> SET SessionManager
  -> GetMPCInstance(MPC_WindowBlend)      -> (store locally)
  -> EnableInput(PlayerController)
  -> SetActorTickEnabled(true)
```

#### Event Tick
```
Tick (DeltaTime)
  -> GET MPC Scalar "TurbulenceYaw"   -> A
  -> GET MPC Scalar "TurbulencePitch" -> B
  -> GET MPC Scalar "TurbulenceRoll"  -> C
  -> Make Rotator(Pitch=B, Yaw=A, Roll=C)
  -> SET CameraRoot RelativeRotation (interp, speed=12)
```

#### Custom Event: OnGyroInput (Yaw: float, Pitch: float)
*Called from Swift via CabinBridge_SendGyro -> C++ CabinPawn::ReceiveGyro*
```
OnGyroInput(Yaw, Pitch)
  -> LookYaw  += Yaw   * SensitivityScale
  -> LookPitch = Clamp(LookPitch + Pitch * SensitivityScale, -45, 45)
  -> SET FirstPersonCamera RelativeRotation (Pitch=LookPitch, Yaw=LookYaw, Roll=0)
```

#### Custom Event: OnTapHotspot (NormX: float, NormY: float)
*Routes taps to the correct diegetic element.*
```
OnTapHotspot(NormX, NormY)
  -> Branch: NormX 0.35..0.65 AND NormY 0.25..0.75  -> IFE Zone
       -> True:  Call SessionManager->CycleIFEMode()
  -> Branch: NormY > 0.80                             -> Tray Zone
       -> True:  Call ToggleTrayTable()
  -> Branch: NormX < 0.12 OR NormX > 0.88            -> Console Zone
       -> True:  Open SeatConsole Widget
```

#### Custom Event: ToggleTrayTable
```
ToggleTrayTable
  -> FLIP bTrayDeployed
  -> Branch(bTrayDeployed)
       -> True:  Play TrayDeployTimeline -> SET TrayMesh RelativeLocation (lerp down)
                 Play Audio: SFX_TrayClunk (attenuation: none, 2D)
       -> False: Reverse TrayDeployTimeline
```

#### Custom Event: BeginBreakWalk
```
BeginBreakWalk
  -> SET bStandingUp = true
  -> Play StandUpTimeline
     [Timeline keys: 0.0s=(0,0,0), 0.6s=(0,0,60), 1.2s=(0,90,90)]
     -> Each frame: SET CameraRoot RelativeLocation from curve
  -> On Finished: Play WalkAisleSequence (Sequencer track)
  -> After walk duration: Reverse timeline back to seat
  -> SET bStandingUp = false
```

---

## BP_WindowSystem

**Parent class:** `ACabinWindowSystem` (C++)
**Location:** `Content/Blueprints/BP_WindowSystem.uasset`

### Construction Script
```
Construction Script
  -> For each window mesh in CabinStaticMeshes:
       -> Create Dynamic Material Instance from M_Window_Master
       -> SET "VideoTexture" param -> SeatMediaTextures[ActiveSeatIndex]
       -> SET "SkyCapRT" param    -> RT_SkyCap
       -> APPLY material to mesh
```

### Event Graph

#### Event Tick (runs in addition to C++ Tick)
```
Tick
  -> GET MPC Scalar "ActiveSeatIndex"  -> SeatIdx (int)
  -> GET SeatMediaTextures[SeatIdx]    -> ActiveTex
  -> For each window Dynamic Material:
       -> SET "VideoTexture" = ActiveTex
```

#### Custom Event: OnTimeOfDayUpdate (Progress: float)
```
OnTimeOfDayUpdate(Progress)
  -> Call C++ SetSessionProgress(Progress)
  -> Lerp SkyCapture FOV: 70 (boarding) -> 90 (cruise, wide cloud view)
```

---

## BP_MealService

**Parent class:** `AActor`
**Location:** `Content/Blueprints/BP_MealService.uasset`

### Components
```
DefaultSceneRoot
└─ TrayMeshSlot  [UStaticMeshComponent]  — positioned on tray table world location
   └─ SteamNiagara [UNiagaraComponent]    — NS_Steam system, looping
```

### Variables
| Name | Type | Default |
|---|---|---|
| `MealMeshes` | `TArray<UStaticMesh*>` | [SM_Espresso, SM_MixedNuts, SM_GourmetPlate] |
| `MealMaterials` | `TArray<UMaterialInterface*>` | matching MI_ set |
| `AppearTimeline` | `FTimeline` | 0.0..1.0, 0.4s |
| `bVisible` | `bool` | false |

### Event Graph

#### Custom Event: ServeMeal (MealIndex: int)
```
ServeMeal(MealIndex)
  -> SET TrayMeshSlot StaticMesh  = MealMeshes[MealIndex]
  -> SET TrayMeshSlot Material[0] = MealMaterials[MealIndex]
  -> SET TrayMeshSlot Visibility  = Visible
  -> SET SteamNiagara Active = true
  -> Play AppearTimeline
     [0.0: Opacity=0, Scale=0.8]  [0.4: Opacity=1, Scale=1.0]
     -> Each frame: SET MI opacity + scale from curve
  -> Play Audio: SFX_MealClink (2D, volume=0.7)
  -> Call WindowSystem->TriggerMealServiceLighting(4.0)
  -> SET bVisible = true
```

#### Custom Event: ClearMeal
```
ClearMeal
  -> Reverse AppearTimeline
  -> On Finished:
       -> SET TrayMeshSlot Visibility = Hidden
       -> SET SteamNiagara Active = false
       -> SET bVisible = false
```

---

## BP_SeatConsole

**Parent class:** `AActor`
**Location:** `Content/Blueprints/BP_SeatConsole.uasset`

### Components
```
DefaultSceneRoot
└─ ConsoleMesh  [UStaticMeshComponent]   — SM_Console_Master (Nanite)
   └─ ButtonUpright    [UStaticMeshComponent]  SM_Button
   └─ ButtonLounge     [UStaticMeshComponent]  SM_Button
   └─ ButtonBed        [UStaticMeshComponent]  SM_Button
   └─ ButtonLumbar     [UStaticMeshComponent]  SM_Button
   └─ AmenityKitMesh   [UStaticMeshComponent]  SM_AmenityKit
   └─ EvianBottleMesh  [UStaticMeshComponent]  SM_EvianBottle
   └─ HeadphonesMesh   [UStaticMeshComponent]  SM_ANCHeadphones
   └─ CubbyLight       [URectLightComponent]   warm amber, 200 lux, cast shadows off
```

### Variables
| Name | Type | Default |
|---|---|---|
| `CurrentSeatMode` | `ESeatMode` (Upright/Lounge/Bed/Lumbar) | Upright |
| `SessionManager` | `ACabinSessionManager*` | null |
| `ButtonPressMI` | `UMaterialInstanceDynamic*` | null (built at runtime) |

### Event Graph

#### Custom Event: OnButtonPressed (ButtonType: ESeatMode)
```
OnButtonPressed(ButtonType)
  -> SET CurrentSeatMode = ButtonType
  -> Flash pressed button MI: EmissiveIntensity 0->3->0 over 0.15s
  -> Play Audio: SFX_ButtonClick (2D, 0.5 volume)
  -> Call SessionManager->OnSeatModeChanged(ButtonType)
  -> Switch on ButtonType:
       Upright: SET CameraRoot RelativeLocation Z=0,   Pitch=0
       Lounge:  SET CameraRoot RelativeLocation Z=-8,  Pitch=-12
       Bed:     SET CameraRoot RelativeLocation Z=-24, Pitch=-22
       Lumbar:  Play 0.3s rumble camera shake (small amplitude)
```

#### Custom Event: AnimateCubbyOpen
```
AnimateCubbyOpen
  -> Play CubbySlideTimeline (0..1 over 0.5s)
     -> Each frame: SET CubbyDoorMesh RelativeLocation.X from curve
  -> SET CubbyLight Intensity: 0 -> 200 (lerp over 0.3s)
```

---

## MPC_WindowBlend — Parameter Collection

**Location:** `Content/Materials/MPC_WindowBlend.uasset`

Create this asset in the editor: **right-click Content Browser → Materials → Material Parameter Collection**.

| Parameter | Type | Default | Written by |
|---|---|---|---|
| `VideoWeight` | Scalar | 0.85 | CabinWindowSystem::Tick |
| `SkyWeight` | Scalar | 0.15 | CabinWindowSystem::Tick |
| `CloudDensity` | Scalar | 0.9 | CabinWindowSystem::SetFlightPhase |
| `TurbulenceYaw` | Scalar | 0.0 | CabinWindowSystem::TickTurbulence |
| `TurbulencePitch` | Scalar | 0.0 | CabinWindowSystem::TickTurbulence |
| `TurbulenceRoll` | Scalar | 0.0 | CabinWindowSystem::TickTurbulence |
| `ActiveSeatIndex` | Scalar | 7.0 | CabinWindowSystem::SwapVideoPlate |

---

## M_Window_Master — Material

**Location:** `Content/Materials/M_Window_Master.uasset`

Node graph (text description for manual recreation):

```
TextureObject param "VideoTexture"  (Texture2D)
  -> TexSample -> Lerp A

TextureObject param "SkyCapRT"      (Texture2D)
  -> TexSample -> Lerp B

MPC Scalar "VideoWeight" -> Lerp Alpha

Lerp -> EmissiveColor [output]

Constant 0 -> Opacity
Constant 1 -> Roughness
Constant 0 -> Metallic

[Material Domain: Surface]
[Shading Model: Unlit]   <- window plane is self-lit by the plate
[Blend Mode: Opaque]
[Two Sided: false]
```

The window plane material is **Unlit** intentionally: the video plate and sky
capture are pre-lit images. Lumen lighting acts on the cabin geometry around
the window, not through it.

---

## Sequencer Tracks to create manually

| Track name | Location | Purpose |
|---|---|---|
| `SEQ_Boarding` | `Content/Sequences/` | Jet bridge visible, bright lights, ground crew |
| `SEQ_Takeoff` | `Content/Sequences/` | Camera tilt 0°→12°, shake spline, seatbelt sign on |
| `SEQ_Descent` | `Content/Sequences/` | Camera tilt back to 0°, lights brighten |
| `SEQ_BreakWalk` | `Content/Sequences/` | Stand-up arc, walk to galley, return |

Each Sequencer track should use **Level Sequence** and be triggered by
`ULevelSequencePlayer::CreateLevelSequencePlayer` from `CabinSessionManager`.
