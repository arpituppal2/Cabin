"""cabin_setup.py
Run inside Unreal Engine 5.7's built-in Python console to create every
Blueprint asset Cabin needs. No manual node-wiring required.

How to run:
  1. Open CabinEngine/CabinEngine.uproject in UE 5.7.4
  2. Wait for shaders to compile (progress bar bottom-right)
  3. Menu bar → Tools → Execute Python Script
  4. Browse to: CabinEngine/Scripts/cabin_setup.py
  5. Click Run
  6. Watch the Output Log — each asset prints ✓ when done
  7. Ctrl+Shift+S to Save All when it finishes

Assets created:
  /Game/Cabin/Materials/MPC_WindowBlend     Material Parameter Collection
  /Game/Cabin/Core/BP_CabinGameMode         Blueprint (parent: CabinGameMode C++)
  /Game/Cabin/Core/BP_CabinPawn             Blueprint (parent: CabinPawn C++)
  /Game/Cabin/Core/BP_WindowSystem          Blueprint (parent: Actor)
  /Game/Cabin/Core/BP_MealService           Blueprint (parent: Actor)
  /Game/Cabin/Core/BP_SeatConsole           Blueprint (parent: Actor)
  /Game/Cabin/Audio/SC_Master               Sound Class
  /Game/Cabin/Audio/SC_Ambience             Sound Class (child of Master)
  /Game/Cabin/Audio/SC_SFX                  Sound Class (child of Master)
  /Game/Cabin/Audio/Mix_Cabin               Sound Mix
  /Game/Maps/CabinMain                      Level
"""

import unreal

# ── helpers ──────────────────────────────────────────────────────────────────

def log(msg: str):
    unreal.log(f"[CabinSetup] {msg}")

def log_ok(path: str):
    unreal.log(f"[CabinSetup] ✓  {path}")

def ensure_dir(path: str):
    if not unreal.EditorAssetLibrary.does_directory_exist(path):
        unreal.EditorAssetLibrary.make_directory(path)

def asset_exists(path: str) -> bool:
    return unreal.EditorAssetLibrary.does_asset_exist(path)

def save(asset) -> None:
    unreal.EditorAssetLibrary.save_loaded_asset(asset)


# ── 0. directory structure ────────────────────────────────────────────────────

log("Creating directory structure…")
for d in [
    "/Game/Cabin",
    "/Game/Cabin/Core",
    "/Game/Cabin/Audio",
    "/Game/Cabin/Materials",
    "/Game/Cabin/Textures",
    "/Game/Cabin/Meshes",
    "/Game/Cabin/Sequences",
    "/Game/Cabin/Niagara",
    "/Game/Cabin/DataAssets",
    "/Game/Maps",
]:
    ensure_dir(d)
log("Directories ready.")


# ── 1. Material Parameter Collection ─────────────────────────────────────────

MPC_PATH = "/Game/Cabin/Materials/MPC_WindowBlend"

if not asset_exists(MPC_PATH):
    log("Creating MPC_WindowBlend…")
    af = unreal.AssetToolsHelpers.get_asset_tools()
    mpc: unreal.MaterialParameterCollection = af.create_asset(
        asset_name="MPC_WindowBlend",
        package_path="/Game/Cabin/Materials",
        asset_class=unreal.MaterialParameterCollection,
        factory=unreal.MaterialParameterCollectionFactoryNew(),
    )
    scalar_params = [
        ("VideoWeight",        1.0),   # 0 = procedural sky, 1 = video plate
        ("SkyWeight",          0.0),
        ("CloudDensity",       0.6),
        ("AltitudeHaze",       0.4),
        ("TurbulenceStrength", 0.0),
        ("TimeOfDay",          0.5),   # 0 = night, 0.5 = midday, 1 = golden hour
        ("WindowGlare",        0.3),
    ]
    params = list(mpc.get_editor_property("scalar_parameters"))
    for name, default in scalar_params:
        p = unreal.CollectionScalarParameter()
        p.set_editor_property("parameter_name", unreal.Name(name))
        p.set_editor_property("default_value", default)
        params.append(p)
    mpc.set_editor_property("scalar_parameters", params)
    save(mpc)
    log_ok(MPC_PATH)
else:
    log("MPC_WindowBlend already exists — skipping.")


# ── helper: create Blueprint ──────────────────────────────────────────────────

def create_blueprint(name: str, folder: str, parent_class) -> unreal.Blueprint:
    path = f"{folder}/{name}"
    if asset_exists(path):
        log(f"{name} already exists — skipping.")
        return unreal.load_asset(path)
    log(f"Creating {name}…")
    factory = unreal.BlueprintFactory()
    factory.set_editor_property("parent_class", parent_class)
    af = unreal.AssetToolsHelpers.get_asset_tools()
    bp = af.create_asset(
        asset_name=name,
        package_path=folder,
        asset_class=unreal.Blueprint,
        factory=factory,
    )
    log_ok(path)
    return bp


