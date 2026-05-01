# Cabin — Asset Manifest

All assets below are **required** before the project can be packaged for iOS.
Assets marked `[STUB]` have placeholder references in the Blueprints and must be created or sourced.
Assets marked `[GENERATED]` are procedural and need no external file.

---

## 3D Meshes (Nanite-ready, `.uasset`)

| Asset Name | Poly Budget (pre-Nanite) | Notes |
|---|---|---|
| `SM_CabinSeat` | 120,000 | Business-class throne. Leather PBR, stitching details. |
| `SM_CabinSeat_Ottoman` | 18,000 | Separate piece for bed-mode extension. |
| `SM_IFEScreen` | 800 | Flat quad with chamfered bezel. Accepts M_IFEDynamic. |
| `SM_TrayTable` | 12,000 | Faux-walnut woodgrain surface. Hinged deploy anim-ready. |
| `SM_Console` | 35,000 | Faux-marble side console. 4 button cutouts. |
| `SM_ConsoleButton` | 600 | Single capacitive button. 4 instances. |
| `SM_StorageCubby` | 8,000 | Backlit cabinet. Sliding door separate mesh. |
| `SM_CubbyDoor` | 2,000 | Sliding door. |
| `SM_OverheadBin` | 22,000 | Curved plastic overhead. |
| `SM_CabinWall` | 5,000 | Sidewall panel section. Tiled. |
| `SM_CabinCeiling` | 4,000 | Curved ceiling section. Gasper vent cutout. |
| `SM_Gasper` | 1,200 | Air vent nozzle. |
| `SM_SeatbeltSign` | 800 | LED sign housing. Emissive material. |
| `SM_WindowFrame` | 3,000 | Oval window frame with thick rim. 2 variants (L/R). |
| `SM_EvianBottle` | 8,000 | 500ml Evian. Label texture. |
| `SM_NoiseCancelHeadphones` | 24,000 | Over-ear ANC headphones. |
| `SM_AmenityKit` | 6,000 | Soft pouch. Branded logo decal slot. |
| `SM_Duvet` | 18,000 | Quilted charcoal-grey duvet. Cloth sim baked. |
| `SM_MealPlate` | 4,000 | Porcelain plate + cutlery. Used for meal-service fade-in. |
| `SM_EspressoCup` | 2,000 | Porcelain espresso cup + saucer. |
| `SM_CabinFloor` | 1,000 | Flat floor section. Thick carpet material. |
| `SM_AisleRunner` | 600 | Centre aisle carpet strip. |

---

## Materials & Material Instances

| Asset | Base Material | Key Parameters |
|---|---|---|
| `M_IFEDynamic` | Unlit | `DynamicTexture` (updated by CabinBridge each frame) |
| `MI_FauxMarble` | M_PBR_Base | Albedo, Normal, Roughness=0.15, veining mask |
| `MI_WalnutGrain` | M_PBR_Base | Albedo, Normal, AO; Roughness=0.45 |
| `MI_LeatherSeat` | M_PBR_Base | Albedo, Normal, Specular, stitching mask |
| `MI_ButtonIdle` | M_Emissive | EmissiveColor=off-white, Intensity=0.2 |
| `MI_ButtonPressed` | M_Emissive | EmissiveColor=warm-white, Intensity=2.8 |
| `MI_WindowLeft` | M_WindowBlend | `VideoTexture`, `ProceduralSkyTexture`, `BlendAlpha` |
| `MI_WindowRight` | M_WindowBlend | Same parameters, mirrored UV |
| `MI_CabinCarpet` | M_PBR_Base | Albedo (dark charcoal loop), Normal, Roughness=0.9 |
| `MI_CabinPlastic` | M_PBR_Base | Off-white satin plastic, Roughness=0.35 |
| `MI_OLEDBezel` | M_PBR_Base | Matte black, Roughness=0.05, metallic=0 |
| `MI_SeatbeltSignOn` | M_Emissive | Orange emissive, Intensity=4.0 |
| `MI_SeatbeltSignOff` | M_Emissive | Dim amber, Intensity=0.1 |

---

## Textures

All textures must be 4K (4096×4096) for Nanite meshes, 2K for secondary props.

| Texture | Resolution | Format |
|---|---|---|
| `T_Marble_Albedo` | 4096 | BC1 |
| `T_Marble_Normal` | 4096 | BC5 |
| `T_Walnut_Albedo` | 4096 | BC1 |
| `T_Walnut_Normal` | 4096 | BC5 |
| `T_Leather_Albedo` | 4096 | BC1 |
| `T_Leather_Normal` | 4096 | BC5 |
| `T_Leather_Roughness` | 2048 | BC4 |
| `T_Carpet_Albedo` | 2048 | BC1 |
| `T_Carpet_Normal` | 2048 | BC5 |
| `T_OLED_Bezel_Normal` | 2048 | BC5 |

---

## Video Plates (`Content/Video/Window/`)

