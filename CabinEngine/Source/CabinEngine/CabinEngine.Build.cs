// CabinEngine.Build.cs
// Unreal Build Tool module rules for the CabinEngine game module.
// Runs at build time to resolve all C++ dependencies.

using UnrealBuildTool;
using System.IO;

public class CabinEngine : ModuleRules
{
    public CabinEngine(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        CppStandard = CppStandardVersion.Cpp17;

        // Warn on all implicit conversions — keeps the C/Swift bridge types clean.
        bEnableUndefinedIdentifierWarnings = true;

        // ---------------------------------------------------------------------------
        // Public includes — exposed to dependent modules (e.g. CabinBridge plugin).
        // ---------------------------------------------------------------------------
        PublicIncludePaths.AddRange(new string[]
        {
            Path.Combine(ModuleDirectory, "Public")
        });

        PrivateIncludePaths.AddRange(new string[]
        {
            Path.Combine(ModuleDirectory, "Private")
        });

        // ---------------------------------------------------------------------------
        // Core engine dependencies.
        // ---------------------------------------------------------------------------
        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore",
            "EnhancedInput",    // UE5 Enhanced Input for gyro/touch axis mappings.
            "RHI",              // Render Hardware Interface — needed for texture bridge.
            "RenderCore",       // Render thread utilities.
            "Renderer",         // Access to FSceneRenderer for pass hooks.
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            // Audio.
            "AudioMixer",
            "SignalProcessing",
            "AudioExtensions",

            // Video plates for window views.
            "MediaAssets",
            "MediaUtils",

            // Niagara particle FX (engine haze, vent particles, cabin dust).
            "Niagara",
            "NiagaraCore",

            // Sequencer (takeoff, landing, break-walk cinematics).
            "LevelSequence",
            "MovieScene",
            "MovieSceneTracks",

            // Lumen / virtual shadow map access (for low-power mode cvar toggle).
            "Renderer",

            // Slate/UMG — session summary overlay widget.
            "Slate",
            "SlateCore",
            "UMG",

            // Platform.
            "ApplicationCore",
        });

        // ---------------------------------------------------------------------------
        // iOS-specific: Metal framework linkage.
        // ---------------------------------------------------------------------------
        if (Target.Platform == UnrealTargetPlatform.IOS ||
            Target.Platform == UnrealTargetPlatform.Mac)
        {
            PublicFrameworks.AddRange(new string[]
            {
                "Metal",
                "MetalKit",
                "CoreMotion",
                "AVFoundation",
                "QuartzCore",
            });

            // Allow Obj-C exceptions for Metal interop.
            bEnableObjCExceptions = true;
        }
    }
}
