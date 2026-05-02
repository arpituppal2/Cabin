"""cabin_setup_no_cpp.py
Runs on a completely blank UE 5.7 project with NO C++ compilation required.
All Blueprints use built-in UE base classes only.

How to run:
  Tools → Execute Python Script → cabin_setup_no_cpp.py → Open
  Then: Window → Output Log to watch progress.
"""

import unreal

def log(msg): unreal.log(f"[Cabin] {msg}")
def ok(path): unreal.log(f"[Cabin] ✓ {path}")
def exists(p): return unreal.EditorAssetLibrary.does_asset_exist(p)
def save(a): unreal.EditorAssetLibrary.save_loaded_asset(a)

def mkdir(p):
    if not unreal.EditorAssetLibrary.does_directory_exist(p):
        unreal.EditorAssetLibrary.make_directory(p)

def make_bp(name, folder, parent):
    path = f"{folder}/{name}"
    if exists(path):
        log(f"{name} already exists — skipping.")
        return unreal.load_asset(path)
    f = unreal.BlueprintFactory()
    f.set_editor_property("parent_class", parent)
    bp = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name=name, package_path=folder,
        asset_class=unreal.Blueprint, factory=f)
    ok(path)
    return bp

# ── directories ──────────────────────────────────────────────────────────────
log("Creating folders…")
for d in ["/Game/Cabin", "/Game/Cabin/Core", "/Game/Cabin/Audio",
          "/Game/Cabin/Materials", "/Game/Cabin/Textures",
          "/Game/Cabin/Meshes", "/Game/Cabin/Sequences",
          "/Game/Cabin/Niagara", "/Game/Maps"]:
    mkdir(d)
log("Folders done.")

# ── Material Parameter Collection ────────────────────────────────────────────
MPC = "/Game/Cabin/Materials/MPC_WindowBlend"
if not exists(MPC):
    log("Creating MPC_WindowBlend…")
    mpc = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name="MPC_WindowBlend",
        package_path="/Game/Cabin/Materials",
        asset_class=unreal.MaterialParameterCollection,
        factory=unreal.MaterialParameterCollectionFactoryNew())
    params = []
    for name, val in [("VideoWeight",1.0),("SkyWeight",0.0),("CloudDensity",0.6),
                      ("AltitudeHaze",0.4),("TurbulenceStrength",0.0),
                      ("TimeOfDay",0.5),("WindowGlare",0.3)]:
        p = unreal.CollectionScalarParameter()
        p.set_editor_property("parameter_name", unreal.Name(name))
        p.set_editor_property("default_value", val)
        params.append(p)
    mpc.set_editor_property("scalar_parameters", params)
    save(mpc)
    ok(MPC)

# ── Blueprints (all using built-in base classes) ──────────────────────────────
bp_gm      = make_bp("BP_CabinGameMode", "/Game/Cabin/Core", unreal.GameModeBase)
bp_pawn    = make_bp("BP_CabinPawn",     "/Game/Cabin/Core", unreal.Pawn)
bp_win     = make_bp("BP_WindowSystem",  "/Game/Cabin/Core", unreal.Actor)
bp_meal    = make_bp("BP_MealService",   "/Game/Cabin/Core", unreal.Actor)
bp_console = make_bp("BP_SeatConsole",   "/Game/Cabin/Core", unreal.Actor)
bp_tray    = make_bp("BP_TrayTable",     "/Game/Cabin/Core", unreal.Actor)
bp_ife     = make_bp("BP_IFEScreen",     "/Game/Cabin/Core", unreal.Actor)

# ── Add components to BP_CabinPawn ───────────────────────────────────────────
if bp_pawn:
    try:
        scs = bp_pawn.get_editor_property("simple_construction_script")
        existing = [n.get_editor_property("internal_variable_name")
                    for n in scs.get_root_nodes()]
        if "CabinSpringArm" not in existing:
            arm = scs.add_node(unreal.SpringArmComponent)
            arm.set_editor_property("internal_variable_name", "CabinSpringArm")
            c = arm.get_editor_property("component_template")
            c.set_editor_property("target_arm_length", 0.0)
            c.set_editor_property("b_use_pawn_control_rotation", True)
        if "CabinCamera" not in existing:
            cam = scs.add_node(unreal.CameraComponent)
            cam.set_editor_property("internal_variable_name", "CabinCamera")
            c = cam.get_editor_property("component_template")
            c.set_editor_property("field_of_view", 72.0)
        save(bp_pawn)
        log("  SpringArm + Camera → BP_CabinPawn")
    except Exception as e:
        log(f"  BP_CabinPawn components (add manually): {e}")