All plates must be **4K, H.265, 30fps, looping-safe** (first and last frame identical).
Minimum duration: **4 minutes** to avoid visible loops.

| File | Scene | Side |
|---|---|---|
| `cruise_day_left.mp4` | 36,000ft overcast / clear day | Left window |
| `cruise_day_right.mp4` | 36,000ft clear day | Right window |
| `cruise_sunset_left.mp4` | Golden hour, orange horizon | Left |
| `cruise_sunset_right.mp4` | Golden hour | Right |
| `cruise_night_left.mp4` | Starfield, faint moonlit cloud | Left |
| `cruise_night_right.mp4` | Starfield | Right |
| `cruise_dawn_left.mp4` | Deep blue pre-dawn, pink horizon | Left |
| `cruise_dawn_right.mp4` | Pre-dawn | Right |
| `taxi_day.mp4` | Ground-level tarmac, gate area | Both |
| `takeoff_day.mp4` | Runway roll → liftoff → climb | Both |
| `landing_day.mp4` | Descent through cloud → runway | Both |

---

## Audio (`Content/Audio/`)

All SFX must be **48kHz / 24-bit WAV or AIFF**. Loops must be seamlessly loopable.

| File | Type | Duration | Notes |
|---|---|---|---|
| `cabin_hum.wav` | Loop | 60s | 180Hz fundamental, pink noise blend |
| `engine_spool.wav` | Loop | 30s | Rising from 60Hz to 180Hz |
| `engine_cruise.wav` | Loop | 120s | Steady 200Hz + harmonics, subtle variation |
| `vent_hiss.wav` | Loop | 45s | White-noise air hiss |
| `boarding_ambience.wav` | Loop | 90s | Muffled voices, distant cart, PA crackle |
| `galley_ambience.wav` | Loop | 60s | Clinking, muffled talk, cart wheels |
| `seatbelt_ding.wav` | One-shot | 1.2s | Dual-tone chime, B♭/E♭ |
| `tray_clunk.wav` | One-shot | 0.6s | Mechanical latch + table settle |
| `meal_clink.wav` | One-shot | 0.8s | Porcelain on tray |
| `button_click.wav` | One-shot | 0.15s | Soft capacitive click |
| `ife_tap.wav` | One-shot | 0.12s | Glass tap, slightly damped |
| `footsteps_carpet.wav` | One-shot ×8 | 0.3s | Muffled carpet footsteps, varied |
| `gear_thud.wav` | One-shot | 1.8s | Heavy mechanical gear extension |
| `pa_prepare_arrival.wav` | One-shot | 6s | "Flight attendants, prepare for arrival." |
| `pa_doors_automatic.wav` | One-shot | 7s | "Flight attendants, doors to automatic and crosscheck." |
| `sprint_complete_chime.wav` | One-shot | 2s | Soft 3-tone ascending chime |
| `session_complete.wav` | One-shot | 4s | Full resolution chime cluster |

---

## Niagara Particle Systems (`Content/FX/`)

| System | Description |
|---|---|
| `NS_EngineHaze` | Window haze shimmer — subtle heat distortion near window edges |
| `NS_VentParticles` | Fine air particles falling from the gasper vent |
| `NS_CabinDust` | Lazy floating dust motes in shaft of window light |
| `NS_MealSteam` | Gentle steam rising from meal service items |

---

## Sequencer Assets (`Content/Sequences/`)

| Asset | Duration | Description |
|---|---|---|
| `SEQ_JetBridgeVisible` | 4s | Jet bridge is visible; lights bright |
| `SEQ_TaxiRoll` | 5min (loop) | Slow tarmac motion outside window |
| `SEQ_TakeoffRoll` | 45s | Runway acceleration → liftoff → climb |
| `SEQ_BreakWalk` | 30s | First-person walk down aisle to galley |
| `SEQ_TouchdownRoll` | 60s | Touchdown → deceleration → taxi to gate |

---

## Animation Assets (`Content/Animations/`)

| Asset | Mesh | Description |
|---|---|---|
| `AM_TrayDeploy` | SM_TrayTable | Tray slides out from under monitor |
| `AM_TrayStow` | SM_TrayTable | Reverse |
| `AM_CubbyOpen` | SM_CubbyDoor | Door slides open |
| `AM_CubbyClose` | SM_CubbyDoor | Door slides closed |
| `AM_SeatUpright` | SM_CabinSeat | Recline to upright position |
| `AM_SeatLounge` | SM_CabinSeat | Mid recline |
| `AM_SeatBed` | SM_CabinSeat | Full flat-bed |

---

## Camera Shake Assets (`Content/CameraShakes/`)

| Asset | Magnitude | Frequency | Phase |
|---|---|---|---|
| `CS_TurbulenceLightShake` | Yaw 0.38°, Pitch 0.22° | 0.18Hz | Cruise |
| `CS_TakeoffShake` | All axes 1.2° | 8Hz decaying | Takeoff roll |
| `CS_LandingShake` | All axes 2.0° | 12Hz decaying | Touchdown |