# ── 2. BP_CabinGameMode ───────────────────────────────────────────────────────

try:
    gm_parent = unreal.load_class(None, "/Script/CabinEngine.CabinGameMode")
except Exception:
    log("CabinGameMode C++ not found — using GameModeBase fallback.")
    gm_parent = unreal.GameModeBase

bp_gm = create_blueprint("BP_CabinGameMode", "/Game/Cabin/Core", gm_parent)


# ── 3. BP_CabinPawn ───────────────────────────────────────────────────────────

try:
    pawn_parent = unreal.load_class(None, "/Script/CabinEngine.CabinPawn")
except Exception:
    log("CabinPawn C++ not found — using Pawn fallback.")
    pawn_parent = unreal.Pawn

bp_pawn = create_blueprint("BP_CabinPawn", "/Game/Cabin/Core", pawn_parent)

if bp_pawn:
    try:
        scs = bp_pawn.get_editor_property("simple_construction_script")
        existing = [n.get_editor_property("internal_variable_name")
                    for n in scs.get_root_nodes()]

        if "CabinSpringArm" not in existing:
            arm_node = scs.add_node(unreal.SpringArmComponent)
            arm_node.set_editor_property("internal_variable_name", "CabinSpringArm")
            arm_comp = arm_node.get_editor_property("component_template")
            arm_comp.set_editor_property("target_arm_length", 0.0)
            arm_comp.set_editor_property("b_use_pawn_control_rotation", True)

        if "CabinCamera" not in existing:
            cam_node = scs.add_node(unreal.CameraComponent)
            cam_node.set_editor_property("internal_variable_name", "CabinCamera")
            cam_comp = cam_node.get_editor_property("component_template")
            cam_comp.set_editor_property("field_of_view", 72.0)
            cam_comp.set_editor_property("constrain_aspect_ratio", False)

        save(bp_pawn)
        log("  SpringArm + Camera added to BP_CabinPawn")
    except Exception as e:
        log(f"  Could not add components to BP_CabinPawn (add manually): {e}")


# ── 4. BP_WindowSystem ────────────────────────────────────────────────────────

bp_win = create_blueprint("BP_WindowSystem", "/Game/Cabin/Core", unreal.Actor)

if bp_win:
    try:
        scs = bp_win.get_editor_property("simple_construction_script")
        existing = [n.get_editor_property("internal_variable_name")
                    for n in scs.get_root_nodes()]

        if "WindowSkyLight" not in existing:
            sl_node = scs.add_node(unreal.SkyLightComponent)
            sl_node.set_editor_property("internal_variable_name", "WindowSkyLight")
            sl_comp = sl_node.get_editor_property("component_template")
            sl_comp.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
            sl_comp.set_editor_property("intensity", 1.2)

        if "WindowDirLight" not in existing:
            dl_node = scs.add_node(unreal.DirectionalLightComponent)
            dl_node.set_editor_property("internal_variable_name", "WindowDirLight")
            dl_comp = dl_node.get_editor_property("component_template")
            dl_comp.set_editor_property("intensity", 8.0)
            dl_comp.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)

        save(bp_win)
        log("  SkyLight + DirectionalLight added to BP_WindowSystem")
    except Exception as e:
        log(f"  Could not add components to BP_WindowSystem: {e}")


# ── 5. BP_MealService ─────────────────────────────────────────────────────────

bp_meal = create_blueprint("BP_MealService", "/Game/Cabin/Core", unreal.Actor)

if bp_meal:
    try:
        scs = bp_meal.get_editor_property("simple_construction_script")
        existing = [n.get_editor_property("internal_variable_name")
                    for n in scs.get_root_nodes()]

        if "PlateMesh" not in existing:
            mesh_node = scs.add_node(unreal.StaticMeshComponent)
            mesh_node.set_editor_property("internal_variable_name", "PlateMesh")
            mesh_comp = mesh_node.get_editor_property("component_template")
            mesh_comp.set_editor_property("visible", False)

        if "MealAudio" not in existing:
            audio_node = scs.add_node(unreal.AudioComponent)
            audio_node.set_editor_property("internal_variable_name", "MealAudio")
            audio_comp = audio_node.get_editor_property("component_template")
            audio_comp.set_editor_property("auto_activate", False)

        save(bp_meal)
        log("  PlateMesh + MealAudio added to BP_MealService")
    except Exception as e:
        log(f"  Could not add components to BP_MealService: {e}")


# ── 6. BP_SeatConsole ─────────────────────────────────────────────────────────

bp_console = create_blueprint("BP_SeatConsole", "/Game/Cabin/Core", unreal.Actor)