# ── Add components to BP_WindowSystem ────────────────────────────────────────
if bp_win:
    try:
        scs = bp_win.get_editor_property("simple_construction_script")
        existing = [n.get_editor_property("internal_variable_name")
                    for n in scs.get_root_nodes()]
        if "WindowSkyLight" not in existing:
            sl = scs.add_node(unreal.SkyLightComponent)
            sl.set_editor_property("internal_variable_name", "WindowSkyLight")
            c = sl.get_editor_property("component_template")
            c.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
            c.set_editor_property("intensity", 1.2)
        if "WindowDirLight" not in existing:
            dl = scs.add_node(unreal.DirectionalLightComponent)
            dl.set_editor_property("internal_variable_name", "WindowDirLight")
            c = dl.get_editor_property("component_template")
            c.set_editor_property("intensity", 8.0)
            c.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
        save(bp_win)
        log("  SkyLight + DirLight → BP_WindowSystem")
    except Exception as e:
        log(f"  BP_WindowSystem components: {e}")

# ── Add components to BP_MealService ─────────────────────────────────────────
if bp_meal:
    try:
        scs = bp_meal.get_editor_property("simple_construction_script")
        existing = [n.get_editor_property("internal_variable_name")
                    for n in scs.get_root_nodes()]
        if "PlateMesh" not in existing:
            m = scs.add_node(unreal.StaticMeshComponent)
            m.set_editor_property("internal_variable_name", "PlateMesh")
            m.get_editor_property("component_template").set_editor_property("visible", False)
        if "MealAudio" not in existing:
            a = scs.add_node(unreal.AudioComponent)
            a.set_editor_property("internal_variable_name", "MealAudio")
            a.get_editor_property("component_template").set_editor_property("auto_activate", False)
        save(bp_meal)
        log("  PlateMesh + MealAudio → BP_MealService")
    except Exception as e:
        log(f"  BP_MealService components: {e}")

# ── Add components to BP_TrayTable ───────────────────────────────────────────
if bp_tray:
    try:
        scs = bp_tray.get_editor_property("simple_construction_script")
        existing = [n.get_editor_property("internal_variable_name")
                    for n in scs.get_root_nodes()]
        if "TrayMesh" not in existing:
            m = scs.add_node(unreal.StaticMeshComponent)
            m.set_editor_property("internal_variable_name", "TrayMesh")
        if "TrayAudio" not in existing:
            a = scs.add_node(unreal.AudioComponent)
            a.set_editor_property("internal_variable_name", "TrayAudio")
            a.get_editor_property("component_template").set_editor_property("auto_activate", False)
        save(bp_tray)
        log("  TrayMesh + TrayAudio → BP_TrayTable")
    except Exception as e:
        log(f"  BP_TrayTable components: {e}")

# ── Add components to BP_IFEScreen ───────────────────────────────────────────
if bp_ife:
    try:
        scs = bp_ife.get_editor_property("simple_construction_script")
        existing = [n.get_editor_property("internal_variable_name")
                    for n in scs.get_root_nodes()]
        if "IFEMesh" not in existing:
            m = scs.add_node(unreal.StaticMeshComponent)
            m.set_editor_property("internal_variable_name", "IFEMesh")
        if "IFEWidget" not in existing:
            w = scs.add_node(unreal.WidgetComponent)
            w.set_editor_property("internal_variable_name", "IFEWidget")
            c = w.get_editor_property("component_template")
            c.set_editor_property("draw_size", unreal.Vector2D(1920, 1080))
        save(bp_ife)
        log("  IFEMesh + IFEWidget → BP_IFEScreen")
    except Exception as e:
        log(f"  BP_IFEScreen components: {e}")

# ── Sound Classes ─────────────────────────────────────────────────────────────
def make_sc(name):
    path = f"/Game/Cabin/Audio/{name}"
    if exists(path):
        log(f"{name} exists — skipping.")
        return unreal.load_asset(path)
    sc = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name=name, package_path="/Game/Cabin/Audio",
        asset_class=unreal.SoundClass, factory=unreal.SoundClassFactory())
    save(sc); ok(path); return sc

sc_master   = make_sc("SC_Master")
sc_ambience = make_sc("SC_Ambience")
sc_sfx      = make_sc("SC_SFX")
for child in [sc_ambience, sc_sfx]:
    if child and sc_master:
        try:
            child.set_editor_property("parent_class", sc_master)
            save(child)
        except: pass

# ── Sound Mix ─────────────────────────────────────────────────────────────────
if not exists("/Game/Cabin/Audio/Mix_Cabin"):
    mix = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name="Mix_Cabin", package_path="/Game/Cabin/Audio",
        asset_class=unreal.SoundMix, factory=unreal.SoundMixFactory())
    save(mix); ok("/Game/Cabin/Audio/Mix_Cabin")

# ── Save all ──────────────────────────────────────────────────────────────────
log("Saving…")
unreal.EditorAssetLibrary.save_directory("/Game/Cabin", only_if_is_dirty=True)

log("")
log("══════════════════════════════════════════════════")
log("  ✓ MPC_WindowBlend")
log("  ✓ BP_CabinGameMode / BP_CabinPawn")
log("  ✓ BP_WindowSystem / BP_MealService")
log("  ✓ BP_SeatConsole / BP_TrayTable / BP_IFEScreen")
log("  ✓ SC_Master / SC_Ambience / SC_SFX / Mix_Cabin")
log("")
log("  NEXT: run cabin_build_cpp.py to fix C++ classes")
log("══════════════════════════════════════════════════")
