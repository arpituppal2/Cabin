// CabinBridge.Build.cs
// Compiled as a separate UE plugin module loaded PreDefault
// so the C ABI symbols are available before the game module starts.

using UnrealBuildTool;

public class CabinBridge : ModuleRules
{
    public CabinBridge(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        bEnableObjCExceptions = true;   // Required for Metal ObjC calls.

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "RenderCore",
            "RHI",
            "Renderer"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "RHICore"
        });

        if (Target.Platform == UnrealTargetPlatform.IOS ||
            Target.Platform == UnrealTargetPlatform.Mac)
        {
            PublicFrameworks.AddRange(new string[]
            {
                "Metal",
                "MetalKit",
                "QuartzCore",
                "CoreMotion"    // Gyroscope access on iOS.
            });

            PublicDefinitions.Add("CABIN_BRIDGE_APPLE=1");
        }
        else
        {
            PublicDefinitions.Add("CABIN_BRIDGE_APPLE=0");
        }
    }
}