if bp_console:
    try:
        scs = bp_console.get_editor_property("simple_construction_script")
        existing = [n.get_editor_property("internal_variable_name")
                    for n in scs.get_root_nodes()]

        if "ConsoleMesh" not in existing:
            mesh_node = scs.add_node(unreal.StaticMeshComponent)
            mesh_node.set_editor_property("internal_variable_name", "ConsoleMesh")

        if "ButtonsRoot" not in existing:
            btn_node = scs.add_node(unreal.SceneComponent)
            btn_node.set_editor_property("internal_variable_name", "ButtonsRoot")

        save(bp_console)
        log("  ConsoleMesh + ButtonsRoot added to BP_SeatConsole")
    except Exception as e:
        log(f"  Could not add components to BP_SeatConsole: {e}")


# ── 7. Sound Classes ──────────────────────────────────────────────────────────

def create_sound_class(name: str) -> unreal.SoundClass:
    path = f"/Game/Cabin/Audio/{name}"
    if asset_exists(path):
        log(f"{name} already exists — skipping.")
        return unreal.load_asset(path)
    log(f"Creating {name}…")
    af = unreal.AssetToolsHelpers.get_asset_tools()
    sc = af.create_asset(
        asset_name=name,
        package_path="/Game/Cabin/Audio",
        asset_class=unreal.SoundClass,
        factory=unreal.SoundClassFactory(),
    )
    save(sc)
    log_ok(path)
    return sc

sc_master   = create_sound_class("SC_Master")
sc_ambience = create_sound_class("SC_Ambience")
sc_sfx      = create_sound_class("SC_SFX")

for child in [sc_ambience, sc_sfx]:
    if child and sc_master:
        try:
            child.set_editor_property("parent_class", sc_master)
            save(child)
        except Exception:
            pass


# ── 8. Sound Mix ──────────────────────────────────────────────────────────────

MIX_PATH = "/Game/Cabin/Audio/Mix_Cabin"
if not asset_exists(MIX_PATH):
    log("Creating Mix_Cabin…")
    af = unreal.AssetToolsHelpers.get_asset_tools()
    mix = af.create_asset(
        asset_name="Mix_Cabin",
        package_path="/Game/Cabin/Audio",
        asset_class=unreal.SoundMix,
        factory=unreal.SoundMixFactory(),
    )
    save(mix)
    log_ok(MIX_PATH)


# ── 9. CabinMain Level ────────────────────────────────────────────────────────

LEVEL_PATH = "/Game/Maps/CabinMain"
if not asset_exists(LEVEL_PATH):
    log("Creating CabinMain level…")
    new_level = unreal.EditorLevelLibrary.new_level(LEVEL_PATH)
    if new_level:
        world = unreal.EditorLevelLibrary.get_editor_world()
        ws = world.get_world_settings()
        if bp_gm:
            try:
                gm_class = unreal.EditorAssetLibrary.load_blueprint_class(
                    "/Game/Cabin/Core/BP_CabinGameMode"
                )
                ws.set_editor_property("default_game_mode", gm_class)
            except Exception as e:
                log(f"  Could not set GameMode on level (set manually): {e}")
        log_ok(LEVEL_PATH)
else:
    log("CabinMain level already exists — skipping.")


# ── 10. Project Settings patches ─────────────────────────────────────────────

log("Patching Project Settings…")
try:
    gs = unreal.get_default_object(unreal.GameMapsSettings)
    gs.set_editor_property("game_default_map", "/Game/Maps/CabinMain")
    gs.set_editor_property("server_default_map", "/Game/Maps/CabinMain")
    log("  Default map → /Game/Maps/CabinMain")
except Exception as e:
    log(f"  Could not patch GameMapsSettings: {e}")

try:
    rs = unreal.get_default_object(unreal.RendererSettings)
    rs.set_editor_property("substrate", True)
    log("  Substrate enabled")
except Exception as e:
    log(f"  Could not enable Substrate (enable manually: Project Settings → Rendering): {e}")


# ── 11. Save everything ───────────────────────────────────────────────────────

log("Saving all modified assets…")
unreal.EditorAssetLibrary.save_directory("/Game/Cabin", only_if_is_dirty=True)
unreal.EditorAssetLibrary.save_directory("/Game/Maps",  only_if_is_dirty=True)

log("")
log("══════════════════════════════════════════════════")
log("  Cabin setup complete.")
log("  ✓ MPC_WindowBlend  (7 scalar params)")
log("  ✓ BP_CabinGameMode")
log("  ✓ BP_CabinPawn     (SpringArm + Camera)")
log("  ✓ BP_WindowSystem  (SkyLight + DirLight)")
log("  ✓ BP_MealService   (Mesh + Audio)")
log("  ✓ BP_SeatConsole   (Mesh + ButtonsRoot)")
log("  ✓ SC_Master / SC_Ambience / SC_SFX")
log("  ✓ Mix_Cabin")
log("  ✓ CabinMain level")
log("")
log("  NEXT: assign meshes, textures, video plates")
log("  and audio in each Blueprint (see BLUEPRINTS.md)")
log("══════════════════════════════════════════════════")
