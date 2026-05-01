// CabinEngine.Build.cs
// Core Cabin UE5 runtime module.

using UnrealBuildTool;

public class CabinEngine : ModuleRules
{
    public CabinEngine(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore",
            "EnhancedInput",
            "ApplicationCore",
            "RenderCore",
            "RHI",
            "UMG",
            "Slate",
            "SlateCore",
            "AudioMixer",
            "MetasoundEngine",
            "Niagara",
            "CinematicCamera",
            "MediaAssets",
            "Projects",
            "HeadMountedDisplay"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "DeveloperSettings",
            "SignalProcessing",
            "AudioExtensions",
            "EngineSettings",
            "MovieScene",
            "LevelSequence",
            "MovieSceneTracks",
            "CabinBridge"
        });

        if (Target.Platform == UnrealTargetPlatform.IOS || Target.Platform == UnrealTargetPlatform.Mac)
        {
            PublicFrameworks.AddRange(new string[]
            {
                "Metal",
                "MetalKit",
                "QuartzCore"
            });

            PublicDefinitions.Add("CABIN_PLATFORM_APPLE=1");
        }
        else
        {
            PublicDefinitions.Add("CABIN_PLATFORM_APPLE=0");
        }

        OptimizeCode = CodeOptimization.InShippingBuildsOnly;
        bEnableExceptions = false;
        bUseUnity = true;
    }
}
