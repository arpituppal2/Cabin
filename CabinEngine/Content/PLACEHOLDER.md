# CabinEngine/Content

This directory is the Unreal Engine content folder. Binary `.uasset` and `.umap` files live here after cooking.

## Expected structure after initial content build

```
Content/
├── Maps/
│   └── CabinMap.umap              Main persistent level
├── Meshes/
│   ├── Suite/
│   │   ├── SM_Seat.uasset
│   │   ├── SM_Console.uasset
│   │   ├── SM_TrayTable.uasset
│   │   ├── SM_StorageCubby.uasset
│   │   ├── SM_Overhead.uasset
│   │   └── SM_CabinShell.uasset
│   └── Props/
│       ├── SM_Duvet.uasset
│       ├── SM_AmenityKit.uasset
│       ├── SM_EvianBottle.uasset
│       └── SM_Headphones.uasset
├── Materials/
│   ├── M_SeatFabric.uasset
│   ├── M_WalnutTray.uasset
│   ├── M_SlateConsole.uasset
│   ├── M_OLEDBezel.uasset
│   ├── M_IFEScreen.uasset         (receives Metal bridge texture)
│   ├── M_WindowGlass.uasset
│   ├── M_CabinPlastic.uasset
│   └── M_SkyAtmosphere.uasset
├── Blueprints/
│   ├── BP_CabinGameMode.uasset
│   ├── BP_CabinPawn.uasset
│   ├── BP_CabinPlayerController.uasset
│   ├── BP_TrayTable.uasset
│   ├── BP_SeatControls.uasset
│   ├── BP_StorageCubby.uasset
│   ├── BP_IFE.uasset
│   ├── BP_MealService.uasset
│   └── BP_BreakWalk.uasset
├── Audio/
│   ├── SoundClasses/
│   ├── Reverb/
│   ├── Mixes/
│   └── Sounds/
│       ├── SW_EngineHum.uasset
│       ├── SW_TakeoffRoll.uasset
│       ├── SW_LandingGear.uasset
│       ├── SW_TrayDeploy.uasset
│       ├── SW_MealClink.uasset
│       ├── SW_SeatbeltChime.uasset
│       ├── SW_AirVent.uasset
│       ├── SW_GalleyChatter.uasset
│       └── SW_CabinFootstep.uasset
├── Niagara/
│   ├── NS_AirVentParticles.uasset
│   ├── NS_CabinDustMotes.uasset
│   └── NS_EngineHaze.uasset
└── Sequences/
    ├── SEQ_Takeoff.uasset
    ├── SEQ_Descent.uasset
    ├── SEQ_BreakWalk.uasset
    └── SEQ_Landing.uasset
```

Binary assets are not committed to git. This placeholder documents the expected content layout.
See `docs/ARCHITECTURE.md` for the full project structure.
